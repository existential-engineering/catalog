import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import {
  type CollectionSchema,
  deleteStatements,
  insertStatements,
  reflectCollection,
} from "../generate-patch.js";

const SCHEMA_SQL = fs.readFileSync(path.join(import.meta.dirname, "..", "schema.sql"), "utf-8");

function emptyDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  return db;
}

/** A hardware entry deep enough to exercise every level of the table graph. */
function seedHardware(db: Database.Database, id: string, name: string): void {
  db.prepare(`INSERT INTO manufacturers (id, name) VALUES ('mfg1', 'Maker')`).run();
  db.prepare(
    `INSERT INTO hardware (id, name, manufacturer_id, primary_category, description)
     VALUES (?, ?, 'mfg1', 'pedal', '<p>A pedal.</p>')`
  ).run(id, name);
  db.prepare(`INSERT INTO hardware_categories (hardware_id, category) VALUES (?, 'effect')`).run(
    id
  );
  db.prepare(
    `INSERT INTO hardware_capabilities (hardware_id, capability) VALUES (?, 'reverb')`
  ).run(id);
  db.prepare(
    `INSERT INTO hardware_io (hardware_id, port_key, name, signal_flow, category, type, connection, max_connections)
     VALUES (?, 'in-1', 'Input', 'input', 'audio', 'instrument', '1/4-inch', 1)`
  ).run(id);
  db.prepare(
    `INSERT INTO hardware_prices (hardware_id, amount, currency) VALUES (?, 199, 'USD')`
  ).run(id);
  db.prepare(
    `INSERT INTO hardware_variants (hardware_id, name, slug) VALUES (?, 'Black', 'black')`
  ).run(id);
  db.prepare(
    `INSERT INTO hardware_variant_prices (variant_id, amount, currency)
     VALUES ((SELECT id FROM hardware_variants WHERE hardware_id = ? AND slug = 'black'), 219, 'USD')`
  ).run(id);
  db.prepare(
    `INSERT INTO hardware_fts (id, name, manufacturer_name, categories, description, search_terms)
     VALUES (?, ?, 'Maker', 'effect', 'A pedal.', '')`
  ).run(id, name);
}

describe("reflectCollection", () => {
  let db: Database.Database;
  let schema: CollectionSchema;

  beforeEach(() => {
    db = emptyDatabase();
    schema = reflectCollection(db, "hardware");
  });

  it("finds every child table the build writes, not a hand-maintained subset", () => {
    const names = schema.children.map((c) => c.name);
    // The drift this script existed to cause: io, prices, links and versions
    // were among the tables a patch silently left stale.
    expect(names).toEqual(
      expect.arrayContaining([
        "hardware_io",
        "hardware_prices",
        "hardware_links",
        "hardware_versions",
        "hardware_variants",
        "hardware_search_terms",
        "hardware_translations",
        "hardware_capabilities",
      ])
    );
  });

  it("nests a table that hangs off a child deeper than the child", () => {
    const variants = schema.children.find((c) => c.name === "hardware_variants")!;
    const variantPrices = schema.children.find((c) => c.name === "hardware_variant_prices")!;
    expect(variants.depth).toBe(1);
    expect(variantPrices.depth).toBe(2);
    expect(variantPrices.parent).toBe("hardware_variants");
  });

  it("omits ids SQLite assigns and keeps composite keys", () => {
    const prices = schema.children.find((c) => c.name === "hardware_prices")!;
    const categories = schema.children.find((c) => c.name === "hardware_categories")!;
    expect(prices.columns).not.toContain("id");
    expect(categories.columns).toEqual(["hardware_id", "category"]);
  });

  it("treats a cross-collection reference as owned by its own collection", () => {
    // content_hardware_compatibility references hardware, but content owns it.
    expect(schema.children.map((c) => c.name)).not.toContain("content_hardware_compatibility");
    const content = reflectCollection(db, "content");
    expect(content.children.map((c) => c.name)).toContain("content_hardware_compatibility");
  });

  it("picks up the collection's full-text table without its shadow tables", () => {
    expect(schema.fts?.name).toBe("hardware_fts");
    expect(schema.children.map((c) => c.name)).not.toContain("hardware_fts_data");
  });
});

describe("deleteStatements", () => {
  it("clears a nested table through its parent, deepest first", () => {
    const db = emptyDatabase();
    const schema = reflectCollection(db, "hardware");
    const sql = deleteStatements(schema, "hw1", true);

    const variantPrices = sql.findIndex((s) => s.includes('DELETE FROM "hardware_variant_prices"'));
    const variants = sql.findIndex((s) => s.includes('DELETE FROM "hardware_variants"'));
    expect(variantPrices).toBeLessThan(variants);
    expect(sql[variantPrices]).toContain('SELECT id FROM "hardware_variants"');
  });

  it("leaves the root row alone when the entry is being rewritten", () => {
    const db = emptyDatabase();
    const schema = reflectCollection(db, "hardware");
    // Another entry's supersedes_id may point at it, so it is upserted instead.
    expect(deleteStatements(schema, "hw1", false)).not.toContain(
      `DELETE FROM "hardware" WHERE id = 'hw1';`
    );
    expect(deleteStatements(schema, "hw1", true)).toContain(
      `DELETE FROM "hardware" WHERE id = 'hw1';`
    );
  });
});

describe("insertStatements", () => {
  it("returns null for an entry the built database does not have", () => {
    const db = emptyDatabase();
    const schema = reflectCollection(db, "hardware");
    expect(insertStatements(db, schema, "missing")).toBeNull();
  });

  it("resolves a nested row's parent by natural key, never by assigned id", () => {
    const built = emptyDatabase();
    seedHardware(built, "hw1", "Pedal");
    const schema = reflectCollection(built, "hardware");

    const price = insertStatements(built, schema, "hw1")!.find((s) =>
      s.includes('INSERT INTO "hardware_variant_prices"')
    )!;
    expect(price).toContain(
      `(SELECT id FROM "hardware_variants" WHERE "hardware_id" = 'hw1' AND "slug" = 'black')`
    );
  });

  it("reproduces the built rows in a database that numbers its ids differently", () => {
    const built = emptyDatabase();
    seedHardware(built, "hw1", "Pedal");
    const schema = reflectCollection(built, "hardware");

    // The target already holds another entry, so its variant ids do not line up
    // with the build's. This is the case that makes carrying ids across wrong.
    const target = emptyDatabase();
    seedHardware(target, "hw0", "Other");
    target.prepare(`INSERT INTO hardware (id, name) VALUES ('hw1', 'Stale')`).run();
    target
      .prepare(`INSERT INTO hardware_categories (hardware_id, category) VALUES ('hw1', 'gone')`)
      .run();

    const sql = [
      ...deleteStatements(schema, "hw1", false),
      ...insertStatements(built, schema, "hw1")!,
    ].join("\n");
    target.exec(sql);

    const rowsFor = (db: Database.Database, table: string, where: string) =>
      db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all();

    expect(rowsFor(target, "hardware", `id = 'hw1'`)).toEqual(
      rowsFor(built, "hardware", `id = 'hw1'`)
    );
    expect(rowsFor(target, "hardware_categories", `hardware_id = 'hw1'`)).toEqual([
      { hardware_id: "hw1", category: "effect" },
    ]);

    const variantPrice = target
      .prepare(
        `SELECT p.amount, v.slug FROM hardware_variant_prices p
         JOIN hardware_variants v ON v.id = p.variant_id
         WHERE v.hardware_id = 'hw1'`
      )
      .all();
    expect(variantPrice).toEqual([{ amount: 219, slug: "black" }]);

    // The untouched entry keeps its own rows.
    expect(
      rowsFor(
        target,
        "hardware_variant_prices",
        `variant_id IN (SELECT id FROM hardware_variants WHERE hardware_id = 'hw0')`
      )
    ).toHaveLength(1);
  });

  it("upserts the root row rather than replacing it, so inbound references survive", () => {
    const built = emptyDatabase();
    seedHardware(built, "hw1", "Pedal");
    const schema = reflectCollection(built, "hardware");

    const target = emptyDatabase();
    seedHardware(target, "hw1", "Stale");
    target.pragma("foreign_keys = ON");
    target
      .prepare(`INSERT INTO hardware (id, name, supersedes_id) VALUES ('hw2', 'Successor', 'hw1')`)
      .run();

    target.exec(
      [...deleteStatements(schema, "hw1", false), ...insertStatements(built, schema, "hw1")!].join(
        "\n"
      )
    );

    expect(target.prepare(`SELECT name FROM hardware WHERE id = 'hw1'`).get()).toEqual({
      name: "Pedal",
    });
    expect(target.prepare(`SELECT supersedes_id FROM hardware WHERE id = 'hw2'`).get()).toEqual({
      supersedes_id: "hw1",
    });
  });
});

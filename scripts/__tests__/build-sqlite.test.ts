import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildDatabase,
  CATALOG_SCHEMA_VERSION,
  markdownToHtml,
  normalizeCategory,
  normalizeIOConnection,
  normalizeIOPosition,
  normalizeIOSignalFlow,
} from "../build-sqlite.js";
import { getYamlFiles } from "../lib/utils.js";
import { COLLECTION_SCHEMAS, validateFile } from "../validate.js";

// Characterization tests (catalog#646). Everything downstream of the build
// (sha256, minisign, Sigstore) proves the file arrived intact; nothing
// proved it was built correctly. These pin the shape of the artifact Studio
// downloads, from a fixture tree small enough to read.

const FIXTURE_DIR = path.join(import.meta.dirname, "fixtures", "catalog");

describe("pure normalizers", () => {
  it("markdownToHtml renders markdown and returns null for nothing", () => {
    expect(markdownToHtml("A **bold** claim.")).toBe("<p>A <strong>bold</strong> claim.</p>");
    expect(markdownToHtml("- one\n- two")).toBe("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
    expect(markdownToHtml("")).toBeNull();
    expect(markdownToHtml(undefined)).toBeNull();
    expect(markdownToHtml(null)).toBeNull();
  });

  it("normalizeCategory maps an alias to its canonical value and passes the rest through", () => {
    expect(normalizeCategory("eq")).toBe("equalizer");
    expect(normalizeCategory("equalizer")).toBe("equalizer");
    expect(normalizeCategory("not-a-category")).toBe("not-a-category");
  });

  it("normalizeIOPosition and normalizeIOConnection pass canonical values through", () => {
    // Both alias maps in schema/ are empty today, so a value comes back
    // unchanged. When an alias is added there, add its mapping here.
    expect(normalizeIOPosition("Top")).toBe("Top");
    expect(normalizeIOConnection("1/4-inch")).toBe("1/4-inch");
  });

  it("normalizeIOSignalFlow flattens bidirectional to input and nothing else", () => {
    // Contract with pre-peer Studio builds, which read `signal_flow` raw
    // and cannot classify `bidirectional`. See the comment on the function.
    expect(normalizeIOSignalFlow("bidirectional")).toBe("input");
    expect(normalizeIOSignalFlow("input")).toBe("input");
    expect(normalizeIOSignalFlow("output")).toBe("output");
  });
});

describe("fixture tree", () => {
  it("validates against the real collection schemas, so the build tests a catalog pnpm validate accepts", () => {
    const manufacturers = new Set(
      getYamlFiles(path.join(FIXTURE_DIR, "manufacturers")).map((f) => path.basename(f, ".yaml"))
    );
    for (const [collection, schema] of Object.entries(COLLECTION_SCHEMAS)) {
      for (const file of getYamlFiles(path.join(FIXTURE_DIR, collection))) {
        expect(validateFile(file, schema, manufacturers), file).toBeNull();
      }
    }
  });
});

describe("buildDatabase", () => {
  let tmp: string;
  let db: Database.Database;
  let warnings: string[];

  const ids = {
    acme: "MFR00000000000000acme",
    holdings: "MFR0000000000holdings",
    host: "SW000000000000000host",
    verb: "SW000000000000000verb",
    verb2: "SW00000000000000verb2",
    presets: "CT0000000000000preset",
    box: "HW0000000000000000box",
    box2: "HW000000000000000box2",
    cable: "AC00000000000000cable",
  };

  const count = (table: string): number =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  const all = <T>(sql: string, ...params: unknown[]): T[] => db.prepare(sql).all(...params) as T[];

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-build-"));
    warnings = [];
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    });
    try {
      buildDatabase({
        dataDir: FIXTURE_DIR,
        outputFile: path.join(tmp, "nested", "catalog.sqlite"),
        version: "0.0.0-test",
      });
    } finally {
      log.mockRestore();
      warn.mockRestore();
    }
    db = new Database(path.join(tmp, "nested", "catalog.sqlite"), { readonly: true });
  });

  afterAll(() => {
    db?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("creates the output directory and writes the requested version", () => {
    const meta = Object.fromEntries(
      all<{ key: string; value: string }>("SELECT key, value FROM catalog_meta").map((r) => [
        r.key,
        r.value,
      ])
    );
    expect(meta.version).toBe("0.0.0-test");
    expect(meta.schema_version).toBe(CATALOG_SCHEMA_VERSION);
    expect(meta.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("inserts one row per fixture entry in each collection", () => {
    expect(count("manufacturers")).toBe(2);
    expect(count("software")).toBe(3);
    expect(count("content")).toBe(1);
    expect(count("hardware")).toBe(2);
    expect(count("accessories")).toBe(1);
  });

  it("populates every FTS table with exactly one row per base row", () => {
    // The single highest-value assertion here: the FTS inserts are separate
    // statements from the base inserts, so one skipped or mis-ordered call
    // still hashes, signs and ships, and search in Studio returns nothing.
    for (const table of ["manufacturers", "software", "content", "hardware", "accessories"]) {
      expect(count(`${table}_fts`), table).toBe(count(table));
    }
    expect(
      all<{ id: string }>("SELECT id FROM software_fts WHERE software_fts MATCH 'verb'")
    ).toEqual(expect.arrayContaining([{ id: ids.verb }, { id: ids.verb2 }]));
    expect(
      all<{ id: string }>("SELECT id FROM manufacturers_fts WHERE manufacturers_fts MATCH 'gmbh'")
    ).toEqual([{ id: ids.acme }]);
  });

  it("expands category aliases into the FTS search terms", () => {
    // acme-verb declares `eq`, which normalizes to `equalizer`; the inverse
    // alias map then puts every alias of equalizer back as a search term.
    const terms = all<{ term: string }>(
      "SELECT term FROM software_search_terms WHERE software_id = ? ORDER BY term",
      ids.verb
    ).map((r) => r.term);
    expect(terms).toEqual(expect.arrayContaining(["eq", "graphic-equalizer", "dynamic-eq"]));
    expect(
      all<{ id: string }>("SELECT id FROM software_fts WHERE software_fts MATCH 'eq'")
    ).toEqual([{ id: ids.verb }]);
  });

  it("normalizes categories and keeps them deduplicated", () => {
    expect(
      all<{ category: string }>(
        "SELECT category FROM software_categories WHERE software_id = ? ORDER BY category",
        ids.verb
      ).map((r) => r.category)
    ).toEqual(["equalizer", "plugin"]);
    // acme-box lists `effect` and `fx`; the alias collapses onto effect.
    expect(
      all<{ category: string }>(
        "SELECT category FROM hardware_categories WHERE hardware_id = ?",
        ids.box
      ).map((r) => r.category)
    ).toEqual(["effect"]);
    expect(warnings.some((w) => w.includes('Duplicate category "effect"'))).toBe(true);
  });

  it("renders markdown fields to HTML and keeps the FTS description as text", () => {
    const row = db
      .prepare("SELECT description, details, specs FROM software WHERE id = ?")
      .get(ids.verb) as { description: string; details: string; specs: string };
    expect(row.description).toBe("<p>A reverb that is also an EQ.</p>");
    expect(row.details).toBe("<p>First paragraph.</p>\n<p>Second paragraph.</p>");
    expect(row.specs).toBe("<ul>\n<li>12 algorithms</li>\n</ul>");
    const fts = db.prepare("SELECT description FROM software_fts WHERE id = ?").get(ids.verb) as {
      description: string;
    };
    expect(fts.description).toBe("A reverb that is also an EQ.");
  });

  it("resolves manufacturer references and parent companies to ids", () => {
    expect(db.prepare("SELECT manufacturer_id FROM software WHERE id = ?").get(ids.verb)).toEqual({
      manufacturer_id: ids.acme,
    });
    expect(
      db.prepare("SELECT parent_company_id, defunct FROM manufacturers WHERE id = ?").get(ids.acme)
    ).toEqual({ parent_company_id: ids.holdings, defunct: 0 });
  });

  it("resolves compatibility slugs to ids and warns on the ones it cannot", () => {
    expect(all("SELECT * FROM software_compatibility")).toEqual([
      { software_id: ids.verb, compatible_with_id: ids.host },
    ]);
    expect(all("SELECT * FROM content_compatibility")).toEqual([
      { content_id: ids.presets, compatible_with_id: ids.verb },
    ]);
    expect(all("SELECT * FROM content_hardware_compatibility")).toEqual([
      { content_id: ids.presets, compatible_with_id: ids.box },
    ]);
    expect(warnings.some((w) => w.includes('Unknown compatibility slug "no-such-host"'))).toBe(
      true
    );
  });

  it("carries supersedes lineage in both query directions", () => {
    expect(db.prepare("SELECT supersedes_id FROM software WHERE id = ?").get(ids.verb2)).toEqual({
      supersedes_id: ids.verb,
    });
    expect(all("SELECT id FROM hardware WHERE supersedes_id = ?", ids.box)).toEqual([
      { id: ids.box2 },
    ]);
    expect(db.prepare("SELECT supersedes_id FROM hardware WHERE id = ?").get(ids.box)).toEqual({
      supersedes_id: null,
    });
  });

  it("writes release dates, formats, platforms, versions, prices, links and videos", () => {
    expect(
      db
        .prepare("SELECT release_date, release_date_year_only FROM software WHERE id = ?")
        .get(ids.verb)
    ).toEqual({ release_date: "2020", release_date_year_only: 1 });
    expect(count("software_formats")).toBe(2);
    expect(count("software_platforms")).toBe(4);
    expect(
      all(
        "SELECT name, release_date_year_only, pre_release, url FROM software_versions WHERE software_id = ?",
        ids.verb
      )
    ).toEqual([
      {
        name: "2.0",
        release_date_year_only: 0,
        pre_release: 0,
        url: "https://acme.example/verb/2",
      },
      { name: "1.0", release_date_year_only: 1, pre_release: 1, url: null },
    ]);
    expect(
      all("SELECT amount, currency, term FROM software_prices WHERE software_id = ?", ids.verb)
    ).toEqual([
      { amount: 99, currency: "USD", term: "perpetual" },
      { amount: 9, currency: "USD", term: "monthly" },
    ]);
    expect(
      all("SELECT type, title, url FROM software_links WHERE software_id = ?", ids.verb)
    ).toEqual([{ type: "resource", title: "Manual", url: "https://acme.example/verb/manual" }]);
    expect(
      all("SELECT video_id, provider, title FROM software_videos WHERE software_id = ?", ids.verb)
    ).toEqual([
      { video_id: "abc123", provider: "youtube", title: "Demo" },
      { video_id: "1017281280", provider: "vimeo", title: null },
    ]);
    expect(all("SELECT amount, currency FROM content_prices")).toEqual([
      { amount: 19, currency: "EUR" },
    ]);
    expect(count("accessories_versions")).toBe(1);
    expect(all("SELECT amount, currency FROM accessories_prices")).toEqual([
      { amount: 12, currency: "GBP" },
    ]);
    expect(count("accessories_links")).toBe(1);
  });

  it("writes one io row per port, flattening signal_flow and keeping the raw value", () => {
    const io = all<Record<string, unknown>>(
      "SELECT port_key, name, signal_flow, signal_flow_raw, category, type, connection, connector_detail, max_connections, position, column_position, row_position FROM hardware_io WHERE hardware_id = ? ORDER BY port_key",
      ids.box
    );
    expect(io).toEqual([
      {
        port_key: "in000001",
        name: "Input",
        signal_flow: "input",
        signal_flow_raw: "input",
        category: "audio",
        type: "instrument",
        connection: "1/4-inch",
        connector_detail: '["TS"]',
        max_connections: 1,
        position: "Right",
        column_position: 1,
        row_position: 1,
      },
      {
        port_key: "usb00001",
        name: "USB",
        signal_flow: "input",
        signal_flow_raw: "bidirectional",
        category: "digital",
        type: "usb",
        connection: "usb-c",
        connector_detail: null,
        max_connections: 1,
        position: "Top",
        column_position: null,
        row_position: null,
      },
    ]);
  });

  it("writes capabilities as their own table", () => {
    expect(
      all<{ capability: string }>(
        "SELECT capability FROM hardware_capabilities WHERE hardware_id = ? ORDER BY capability",
        ids.box
      ).map((r) => r.capability)
    ).toEqual(["delay", "reverb"]);
  });

  it("attaches variant prices and links to the variant row, slugging a name when no slug is given", () => {
    const variants = all<{ id: number; name: string; slug: string }>(
      "SELECT id, name, slug FROM hardware_variants WHERE hardware_id = ? ORDER BY id",
      ids.box
    );
    expect(variants.map((v) => [v.name, v.slug])).toEqual([
      ["Black", "black"],
      ["Silver Edition", "silver"],
    ]);
    const [black, silver] = variants;
    expect(all("SELECT variant_id, amount, currency FROM hardware_variant_prices")).toEqual([
      { variant_id: black.id, amount: 219, currency: "USD" },
    ]);
    expect(all("SELECT variant_id, url FROM hardware_variant_links")).toEqual([
      { variant_id: silver.id, url: "https://acme.example/box/silver" },
    ]);
  });

  it("lands translations under approved locales only", () => {
    expect(all("SELECT locale, description FROM manufacturer_translations")).toEqual([
      { locale: "de", description: "<p>Boutique-Effekthersteller.</p>" },
    ]);
    expect(
      all(
        "SELECT locale, description, url FROM software_translations WHERE software_id = ?",
        ids.verb
      )
    ).toEqual([
      { locale: "de", description: "<p>Ein Hall.</p>", url: "https://acme.example/de/verb" },
    ]);
    expect(all("SELECT locale, title FROM software_links_localized")).toEqual([
      { locale: "es", title: "Manual de usuario" },
    ]);
    expect(all("SELECT locale, video_id FROM software_videos_localized")).toEqual([
      { locale: "es", video_id: "es456" },
    ]);
    expect(all("SELECT locale, specs FROM hardware_translations")).toEqual([
      { locale: "de", specs: "<ul>\n<li>Zwei Buchsen</li>\n</ul>" },
    ]);
  });

  it("translates io ports by original name and skips one the entry does not have", () => {
    expect(
      all("SELECT locale, original_name, translated_name FROM hardware_io_translations")
    ).toEqual([{ locale: "de", original_name: "Input", translated_name: "Eingang" }]);
    expect(warnings.some((w) => w.includes("references unknown I/O port 'Nope'"))).toBe(true);
  });

  it("seeds the locales table from schema/locales.yaml", () => {
    const codes = all<{ code: string }>("SELECT code FROM locales ORDER BY code").map(
      (r) => r.code
    );
    expect(codes).toContain("de");
    expect(codes).toContain("es");
    expect(codes).not.toContain("xx");
  });

  it("keeps declared search terms ahead of the derived ones", () => {
    const terms = all<{ term: string }>(
      "SELECT term FROM hardware_search_terms WHERE hardware_id = ?",
      ids.box
    ).map((r) => r.term);
    expect(terms[0]).toBe("The Box");
    expect(terms).toContain("acmebox");
  });
});

describe("buildDatabase failures", () => {
  it("refuses an entry with no id rather than building around it", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-build-noid-"));
    try {
      fs.mkdirSync(path.join(root, "data", "manufacturers"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "data", "manufacturers", "nameless.yaml"),
        "name: Nameless\nurl: https://nameless.example/\n"
      );
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        expect(() =>
          buildDatabase({
            dataDir: path.join(root, "data"),
            outputFile: path.join(root, "out.sqlite"),
            version: "0.0.0-test",
          })
        ).toThrow(/Missing id .*nameless\.yaml.*pnpm assign-ids/);
        // The handle is closed on the way out, so the same path builds again.
        expect(() =>
          buildDatabase({
            dataDir: FIXTURE_DIR,
            outputFile: path.join(root, "out.sqlite"),
            version: "0.0.0-test",
          })
        ).not.toThrow();
      } finally {
        log.mockRestore();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

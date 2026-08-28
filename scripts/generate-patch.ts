/**
 * Patch Generation Script
 *
 * Compares YAML changes since the last release and generates SQL patch files.
 * Run with: pnpm patch [from-version] [to-version] [--db <path>] [--skip-build]
 *
 * The statements are derived from a freshly built `catalog.sqlite` rather than
 * re-implemented from the YAML. `build-sqlite.ts` normalizes categories, renders
 * markdown to HTML, expands search-term synonyms, resolves `supersedes` and
 * writes some sixty tables; a second hand-written encoder of all that drifts
 * table by table, which is what this script used to be (it covered sixteen of
 * those tables, wrote raw markdown into HTML columns, and inserted unnormalized
 * category aliases). Reading rows back out of the built database keeps one
 * encoder, so a new child table or column is picked up here for free.
 *
 * Known limitation: a patch only rewrites the entries whose YAML changed.
 * Renaming a manufacturer leaves the denormalized `manufacturer_name` in the FTS
 * rows of its unchanged products stale, where a full rebuild would refresh them.
 * Ship a full database when manufacturer names move.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import Database from "better-sqlite3";
import { parse as parseYaml } from "yaml";

import type { Change } from "./lib/types.js";
import { DATA_DIR, escapeSQL, OUTPUT_DIR } from "./lib/utils.js";

const PATCHES_DIR = path.join(OUTPUT_DIR, "patches");
const DEFAULT_DB = path.join(OUTPUT_DIR, "catalog.sqlite");
const BUILD_SCRIPT = path.join(import.meta.dirname, "build-sqlite.ts");

/**
 * Collection root tables, and the prefixes their child tables carry.
 *
 * Ownership is by name prefix rather than by foreign key: `content_compatibility`
 * references both `content` and `software`, but only `content` owns it, and
 * `accessories.manufacturer_id` references `manufacturers` without making
 * accessories a child of it. Everything else about the shape (which column
 * carries the link, which tables nest a level deeper, what columns each has) is
 * read from the database.
 */
const COLLECTIONS: Record<Change["category"], { table: string; prefixes: string[] }> = {
  manufacturers: { table: "manufacturers", prefixes: ["manufacturers_", "manufacturer_"] },
  software: { table: "software", prefixes: ["software_"] },
  content: { table: "content", prefixes: ["content_"] },
  hardware: { table: "hardware", prefixes: ["hardware_"] },
  accessories: { table: "accessories", prefixes: ["accessories_"] },
};

/** Manufacturers must land before the products that reference them. */
const COLLECTION_ORDER: Change["category"][] = [
  "manufacturers",
  "software",
  "content",
  "hardware",
  "accessories",
];

/** FTS5 keeps its index in shadow tables that are not ours to write. */
const FTS_SHADOW_SUFFIX = /_(data|idx|content|docsize|config)$/;

// =============================================================================
// SQL HELPERS
// =============================================================================

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Render a value read back out of SQLite as a SQL literal. */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
  return escapeSQL(String(value));
}

function insertRow(table: string, columns: string[], values: string[]): string {
  return (
    `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) ` +
    `VALUES (${values.join(", ")});`
  );
}

// =============================================================================
// SCHEMA REFLECTION
// =============================================================================

interface ColumnInfo {
  name: string;
  pk: number;
  type: string;
}

export interface ChildTable {
  /** Table name. */
  name: string;
  /** Column on this table carrying the link to `parent`. */
  fkColumn: string;
  /** Table this one hangs off: the collection root, or another child. */
  parent: string;
  /** Columns to write, excluding any id SQLite assigns. */
  columns: string[];
  /** Distance from the root table (1 = direct child). */
  depth: number;
}

export interface CollectionSchema {
  root: string;
  rootColumns: string[];
  /** Root-level full-text table, if the collection has one. */
  fts: { name: string; columns: string[] } | null;
  /** Ordered parent-before-child. */
  children: ChildTable[];
  /**
   * Natural keys for tables that other tables reference by assigned id. A
   * patched database cannot reuse those ids, because a full build numbers them
   * globally and the target database has its own numbering; children look their
   * parent up by natural key instead.
   */
  naturalKeys: Map<string, string[]>;
}

/** True for an id SQLite assigns, which must be left out of an INSERT. */
function isAssignedPk(column: ColumnInfo, createSql: string): boolean {
  if (column.pk !== 1 || column.type.toUpperCase() !== "INTEGER") return false;
  // A composite primary key or a TEXT id is real data and has to be written.
  return new RegExp(`\\b${column.name}\\s+INTEGER\\s+PRIMARY\\s+KEY`, "i").test(createSql);
}

export function reflectCollection(
  db: Database.Database,
  category: Change["category"]
): CollectionSchema {
  const { table: root, prefixes } = COLLECTIONS[category];

  const objects = db
    .prepare(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
    .all() as { name: string; sql: string | null }[];

  const createSql = new Map(objects.map((o) => [o.name, o.sql ?? ""]));
  const isVirtual = (name: string) => /CREATE\s+VIRTUAL\s+TABLE/i.test(createSql.get(name) ?? "");

  const columnsOf = (table: string): ColumnInfo[] =>
    db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as ColumnInfo[];

  const writableColumns = (table: string): string[] => {
    const sql = createSql.get(table) ?? "";
    return columnsOf(table)
      .filter((c) => !isAssignedPk(c, sql))
      .map((c) => c.name);
  };

  const owned = objects
    .map((o) => o.name)
    .filter((name) => name !== root && prefixes.some((p) => name.startsWith(p)))
    .filter((name) => !FTS_SHADOW_SUFFIX.test(name));

  const ftsName = owned.find((name) => isVirtual(name)) ?? null;
  const fts = ftsName ? { name: ftsName, columns: columnsOf(ftsName).map((c) => c.name) } : null;

  // Walk outward from the root, so a table hanging off a child (variant links
  // off variants) is discovered after the child it depends on.
  const children: ChildTable[] = [];
  const placed = new Set<string>([root]);
  const candidates = owned.filter((name) => !isVirtual(name));

  for (let depth = 1; depth <= candidates.length; depth++) {
    // Only tables placed in earlier passes count as parents, or a table
    // discovered mid-pass would let its own child in at the same depth and the
    // delete order would depend on the order sqlite_master happens to list them.
    const reachable = new Set(placed);
    let added = false;
    for (const name of candidates) {
      if (placed.has(name)) continue;
      const fks = db.prepare(`PRAGMA foreign_key_list(${quoteIdent(name)})`).all() as {
        table: string;
        from: string;
      }[];
      const link = fks.find((fk) => reachable.has(fk.table) && fk.table !== name);
      if (!link) continue;
      children.push({
        name,
        fkColumn: link.from,
        parent: link.table,
        columns: writableColumns(name),
        depth,
      });
      placed.add(name);
      added = true;
    }
    if (!added) break;
  }

  const unreachable = candidates.filter((name) => !placed.has(name));
  if (unreachable.length > 0) {
    throw new Error(
      `Cannot patch ${root}: no foreign key path from ${unreachable.join(", ")}. ` +
        `Add one, or move the table out of the ${root} name prefix.`
    );
  }

  // A child keyed on something other than the root's text id needs its parent
  // resolved at apply time.
  const naturalKeys = new Map<string, string[]>();
  for (const child of children) {
    if (child.parent === root || naturalKeys.has(child.parent)) continue;
    const indexes = db.prepare(`PRAGMA index_list(${quoteIdent(child.parent)})`).all() as {
      name: string;
      unique: number;
    }[];
    const unique = indexes.find((i) => i.unique === 1);
    if (!unique) {
      throw new Error(
        `Cannot patch ${root}: ${child.name} references ${child.parent} by assigned id, ` +
          `but ${child.parent} has no unique index to resolve it by.`
      );
    }
    const cols = (
      db.prepare(`PRAGMA index_info(${quoteIdent(unique.name)})`).all() as { name: string }[]
    ).map((c) => c.name);
    naturalKeys.set(child.parent, cols);
  }

  return { root, rootColumns: writableColumns(root), fts, children, naturalKeys };
}

/** The column on `parent` that links it back toward the collection root. */
function linkToRoot(schema: CollectionSchema, parent: string): string {
  return schema.children.find((c) => c.name === parent)?.fkColumn ?? `${schema.root}_id`;
}

// =============================================================================
// GIT HELPERS
// =============================================================================

function getLatestTag(): string | null {
  try {
    return execFileSync("git", ["describe", "--tags", "--abbrev=0"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/** Read an entry's nanoid out of git history, for files no longer on disk. */
function getDeletedEntryId(since: string, filePath: string): string | null {
  try {
    const content = execFileSync("git", ["show", `${since}:${filePath}`], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return (parseYaml(content) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

function getChangedFiles(since: string): Change[] {
  const changes: Change[] = [];
  const output = execFileSync("git", ["diff", "--name-status", since, "HEAD", "--", "data/"], {
    encoding: "utf-8",
  });

  for (const line of output.split("\n").filter(Boolean)) {
    const [status, file] = line.split("\t");
    if (!file) continue;

    const parts = file.split("/");
    if (parts.length < 3) continue;

    const category = parts[1] as Change["category"];
    if (!(category in COLLECTIONS)) continue;
    if (!/\.ya?ml$/.test(parts[2])) continue;

    const type = status.startsWith("A")
      ? "added"
      : status.startsWith("M")
        ? "modified"
        : status.startsWith("D")
          ? "deleted"
          : null;
    if (!type) continue;

    changes.push({ type, category, file, slug: parts[2].replace(/\.ya?ml$/, "") });
  }

  return changes;
}

// =============================================================================
// STATEMENT GENERATION
// =============================================================================

/**
 * Remove an entry's rows, deepest table first.
 *
 * `includeRoot` is false for an entry being rewritten rather than removed:
 * another entry's `supersedes_id` may point at the root row, and dropping it
 * trips that foreign key even though the row is about to come straight back.
 * Such a row is upserted in place instead, so it never disappears.
 */
export function deleteStatements(
  schema: CollectionSchema,
  id: string,
  includeRoot: boolean
): string[] {
  const sql: string[] = [];

  for (const child of [...schema.children].sort((a, b) => b.depth - a.depth)) {
    if (child.parent === schema.root) {
      sql.push(
        `DELETE FROM ${quoteIdent(child.name)} WHERE ${quoteIdent(child.fkColumn)} = ${escapeSQL(id)};`
      );
    } else {
      sql.push(
        `DELETE FROM ${quoteIdent(child.name)} WHERE ${quoteIdent(child.fkColumn)} IN ` +
          `(SELECT id FROM ${quoteIdent(child.parent)} ` +
          `WHERE ${quoteIdent(linkToRoot(schema, child.parent))} = ${escapeSQL(id)});`
      );
    }
  }

  // Full-text tables carry no foreign keys, so they are always replaced whole.
  if (schema.fts) {
    sql.push(`DELETE FROM ${quoteIdent(schema.fts.name)} WHERE id = ${escapeSQL(id)};`);
  }
  if (includeRoot) {
    sql.push(`DELETE FROM ${quoteIdent(schema.root)} WHERE id = ${escapeSQL(id)};`);
  }
  return sql;
}

/** Re-create an entry from the freshly built database. */
export function insertStatements(
  db: Database.Database,
  schema: CollectionSchema,
  id: string
): string[] | null {
  const root = db.prepare(`SELECT * FROM ${quoteIdent(schema.root)} WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!root) return null;

  const assignments = schema.rootColumns
    .filter((c) => c !== "id")
    .map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`)
    .join(", ");

  const sql: string[] = [
    insertRow(
      schema.root,
      schema.rootColumns,
      schema.rootColumns.map((c) => sqlLiteral(root[c]))
    ).replace(/;$/, ` ON CONFLICT(id) DO UPDATE SET ${assignments};`),
  ];

  if (schema.fts) {
    const ftsRow = db
      .prepare(`SELECT * FROM ${quoteIdent(schema.fts.name)} WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (ftsRow) {
      sql.push(
        insertRow(
          schema.fts.name,
          schema.fts.columns,
          schema.fts.columns.map((c) => sqlLiteral(ftsRow[c]))
        )
      );
    }
  }

  for (const child of [...schema.children].sort((a, b) => a.depth - b.depth)) {
    const direct = child.parent === schema.root;
    const keys = direct ? [] : schema.naturalKeys.get(child.parent)!;

    const rows = direct
      ? (db
          .prepare(
            `SELECT * FROM ${quoteIdent(child.name)} WHERE ${quoteIdent(child.fkColumn)} = ?`
          )
          .all(id) as Record<string, unknown>[])
      : (db
          .prepare(
            `SELECT c.*, ${keys.map((k) => `p.${quoteIdent(k)} AS ${quoteIdent(`__key_${k}`)}`).join(", ")} ` +
              `FROM ${quoteIdent(child.name)} c ` +
              `JOIN ${quoteIdent(child.parent)} p ON p.id = c.${quoteIdent(child.fkColumn)} ` +
              `WHERE p.${quoteIdent(linkToRoot(schema, child.parent))} = ?`
          )
          .all(id) as Record<string, unknown>[]);

    for (const row of rows) {
      const values = child.columns.map((column) => {
        if (direct || column !== child.fkColumn) return sqlLiteral(row[column]);
        // The parent's id is assigned by whichever database applies this patch,
        // so resolve it there rather than baking in this build's numbering.
        const where = keys
          .map((k) => `${quoteIdent(k)} = ${sqlLiteral(row[`__key_${k}`])}`)
          .join(" AND ");
        return `(SELECT id FROM ${quoteIdent(child.parent)} WHERE ${where})`;
      });
      sql.push(insertRow(child.name, child.columns, values));
    }
  }

  return sql;
}

// =============================================================================
// MAIN
// =============================================================================

function readEntryId(category: Change["category"], slug: string): string | null {
  try {
    const file = path.join(DATA_DIR, category, `${slug}.yaml`);
    return (parseYaml(fs.readFileSync(file, "utf-8")) as { id?: string }).id ?? null;
  } catch {
    return null;
  }
}

function generatePatch(fromTag: string, toVersion: string, dbPath: string): void {
  const changes = getChangedFiles(fromTag);

  if (changes.length === 0) {
    console.log("No changes detected since last release.");
    return;
  }

  console.log(`\n📝 Generating patch ${fromTag} → ${toVersion}\n`);
  console.log(`   Found ${changes.length} changes\n`);

  const db = new Database(dbPath, { readonly: true });
  const schemas = new Map<Change["category"], CollectionSchema>(
    COLLECTION_ORDER.map((category) => [category, reflectCollection(db, category)])
  );

  const body: string[] = [];
  const failures: string[] = [];

  const ordered = [...changes].sort(
    (a, b) => COLLECTION_ORDER.indexOf(a.category) - COLLECTION_ORDER.indexOf(b.category)
  );

  for (const change of ordered) {
    const schema = schemas.get(change.category)!;
    const id =
      change.type === "deleted"
        ? getDeletedEntryId(fromTag, change.file)
        : readEntryId(change.category, change.slug);

    if (!id) {
      failures.push(`${change.category}/${change.slug}: could not resolve entry id`);
      continue;
    }

    const statements = deleteStatements(schema, id, change.type === "deleted");

    if (change.type !== "deleted") {
      const inserts = insertStatements(db, schema, id);
      if (!inserts) {
        failures.push(
          `${change.category}/${change.slug}: id ${id} is not in ${path.basename(dbPath)} ` +
            `(rebuild with 'pnpm build')`
        );
        continue;
      }
      statements.push(...inserts);
    }

    body.push(`-- ${change.type.toUpperCase()}: ${change.category}/${change.slug}`);
    body.push(...statements);
    body.push("");
  }

  if (failures.length > 0) {
    // Stamping a new version while silently dropping a change leaves a database
    // claiming content it does not have, so refuse to write the patch at all.
    console.error(`\n❌ Refusing to write a patch, ${failures.length} change(s) unresolved:\n`);
    for (const failure of failures) console.error(`   - ${failure}`);
    process.exitCode = 1;
    db.close();
    return;
  }

  const schemaVersion = (
    db.prepare(`SELECT value FROM catalog_meta WHERE key = 'schema_version'`).get() as
      | { value: string }
      | undefined
  )?.value;
  db.close();

  const sql: string[] = [
    `-- Catalog patch: ${fromTag} → ${toVersion}`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- Changes: ${changes.length}`,
    "",
    "BEGIN TRANSACTION;",
    "",
    ...body,
    "-- Update catalog version",
    `UPDATE catalog_meta SET value = ${escapeSQL(toVersion)} WHERE key = 'version';`,
    `UPDATE catalog_meta SET value = datetime('now') WHERE key = 'updated_at';`,
  ];

  if (schemaVersion) {
    sql.push(
      `INSERT INTO catalog_meta (key, value) VALUES ('schema_version', ${escapeSQL(schemaVersion)}) ` +
        `ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
    );
  }

  sql.push("", "COMMIT;");

  fs.mkdirSync(PATCHES_DIR, { recursive: true });
  const patchFile = path.join(PATCHES_DIR, `patch-${fromTag}-${toVersion}.sql`);
  fs.writeFileSync(patchFile, sql.join("\n"));

  const sizeKB = (fs.statSync(patchFile).size / 1024).toFixed(2);
  console.log(`✅ Patch generated!`);
  console.log(`   Output: ${patchFile}`);
  console.log(`   Size: ${sizeKB} KB`);
}

// =============================================================================
// CLI
// =============================================================================

function main(): void {
  const argv = process.argv.slice(2);
  const dbFlag = argv.indexOf("--db");
  const dbPath = dbFlag === -1 ? DEFAULT_DB : argv[dbFlag + 1];
  // An explicit database is one the caller vouches for, so do not overwrite it.
  const skipBuild = argv.includes("--skip-build") || dbFlag !== -1;
  const positional = argv.filter(
    (arg, i) => !arg.startsWith("--") && !(dbFlag !== -1 && i === dbFlag + 1)
  );

  const [fromArg, toArg] = positional;
  const fromTag = fromArg ?? getLatestTag();

  if (!fromTag) {
    console.log("No previous release found. Build a baseline first with: pnpm build");
  } else if (!dbPath) {
    console.error("❌ --db needs a path.");
    process.exitCode = 1;
  } else {
    if (!skipBuild) {
      // The statements are read out of the built database, so it has to be HEAD's.
      console.log("🔨 Building catalog database…");
      execFileSync("tsx", [BUILD_SCRIPT], { stdio: "inherit" });
    }
    if (!fs.existsSync(dbPath)) {
      console.error(`❌ ${dbPath} not found. Build it with 'pnpm build'.`);
      process.exitCode = 1;
    } else {
      generatePatch(fromTag, toArg ?? "next", dbPath);
    }
  }
}

// Importing this module (from tests) must not run a build.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}

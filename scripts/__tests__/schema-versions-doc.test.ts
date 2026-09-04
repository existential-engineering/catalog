/**
 * `docs/SCHEMA_VERSIONS.md` against the `schema_migrations` rows in
 * `scripts/schema.sql`.
 *
 * The doc is the compatibility contract consumers are told to read, and
 * nothing in the repo referenced it, so it drifted: it stopped at
 * "Version 10 (Current)" while the schema reached 22, hiding four
 * breaking changes and the `term` column of catalog#715 (AUREO-1081).
 * It had also mislabelled the v17 rename as a second "Version 8".
 *
 * This diffs the two so the next migration cannot land without its
 * entry. It checks the version set, the descriptions and the breaking
 * flags, which is the part a consumer acts on. Whether the `Changes`
 * bullets describe the migration well stays review-time judgement.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

interface Entry {
  version: number;
  description: string;
  breaking: boolean;
}

/**
 * The end of the SQL statement starting at `from`: the first `;` that is
 * not inside a quoted string. Two descriptions contain a semicolon, so a
 * `[^;]*` block matcher silently stops at version 16.
 */
function statementEnd(sql: string, from: number): number {
  let quoted = false;
  for (let i = from; i < sql.length; i++) {
    if (sql[i] === "'") quoted = !quoted;
    else if (sql[i] === ";" && !quoted) return i;
  }
  throw new Error("unterminated schema_migrations INSERT in scripts/schema.sql");
}

/** The `INSERT INTO schema_migrations` rows, the authority for this test. */
function migrationsFromSchema(): Entry[] {
  const sql = readFileSync(path.join(repoRoot, "scripts/schema.sql"), "utf8");
  const start = sql.search(/INSERT OR REPLACE INTO schema_migrations/);
  if (start === -1) throw new Error("no schema_migrations INSERT found in scripts/schema.sql");
  const block = sql.slice(start, statementEnd(sql, start));

  const rows = [...block.matchAll(/\(\s*(\d+)\s*,\s*'((?:[^']|'')*)'\s*,\s*([01])\s*\)/g)];
  return rows.map((m) => ({
    version: Number(m[1]),
    description: m[2].replace(/''/g, "'"),
    breaking: m[3] === "1",
  }));
}

/** The `### Version N` sections of the doc, in the order they appear. */
function entriesFromDoc(): Entry[] {
  const md = readFileSync(path.join(repoRoot, "docs/SCHEMA_VERSIONS.md"), "utf8");
  const history = md.slice(md.indexOf("## Version History"));

  const sections = [...history.matchAll(/^### Version (\d+)(?: \(Current\))?\s*$/gm)];
  return sections.map((section, i) => {
    const start = section.index;
    const end = i + 1 < sections.length ? sections[i + 1].index : history.length;
    const body = history.slice(start, end);

    const description = /\*\*Description:\*\*\s*(.+)/.exec(body)?.[1].trim();
    const breaking = /\*\*Breaking:\*\*\s*(Yes|No)/.exec(body)?.[1];
    if (!description) throw new Error(`Version ${section[1]} has no **Description:** line`);
    if (!breaking) throw new Error(`Version ${section[1]} has no **Breaking:** line`);

    return { version: Number(section[1]), description, breaking: breaking === "Yes" };
  });
}

describe("docs/SCHEMA_VERSIONS.md", () => {
  const schema = migrationsFromSchema();
  const doc = entriesFromDoc();

  it("documents every migration in scripts/schema.sql, and no others", () => {
    expect(doc.map((e) => e.version).sort((a, b) => a - b)).toEqual(
      schema.map((e) => e.version).sort((a, b) => a - b)
    );
  });

  it("lists versions newest first", () => {
    const versions = doc.map((e) => e.version);
    expect(versions).toEqual([...versions].sort((a, b) => b - a));
  });

  it("marks the highest version as (Current)", () => {
    const md = readFileSync(path.join(repoRoot, "docs/SCHEMA_VERSIONS.md"), "utf8");
    const highest = Math.max(...schema.map((e) => e.version));
    expect(md).toContain(`### Version ${highest} (Current)`);
    expect(md.match(/\(Current\)/g)).toHaveLength(1);
  });

  it("matches each migration's description and breaking flag", () => {
    const byVersion = new Map(doc.map((e) => [e.version, e]));
    for (const migration of schema) {
      expect(byVersion.get(migration.version)).toEqual(migration);
    }
  });
});

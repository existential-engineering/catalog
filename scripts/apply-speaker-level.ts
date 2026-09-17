#!/usr/bin/env tsx
/**
 * Apply Reviewed Speaker-Level Typings
 *
 * Retypes io ports that `pnpm speaker-level-audit` surfaced and a human
 * accepted. Input is the audit's own TSV with rejected rows deleted.
 *
 * WHY THERE IS NO BULK APPLY
 *
 * Same contract as `capability-gaps:apply`, and for the same reason: the
 * audit is a guess about what a port name means, so a human decides and
 * this only writes. The reviewed unit is the `slug<TAB>port` PAIR rather
 * than the slug, because an entry commonly has one speaker output that
 * should be retyped and one speaker-emulated output that must not be.
 *
 * WHAT IT REFUSES
 *
 * A row is data from a file someone edited by hand, so nothing in it is
 * trusted. An entry that cannot be read, a port the entry does not have, a
 * port already typed `speaker-level` and a name that no longer matches the
 * audit's own predicate are each skipped and reported. That last one is the
 * important one: it means the reviewed list cannot be widened after review
 * by editing a name, and a row that went stale because the entry changed
 * underneath it is refused rather than applied to whatever is there now.
 *
 * Usage:
 *   pnpm speaker-level:apply --rows reviewed.tsv           # dry run
 *   pnpm speaker-level:apply --rows reviewed.tsv --apply
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parseDocument } from "yaml";
import { checkContainedRegularFile, DATA_DIR } from "./lib/utils.js";
import { isSpeakerPort } from "./speaker-level-audit.js";

export interface Row {
  slug: string;
  port: string;
}

export interface Outcome {
  applied: number;
  skipped: { row: Row; reason: string }[];
}

/**
 * Parse `slug<TAB>port` lines, ignoring blanks and `#` comments.
 *
 * Extra columns are allowed and ignored, so the audit's four-column TSV can
 * be handed back unedited apart from deleted rows.
 */
export function parseRows(source: string): Row[] {
  const rows: Row[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [slug, port] = raw.split("\t");
    if (!slug?.trim() || !port?.trim()) continue;
    rows.push({ slug: slug.trim(), port: port.trim() });
  }
  return rows;
}

/**
 * Retype each reviewed port to `speaker-level`.
 *
 * Edits through `parseDocument` so comments, key order and formatting in
 * the rest of the entry survive untouched.
 */
export function applyRows(rows: Row[], dir: string, write: boolean): Outcome {
  const outcome: Outcome = { applied: 0, skipped: [] };
  const byslug = new Map<string, Row[]>();
  for (const row of rows) {
    byslug.set(row.slug, [...(byslug.get(row.slug) ?? []), row]);
  }

  for (const [slug, slugRows] of byslug) {
    // The slug comes from a reviewed file someone edited by hand, so the
    // path is checked before it is read and again before it is written
    // (CLAUDE.md: a read earlier in the run is not a statement about now).
    // The helper returns `{ path }` or `{ reason }` and never a boolean, so
    // it has to be read by its fields: `if (!check)` is always false and
    // leaves the guard inert, which is how the first cut of this let a
    // missing entry reach readFileSync.
    const candidate = checkContainedRegularFile(path.join(dir, `${slug}.yaml`), dir);
    if (candidate.reason !== undefined) {
      for (const row of slugRows) outcome.skipped.push({ row, reason: candidate.reason });
      continue;
    }
    const file = candidate.path;

    const doc = parseDocument(fs.readFileSync(file, "utf8"));
    const data = doc.toJSON() as { io?: { name?: string; type?: string }[] } | null;
    if (!Array.isArray(data?.io)) {
      for (const row of slugRows) outcome.skipped.push({ row, reason: "entry has no io" });
      continue;
    }

    // An entry can hold SEVERAL jacks with one name, which is correct here:
    // CLAUDE.md requires one io entry per physical jack, so a Marshall head
    // with two speaker jacks carries two ports both called "Speaker Output".
    // The reviewed list then holds one row per jack, and a plain findIndex
    // matches the first one every time: the first cut of this script
    // reported 227 ports applied while changing 217, having retyped ten
    // ports twice and their siblings never. Each row consumes the next
    // unclaimed match instead.
    const claimed = new Set<number>();
    let changed = false;
    for (const row of slugRows) {
      const index = data.io.findIndex((io, at) => io?.name === row.port && !claimed.has(at));
      if (index === -1) {
        outcome.skipped.push({ row, reason: "entry has no such port" });
        continue;
      }
      claimed.add(index);
      const port = data.io[index];
      if (port.type === "speaker-level") {
        outcome.skipped.push({ row, reason: "already speaker-level" });
        continue;
      }
      if (!isSpeakerPort(row.port)) {
        outcome.skipped.push({ row, reason: "name is not a passive-speaker port" });
        continue;
      }
      doc.setIn(["io", index, "type"], "speaker-level");
      outcome.applied++;
      changed = true;
    }

    if (changed && write) {
      const target = checkContainedRegularFile(file, dir);
      if (target.reason !== undefined) continue;
      fs.writeFileSync(target.path, doc.toString());
    }
  }

  return outcome;
}

function main(): void {
  const rowsIndex = process.argv.indexOf("--rows");
  if (rowsIndex === -1 || !process.argv[rowsIndex + 1]) {
    console.error("Usage: pnpm speaker-level:apply --rows <file> [--apply]");
    process.exit(1);
  }
  const write = process.argv.includes("--apply");
  const dir = path.join(DATA_DIR, "hardware");
  const rows = parseRows(fs.readFileSync(process.argv[rowsIndex + 1], "utf8"));
  const outcome = applyRows(rows, dir, write);

  console.log(`\n🔊 ${write ? "Applied" : "Would apply"}: ${outcome.applied} port(s)`);
  if (outcome.skipped.length > 0) {
    console.log(`   Skipped: ${outcome.skipped.length}`);
    for (const { row, reason } of outcome.skipped) {
      console.log(`     ${row.slug} / ${row.port}: ${reason}`);
    }
  }
  if (!write) console.log(`\n   Re-run with --apply to write.\n`);
  else console.log(`\n   Run 'pnpm format' and 'pnpm validate' next.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

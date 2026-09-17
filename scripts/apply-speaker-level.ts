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
 * port already typed `speaker-level` and a port the audit's own predicate no
 * longer accepts are each skipped and reported. That last one is the
 * important one: it means the reviewed list cannot be widened after review by
 * editing a name, a row that went stale because the entry changed underneath
 * it is refused rather than applied to whatever is there now, and the
 * connector and prose exclusions the audit applies are enforced a second time
 * at the point of writing.
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
import { entryProse, isPassiveSpeakerPort } from "./speaker-level-audit.js";

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
    const data = doc.toJSON() as {
      io?: { name?: string; type?: string; connection?: string }[];
      description?: string;
      details?: string;
      specs?: string;
    } | null;
    if (!Array.isArray(data?.io)) {
      for (const row of slugRows) outcome.skipped.push({ row, reason: "entry has no io" });
      continue;
    }
    const prose = entryProse(data);

    // An entry can hold SEVERAL jacks with one name, which is correct here:
    // CLAUDE.md requires one io entry per physical jack, so a Marshall head
    // with two speaker jacks carries two ports both called "Speaker Output".
    // The reviewed list then holds one row per jack, and a plain findIndex
    // matches the first one every time: the first cut of this script
    // reported 227 ports applied while changing 217, having retyped ten
    // ports twice and their siblings never. Each row consumes the next
    // unclaimed match instead, and prefers one that is still mistyped, or a
    // half-correct entry (one jack retyped by hand, its sibling not) would
    // claim the correct jack and leave the mistyped one alone.
    const claimed = new Set<number>();
    const changedHere: Row[] = [];
    for (const row of slugRows) {
      const matches = (io: { name?: string }, at: number) =>
        io?.name === row.port && !claimed.has(at);
      const index = data.io.findIndex((io, at) => matches(io, at) && io.type !== "speaker-level");
      if (index === -1) {
        const correct = data.io.findIndex(matches);
        outcome.skipped.push({
          row,
          reason: correct === -1 ? "entry has no such port" : "already speaker-level",
        });
        if (correct !== -1) claimed.add(correct);
        continue;
      }
      claimed.add(index);
      if (!isPassiveSpeakerPort(data.io[index], prose)) {
        outcome.skipped.push({ row, reason: "not a passive-speaker port" });
        continue;
      }
      doc.setIn(["io", index, "type"], "speaker-level");
      changedHere.push(row);
    }

    if (changedHere.length === 0) continue;
    if (!write) {
      outcome.applied += changedHere.length;
      continue;
    }

    // A row counts as applied only once its file is written. The first cut
    // incremented before this guard, so an entry that became unreadable
    // between the read and the write was reported as applied and was not.
    const target = checkContainedRegularFile(file, dir);
    if (target.reason !== undefined) {
      for (const row of changedHere) outcome.skipped.push({ row, reason: target.reason });
      continue;
    }
    fs.writeFileSync(target.path, doc.toString());
    outcome.applied += changedHere.length;
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
  // The review list is a path someone typed, so it goes through the same
  // guard as every other path this tooling did not choose (CLAUDE.md): a
  // symlink, a FIFO or a device would otherwise be read, and a FIFO never
  // reaches EOF.
  const rowsFile = checkContainedRegularFile(process.argv[rowsIndex + 1], process.cwd());
  if (rowsFile.reason !== undefined) {
    console.error(`Cannot read --rows file: ${rowsFile.reason}`);
    process.exit(1);
  }
  const rows = parseRows(fs.readFileSync(rowsFile.path, "utf8"));
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

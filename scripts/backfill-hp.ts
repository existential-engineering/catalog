#!/usr/bin/env tsx
/**
 * Backfill `hp` on modular hardware entries (AUREO-1110)
 *
 * `hp` is the panel width in Eurorack HP, the one number the faceplate node
 * needs to draw a module at scale. It is never guessed: a value comes from
 * the entry's own prose, or from a source a person looked at and wrote down.
 * This script is the reproducible half of that pass.
 *
 * PROSE PASS
 *
 * Most modular entries already say their width somewhere in `name`,
 * `description`, `details` or `specs` ("12HP", "Width: 8 HP", "occupies just
 * 4 HP"). Every such mention is collected; an entry whose mentions all agree
 * on one value gets it. An entry naming several widths (its own and an
 * expander's, a 3U and a 1U variant) is reported as ambiguous and left
 * alone, and one naming none is reported as unsourced with its `url` so the
 * page can be read. A mention that describes capacity rather than a panel
 * ("up to 84HP", "gives you 104HP of rack space") is ignored, which keeps a
 * case's row width from landing on the case as if it were a module.
 *
 * REVIEW LIST
 *
 * `--review <tsv>` takes `slug<TAB>hp<TAB>source` lines for widths read off
 * a maker page, manual or ModularGrid, and `slug<TAB>skip<TAB>reason` lines
 * for entries the prose pass would get wrong (a case whose one mention is
 * its row capacity) or that have no HP to give (a Buchla system, a desktop
 * unit filed under `modular`). A reviewed value wins over the prose, a skip
 * suppresses it. The list is committed under docs/reviews/ so the next pass
 * does not re-litigate the same entries; see capability-gaps for the same
 * contract.
 *
 * Usage:
 *   pnpm hp:backfill                                   # dry run, prose only
 *   pnpm hp:backfill --review docs/reviews/x.tsv       # dry run with the list
 *   pnpm hp:backfill --review docs/reviews/x.tsv --apply
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

// =============================================================================
// PROSE
// =============================================================================

/** "12HP", "12 HP", "12hp": one to three digits, optional space, the unit. */
const HP_MENTION = /\b(\d{1,3})\s?hp\b/gi;

/**
 * Phrases that make a mention a capacity, a limit or an estimate rather
 * than the panel width of the entry itself, checked against a short window
 * on the side of the match where they occur. "occupies 4 HP" and "16HP
 * module gives you" survive; "up to 84HP", "gives you 104HP", "approximately
 * 8 HP", "84HP 3U case" and "107HP Eurorack module capacity" do not.
 */
const NOT_A_WIDTH_BEFORE =
  /\b(up to|at least|gives you|room for|accommodat\w*|each at|approximately|spans?)\b[^.]*$|~\s*$/i;
const NOT_A_WIDTH_AFTER =
  /^\s*(\d?u?\s*(case|skiff)\b|of\s+(usable|useable|free|module)\s+space\b|of\s+(usable|useable|free)\b|(wide\s+)?per\s+row|total width)|^[^.]*\b(capacity|usable|useable|additional|free space|case space)\b/i;

const CONTEXT_BEFORE = 40;
const CONTEXT_AFTER = 32;

/**
 * Distinct HP values the text claims for the product described, in order of
 * first mention. Mentions that read as capacity are dropped before counting,
 * so a case with one capacity mention and no width comes back empty rather
 * than with its row width.
 */
export function extractProseHp(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(HP_MENTION)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const before = text.slice(Math.max(0, start - CONTEXT_BEFORE), start);
    const after = text.slice(end, end + CONTEXT_AFTER);
    if (NOT_A_WIDTH_BEFORE.test(before) || NOT_A_WIDTH_AFTER.test(after)) continue;
    const value = Number(match[1]);
    if (value > 0 && !values.includes(value)) values.push(value);
  }
  return values;
}

function proseOf(entry: Hardware): string {
  const flat = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join("\n") : (v ?? ""));
  return [entry.name ?? "", entry.description ?? "", flat(entry.details), flat(entry.specs)].join(
    "\n"
  );
}

// =============================================================================
// REVIEW LIST
// =============================================================================

export type ReviewEntry = { hp: number; source: string } | { skip: true; reason: string };

/**
 * Parse `slug<TAB>hp<TAB>source` and `slug<TAB>skip<TAB>reason` lines. Blank
 * lines and `#` comments are ignored. A width must be a positive integer,
 * because that is what the schema accepts, and every line needs its third
 * column: a value without a source is a guess with a paper trail.
 */
export function parseReview(text: string): Map<string, ReviewEntry> {
  const entries = new Map<string, ReviewEntry>();
  text.split("\n").forEach((raw, index) => {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) return;
    const [slug, value, ...rest] = line.split("\t").map((s) => s.trim());
    const note = rest.join(" ").trim();
    const where = `line ${index + 1}`;
    if (!slug || !value || !note) {
      throw new Error(`${where}: expected "slug<TAB>hp|skip<TAB>source or reason", got "${raw}"`);
    }
    if (entries.has(slug)) throw new Error(`${where}: ${slug} is listed twice`);
    if (value === "skip") {
      entries.set(slug, { skip: true, reason: note });
      return;
    }
    if (!/^[1-9]\d{0,2}$/.test(value)) {
      throw new Error(
        `${where}: hp for ${slug} must be a positive integer or "skip", got "${value}"`
      );
    }
    entries.set(slug, { hp: Number(value), source: note });
  });
  return entries;
}

// =============================================================================
// WRITE
// =============================================================================

/**
 * Insert `hp: N` after the `categories` block, or after `primaryCategory`
 * when the entry has no categories. Text insertion rather than a YAML
 * round-trip, matching apply-capability-gaps: a re-serialize reflows every
 * block scalar in the file and buries the one line that changed. Refuses a
 * file that already carries the key, and one whose categories are not the
 * two-space block sequence `pnpm format` writes.
 */
export function insertHp(source: string, hp: number): string {
  const lines = source.split("\n");
  if (lines.some((line) => /^hp:/.test(line))) {
    throw new Error("entry already carries hp");
  }
  const categories = lines.findIndex((line) => line.startsWith("categories:"));
  let at: number;
  if (categories !== -1) {
    if (lines[categories] !== "categories:") {
      throw new Error("categories is not a two-space block sequence; run pnpm format first");
    }
    at = categories + 1;
    while (at < lines.length && lines[at].startsWith("  - ")) at++;
  } else {
    const primary = lines.findIndex((line) => line.startsWith("primaryCategory:"));
    if (primary === -1) throw new Error("entry has neither categories nor primaryCategory");
    at = primary + 1;
  }
  lines.splice(at, 0, `hp: ${hp}`);
  return lines.join("\n");
}

// =============================================================================
// MAIN
// =============================================================================

function isModular(entry: Hardware): boolean {
  return (
    entry.primaryCategory === "modular" ||
    (Array.isArray(entry.categories) && entry.categories.includes("modular"))
  );
}

interface Decision {
  slug: string;
  file: string;
  entry: Hardware;
  proseValues: number[];
  outcome:
    | { kind: "prose"; hp: number }
    | { kind: "review"; hp: number; source: string }
    | { kind: "skip"; reason: string }
    | { kind: "ambiguous" }
    | { kind: "unsourced" };
}

function decide(review: Map<string, ReviewEntry>): Decision[] {
  const decisions: Decision[] = [];
  for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
    const entry = loadYamlFile<Hardware>(file);
    if (!isModular(entry) || entry.hp !== undefined) continue;
    const slug = path.basename(file, ".yaml");
    const proseValues = extractProseHp(proseOf(entry));
    const reviewed = review.get(slug);
    let outcome: Decision["outcome"];
    if (reviewed && "skip" in reviewed) outcome = { kind: "skip", reason: reviewed.reason };
    else if (reviewed) outcome = { kind: "review", hp: reviewed.hp, source: reviewed.source };
    else if (proseValues.length === 1) outcome = { kind: "prose", hp: proseValues[0] };
    else if (proseValues.length > 1) outcome = { kind: "ambiguous" };
    else outcome = { kind: "unsourced" };
    decisions.push({ slug, file, entry, proseValues, outcome });
  }
  return decisions;
}

function main(): void {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const reviewIndex = args.indexOf("--review");
  const reviewPath = reviewIndex === -1 ? undefined : args[reviewIndex + 1];
  if (reviewIndex !== -1 && !reviewPath) {
    console.error("--review needs a path");
    process.exit(2);
  }
  const review = reviewPath ? parseReview(fs.readFileSync(reviewPath, "utf-8")) : new Map();

  const decisions = decide(review);
  const unknownReview = [...review.keys()].filter((s) => !decisions.some((d) => d.slug === s));

  const by = (kind: Decision["outcome"]["kind"]) =>
    decisions.filter((d) => d.outcome.kind === kind);

  console.log("\n📏 hp backfill" + (apply ? "" : " (dry run)"));
  console.log("═".repeat(60));
  console.log(`  Modular entries without hp: ${decisions.length}`);
  console.log(`  From prose:                 ${by("prose").length}`);
  console.log(`  From review list:           ${by("review").length}`);
  console.log(`  Skipped by review list:     ${by("skip").length}`);
  console.log(`  Ambiguous prose:            ${by("ambiguous").length}`);
  console.log(`  Unsourced:                  ${by("unsourced").length}`);
  console.log();

  const section = (title: string, rows: Decision[], line: (d: Decision) => string) => {
    if (rows.length === 0) return;
    console.log(`${title} (${rows.length})`);
    console.log("─".repeat(40));
    for (const d of rows) console.log(`  ${line(d)}`);
    console.log();
  };
  section("✍️  From prose", by("prose"), (d) => `${d.slug}\t${d.proseValues[0]}`);
  section("📋 From review list", by("review"), (d) =>
    d.outcome.kind === "review" ? `${d.slug}\t${d.outcome.hp}\t${d.outcome.source}` : d.slug
  );
  section("⏭  Skipped", by("skip"), (d) =>
    d.outcome.kind === "skip" ? `${d.slug}\t${d.outcome.reason}` : d.slug
  );
  section(
    "❓ Ambiguous prose (several widths named; add a review line)",
    by("ambiguous"),
    (d) => `${d.slug}\t${d.proseValues.join(", ")}`
  );
  section("🔍 Unsourced (read the url, then add a review line)", by("unsourced"), (d) =>
    [d.slug, d.entry.primaryCategory ?? "", d.entry.url ?? "(no url)"].join("\t")
  );
  if (unknownReview.length > 0) {
    console.log(`⚠️  Review lines for entries that are not modular, or already carry hp:`);
    for (const slug of unknownReview) console.log(`  ${slug}`);
    console.log();
  }

  const writes = decisions.filter((d) => d.outcome.kind === "prose" || d.outcome.kind === "review");
  if (!apply) {
    console.log(`Dry run: ${writes.length} entries would gain hp. Re-run with --apply to write.`);
    return;
  }
  // Stage everything first so a refusal leaves no half-written pass behind.
  const staged = writes.map((d) => {
    const hp = d.outcome.kind === "prose" || d.outcome.kind === "review" ? d.outcome.hp : 0;
    return [d.file, insertHp(fs.readFileSync(d.file, "utf-8"), hp)] as const;
  });
  for (const [file, contents] of staged) fs.writeFileSync(file, contents, "utf-8");
  console.log(`Wrote hp on ${staged.length} entries. Run pnpm validate and pnpm format:check.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();

#!/usr/bin/env tsx
/**
 * Capability Gap Report
 *
 * `capabilities` records what a product does. Nothing writes it during import,
 * merge, or maintenance, so a list is only ever as current as the pass that
 * wrote it — the Eventide H90 carried no `granular` while its own `details`
 * described four granular algorithms and it linked a page titled "Eventide
 * Goes Granular". This reads each assessed entry's prose back against the
 * vocabulary and reports operations named there but absent from the list.
 *
 * SCOPE: entries that already carry `capabilities`. An entry with none is not
 * wrong, it is unassessed, which `pnpm capability-coverage` reports as such;
 * conflating the two is what makes an empty list unreadable. Populate those
 * with `pnpm derive-capabilities` first.
 *
 * TIERS mirror `discontinued:report`, for the same reason. Tier 1 (`auto`) is
 * a token that names an operation and nothing else, applied unreviewed by
 * `pnpm capability-gaps:apply`. Tier 2 (`review`) is a token that as easily
 * names a control, a spec, or a neighbouring product — a delay's tone control
 * is not `filter` in the sense the vocabulary means — and is curated by hand
 * into a file list. Never widen tier 1 to clear a backlog: a guessed
 * capability is indistinguishable from a verified one once written, which is
 * the whole reason this field has no aliases.
 *
 * Usage:
 *   pnpm capability-gaps                 # both tiers, grouped by entry
 *   pnpm capability-gaps --tier auto     # only the auto-applicable gaps
 *   pnpm capability-gaps --tier review   # only the ones needing a human
 *   pnpm capability-gaps --slug <slug>   # one entry, with excerpts
 *   pnpm capability-gaps --files         # bare slug list, for --files curation
 *   pnpm capability-gaps --json
 */

import path from "node:path";
import { type ProbeHit, type ProbeTier, probeProse } from "./lib/capability-probes.js";
import { type FindingInput, findingsDirArg, recordFindings } from "./lib/findings.js";
import { getCapabilitiesSet } from "./lib/schema-loader.js";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, REPO_ROOT } from "./lib/utils.js";

export interface GapRow {
  slug: string;
  /**
   * The entry's own `manufacturer:` slug, never the filename prefix: a
   * `dean-markley-*` file is not a Dean Guitars product.
   */
  manufacturer: string;
  name: string;
  primaryCategory: string;
  capabilities: string[];
  hits: ProbeHit[];
}

/**
 * Read every assessed hardware entry and probe its prose. Returns only entries
 * with at least one gap, so an empty result is the honest "nothing to do"
 * rather than a wall of clean rows.
 */
export function findGaps(tier?: ProbeTier): GapRow[] {
  const rows: GapRow[] = [];
  for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
    const data = loadYamlFile<Hardware>(file);
    if (!data.capabilities || data.capabilities.length === 0) continue;
    const prose = [data.description, data.details, data.specs]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join("\n");
    if (!prose) continue;
    const hits = probeProse(prose, new Set(data.capabilities)).filter(
      (hit) => !tier || hit.tier === tier
    );
    if (hits.length === 0) continue;
    rows.push({
      slug: path.basename(file, path.extname(file)),
      manufacturer: data.manufacturer ?? "",
      name: data.name,
      primaryCategory: data.primaryCategory ?? "(none)",
      capabilities: data.capabilities,
      hits,
    });
  }
  return rows;
}

/** Print one entry in full, excerpts included, for a `--slug` lookup. */
function reportOne(rows: GapRow[], slug: string): void {
  const row = rows.find((candidate) => candidate.slug === slug);
  if (!row) {
    console.log(`\n✅ No capability gaps found for '${slug}'.\n`);
    return;
  }
  console.log(`\n🔍 ${row.name} (${row.slug}, ${row.primaryCategory})`);
  console.log(`   carries: ${row.capabilities.join(", ")}\n`);
  for (const hit of row.hits) {
    console.log(`   [${hit.tier === "auto" ? "auto  " : "review"}] ${hit.capability}`);
    console.log(`            ${hit.excerpt}`);
  }
  console.log("");
}

/** Console summary: totals, most-missed values, then the worst entries. */
function report(rows: GapRow[]): void {
  const auto = rows.flatMap((row) => row.hits.filter((hit) => hit.tier === "auto"));
  const review = rows.flatMap((row) => row.hits.filter((hit) => hit.tier === "review"));

  console.log("\n🧭 Capability gaps (assessed entries whose prose names more)\n");
  console.log(`   entries with a gap:   ${rows.length}`);
  console.log(`   tier 1 (auto-apply):  ${auto.length}`);
  console.log(`   tier 2 (review):      ${review.length}\n`);

  const freq = new Map<string, number>();
  for (const hit of [...auto, ...review]) {
    freq.set(hit.capability, (freq.get(hit.capability) ?? 0) + 1);
  }
  console.log("   most-missed capabilities:");
  for (const [capability, count] of [...freq].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`     ${String(count).padStart(4)}  ${capability}`);
  }

  console.log("\n   entries with the most gaps:");
  for (const row of [...rows].sort((a, b) => b.hits.length - a.hits.length).slice(0, 15)) {
    const names = row.hits.map((hit) => `${hit.capability}${hit.tier === "review" ? "?" : ""}`);
    console.log(`     ${row.slug} (${row.primaryCategory}): ${names.join(", ")}`);
  }
  console.log("\n   '?' marks a tier-2 gap. Inspect one with --slug <slug>.\n");
}

/**
 * The inbox rows for a run's gaps, one per accepted **pair**.
 *
 * The pair is the reviewed unit and not the entry, for the reason
 * `capability-gaps:apply --pairs` takes pairs: an entry commonly has one
 * finding a person accepts and one they reject, and an issue per entry
 * cannot be closed by half.
 *
 * Tier 1 only. A tier-2 probe sits in the review tier because it was
 * measured to produce false positives that are not lexical: prose names
 * a sibling product ("the Mini platform that also spawned DITTO
 * LOOPER"), or a homonym (the Roland VP-550's "Mixed Chorus" is a choir
 * voice). Separating those needs a product index rather than a regex,
 * which is why the reviewed list exists and why this does not file them.
 */
export function toFindings(rows: GapRow[]): FindingInput[] {
  return rows.flatMap((row) =>
    row.hits
      .filter((hit) => hit.tier === "auto")
      .map((hit) => ({
        kind: "capability-gap" as const,
        brand: row.manufacturer || "catalog",
        key: `capability-gap:${row.slug}:${hit.capability}`,
        title: `\`${hit.capability}\` is missing from ${row.name}`,
        detail:
          `\`${row.slug}\` carries \`capabilities\` (${row.capabilities.join(", ")}) ` +
          `and its own prose describes \`${hit.capability}\`:\n\n> ${hit.excerpt}\n\n` +
          "Check the prose really claims the operation rather than denying it, " +
          "measuring it, or naming a sibling product, then accept the pair into a " +
          "reviewed list and apply with `pnpm capability-gaps:apply --pairs <file>`.",
        file: `data/hardware/${row.slug}.yaml`,
      }))
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const tierIndex = args.indexOf("--tier");
  const tierArg = tierIndex !== -1 ? args[tierIndex + 1] : undefined;
  // `--tier` with no value must fail rather than silently widening to both
  // tiers, which is the opposite of what the flag was reached for.
  if (tierIndex !== -1 && tierArg !== "auto" && tierArg !== "review") {
    console.error("\n❌ --tier takes 'auto' or 'review'.\n");
    process.exitCode = 1;
    return;
  }

  // A probe naming a value the vocabulary dropped would silently stop matching,
  // so fail loudly rather than under-report.
  const vocabulary = getCapabilitiesSet();
  const rows = findGaps(tierArg as ProbeTier | undefined);
  for (const row of rows) {
    for (const hit of row.hits) {
      if (!vocabulary.has(hit.capability)) {
        throw new Error(
          `Probe produces '${hit.capability}', which is not in schema/capabilities.yaml.`
        );
      }
    }
  }

  const dir = findingsDirArg(args, REPO_ROOT);
  if (dir) {
    const findingRows = toFindings(rows);
    const written = recordFindings(dir, findingRows);
    process.stderr.write(`findings: wrote ${written} of ${findingRows.length} to ${dir}\n`);
  }

  const slugIndex = args.indexOf("--slug");
  if (slugIndex !== -1) {
    const slug = args[slugIndex + 1];
    if (!slug) {
      console.error("\n❌ --slug requires a hardware slug.\n");
      process.exitCode = 1;
      return;
    }
    reportOne(rows, slug);
    return;
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (args.includes("--files")) {
    for (const row of rows) console.log(row.slug);
    return;
  }
  report(rows);
}

main();

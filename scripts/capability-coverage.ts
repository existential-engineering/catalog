#!/usr/bin/env tsx
/**
 * Capability Coverage & Neighbour Report
 *
 * `capabilities` (schema/capabilities.yaml) records what a product DOES, on a
 * single axis, so that two entries' lists are comparable. `categories` is not
 * comparable that way: it mixes lifecycle (`discontinued`), form factor
 * (`rack-mount`), technology (`analog`) and era (`vintage`) in with function,
 * so a shared value there is not evidence that two products overlap.
 *
 * This script reports two things:
 *
 *   1. Coverage — which primary categories have been assessed and which have
 *      not. `capabilities` is absent by default and rolls out per category,
 *      so "no capabilities" must stay readable as "not yet assessed" rather
 *      than "does nothing". Anything consuming this field needs to know which
 *      it is looking at.
 *   2. Neighbours — for one entry, the other entries whose capability set is
 *      closest, by Jaccard similarity. This is the query `primaryCategory`
 *      cannot answer: every member of a category is equidistant from every
 *      other, which is what makes a bucket match weak evidence of redundancy.
 *
 * Reports only, never exits non-zero: partial coverage is the expected state
 * during rollout, so failing on it would redden CI for work nobody has chosen
 * to do yet.
 *
 * Usage:
 *   pnpm capability-coverage                    # coverage by primary category
 *   pnpm capability-coverage --neighbours <slug>  # nearest entries to one product
 *   pnpm capability-coverage --limit 15         # neighbour rows (default 10)
 */

import path from "node:path";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

interface Entry {
  slug: string;
  name: string;
  primaryCategory: string;
  capabilities: Set<string>;
}

function loadHardware(): Entry[] {
  return getYamlFiles(path.join(DATA_DIR, "hardware")).map((file) => {
    const data = loadYamlFile<Hardware>(file);
    return {
      slug: path.basename(file, path.extname(file)),
      name: data.name,
      primaryCategory: data.primaryCategory ?? "(none)",
      capabilities: new Set(data.capabilities ?? []),
    };
  });
}

/**
 * Jaccard similarity: shared capabilities over the union. Chosen over raw
 * intersection size so a 20-capability workstation does not read as similar to
 * everything simply by having a long list.
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a) {
    if (b.has(value)) shared += 1;
  }
  return shared / (a.size + b.size - shared);
}

function reportCoverage(entries: Entry[]): void {
  const byCategory = new Map<string, { total: number; assessed: number }>();
  for (const entry of entries) {
    const row = byCategory.get(entry.primaryCategory) ?? { total: 0, assessed: 0 };
    row.total += 1;
    if (entry.capabilities.size > 0) row.assessed += 1;
    byCategory.set(entry.primaryCategory, row);
  }

  const assessed = [...byCategory.entries()]
    .filter(([, row]) => row.assessed > 0)
    .sort((a, b) => b[1].assessed - a[1].assessed);
  const totalAssessed = entries.filter((e) => e.capabilities.size > 0).length;

  console.log("\n📊 Capability coverage\n");
  console.log(
    `   ${totalAssessed} of ${entries.length} hardware entries assessed (${((100 * totalAssessed) / entries.length).toFixed(1)}%)\n`
  );

  if (assessed.length === 0) {
    console.log("   No entries carry capabilities yet.\n");
    return;
  }

  console.log("   Primary categories with coverage:");
  for (const [category, row] of assessed) {
    const pct = ((100 * row.assessed) / row.total).toFixed(0);
    const flag = row.assessed < row.total ? "  ← partial" : "";
    console.log(
      `     ${category.padEnd(24)} ${String(row.assessed).padStart(4)} / ${String(row.total).padEnd(4)} (${pct}%)${flag}`
    );
  }

  const untouched = [...byCategory.entries()]
    .filter(([, row]) => row.assessed === 0)
    .sort((a, b) => b[1].total - a[1].total);
  console.log(
    `\n   ${untouched.length} primary categories not yet assessed (largest: ${untouched
      .slice(0, 5)
      .map(([c, r]) => `${c} ${r.total}`)
      .join(", ")})\n`
  );
}

function reportNeighbours(entries: Entry[], slug: string, limit: number): void {
  const target = entries.find((e) => e.slug === slug);
  if (!target) {
    console.error(`\n❌ No hardware entry with slug '${slug}'.\n`);
    process.exitCode = 1;
    return;
  }
  if (target.capabilities.size === 0) {
    console.log(`\n⚠️  '${slug}' has no capabilities recorded, so it has no neighbours.\n`);
    return;
  }

  const scored = entries
    .filter((e) => e.slug !== slug && e.capabilities.size > 0)
    .map((e) => ({ entry: e, score: jaccard(target.capabilities, e.capabilities) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  console.log(`\n🔍 Nearest by capability: ${target.name} (${slug})`);
  console.log(`   capabilities: ${[...target.capabilities].sort().join(", ")}\n`);

  if (scored.length === 0) {
    console.log("   No other assessed entry shares a capability.\n");
    return;
  }

  for (const { entry, score } of scored.slice(0, limit)) {
    const shared = [...target.capabilities].filter((c) => entry.capabilities.has(c)).sort();
    console.log(
      `   ${score.toFixed(3)}  ${entry.name} (${entry.primaryCategory})\n            shared: ${shared.join(", ")}`
    );
  }
  const sameCategory = entries.filter(
    (e) => e.primaryCategory === target.primaryCategory && e.slug !== slug
  ).length;
  console.log(
    `\n   ${scored.length} entries share at least one capability; ` +
      `${sameCategory} share primaryCategory '${target.primaryCategory}'.\n`
  );
}

function main(): void {
  const args = process.argv.slice(2);
  const neighbourIndex = args.indexOf("--neighbours");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) || 10 : 10;

  const entries = loadHardware();

  if (neighbourIndex !== -1) {
    const slug = args[neighbourIndex + 1];
    if (!slug) {
      console.error("\n❌ --neighbours requires a hardware slug.\n");
      process.exitCode = 1;
      return;
    }
    reportNeighbours(entries, slug, limit);
    return;
  }

  reportCoverage(entries);
}

main();

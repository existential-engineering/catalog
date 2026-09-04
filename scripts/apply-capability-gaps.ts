#!/usr/bin/env tsx
/**
 * Apply Reviewed Capability Gaps
 *
 * Writes capabilities that `pnpm capability-gaps` surfaced and a human
 * accepted. Input is a list of `slug<TAB>capability` pairs, one per line —
 * never a slug alone, and there is deliberately no flag that applies a whole
 * tier.
 *
 * WHY THERE IS NO BULK APPLY
 *
 * The tier-1 probes were measured against the corpus at roughly 87% precision
 * before tightening, and the residue is not lexical: prose names a sibling
 * product ("the Mini platform that also spawned DITTO LOOPER"), or a homonym
 * (the Roland VP-550's "Mixed Chorus" is a choir voice, not the effect). No
 * regex separates those, and `capabilities` is the one field whose entire
 * value is that its claims are comparable — a wrong entry is not noise, it is
 * a false neighbour that survives every later query. `discontinued:apply`
 * gets a blanket `--signal` because "superseded" and "defunct manufacturer"
 * are facts about the graph; a probe is a guess about language, so it gets
 * the `--files` half of that tool's contract and nothing more.
 *
 * The pair, not the slug, is the reviewed unit: an entry commonly has one
 * accepted gap and one rejected, so accepting it wholesale would write the
 * rejection too.
 *
 * Usage:
 *   pnpm capability-gaps:apply --pairs reviewed.tsv           # dry run
 *   pnpm capability-gaps:apply --pairs reviewed.tsv --apply
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getCapabilitiesSet } from "./lib/schema-loader.js";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

interface Pair {
  slug: string;
  capability: string;
}

/** Parse `slug<TAB>capability` lines, ignoring blanks and `#` comments. */
export function parsePairs(source: string): Pair[] {
  const pairs: Pair[] = [];
  source.split("\n").forEach((raw, index) => {
    const line = raw.split("#")[0].trim();
    if (!line) return;
    const [slug, capability, ...rest] = line.split(/\s+/);
    if (!slug || !capability || rest.length > 0) {
      throw new Error(`line ${index + 1}: expected "slug<TAB>capability", got "${raw.trim()}"`);
    }
    pairs.push({ slug, capability });
  });
  return pairs;
}

/**
 * Append capabilities to an entry's existing block. The field is only ever
 * added to here — this tool corrects an under-described entry, and removing a
 * capability means someone decided the entry never performed it, which is a
 * different judgement that belongs in the file by hand.
 *
 * Text insertion rather than a YAML round-trip, matching
 * `derive-capabilities.ts`: a re-serialize reflows every block scalar in the
 * file and buries the one line that changed.
 */
export function appendCapabilities(source: string, additions: string[]): string {
  const lines = source.split("\n");
  const start = lines.indexOf("capabilities:");
  if (start === -1) throw new Error("entry has no capabilities block");
  let end = start + 1;
  while (end < lines.length && lines[end].startsWith("  - ")) end += 1;
  lines.splice(end, 0, ...additions.map((capability) => `  - ${capability}`));
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const pairsIndex = args.indexOf("--pairs");
  const pairsPath = pairsIndex !== -1 ? args[pairsIndex + 1] : undefined;
  if (!pairsPath) {
    console.error('\n❌ --pairs <file> is required (lines of "slug<TAB>capability").\n');
    process.exitCode = 1;
    return;
  }

  const vocabulary = getCapabilitiesSet();
  const pairs = parsePairs(fs.readFileSync(pairsPath, "utf-8"));

  const filesBySlug = new Map<string, string>();
  for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
    filesBySlug.set(path.basename(file, path.extname(file)), file);
  }

  const additions = new Map<string, string[]>();
  const problems: string[] = [];
  for (const { slug, capability } of pairs) {
    const file = filesBySlug.get(slug);
    if (!file) {
      problems.push(`${slug}: no such hardware entry`);
      continue;
    }
    if (!vocabulary.has(capability)) {
      problems.push(`${slug}: '${capability}' is not in schema/capabilities.yaml`);
      continue;
    }
    const data = loadYamlFile<Hardware>(file);
    if (!data.capabilities?.length) {
      problems.push(`${slug}: has no capabilities block; run derive-capabilities first`);
      continue;
    }
    if (data.capabilities.includes(capability)) continue;
    const list = additions.get(slug) ?? [];
    if (list.includes(capability)) continue;
    list.push(capability);
    additions.set(slug, list);
  }

  // Refuse the whole run rather than writing the good half: a partially
  // applied list cannot be re-run safely, because the reviewer cannot tell
  // which lines landed.
  if (problems.length > 0) {
    console.error(`\n❌ ${problems.length} unusable line(s):\n`);
    for (const problem of problems) console.error(`   ${problem}`);
    console.error("");
    process.exitCode = 1;
    return;
  }

  const total = [...additions.values()].reduce((sum, list) => sum + list.length, 0);
  console.log(`\n📝 Capability gaps${apply ? "" : " (dry run)"}\n`);
  console.log(`   entries:      ${additions.size}`);
  console.log(`   capabilities: ${total}\n`);
  for (const [slug, list] of additions) {
    console.log(`   ${slug} += ${list.join(", ")}`);
  }

  if (!apply) {
    console.log("\n   Re-run with --apply to write.\n");
    return;
  }
  for (const [slug, list] of additions) {
    const file = filesBySlug.get(slug) as string;
    fs.writeFileSync(file, appendCapabilities(fs.readFileSync(file, "utf-8"), list), "utf-8");
  }
  console.log(`\n   ✅ Wrote ${additions.size} files.\n`);
}

// Only run when invoked directly. The guard test imports parsePairs from this
// module, and without this an import would execute the script — writing files
// if the importing process happened to carry --pairs and --apply. Same guard,
// and same reason, as derive-capabilities.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

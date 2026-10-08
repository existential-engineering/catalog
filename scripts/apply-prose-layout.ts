#!/usr/bin/env tsx
/**
 * Apply the lossless prose layout fixes (AUREO-1192).
 *
 * Rewrites the `details` and `specs` that `pnpm prose-layout-audit` marks
 * fixable, and nothing else: one block per line becomes one paragraph per
 * line, `•` lines become `- ` items, a four-space-indented list comes back
 * to the margin, a list-less `specs` gets one item per line, entities
 * decode, and every value is written as a `|-` block. `fixSource` proves
 * each rewritten value keeps every word in order and that no other field
 * moved, and throws before writing when either fails.
 *
 * Dry run by default.
 *
 * Usage:
 *   pnpm prose-layout:apply                 # list what would change
 *   pnpm prose-layout:apply --write         # write it
 *   pnpm prose-layout:apply --write <file>  # only the named files
 */

import fs from "node:fs";
import path from "node:path";
import { fixSource } from "./lib/prose-layout.js";
import { checkContainedRegularFile, DATA_DIR, getYamlFiles } from "./lib/utils.js";

const COLLECTIONS = ["software", "hardware", "content", "accessories"] as const;

const args = process.argv.slice(2);
const write = args.includes("--write");
const named = args.filter((a) => !a.startsWith("--"));

const files = named.length
  ? named
  : COLLECTIONS.flatMap((c) => getYamlFiles(path.join(DATA_DIR, c)));

let changedFiles = 0;
let changedValues = 0;
for (const candidate of files) {
  const checked = checkContainedRegularFile(candidate, DATA_DIR);
  if (checked.path === undefined) {
    console.error(`skip ${candidate}: ${checked.reason}`);
    continue;
  }
  const src = fs.readFileSync(checked.path, "utf-8");
  const { text, changed } = fixSource(src);
  if (changed.length === 0) continue;
  changedFiles++;
  changedValues += changed.length;
  console.log(`${path.relative(DATA_DIR, checked.path)}\n  ${changed.join("\n  ")}`);
  if (write) {
    // Re-check immediately before the write: the read was not a statement about now.
    const again = checkContainedRegularFile(checked.path, DATA_DIR);
    if (again.path === undefined) {
      console.error(`skip ${candidate}: ${again.reason}`);
      continue;
    }
    fs.writeFileSync(again.path, text);
  }
}

console.log(
  `\n${write ? "Rewrote" : "Would rewrite"} ${changedValues} value(s) in ${changedFiles} file(s).` +
    (write ? "" : " Pass --write to apply.")
);

#!/usr/bin/env tsx
/**
 * JUCE Identifiers
 *
 * Print review rows for one catalog entry from an open-source plugin's
 * JUCE build file (a `CMakeLists.txt` calling `juce_add_plugin`, or a
 * `.jucer`). Append the rows to a TSV and apply them with
 * `pnpm identifiers:apply`.
 *
 * Usage:
 *   pnpm identifiers:from-juce --slug surge-xt --file /path/to/CMakeLists.txt
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import { extractJuceIdentifiers, juceRows } from "./lib/juce-identifiers.js";
import { rowsToTsv } from "./lib/open-audio-registry.js";

function main(): void {
  const { values } = parseArgs({
    options: { slug: { type: "string" }, file: { type: "string" } },
  });
  if (!values.slug || !values.file) {
    console.error(
      "Usage: tsx scripts/juce-identifiers.ts --slug <entry-slug> --file <CMakeLists.txt|.jucer>"
    );
    process.exit(1);
  }
  const info = extractJuceIdentifiers(fs.readFileSync(values.file, "utf-8"));
  if (!info) {
    console.error(`${values.file}: no juce_add_plugin call or JUCERPROJECT element found`);
    process.exit(1);
  }
  const rows = juceRows(values.slug, info, `juce:${values.file}`);
  if (info.manufacturerCode || info.pluginCode) {
    console.error(
      `# AU codes for ${values.slug}: manufacturer ${info.manufacturerCode ?? "?"}, plugin ${info.pluginCode ?? "?"} (no catalog field yet)`
    );
  }
  console.log(rowsToTsv(rows));
}

main();

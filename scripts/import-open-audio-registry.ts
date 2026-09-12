#!/usr/bin/env tsx
/**
 * Import Open Audio Stack Registry
 *
 * Reads the registry's static index, matches its packages to catalog
 * software entries, and writes two review files: the format and version
 * rows `pnpm identifiers:apply` takes, and the macOS download URLs the
 * racks installer-introspection lane can read bundle ids out of. The
 * registry carries no identifiers itself, so this script never writes an
 * entry; the rows go through the reviewed-TSV applier like every other
 * source.
 *
 * Usage:
 *   pnpm identifiers:from-registry --out registry.tsv --downloads downloads.tsv
 *   pnpm identifiers:from-registry --file index.json --out registry.tsv   # offline
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import {
  loadCatalogSoftware,
  matchRegistry,
  type Registry,
  rowsToTsv,
} from "./lib/open-audio-registry.js";
import { fetchPublic } from "./lib/url-guard.js";

export const REGISTRY_INDEX_URL =
  "https://open-audio-stack.github.io/open-audio-stack-registry/index.json";

/** The registry index, from a local file or fetched through the URL guard. */
async function loadRegistry(file: string | undefined): Promise<Registry> {
  if (file) {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as Registry;
  }
  const { response } = await fetchPublic(REGISTRY_INDEX_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`registry index returned ${response.status}`);
  }
  return (await response.json()) as Registry;
}

/** CLI entry: match the registry and write the review files. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      out: { type: "string" },
      downloads: { type: "string" },
    },
  });
  if (!values.out) {
    console.error(
      "Usage: tsx scripts/import-open-audio-registry.ts [--file index.json] --out rows.tsv [--downloads urls.tsv]"
    );
    process.exit(1);
  }

  const registry = await loadRegistry(values.file);
  const match = matchRegistry(registry, loadCatalogSoftware());

  const header = [
    "# Open Audio Stack registry, matched to catalog entries.",
    "# target<TAB>format<TAB>identifier<TAB>version<TAB>source; the registry carries no",
    "# identifiers, so every row adds a format and version only. Review, then:",
    "#   pnpm identifiers:apply --rows <this file> --write",
    "",
  ].join("\n");
  fs.writeFileSync(values.out, `${header}${rowsToTsv(match.rows)}\n`);
  console.log(`wrote ${match.rows.length} row(s) to ${values.out}`);

  if (values.downloads) {
    const lines = match.downloads.map((d) => `${d.slug}\t${d.url}`);
    fs.writeFileSync(values.downloads, `${lines.join("\n")}\n`);
    console.log(
      `wrote ${lines.length} macOS archive URL(s) to ${values.downloads} for the racks installer lane`
    );
  }

  if (match.unmatched.length > 0) {
    console.log(`\nNot in the catalog (${match.unmatched.length}), for a later import:`);
    for (const u of match.unmatched) {
      console.log(`  ${u.package}: ${u.author} ${u.name} ${u.url ?? ""}`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

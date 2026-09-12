#!/usr/bin/env tsx
/**
 * Apply Reviewed Identifiers
 *
 * Writes identifiers (and, optionally, versions) from a reviewed TSV onto
 * software entries. This is the hand-off point for every lane that reads
 * identifiers out of something a person then checks: the racks installer
 * introspection lane, the open-registry importer, or a list typed by hand.
 *
 * Input: `target<TAB>format<TAB>identifier[<TAB>version[<TAB>source]]`,
 * one per line, `#` comments and blank lines ignored. `target` is a
 * software entry's id or slug. Every row goes through the shared writer
 * (lib/identifier-writer.ts), so a local fallback, an invalid value, a
 * conflicting existing identifier, or a vendor segment naming another
 * maker is reported rather than written.
 *
 * Usage:
 *   pnpm identifiers:apply --rows reviewed.tsv           # dry run
 *   pnpm identifiers:apply --rows reviewed.tsv --write
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import {
  applyIdentifierRows,
  parseIdentifierRows,
  printApplySummary,
} from "./lib/identifier-writer.js";

/** CLI entry: parse the reviewed TSV and apply it through the writer. */
function main(): void {
  const { values } = parseArgs({
    options: {
      rows: { type: "string" },
      write: { type: "boolean", default: false },
    },
  });
  if (!values.rows) {
    console.error("Usage: tsx scripts/apply-identifiers.ts --rows reviewed.tsv [--write]");
    process.exit(1);
  }
  const rows = parseIdentifierRows(fs.readFileSync(values.rows, "utf-8"));
  const summary = applyIdentifierRows(rows, { write: values.write });
  printApplySummary(summary, values.write);
}

main();

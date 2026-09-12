#!/usr/bin/env tsx
/**
 * Add Telemetry Identifiers Script
 *
 * Writes the identifiers Studio observed behind name-based plugin matches
 * (`catalog_identifier_observed` events) onto the entries they matched.
 * The twin of add-telemetry-versions.ts: entries resolve by catalog id, so
 * no name matching is involved, and the write goes through the shared
 * identifier writer with its refusals.
 *
 * Input: JSON array of
 *   { software_id: string, software_name?: string, manufacturer?: string,
 *     format: string, identifier: string, devices: number,
 *     versions?: string[] }
 * produced by the racks repo's `scripts/telemetry/aggregate-identifiers.ts`
 * from the archived Aptabase CSV exports.
 *
 * A row is applied only when at least `--min-devices` distinct machines
 * reported the same pair (default 2). One machine's report is one
 * fuzzy match, and a fuzzy match is the thing this data is supposed to
 * replace; two machines agreeing on the same bundle id for the same
 * catalog entry is the scanner reading a fact off two installs. Rows
 * under the threshold are listed, not written, so a pair one report
 * short is visible for review.
 *
 * Every version the rows carry is offered beside the identifier and added
 * only when the entry lacks it, with the same coercion rule as the
 * versions script.
 *
 * Usage:
 *   tsx scripts/add-telemetry-identifiers.ts --input identifiers.json            # dry run
 *   tsx scripts/add-telemetry-identifiers.ts --input identifiers.json --write
 *   tsx scripts/add-telemetry-identifiers.ts --input identifiers.json --min-devices 3
 */

import fs from "node:fs";
import { parseArgs } from "node:util";
import {
  applyIdentifierRows,
  type IdentifierRow,
  printApplySummary,
} from "./lib/identifier-writer.js";

export interface TelemetryIdentifier {
  software_id: string;
  software_name?: string;
  manufacturer?: string;
  format: string;
  identifier: string;
  devices: number;
  versions?: string[];
}

export const DEFAULT_MIN_DEVICES = 2;

/**
 * Turn telemetry rows into writer rows, keeping only those enough
 * machines agree on. A row with several versions becomes one writer row
 * per version, so each is offered to `versions`; the identifier is the
 * same on all of them and the writer reports the repeats as `same`.
 */
export function selectTelemetryRows(
  entries: TelemetryIdentifier[],
  minDevices: number
): { rows: IdentifierRow[]; underThreshold: TelemetryIdentifier[] } {
  const rows: IdentifierRow[] = [];
  const underThreshold: TelemetryIdentifier[] = [];
  for (const entry of entries) {
    if (!Number.isFinite(entry.devices) || entry.devices < minDevices) {
      underThreshold.push(entry);
      continue;
    }
    const versions = entry.versions?.length ? entry.versions : [undefined];
    for (const version of versions) {
      rows.push({
        target: entry.software_id,
        format: entry.format,
        identifier: entry.identifier,
        ...(version ? { version } : {}),
        source: `telemetry:${entry.devices} devices`,
      });
    }
  }
  return { rows, underThreshold };
}

function main(): void {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      write: { type: "boolean", default: false },
      "min-devices": { type: "string", default: String(DEFAULT_MIN_DEVICES) },
    },
  });
  if (!values.input) {
    console.error(
      "Usage: tsx scripts/add-telemetry-identifiers.ts --input identifiers.json [--write] [--min-devices N]"
    );
    process.exit(1);
  }
  const minDevices = Number(values["min-devices"]);
  if (!Number.isInteger(minDevices) || minDevices < 1) {
    console.error(`--min-devices must be a positive integer, got "${values["min-devices"]}"`);
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(values.input, "utf-8")) as TelemetryIdentifier[];
  const { rows, underThreshold } = selectTelemetryRows(entries, minDevices);
  const summary = applyIdentifierRows(rows, { write: values.write });
  printApplySummary(summary, values.write);

  if (underThreshold.length > 0) {
    console.log(`\nUnder the ${minDevices}-device threshold (${underThreshold.length}):`);
    for (const entry of underThreshold) {
      console.log(
        `  ${entry.software_id} ${entry.format} ${entry.identifier} (${entry.devices} device(s), ${entry.manufacturer ?? "?"} ${entry.software_name ?? ""})`
      );
    }
  }
}

if (process.argv[1]?.endsWith("add-telemetry-identifiers.ts")) {
  main();
}

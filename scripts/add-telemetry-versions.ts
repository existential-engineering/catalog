/**
 * Add Telemetry Versions Script
 *
 * Adds missing software versions reported by Studio's catalog telemetry
 * (`catalog_version_not_found` events). Entries are resolved by catalog
 * id, so no name matching is involved.
 *
 * Input: JSON array of
 *   { software_id: string, software_name?: string, manufacturer?: string,
 *     versions: string[] }
 * aggregated from the Aptabase CSV exports (racks repo,
 * tools/reports/data/*-release.csv).
 *
 * A reported version is added only if the entry has no existing version
 * with the same name or the same coerced major.minor.patch — mirroring
 * Studio's pluginMatcher, which matches exact names first and falls back
 * to semver-coerced equality. New versions carry only `name` (telemetry
 * has no release dates) and are inserted newest-first to match the
 * existing convention. Versions that coerce to 0.0.0 or contain no
 * digits are skipped as scanner junk.
 *
 * IMPORTANT — curate the dry run before writing. A reported version that
 * is wildly inconsistent with the entry's line (e.g. Waves' 16.7.33 on a
 * non-Waves entry, or a 5.x on a product that never left 4.x) indicates a
 * Studio plugin mis-match, not a catalog gap. Adding it would bake wrong
 * data in AND silence the telemetry exposing the bad match. Drop those
 * rows from the input JSON and report them against the matcher instead.
 *
 * Usage:
 *   tsx scripts/add-telemetry-versions.ts --input versions.json          # dry run
 *   tsx scripts/add-telemetry-versions.ts --input versions.json --write
 */

import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

const COLLECTIONS = ["software", "content", "hardware", "accessories"];

interface TelemetryEntry {
  software_id: string;
  software_name?: string;
  manufacturer?: string;
  versions: string[];
}

interface VersionRecord {
  name: string;
  [key: string]: unknown;
}

/** Coerce a version string to [major, minor, patch], like semver.coerce. */
function coerce(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function coercedEqual(a: string, b: string): boolean {
  const ca = coerce(a);
  const cb = coerce(b);
  if (!ca || !cb) {
    return false;
  }
  return ca[0] === cb[0] && ca[1] === cb[1] && ca[2] === cb[2];
}

function isJunkVersion(version: string): boolean {
  const c = coerce(version);
  return !c || (c[0] === 0 && c[1] === 0 && c[2] === 0);
}

/** Descending compare of coerced versions; unparseable names sort last. */
function compareCoercedDesc(a: string, b: string): number {
  const ca = coerce(a);
  const cb = coerce(b);
  if (!ca || !cb) {
    return ca ? -1 : cb ? 1 : 0;
  }
  return cb[0] - ca[0] || cb[1] - ca[1] || cb[2] - ca[2];
}

function buildIdIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const collection of COLLECTIONS) {
    const dir = path.join(DATA_DIR, collection);
    if (!fs.existsSync(dir)) {
      continue;
    }
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
        continue;
      }
      const filePath = path.join(dir, file);
      const idMatch = fs.readFileSync(filePath, "utf-8").match(/^id:\s*(\S+)/m);
      if (idMatch) {
        index.set(idMatch[1], filePath);
      }
    }
  }
  return index;
}

function parseArgs(): { input: string; write: boolean } {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  if (!input) {
    console.error("Usage: tsx scripts/add-telemetry-versions.ts --input versions.json [--write]");
    process.exit(1);
  }
  return { input, write: args.includes("--write") };
}

function main(): void {
  const { input, write } = parseArgs();
  const entries = JSON.parse(fs.readFileSync(input, "utf-8")) as TelemetryEntry[];
  const index = buildIdIndex();

  let filesChanged = 0;
  let versionsAdded = 0;
  let skippedExisting = 0;
  const junk: string[] = [];
  const notFound: string[] = [];

  for (const entry of entries) {
    const filePath = index.get(entry.software_id);
    if (!filePath) {
      notFound.push(`${entry.software_id} (${entry.manufacturer} ${entry.software_name})`);
      continue;
    }

    const doc = parseDocument(fs.readFileSync(filePath, "utf-8"));
    const existing = (doc.get("versions") as unknown as VersionRecord[] | undefined)
      ? ((doc.toJSON() as { versions?: VersionRecord[] }).versions ?? [])
      : [];
    const existingNames = existing.map((v) => String(v.name));

    const toAdd: string[] = [];
    for (const version of entry.versions) {
      if (isJunkVersion(version)) {
        junk.push(`${entry.manufacturer} ${entry.software_name}: ${version}`);
        continue;
      }
      const isDupe = (names: string[]) =>
        names.some((n) => n === version || coercedEqual(n, version));
      if (isDupe(existingNames) || isDupe(toAdd)) {
        skippedExisting++;
        continue;
      }
      toAdd.push(version);
    }
    if (toAdd.length === 0) {
      continue;
    }

    // Insert newest-first without reordering existing entries.
    const merged: VersionRecord[] = [...existing];
    for (const version of toAdd.sort(compareCoercedDesc)) {
      const insertAt = merged.findIndex((v) => compareCoercedDesc(version, String(v.name)) < 0);
      merged.splice(insertAt < 0 ? merged.length : insertAt, 0, { name: version });
    }

    doc.set("versions", merged);
    filesChanged++;
    versionsAdded += toAdd.length;
    const relative = path.relative(REPO_ROOT, filePath);
    console.log(`${write ? "updated" : "would update"} ${relative}: +${toAdd.join(", +")}`);

    if (write) {
      fs.writeFileSync(filePath, doc.toString());
    }
  }

  console.log(
    `\n${write ? "Applied" : "Dry run"}: ${versionsAdded} versions across ${filesChanged} files; ` +
      `${skippedExisting} already present, ${junk.length} junk, ${notFound.length} ids not found`
  );
  for (const j of junk) {
    console.log(`  junk: ${j}`);
  }
  for (const n of notFound) {
    console.log(`  not found: ${n}`);
  }
  if (!write && filesChanged > 0) {
    console.log("\nRe-run with --write to apply, then run: pnpm format && pnpm validate");
  }
}

main();

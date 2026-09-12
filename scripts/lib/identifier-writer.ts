/**
 * Identifier Writer
 *
 * The one place an observed plugin identifier is written into a software
 * entry, whichever lane observed it: Studio telemetry
 * (`add-telemetry-identifiers.ts`), a reviewed TSV
 * (`apply-identifiers.ts`), an installer read by the racks introspection
 * lane, or an open registry. Three producers, one set of refusals, so a
 * rule added here holds for all of them.
 *
 * What it refuses, and why each refusal is a report rather than a write:
 *
 * - A `local.*` or empty identifier is the scanner's fallback for a bundle
 *   with no id. It names the plugin on one machine and nowhere else.
 * - An identifier that fails the format's pattern (identifier-validation)
 *   is a scanner or transcription error, not a fact about the plugin.
 * - A format the entry already resolves to a different identifier is a
 *   conflict for a person: the existing value may be a per-format override
 *   or a mis-match the telemetry is now exposing (AUREO-696), and the
 *   writer cannot tell which.
 * - A reverse-domain identifier whose vendor segment names nobody like the
 *   entry's manufacturer is the mis-match signal itself. `com.waves.X`
 *   observed against a Softube entry means Studio matched the wrong
 *   product, and writing it would bake the mis-match in while silencing
 *   the telemetry that exposed it.
 *
 * A format the entry does not list is added when its identifier is, because
 * the build only writes `software_formats` rows for listed formats and an
 * identifier on an unlisted one reaches nothing.
 */

import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { resolveFormatIdentifier } from "./identifier-fallback.js";
import { validateIdentifier } from "./identifier-validation.js";
import { isValidFormat } from "./schema-loader.js";
import { DATA_DIR, getYamlFiles } from "./utils.js";
import { insertVersion, isJunkVersion, type VersionRecord } from "./version-names.js";

export interface IdentifierRow {
  /** A software entry's id or its slug (filename stem). */
  target: string;
  /** A plugin format from schema/formats.yaml. */
  format: string;
  /**
   * Absent (`-` in a TSV) when the source knows the format and version but
   * no identifier, as an open registry does: the row then adds only those.
   */
  identifier?: string;
  /** An observed version to add beside the identifier, if any. */
  version?: string;
  /** Where the row came from, for the report only. */
  source?: string;
}

export type OutcomeKind =
  | "written"
  | "same"
  | "conflict"
  | "skipped"
  | "not-found"
  | "unsupported-format";

export interface RowOutcome {
  row: IdentifierRow;
  kind: OutcomeKind;
  /** Relative YAML path, when the target resolved. */
  file?: string;
  /** What was written or why nothing was. */
  detail: string;
  /** True when a `formats` entry was added beside the identifier. */
  formatAdded?: boolean;
  /** True when the row's version was added to `versions`. */
  versionAdded?: boolean;
}

export interface ApplySummary {
  outcomes: RowOutcome[];
  filesChanged: number;
}

interface SoftwareTarget {
  file: string;
  slug: string;
}

interface SoftwareIndex {
  byId: Map<string, SoftwareTarget>;
  bySlug: Map<string, SoftwareTarget>;
}

/** True for an identifier the scanner made up rather than read. */
export function isLocalIdentifier(identifier: string): boolean {
  const trimmed = identifier.trim();
  return trimmed === "" || trimmed.startsWith("local.");
}

/** Letters and digits only, lowercased, for a tolerant vendor comparison. */
function alnum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** A reverse-domain identifier: at least two dot-separated segments, no hex CID. */
function isReverseDomain(identifier: string): boolean {
  return identifier.includes(".") && !/^[0-9a-f]{32}$/i.test(identifier);
}

/**
 * Whether a reverse-domain identifier plausibly belongs to the manufacturer.
 * Every segment between the TLD and the product name is a vendor
 * candidate (`com.fabfilter.Pro-Q`, `uk.co.acme.Verb`, `de.u-he.Diva`), and
 * one of them has to be contained in the manufacturer's slug or display
 * name, or contain it, once both are reduced to letters and digits. A
 * two-segment id (`vendor.Product`) is judged on its first segment.
 *
 * Deliberately tolerant: it exists to catch `com.waves` on a Softube
 * entry, not to demand that a vendor spell its own name one way.
 */
export function vendorSegmentMatches(
  identifier: string,
  manufacturerSlug: string,
  manufacturerName: string
): boolean {
  const segments = identifier.split(".").filter(Boolean);
  const candidates = segments.length >= 3 ? segments.slice(1, -1) : segments.slice(0, 1);
  const names = [alnum(manufacturerSlug), alnum(manufacturerName)].filter((n) => n.length >= 3);
  if (names.length === 0) {
    return true;
  }
  return candidates.some((segment) => {
    const s = alnum(segment);
    if (s.length < 3) {
      return false;
    }
    return names.some((n) => n.includes(s) || s.includes(n));
  });
}

function buildSoftwareIndex(dataDir: string): SoftwareIndex {
  const byId = new Map<string, SoftwareTarget>();
  const bySlug = new Map<string, SoftwareTarget>();
  const dir = path.join(dataDir, "software");
  for (const file of getYamlFiles(dir)) {
    const slug = path.basename(file).replace(/\.ya?ml$/, "");
    const target = { file, slug };
    bySlug.set(slug, target);
    const idMatch = fs.readFileSync(file, "utf-8").match(/^id:\s*(\S+)/m);
    if (idMatch) {
      byId.set(idMatch[1], target);
    }
  }
  return { byId, bySlug };
}

function manufacturerName(dataDir: string, slug: string): string {
  const file = path.join(dataDir, "manufacturers", `${slug}.yaml`);
  if (!fs.existsSync(file)) {
    return "";
  }
  const match = fs.readFileSync(file, "utf-8").match(/^name:\s*(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

interface EntryShape {
  manufacturer?: string;
  formats?: string[];
  identifiers?: Record<string, string>;
  versions?: VersionRecord[];
}

/**
 * Apply rows to the software entries under `dataDir`. Every row gets an
 * outcome, and the file is written only with `write`. Rows for one file
 * are applied in order against the same document, so two formats
 * observed for one entry land in one write.
 */
export function applyIdentifierRows(
  rows: IdentifierRow[],
  options: { write: boolean; dataDir?: string }
): ApplySummary {
  const dataDir = options.dataDir ?? DATA_DIR;
  const index = buildSoftwareIndex(dataDir);
  const docs = new Map<string, ReturnType<typeof parseDocument>>();
  const changed = new Set<string>();
  const outcomes: RowOutcome[] = [];

  for (const row of rows) {
    const target = index.byId.get(row.target) ?? index.bySlug.get(row.target);
    if (!target) {
      outcomes.push({ row, kind: "not-found", detail: `no software entry for ${row.target}` });
      continue;
    }
    const file = path.relative(dataDir, target.file);

    if (!isValidFormat(row.format) || row.format === "standalone") {
      outcomes.push({
        row,
        kind: "unsupported-format",
        file,
        detail: `${row.format} is not an identifier-bearing format in schema/formats.yaml`,
      });
      continue;
    }
    const identifier = row.identifier;
    if (identifier !== undefined) {
      if (isLocalIdentifier(identifier)) {
        outcomes.push({ row, kind: "skipped", file, detail: "local fallback identifier" });
        continue;
      }
      const valid = validateIdentifier(row.format, identifier);
      if (!valid.valid) {
        outcomes.push({ row, kind: "skipped", file, detail: valid.error ?? "invalid identifier" });
        continue;
      }
    }

    let doc = docs.get(target.file);
    if (!doc) {
      doc = parseDocument(fs.readFileSync(target.file, "utf-8"));
      docs.set(target.file, doc);
    }
    const entry = doc.toJSON() as EntryShape;
    const slug = entry.manufacturer ?? "";
    if (identifier !== undefined && isReverseDomain(identifier)) {
      const name = manufacturerName(dataDir, slug);
      if (!vendorSegmentMatches(identifier, slug, name)) {
        outcomes.push({
          row,
          kind: "conflict",
          file,
          detail: `vendor segment of ${identifier} does not match manufacturer ${slug}`,
        });
        continue;
      }
    }

    const existing = resolveFormatIdentifier(entry.identifiers, row.format);
    let kind: OutcomeKind = "same";
    let detail =
      identifier === undefined
        ? `${row.format} already listed`
        : `${row.format} already resolves to ${identifier}`;
    if (identifier !== undefined && existing && existing !== identifier) {
      outcomes.push({
        row,
        kind: "conflict",
        file,
        detail: `${row.format} already resolves to ${existing}, observed ${identifier}`,
      });
      continue;
    }

    let formatAdded = false;
    let versionAdded = false;
    if (identifier !== undefined && !existing) {
      const identifiers = { ...(entry.identifiers ?? {}), [row.format]: identifier };
      doc.set("identifiers", identifiers);
      kind = "written";
      detail = `${row.format}: ${identifier}`;
    }
    const formats = entry.formats ?? [];
    if (!formats.includes(row.format)) {
      doc.set("formats", [...formats, row.format]);
      formatAdded = true;
      kind = "written";
      detail += ` (added ${row.format} to formats)`;
    }
    if (row.version && !isJunkVersion(row.version)) {
      const merged = insertVersion(entry.versions ?? [], row.version);
      if (merged) {
        doc.set("versions", merged);
        versionAdded = true;
        kind = "written";
        detail += ` (added version ${row.version})`;
      }
    }

    if (kind === "written") {
      changed.add(target.file);
    }
    outcomes.push({ row, kind, file, detail, formatAdded, versionAdded });
  }

  if (options.write) {
    for (const file of changed) {
      const doc = docs.get(file);
      if (doc) {
        fs.writeFileSync(file, doc.toString());
      }
    }
  }

  return { outcomes, filesChanged: changed.size };
}

/**
 * Parse a reviewed TSV: `target<TAB>format<TAB>identifier[<TAB>version[<TAB>source]]`,
 * blank lines and `#` comments ignored, `-` for an identifier the source
 * does not know (the row then carries a format or version alone). A line with fewer than three
 * columns is an error, not a skip, because a silently dropped row reads
 * as reviewed and declined.
 */
export function parseIdentifierRows(text: string): IdentifierRow[] {
  const rows: IdentifierRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const [target, format, identifier, version, source] = line.split("\t").map((c) => c.trim());
    if (!target || !format || !identifier) {
      throw new Error(`line ${i + 1}: expected target<TAB>format<TAB>identifier, got "${line}"`);
    }
    rows.push({
      target,
      format,
      ...(identifier === "-" ? {} : { identifier }),
      ...(version ? { version } : {}),
      ...(source ? { source } : {}),
    });
  }
  return rows;
}

/** Print a summary in the shape every identifier producer shares. */
export function printApplySummary(summary: ApplySummary, write: boolean): void {
  const counts = new Map<OutcomeKind, number>();
  for (const outcome of summary.outcomes) {
    counts.set(outcome.kind, (counts.get(outcome.kind) ?? 0) + 1);
    if (outcome.kind === "written") {
      console.log(`${write ? "updated" : "would update"} ${outcome.file}: ${outcome.detail}`);
    }
  }
  for (const outcome of summary.outcomes) {
    if (outcome.kind === "conflict" || outcome.kind === "not-found") {
      console.log(`  ${outcome.kind}: ${outcome.row.target} ${outcome.detail}`);
    }
  }
  const parts = [...counts.entries()].map(([kind, count]) => `${count} ${kind}`);
  console.log(
    `\n${write ? "Applied" : "Dry run"}: ${parts.join(", ")} across ${summary.filesChanged} file(s)`
  );
  if (!write && summary.filesChanged > 0) {
    console.log("\nRe-run with --write to apply, then run: pnpm format && pnpm validate");
  }
}

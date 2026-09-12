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

/** A VST3 class id: 32 hex digits, which moduleinfo.json writes in either case. */
function isClassId(identifier: string): boolean {
  return /^[0-9a-f]{32}$/i.test(identifier);
}

/** A reverse-domain identifier: at least two dot-separated segments, no hex CID. */
function isReverseDomain(identifier: string): boolean {
  return identifier.includes(".") && !isClassId(identifier);
}

/**
 * Whether two identifiers name the same thing. A class id compares
 * case-insensitively, since the same FUID is written upper-case by one
 * SDK and lower-case by another; a bundle id is compared as written.
 */
export function sameIdentifier(a: string, b: string): boolean {
  if (isClassId(a) && isClassId(b)) return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

/**
 * Whether a reverse-domain identifier plausibly belongs to the manufacturer.
 * Every segment between the TLD and the product name is a vendor
 * candidate (`com.fabfilter.Pro-Q`, `uk.co.acme.Verb`, `de.u-he.Diva`), and
 * one of them has to be contained in the manufacturer's slug, display name
 * or own domain, or contain it, once all are reduced to letters and digits.
 * A two-segment id (`vendor.Product`) is judged on its first segment.
 *
 * The domain is in the set because a bundle id is built from it, not from
 * the brand's name, and the two need not resemble each other: Universal
 * Audio ships `com.uaudio.effects.*` from `uaudio.com`, which matches
 * neither `universal-audio` nor `Universal Audio` and so was refused on
 * every one of that maker's 156 entries. Only the host of a root url
 * counts, the same rule racks' triage alias uses, because a brand whose
 * url is a deep path on another company's domain is hosted there rather
 * than the owner of it.
 *
 * Deliberately tolerant: it exists to catch `com.waves` on a Softube
 * entry, not to demand that a vendor spell its own name one way.
 */
export function vendorSegmentMatches(
  identifier: string,
  manufacturerSlug: string,
  manufacturerName: string,
  manufacturerUrl = ""
): boolean {
  const segments = identifier.split(".").filter(Boolean);
  const candidates = segments.length >= 3 ? segments.slice(1, -1) : segments.slice(0, 1);
  const names = [
    alnum(manufacturerSlug),
    alnum(manufacturerName),
    alnum(vendorHostLabel(manufacturerUrl)),
  ].filter((n) => n.length >= 3);
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

/**
 * The leading host label of a root url, or "" when the url names no domain
 * the brand owns. A subpath means the brand is hosted on someone else's
 * site (`bock-audio` sits on `uaudio.com/pages/microphones`), so it
 * contributes nothing.
 */
function vendorHostLabel(url: string): string {
  if (url === "") {
    return "";
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  if (parsed.pathname !== "" && parsed.pathname !== "/") {
    return "";
  }
  return parsed.hostname.replace(/^www\./, "").split(".")[0] ?? "";
}

/** Every software entry by id and by slug, so a row may name either. */
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

/**
 * A manufacturer's display name and url from its own file, each empty when
 * the file has none. Both feed the vendor-segment check, which needs the
 * url because a bundle id is built from the domain rather than the name.
 */
function manufacturerIdentity(dataDir: string, slug: string): { name: string; url: string } {
  const file = path.join(dataDir, "manufacturers", `${slug}.yaml`);
  if (!fs.existsSync(file)) {
    return { name: "", url: "" };
  }
  const text = fs.readFileSync(file, "utf-8");
  const field = (key: string): string => {
    const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  return { name: field("name"), url: field("url") };
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

    // `standalone` is a legal format with no identifier of its own, so a
    // row may list it (with a version) but never write an id under it.
    if (
      !isValidFormat(row.format) ||
      (row.format === "standalone" && row.identifier !== undefined)
    ) {
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
      const maker = manufacturerIdentity(dataDir, slug);
      if (!vendorSegmentMatches(identifier, slug, maker.name, maker.url)) {
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
        : `${row.format} already resolves to ${existing ?? identifier}`;
    if (identifier !== undefined && existing && !sameIdentifier(existing, identifier)) {
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
      // An identifier-less row exists to add the format, so it replaces the
      // "already listed" default rather than appending to it: the two read as
      // a contradiction on the row that needed the format most.
      detail =
        identifier === undefined
          ? `added ${row.format} to formats`
          : `${detail} (added ${row.format} to formats)`;
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
    // Every refusal is printed, not only the ones a person must resolve: a
    // skipped or unsupported row that is merely counted cannot be checked.
    if (outcome.kind !== "written" && outcome.kind !== "same") {
      console.log(
        `  ${outcome.kind}: ${outcome.row.target} ${outcome.row.format} ${outcome.detail}`
      );
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

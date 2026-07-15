#!/usr/bin/env tsx
/**
 * Discontinued Candidates Script
 *
 * Surfaces catalog entries that should likely carry the `discontinued`
 * category but don't. The Studio app auto-derives discontinued state from
 * `supersedes` at runtime, so tagging the YAML is optional from the
 * frontend's perspective — but explicit tagging keeps catalog content
 * self-describing and helps downstream consumers that don't run the
 * Studio inference logic.
 *
 * Signals (in order of confidence):
 *
 *   1. `superseded` — entry's ID is referenced by another entry's
 *      `supersedes` field. Definitive: the newer entry replaces this one.
 *      Auto-tag-safe via `apply-discontinued-tags.ts`.
 *
 *   1. `defunct-manufacturer` — entry's manufacturer is marked
 *      `defunct: true`. A dead company cannot be producing anything, so
 *      this is also auto-tag-safe (via `apply-discontinued-tags.ts
 *      --signal defunct`). The care lives in the manufacturer flag: it
 *      must never be set for revived brands.
 *
 *   2. `legacy-without-discontinued` — entry has the `legacy` category
 *      but not `discontinued`. Often used as a synonym; flag for review.
 *
 *   2. `verification-discontinued` — entry has
 *      `verification.status === "discontinued"` but the `discontinued`
 *      category is missing. Rare in practice but worth surfacing.
 *
 *   2. `vintagesynth-linked` — entry carries a vintagesynth.com link.
 *      VSE's scope is overwhelmingly out-of-production gear, but it also
 *      covers some current instruments (Doepfer A-100, microKorg, Volcas,
 *      Prophet-5 reissue), so this is REVIEW-tier: curate the list, then
 *      apply via `apply-discontinued-tags.ts --files`.
 *
 *   2. `released-before-cutoff` — entry's releaseDate is 20+ years old
 *      and no newer signal covers it. Production lifetimes are category-
 *      dependent (SM58: 1966–present; Boss DS-1: 1978–present), so age is
 *      never auto-tag-safe — review before applying.
 *
 * Usage:
 *   pnpm discontinued:report           # Console output
 *   pnpm discontinued:report --json    # JSON output
 */

import path from "node:path";
import { z } from "zod";
import type { Accessory, Content, Hardware, Software } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadDefunctManufacturers, loadYamlFile } from "./lib/utils.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const DISCONTINUED_CATEGORY = "discontinued";
const LEGACY_CATEGORY = "legacy";
const VSE_HOST = /(^|\.)vintagesynth\.com$/i;
/** Entries released at least this many years ago land in the review bucket. */
const REVIEW_CUTOFF_YEARS = 20;

const ENTRY_TYPES = ["software", "content", "hardware", "accessories"] as const;
type EntryType = (typeof ENTRY_TYPES)[number];
type Entry = Software | Content | Hardware | Accessory;

// =============================================================================
// SCHEMAS
// =============================================================================

const EntryTypeSchema = z.enum(ENTRY_TYPES);

const CandidateSchema = z.object({
  id: z.string(),
  file: z.string(),
  name: z.string(),
  type: EntryTypeSchema,
  manufacturer: z.string(),
  /** Entry ID(s) that supersede this one (newer products replacing it). */
  supersededBy: z.array(z.string()).optional(),
  /** Whether the `discontinued` category is currently set. */
  hasDiscontinuedCategory: z.boolean(),
  /** Whether the `legacy` category is currently set. */
  hasLegacyCategory: z.boolean(),
  /** Verification status from YAML, if any. */
  verificationStatus: z.string().optional(),
  /** Year from the entry's releaseDate, if present. Aids review. */
  releaseYear: z.number().optional(),
  /** vintagesynth.com link carried by the entry, if any. */
  vintagesynthUrl: z.string().optional(),
});
type Candidate = z.infer<typeof CandidateSchema>;

const DiscontinuedReportSchema = z.object({
  generatedAt: z.string(),
  summary: z.object({
    totalEntries: z.number(),
    superseded: z.number(),
    supersededMissingCategory: z.number(),
    defunctManufacturer: z.number(),
    legacyWithoutDiscontinued: z.number(),
    verificationDiscontinuedMissingCategory: z.number(),
    descriptionMentionsDiscontinued: z.number(),
    vintagesynthLinked: z.number(),
    releasedBeforeCutoff: z.number(),
  }),
  /** Tier 1: entries on the receiving end of a `supersedes` link, missing
   *  the `discontinued` category. Auto-tag-safe. */
  supersededMissingCategory: z.array(CandidateSchema),
  /** Entries on the receiving end of `supersedes` that already have the
   *  category. Informational; nothing to do. */
  supersededWithCategory: z.array(CandidateSchema),
  /** Tier 1: entries whose manufacturer is marked `defunct: true`, missing
   *  the category. Auto-tag-safe via `--signal defunct`. */
  defunctManufacturer: z.array(CandidateSchema),
  /** Tier 2: entries with `legacy` category but missing `discontinued`. */
  legacyWithoutDiscontinued: z.array(CandidateSchema),
  /** Tier 2: entries with `verification.status === "discontinued"` but
   *  missing the `discontinued` category. */
  verificationDiscontinuedMissingCategory: z.array(CandidateSchema),
  /** Tier 2: description/details text mentions discontinuation with
   *  high confidence, but the `discontinued` category is missing.
   *  Heuristic — human review recommended before applying. */
  descriptionMentionsDiscontinued: z.array(CandidateSchema),
  /** Tier 2: entries carrying a vintagesynth.com link, missing the
   *  category. Mostly-but-not-all discontinued — review, then apply via
   *  `apply-discontinued-tags.ts --files`. */
  vintagesynthLinked: z.array(CandidateSchema),
  /** Tier 2: entries released REVIEW_CUTOFF_YEARS+ years ago with no
   *  stronger signal. Age is never auto-tag-safe (evergreen products);
   *  review before applying. */
  releasedBeforeCutoff: z.array(CandidateSchema),
});
export type DiscontinuedReport = z.infer<typeof DiscontinuedReportSchema>;

// =============================================================================
// HELPERS
// =============================================================================

function hasCategory(entry: Entry, slug: string): boolean {
  if (entry.primaryCategory === slug || entry.secondaryCategory === slug) return true;
  return Array.isArray(entry.categories) && entry.categories.includes(slug);
}

// Self-referential signals: the manufacturer is talking about THIS product,
// not about some other vintage unit it was modeled after or replaces.
//
// Bare phrases like "out of production" / "no longer in production" are
// intentionally NOT in this list — they fire too often on inspiration
// blurbs ("the original tube was long out of production"). We require
// stronger evidence than a bare phrase floating in body text.
const SELF_REFERENTIAL_PATTERNS = [
  // Description (or a paragraph) opens with "Discontinued ..." — the dbx
  // pattern. "No longer" is intentionally excluded here because it's
  // commonly used as a discourse marker ("No longer confined to...").
  /(?:^|[.!?]\s+|\n)\s*Discontinued\b/,
  // "This/It is/was a legacy product / no longer available / discontinued"
  // Captures the audeze "This is a legacy product and no longer available
  // for sale." pattern and the dbx "This unit was discontinued in 2020."
  /(?:^|[.!?]\s+|\n)\s*(?:This|It)\s+(?:product\s+|model\s+|item\s+|unit\s+)?(?:is|was)\b[^.!?\n]{0,80}\b(?:no longer (?:available|in production|manufactured|made|sold|produced)|discontinued)\b/i,
  // "Discontinued in <year>" — year is specific enough to be self-ref.
  /\bdiscontinued in (?:19|20)\d{2}\b/i,
  // EOL / end-of-life are narrow industry terms; rarely appear in
  // historical references.
  /\bend[- ]of[- ]life\b/i,
];

function toText(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value.join("\n") : value;
}

function mentionsDiscontinued(entry: Entry): boolean {
  const description = toText(entry.description);
  const details = toText(entry.details);

  // Broken-schema artifact: catalog importer dumped a status into the
  // details field (`details: |- status: discontinued`). High confidence.
  if (/\bstatus\s*:\s*discontinued\b/i.test(details)) return true;

  const haystack = `${description}\n${details}`;
  return SELF_REFERENTIAL_PATTERNS.some((re) => re.test(haystack));
}

function vintagesynthUrl(entry: Entry): string | undefined {
  if (!Array.isArray(entry.links)) return undefined;
  for (const link of entry.links) {
    if (!link?.url) continue;
    try {
      if (VSE_HOST.test(new URL(link.url).hostname)) return link.url;
    } catch {
      // Malformed URL — validate.ts owns that complaint.
    }
  }
  return undefined;
}

function releaseYear(entry: Entry): number | undefined {
  const match = /^(\d{4})/.exec(entry.releaseDate ?? "");
  return match ? Number(match[1]) : undefined;
}

function toCandidate(
  filePath: string,
  entry: Entry,
  type: EntryType,
  supersededBy: string[] | undefined
): Candidate {
  return {
    id: entry.id ?? "",
    file: path.relative(DATA_DIR, filePath),
    name: entry.name,
    type,
    manufacturer: entry.manufacturer,
    supersededBy: supersededBy && supersededBy.length > 0 ? supersededBy : undefined,
    hasDiscontinuedCategory: hasCategory(entry, DISCONTINUED_CATEGORY),
    hasLegacyCategory: hasCategory(entry, LEGACY_CATEGORY),
    verificationStatus: entry.verification?.status,
    releaseYear: releaseYear(entry),
    vintagesynthUrl: vintagesynthUrl(entry),
  };
}

// =============================================================================
// MAIN
// =============================================================================

function generateReport(): DiscontinuedReport {
  const report: DiscontinuedReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalEntries: 0,
      superseded: 0,
      supersededMissingCategory: 0,
      defunctManufacturer: 0,
      legacyWithoutDiscontinued: 0,
      verificationDiscontinuedMissingCategory: 0,
      descriptionMentionsDiscontinued: 0,
      vintagesynthLinked: 0,
      releasedBeforeCutoff: 0,
    },
    supersededMissingCategory: [],
    supersededWithCategory: [],
    defunctManufacturer: [],
    legacyWithoutDiscontinued: [],
    verificationDiscontinuedMissingCategory: [],
    descriptionMentionsDiscontinued: [],
    vintagesynthLinked: [],
    releasedBeforeCutoff: [],
  };

  const defunctManufacturers = loadDefunctManufacturers();
  const cutoffYear = new Date().getFullYear() - REVIEW_CUTOFF_YEARS;

  // First pass: collect every entry by id so we can resolve `supersedes`
  // targets, and build a reverse-index of supersession references. Skip
  // self-loops and prune 2-cycles after the index is built; both are data
  // errors that would otherwise produce bogus tier-1 candidates.
  const entriesById = new Map<string, { file: string; entry: Entry; type: EntryType }>();
  const supersededBy = new Map<string, string[]>();
  const supersedesOf = new Map<string, string>();

  for (const type of ENTRY_TYPES) {
    const files = getYamlFiles(path.join(DATA_DIR, type));
    for (const file of files) {
      const entry = loadYamlFile<Entry>(file);
      report.summary.totalEntries++;

      if (entry.id) {
        entriesById.set(entry.id, { file, entry, type });
      }
      if (entry.supersedes && entry.id && entry.supersedes !== entry.id) {
        const list = supersededBy.get(entry.supersedes) ?? [];
        list.push(entry.id);
        supersededBy.set(entry.supersedes, list);
        supersedesOf.set(entry.id, entry.supersedes);
      }
    }
  }

  // Prune 2-cycles (A.supersedes === B && B.supersedes === A). Neither
  // direction is unambiguously "the current product" so we skip both
  // ends from the auto-tag path.
  for (const [targetId, sourceIds] of supersededBy.entries()) {
    const filtered = sourceIds.filter((sourceId) => supersedesOf.get(targetId) !== sourceId);
    if (filtered.length === 0) {
      supersededBy.delete(targetId);
    } else {
      supersededBy.set(targetId, filtered);
    }
  }

  // Second pass: classify each entry against the signals.
  for (const { file, entry, type } of entriesById.values()) {
    const supersessors = entry.id ? supersededBy.get(entry.id) : undefined;
    const isSuperseded = !!supersessors && supersessors.length > 0;
    const isDefunctMfr = defunctManufacturers.has(entry.manufacturer);
    const hasDiscontinued = hasCategory(entry, DISCONTINUED_CATEGORY);
    const hasLegacy = hasCategory(entry, LEGACY_CATEGORY);
    const verificationDiscontinued = entry.verification?.status === "discontinued";

    if (isSuperseded) {
      report.summary.superseded++;
      const candidate = toCandidate(file, entry, type, supersessors);
      if (hasDiscontinued) {
        report.supersededWithCategory.push(candidate);
      } else {
        report.supersededMissingCategory.push(candidate);
      }
    }

    if (isDefunctMfr && !hasDiscontinued && !isSuperseded) {
      report.defunctManufacturer.push(toCandidate(file, entry, type, supersessors));
    }

    // Secondary signals — only surface when NOT already claimed by a
    // tier-1 bucket (to keep tiers disjoint and the apply tool focused).
    const inTier1 = (isSuperseded || isDefunctMfr) && !hasDiscontinued;
    if (!inTier1) {
      if (hasLegacy && !hasDiscontinued) {
        report.legacyWithoutDiscontinued.push(toCandidate(file, entry, type, supersessors));
      }
      if (verificationDiscontinued && !hasDiscontinued) {
        report.verificationDiscontinuedMissingCategory.push(
          toCandidate(file, entry, type, supersessors)
        );
      }
      if (!hasDiscontinued && mentionsDiscontinued(entry)) {
        report.descriptionMentionsDiscontinued.push(toCandidate(file, entry, type, supersessors));
      }
      if (!hasDiscontinued) {
        const candidate = toCandidate(file, entry, type, supersessors);
        if (candidate.vintagesynthUrl) {
          report.vintagesynthLinked.push(candidate);
        } else if (candidate.releaseYear !== undefined && candidate.releaseYear <= cutoffYear) {
          report.releasedBeforeCutoff.push(candidate);
        }
      }
    }
  }

  report.summary.supersededMissingCategory = report.supersededMissingCategory.length;
  report.summary.defunctManufacturer = report.defunctManufacturer.length;
  report.summary.legacyWithoutDiscontinued = report.legacyWithoutDiscontinued.length;
  report.summary.verificationDiscontinuedMissingCategory =
    report.verificationDiscontinuedMissingCategory.length;
  report.summary.descriptionMentionsDiscontinued = report.descriptionMentionsDiscontinued.length;
  report.summary.vintagesynthLinked = report.vintagesynthLinked.length;
  report.summary.releasedBeforeCutoff = report.releasedBeforeCutoff.length;

  return report;
}

function printConsoleReport(report: DiscontinuedReport): void {
  console.log("\n🗂  Discontinued Candidates Report");
  console.log("═".repeat(60));
  console.log(`Generated: ${report.generatedAt}`);
  console.log();

  console.log("📈 Summary");
  console.log("─".repeat(40));
  console.log(`  Total entries:                                  ${report.summary.totalEntries}`);
  console.log(`  Superseded by another entry:                    ${report.summary.superseded}`);
  console.log(
    `  Superseded WITHOUT discontinued category (tier 1): ${report.summary.supersededMissingCategory}`
  );
  console.log(
    `  Defunct manufacturer, missing category (tier 1):   ${report.summary.defunctManufacturer}`
  );
  console.log(
    `  Has 'legacy' but missing 'discontinued':           ${report.summary.legacyWithoutDiscontinued}`
  );
  console.log(
    `  verification.status=discontinued, missing category: ${report.summary.verificationDiscontinuedMissingCategory}`
  );
  console.log(
    `  Description/details mention discontinuation:       ${report.summary.descriptionMentionsDiscontinued}`
  );
  console.log(
    `  vintagesynth.com-linked, missing category (review): ${report.summary.vintagesynthLinked}`
  );
  console.log(
    `  Released ${REVIEW_CUTOFF_YEARS}+ years ago, no other signal (review):  ${report.summary.releasedBeforeCutoff}`
  );
  console.log();

  if (report.supersededMissingCategory.length > 0) {
    console.log("🎯 Tier 1: Superseded, missing discontinued category");
    console.log("─".repeat(40));
    for (const candidate of report.supersededMissingCategory.slice(0, 30)) {
      console.log(`  ${candidate.file}`);
      console.log(
        `    ${candidate.manufacturer} — ${candidate.name} (${candidate.type})` +
          ` → superseded by ${candidate.supersededBy?.join(", ")}`
      );
    }
    if (report.supersededMissingCategory.length > 30) {
      console.log(`  ... and ${report.supersededMissingCategory.length - 30} more`);
    }
    console.log();
  }

  if (report.defunctManufacturer.length > 0) {
    console.log("🎯 Tier 1: Defunct manufacturer, missing discontinued category");
    console.log("─".repeat(40));
    for (const candidate of report.defunctManufacturer.slice(0, 30)) {
      console.log(`  ${candidate.file}`);
      console.log(`    ${candidate.manufacturer} — ${candidate.name} (${candidate.type})`);
    }
    if (report.defunctManufacturer.length > 30) {
      console.log(`  ... and ${report.defunctManufacturer.length - 30} more`);
    }
    console.log();
  }

  if (report.legacyWithoutDiscontinued.length > 0) {
    console.log("⚠️  Tier 2: Has 'legacy' category but missing 'discontinued'");
    console.log("─".repeat(40));
    for (const candidate of report.legacyWithoutDiscontinued.slice(0, 15)) {
      console.log(`  ${candidate.file}`);
      console.log(`    ${candidate.manufacturer} — ${candidate.name} (${candidate.type})`);
    }
    if (report.legacyWithoutDiscontinued.length > 15) {
      console.log(`  ... and ${report.legacyWithoutDiscontinued.length - 15} more`);
    }
    console.log();
  }

  if (report.verificationDiscontinuedMissingCategory.length > 0) {
    console.log("📋 Tier 2: verification.status=discontinued but category missing");
    console.log("─".repeat(40));
    for (const candidate of report.verificationDiscontinuedMissingCategory.slice(0, 15)) {
      console.log(`  ${candidate.file}`);
      console.log(`    ${candidate.manufacturer} — ${candidate.name} (${candidate.type})`);
    }
    console.log();
  }

  if (report.descriptionMentionsDiscontinued.length > 0) {
    console.log("📝 Tier 2: Description/details mention discontinuation (review before applying)");
    console.log("─".repeat(40));
    for (const candidate of report.descriptionMentionsDiscontinued.slice(0, 20)) {
      console.log(`  ${candidate.file}`);
      console.log(`    ${candidate.manufacturer} — ${candidate.name} (${candidate.type})`);
    }
    if (report.descriptionMentionsDiscontinued.length > 20) {
      console.log(`  ... and ${report.descriptionMentionsDiscontinued.length - 20} more`);
    }
    console.log();
  }

  if (report.vintagesynthLinked.length > 0) {
    console.log("📝 Tier 2: vintagesynth.com-linked (review — VSE also covers some current gear)");
    console.log("─".repeat(40));
    for (const candidate of report.vintagesynthLinked.slice(0, 20)) {
      console.log(
        `  ${candidate.file} (${candidate.releaseYear ?? "no date"})` +
          `  ${candidate.manufacturer} — ${candidate.name}`
      );
    }
    if (report.vintagesynthLinked.length > 20) {
      console.log(`  ... and ${report.vintagesynthLinked.length - 20} more`);
    }
    console.log();
  }

  if (report.releasedBeforeCutoff.length > 0) {
    console.log(
      `📝 Tier 2: Released ${REVIEW_CUTOFF_YEARS}+ years ago, no other signal (review — beware evergreens)`
    );
    console.log("─".repeat(40));
    for (const candidate of report.releasedBeforeCutoff.slice(0, 20)) {
      console.log(
        `  ${candidate.file} (${candidate.releaseYear})` +
          `  ${candidate.manufacturer} — ${candidate.name}`
      );
    }
    if (report.releasedBeforeCutoff.length > 20) {
      console.log(`  ... and ${report.releasedBeforeCutoff.length - 20} more`);
    }
    console.log();
  }

  console.log("═".repeat(60));
  const tier1 = report.summary.supersededMissingCategory + report.summary.defunctManufacturer;
  if (tier1 > 0) {
    console.log(
      `Run \`pnpm discontinued:apply\` (superseded) and \`pnpm discontinued:apply --signal defunct\` ` +
        `to auto-tag ${tier1} tier-1 candidates (dry-run by default).`
    );
  } else {
    console.log("No tier-1 candidates — catalog is fully tagged for superseded products.");
  }
  if (report.summary.vintagesynthLinked > 0 || report.summary.releasedBeforeCutoff > 0) {
    console.log(
      "Review-tier candidates: curate a file list from `--json` output, then apply with " +
        "`pnpm discontinued:apply --files <list.txt>`."
    );
  }
}

// =============================================================================
// RUN
// =============================================================================

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

const report = generateReport();

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printConsoleReport(report);
}

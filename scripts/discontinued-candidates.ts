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
 *   2. `legacy-without-discontinued` — entry has the `legacy` category
 *      but not `discontinued`. Often used as a synonym; flag for review.
 *
 *   3. `verification-discontinued` — entry has
 *      `verification.status === "discontinued"` but the `discontinued`
 *      category is missing. Rare in practice but worth surfacing.
 *
 * Usage:
 *   pnpm discontinued:report           # Console output
 *   pnpm discontinued:report --json    # JSON output
 */

import path from "node:path";
import { z } from "zod";
import type { Accessory, Content, Hardware, Software } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const DISCONTINUED_CATEGORY = "discontinued";
const LEGACY_CATEGORY = "legacy";

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
});
type Candidate = z.infer<typeof CandidateSchema>;

const DiscontinuedReportSchema = z.object({
  generatedAt: z.string(),
  summary: z.object({
    totalEntries: z.number(),
    superseded: z.number(),
    supersededMissingCategory: z.number(),
    legacyWithoutDiscontinued: z.number(),
    verificationDiscontinuedMissingCategory: z.number(),
  }),
  /** Tier 1: entries on the receiving end of a `supersedes` link, missing
   *  the `discontinued` category. Auto-tag-safe. */
  supersededMissingCategory: z.array(CandidateSchema),
  /** Entries on the receiving end of `supersedes` that already have the
   *  category. Informational; nothing to do. */
  supersededWithCategory: z.array(CandidateSchema),
  /** Tier 2: entries with `legacy` category but missing `discontinued`. */
  legacyWithoutDiscontinued: z.array(CandidateSchema),
  /** Tier 2: entries with `verification.status === "discontinued"` but
   *  missing the `discontinued` category. */
  verificationDiscontinuedMissingCategory: z.array(CandidateSchema),
});
export type DiscontinuedReport = z.infer<typeof DiscontinuedReportSchema>;

// =============================================================================
// HELPERS
// =============================================================================

function hasCategory(entry: Entry, slug: string): boolean {
  if (entry.primaryCategory === slug || entry.secondaryCategory === slug) return true;
  return Array.isArray(entry.categories) && entry.categories.includes(slug);
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
      legacyWithoutDiscontinued: 0,
      verificationDiscontinuedMissingCategory: 0,
    },
    supersededMissingCategory: [],
    supersededWithCategory: [],
    legacyWithoutDiscontinued: [],
    verificationDiscontinuedMissingCategory: [],
  };

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

    // Secondary signals — only surface when NOT already in the supersession-
    // missing bucket (to keep tiers disjoint and the apply tool focused).
    if (!isSuperseded || hasDiscontinued) {
      if (hasLegacy && !hasDiscontinued) {
        report.legacyWithoutDiscontinued.push(toCandidate(file, entry, type, supersessors));
      }
      if (verificationDiscontinued && !hasDiscontinued) {
        report.verificationDiscontinuedMissingCategory.push(
          toCandidate(file, entry, type, supersessors)
        );
      }
    }
  }

  report.summary.supersededMissingCategory = report.supersededMissingCategory.length;
  report.summary.legacyWithoutDiscontinued = report.legacyWithoutDiscontinued.length;
  report.summary.verificationDiscontinuedMissingCategory =
    report.verificationDiscontinuedMissingCategory.length;

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
    `  Has 'legacy' but missing 'discontinued':           ${report.summary.legacyWithoutDiscontinued}`
  );
  console.log(
    `  verification.status=discontinued, missing category: ${report.summary.verificationDiscontinuedMissingCategory}`
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

  console.log("═".repeat(60));
  if (report.summary.supersededMissingCategory > 0) {
    console.log(
      `Run \`pnpm discontinued:apply\` to auto-tag ${report.summary.supersededMissingCategory} tier-1 candidates (dry-run by default).`
    );
  } else {
    console.log("No tier-1 candidates — catalog is fully tagged for superseded products.");
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

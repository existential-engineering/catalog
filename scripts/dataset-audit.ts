#!/usr/bin/env tsx
/**
 * Dataset Audit Script (Tier 1 of the holistic review)
 *
 * `pnpm validate` and the per-PR `/data-review` are fundamentally
 * per-file: they check each entry in isolation. As the catalog grows past
 * ~12k entries — with imports dropping hundreds of products per PR — the
 * problems that slip through are *cross-entry*: the same product filed
 * twice, a `compatibleWith` pointing at a slug that doesn't exist, a
 * manufacturer with no products, descriptions that are technically present
 * but useless.
 *
 * This script loads the WHOLE dataset and runs the deterministic
 * cross-entry checks that scale with dataset size (cheap, no LLM). It is
 * the cheap-and-always-run half of the layered review:
 *
 *   - Tier 1 (this script): deterministic, whole-dataset, runs in CI and on
 *     a monthly schedule (`.github/workflows/dataset-audit.yml`).
 *   - Tier 2 (`/dataset-review`): an LLM pass over ONLY the `flagged`
 *     subset this script emits — bounded cost, independent of total size.
 *
 * Checks:
 *   1. duplicate-name    — same manufacturer + collection + normalized name.
 *                          Likely "same product, two files". Exact-normalized
 *                          only (not fuzzy) — a product catalog is full of
 *                          model-number families ("Bassysm-F" vs "Bassysm-J")
 *                          that edit-distance matching drowns you in.
 *   2. broken-compatible — `compatibleWith` slug resolves to no software or
 *                          hardware entry. (validate's W123 only covers
 *                          software/hardware entries; content is checked here.)
 *   3. orphan-manufacturer — a manufacturer referenced by zero products.
 *   4. thin-description  — description present but suspiciously short.
 *
 * Findings with `needsLlmReview: true` are collected into `flagged`, the
 * seam handed to Tier 2. Deterministic findings (broken refs, orphans) are
 * actionable as-is and are NOT flagged for the LLM.
 *
 * Usage:
 *   pnpm dataset:audit                # Console output
 *   pnpm dataset:audit --json         # JSON output (for the workflow / Tier 2)
 *   pnpm dataset:audit --fast         # Skip thin-description scan (CI)
 */

import path from "node:path";
import { z } from "zod";
import type { Accessory, Content, Hardware, Manufacturer, Software } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Product collections (everything except manufacturers). */
const PRODUCT_TYPES = ["software", "content", "hardware", "accessories"] as const;
type ProductType = (typeof PRODUCT_TYPES)[number];
type Product = Software | Content | Hardware | Accessory;

/** Descriptions shorter than this (after trimming) are flagged as thin. */
const THIN_DESCRIPTION_CHARS = 40;
/** Cap on the LLM-bound `flagged` list, prioritized by severity. */
const MAX_FLAGGED = 100;

// =============================================================================
// SCHEMAS
// =============================================================================

const CheckSchema = z.enum([
  "duplicate-name",
  "broken-compatible",
  "orphan-manufacturer",
  "thin-description",
]);

const SeveritySchema = z.enum(["blocking", "warning", "info"]);

const FindingSchema = z.object({
  check: CheckSchema,
  severity: SeveritySchema,
  /** True when the finding is ambiguous and worth an LLM judgment (Tier 2). */
  needsLlmReview: z.boolean(),
  /** Collection this finding concerns ("manufacturers" for orphans). */
  collection: z.string(),
  /** Display name of the primary entry. */
  name: z.string(),
  /** Manufacturer slug, when applicable. */
  manufacturer: z.string().optional(),
  /** Relative file path(s); duplicate findings list every colliding file. */
  files: z.array(z.string()),
  /** Human-readable explanation of the finding. */
  detail: z.string(),
});
type Finding = z.infer<typeof FindingSchema>;

const CoverageSchema = z.object({
  total: z.number(),
  withDescription: z.number(),
  withUrl: z.number(),
  withPrices: z.number(),
  withVerification: z.number(),
});

const DatasetAuditSchema = z.object({
  generatedAt: z.string(),
  fast: z.boolean(),
  summary: z.object({
    totalEntries: z.number(),
    manufacturers: z.number(),
    byCheck: z.object({
      duplicateName: z.number(),
      brokenCompatible: z.number(),
      orphanManufacturer: z.number(),
      thinDescription: z.number(),
    }),
    flagged: z.number(),
  }),
  /** Per-collection coverage metrics (denominator for "is the data thinning?"). */
  coverage: z.record(z.string(), CoverageSchema),
  /** Every finding, all severities. */
  findings: z.array(FindingSchema),
  /** The bounded subset worth an LLM pass — the seam to Tier 2. */
  flagged: z.array(FindingSchema),
});
export type DatasetAudit = z.infer<typeof DatasetAuditSchema>;

// =============================================================================
// HELPERS
// =============================================================================

interface LoadedProduct {
  type: ProductType;
  slug: string;
  file: string;
  entry: Product;
}

function relPath(file: string): string {
  return path.relative(DATA_DIR, file);
}

function slugOf(file: string): string {
  return path.basename(file, path.extname(file));
}

/** Collapse a display name to a comparable key (lowercase, alphanumerics only). */
export function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      // A "+" marks a distinct SKU, so preserve it as a "plus" token instead of
      // stripping it. This covers both a trailing "+" (ProFX10v3 vs ProFX10v3+,
      // Prime 4 vs Prime 4+) and an internal "+" that precedes more of the name
      // (Vision+ Console vs Vision Console, SPS-1UW+ MKII vs SPS-1UW MKII).
      .replace(/\+/g, "plus")
      .replace(/[^a-z0-9]+/g, "")
  );
}

function descriptionText(entry: Product): string {
  return (entry.description ?? "").trim();
}

function hasPrices(entry: Product): boolean {
  return Array.isArray(entry.prices) && entry.prices.length > 0;
}

/** `compatibleWith` only exists on software and content in the schema. */
function compatibleWithOf(entry: Product): string[] {
  const value = (entry as Software | Content).compatibleWith;
  return Array.isArray(value) ? value : [];
}

// =============================================================================
// LOAD
// =============================================================================

interface Dataset {
  products: LoadedProduct[];
  manufacturers: { slug: string; file: string; entry: Manufacturer }[];
  /** Slugs that a `compatibleWith` is allowed to point at (software + hardware). */
  hostSlugs: Set<string>;
  /** Manufacturer slugs referenced by at least one product. */
  usedManufacturers: Set<string>;
}

function loadDataset(): Dataset {
  const products: LoadedProduct[] = [];
  const hostSlugs = new Set<string>();
  const usedManufacturers = new Set<string>();

  for (const type of PRODUCT_TYPES) {
    for (const file of getYamlFiles(path.join(DATA_DIR, type))) {
      const entry = loadYamlFile<Product>(file);
      const slug = slugOf(file);
      products.push({ type, slug, file, entry });
      if (type === "software" || type === "hardware") hostSlugs.add(slug);
      if (entry.manufacturer) usedManufacturers.add(entry.manufacturer);
    }
  }

  const manufacturers = getYamlFiles(path.join(DATA_DIR, "manufacturers")).map((file) => ({
    slug: slugOf(file),
    file,
    entry: loadYamlFile<Manufacturer>(file),
  }));

  return { products, manufacturers, hostSlugs, usedManufacturers };
}

// =============================================================================
// CHECKS
// =============================================================================

/**
 * Same manufacturer + collection + normalized name. Catches the same
 * product filed twice with only punctuation/spacing/case differences
 * ("Pro-Q 3" vs "ProQ3"). Deliberately exact-normalized, not fuzzy:
 * catalogs are full of legitimate model-number families ("Bassysm-F" vs
 * "Bassysm-J", "Amethyst" vs "Amethyst2") that edit-distance matching would
 * flag by the thousands. An exact collision is still worth an LLM glance —
 * usually a duplicate or a cosmetic variant that belongs in one entry's
 * `variants`, occasionally a genuine pair of distinct products.
 */
function checkDuplicateNames(products: LoadedProduct[]): Finding[] {
  const buckets = new Map<string, LoadedProduct[]>();
  for (const p of products) {
    const norm = normalizeName(p.entry.name);
    if (!norm) continue;
    const key = `${p.type} ${p.entry.manufacturer ?? ""} ${norm}`;
    const list = buckets.get(key) ?? [];
    list.push(p);
    buckets.set(key, list);
  }

  const findings: Finding[] = [];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    findings.push({
      check: "duplicate-name",
      severity: "warning",
      needsLlmReview: true,
      collection: first.type,
      name: first.entry.name,
      manufacturer: first.entry.manufacturer,
      files: group.map((g) => relPath(g.file)),
      detail:
        `${group.length} entries share the normalized name "${normalizeName(first.entry.name)}" ` +
        "under the same manufacturer — likely the same product filed more than once " +
        "(cosmetic variants belong in a single entry's `variants`).",
    });
  }
  return findings;
}

/**
 * `compatibleWith` slugs that resolve to no software/hardware entry. These
 * are deterministic data errors — actionable without LLM judgment.
 */
function checkBrokenCompatible(products: LoadedProduct[], hostSlugs: Set<string>): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    const refs = compatibleWithOf(p.entry);
    const broken = refs.filter((slug) => !hostSlugs.has(slug));
    if (broken.length === 0) continue;
    findings.push({
      check: "broken-compatible",
      severity: "warning",
      needsLlmReview: false,
      collection: p.type,
      name: p.entry.name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail: `compatibleWith references no existing software/hardware: ${broken.join(", ")}`,
    });
  }
  return findings;
}

/** Manufacturers referenced by zero products. Informational housekeeping. */
function checkOrphanManufacturers(dataset: Dataset): Finding[] {
  const findings: Finding[] = [];
  for (const m of dataset.manufacturers) {
    if (dataset.usedManufacturers.has(m.slug)) continue;
    findings.push({
      check: "orphan-manufacturer",
      severity: "info",
      needsLlmReview: false,
      collection: "manufacturers",
      name: m.entry.name,
      files: [relPath(m.file)],
      detail: "Manufacturer is referenced by no product entries.",
    });
  }
  return findings;
}

/** Descriptions that exist but are too short to be useful. */
function checkThinDescriptions(products: LoadedProduct[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    const text = descriptionText(p.entry);
    if (text.length === 0 || text.length >= THIN_DESCRIPTION_CHARS) continue;
    findings.push({
      check: "thin-description",
      severity: "info",
      needsLlmReview: true,
      collection: p.type,
      name: p.entry.name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail: `Description is only ${text.length} chars: "${text}"`,
    });
  }
  return findings;
}

function computeCoverage(
  products: LoadedProduct[]
): Record<string, z.infer<typeof CoverageSchema>> {
  const coverage: Record<string, z.infer<typeof CoverageSchema>> = {};
  for (const type of PRODUCT_TYPES) {
    coverage[type] = {
      total: 0,
      withDescription: 0,
      withUrl: 0,
      withPrices: 0,
      withVerification: 0,
    };
  }
  for (const p of products) {
    const c = coverage[p.type];
    c.total++;
    if (descriptionText(p.entry).length > 0) c.withDescription++;
    if (p.entry.url) c.withUrl++;
    if (hasPrices(p.entry)) c.withPrices++;
    if (p.entry.verification) c.withVerification++;
  }
  return coverage;
}

// =============================================================================
// MAIN
// =============================================================================

const SEVERITY_RANK: Record<z.infer<typeof SeveritySchema>, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

function generateAudit(fast: boolean): DatasetAudit {
  const dataset = loadDataset();

  const findings: Finding[] = [
    ...checkDuplicateNames(dataset.products),
    ...checkBrokenCompatible(dataset.products, dataset.hostSlugs),
    ...checkOrphanManufacturers(dataset),
    ...(fast ? [] : checkThinDescriptions(dataset.products)),
  ];

  // The Tier-2 seam: only ambiguous findings, highest severity first, capped.
  const flagged = findings
    .filter((f) => f.needsLlmReview)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, MAX_FLAGGED);

  const byCheck = {
    duplicateName: findings.filter((f) => f.check === "duplicate-name").length,
    brokenCompatible: findings.filter((f) => f.check === "broken-compatible").length,
    orphanManufacturer: findings.filter((f) => f.check === "orphan-manufacturer").length,
    thinDescription: findings.filter((f) => f.check === "thin-description").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    fast,
    summary: {
      totalEntries: dataset.products.length,
      manufacturers: dataset.manufacturers.length,
      byCheck,
      flagged: flagged.length,
    },
    coverage: computeCoverage(dataset.products),
    findings,
    flagged,
  };
}

function pct(n: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((n / total) * 100)}%`;
}

function printConsoleReport(audit: DatasetAudit): void {
  console.log("\n🗂  Dataset Audit");
  console.log("═".repeat(60));
  console.log(`Generated: ${audit.generatedAt}${audit.fast ? "  (fast mode)" : ""}`);
  console.log();

  console.log("📈 Summary");
  console.log("─".repeat(40));
  console.log(`  Product entries:        ${audit.summary.totalEntries}`);
  console.log(`  Manufacturers:          ${audit.summary.manufacturers}`);
  console.log(`  Duplicate-name groups:  ${audit.summary.byCheck.duplicateName}`);
  console.log(`  Broken compatibleWith:  ${audit.summary.byCheck.brokenCompatible}`);
  console.log(`  Orphan manufacturers:   ${audit.summary.byCheck.orphanManufacturer}`);
  console.log(`  Thin descriptions:      ${audit.summary.byCheck.thinDescription}`);
  console.log(`  Flagged for LLM review: ${audit.summary.flagged}`);
  console.log();

  console.log("📊 Coverage");
  console.log("─".repeat(40));
  for (const [collection, c] of Object.entries(audit.coverage)) {
    console.log(
      `  ${collection.padEnd(12)} ${String(c.total).padStart(5)} entries — ` +
        `desc ${pct(c.withDescription, c.total)}, url ${pct(c.withUrl, c.total)}, ` +
        `price ${pct(c.withPrices, c.total)}, verified ${pct(c.withVerification, c.total)}`
    );
  }
  console.log();

  const groups: { title: string; check: Finding["check"]; limit: number }[] = [
    { title: "🔁 Duplicate-name groups", check: "duplicate-name", limit: 30 },
    { title: "🔗 Broken compatibleWith references", check: "broken-compatible", limit: 30 },
    { title: "🏷  Orphan manufacturers", check: "orphan-manufacturer", limit: 20 },
    { title: "📝 Thin descriptions", check: "thin-description", limit: 20 },
  ];

  for (const { title, check, limit } of groups) {
    const items = audit.findings.filter((f) => f.check === check);
    if (items.length === 0) continue;
    console.log(`${title} (${items.length})`);
    console.log("─".repeat(40));
    for (const f of items.slice(0, limit)) {
      console.log(`  ${f.files.join("  ↔  ")}`);
      console.log(`    ${f.detail}`);
    }
    if (items.length > limit) console.log(`  ... and ${items.length - limit} more`);
    console.log();
  }

  console.log("═".repeat(60));
  if (audit.summary.flagged > 0) {
    console.log(
      `Run \`/dataset-review\` to LLM-review the ${audit.summary.flagged} flagged finding(s).`
    );
  } else {
    console.log("No findings need LLM review — deterministic checks are clean.");
  }
}

// =============================================================================
// RUN
// =============================================================================

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const fast = args.includes("--fast");

// Parse against the schema so a shape regression fails loudly rather than
// silently emitting malformed JSON the workflow / Tier 2 would choke on.
const audit = DatasetAuditSchema.parse(generateAudit(fast));

if (jsonOutput) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  printConsoleReport(audit);
}

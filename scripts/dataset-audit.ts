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
 *   5. aggregator-url    — canonical `url` points at an aggregator
 *                          (KVR, ModularGrid, ...) instead of an official
 *                          page. Fix via scripts/promote-canonical-urls.ts
 *                          or manual research; acceptable only when no
 *                          official page exists.
 *   6. cv-gate-category  — a `cv/gate` or `clock` io jack filed under a
 *                          category other than `audio` (AUREO-1103).
 *   7. expression-typed-cv — an io jack named for an expression or pedal
 *                          jack, in either direction, but typed `cv/gate`
 *                          instead of `expression` (AUREO-1103).
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
import { isAggregatorUrl, isManufacturerOwnDomain, urlHost } from "./lib/aggregator-domains.js";
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
  "aggregator-url",
  "name-tagline",
  "bundle-entry",
  "suspect-pin",
  "cv-gate-category",
  "expression-typed-cv",
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
      aggregatorUrl: z.number(),
      nameTagline: z.number(),
      bundleEntry: z.number(),
      suspectPin: z.number(),
      cvGateCategory: z.number(),
      expressionTypedCv: z.number(),
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

export interface LoadedProduct {
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

/**
 * Canonical `url` pointing at an aggregator/marketplace instead of an
 * official page. Deterministic to detect; fixing needs the promote
 * script or manual research, so these are not Tier-2 flagged. Skipped
 * when the aggregator domain is the manufacturer's own (best-service).
 */
function checkAggregatorUrls(dataset: Dataset): Finding[] {
  const findings: Finding[] = [];
  const flag = (
    collection: string,
    name: string,
    manufacturer: string | undefined,
    file: string,
    url: string
  ): void => {
    findings.push({
      check: "aggregator-url",
      severity: "info",
      needsLlmReview: false,
      collection,
      name,
      manufacturer,
      files: [relPath(file)],
      detail:
        `Canonical url points at aggregator ${urlHost(url)} — promote an official page ` +
        "(scripts/promote-canonical-urls.ts) or confirm none exists.",
    });
  };
  for (const p of dataset.products) {
    const url = (p.entry as { url?: string }).url;
    if (!url || !isAggregatorUrl(url)) continue;
    if (p.entry.manufacturer && isManufacturerOwnDomain(p.entry.manufacturer, url)) continue;
    flag(p.type, p.entry.name, p.entry.manufacturer, p.file, url);
  }
  for (const m of dataset.manufacturers) {
    const url = m.entry.url;
    if (!url || !isAggregatorUrl(url) || isManufacturerOwnDomain(m.slug, url)) continue;
    flag("manufacturers", m.entry.name, undefined, m.file, url);
  }
  return findings;
}

/**
 * Plain-hyphen name suffixes are too common in real product names to be a
 * validation warning (en/em-dash and pipe forms are — W130), but a long,
 * digit-free suffix is often a scraped marketing tagline
 * ("Iron Cobra 200 Hi-Hat Stand - Single Braced Legs" is legit;
 * "Dream Sequence - Programmable Pedal Sequencer" is not). Ambiguous by
 * construction, so every hit goes to Tier-2 LLM review.
 */
function checkNameTaglines(products: LoadedProduct[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    const name = p.entry.name ?? "";
    const match = name.match(/\s-\s(.+)$/);
    if (!match) continue;
    const suffix = match[1];
    // Short or number-bearing suffixes are usually variant/spec qualifiers.
    if (/\d/.test(suffix) || suffix.trim().split(/\s+/).length < 3) continue;
    findings.push({
      check: "name-tagline",
      severity: "info",
      needsLlmReview: true,
      collection: p.type,
      name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail: `Name suffix "- ${suffix}" may be a marketing tagline — verify against the official product name.`,
    });
  }
  return findings;
}

/**
 * Standalone bundle/suite entries are not accepted: a bundle is a commercial
 * SKU, not a discrete product — import the member products instead.
 * Integrated products that merely carry "Suite"/"Bundle" in the name (sold
 * only as one unit, members not available separately) are allowlisted here
 * after human review.
 */
const BUNDLE_ALLOWLIST = new Set<string>([
  "aguilar-plugin-suite", // single product; members not sold separately
  "apogee-fx-bundle", // members not yet cataloged — replace with members, then delete
  "focusrite-red-plugin-suite", // one plugin package (Red 2 EQ + Red 3 compressor)
  "lexicon-lxp-native-reverb-plug-in-bundle", // LXP plugins only sold as the bundle
  "plugin-alliance-waldorf-edition-2", // members only available in the edition
  "psp-audioware-mixpack2", // Mix* processors only sold as the pack
  "soundtoys-effect-rack", // a single multi-effect plugin
  "waves-cla-effects", // a single signature-series plugin
]);

function checkBundleEntries(products: LoadedProduct[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    if (BUNDLE_ALLOWLIST.has(p.slug)) continue;
    const primary = (p.entry as { primaryCategory?: string }).primaryCategory ?? "";
    const byCategory = primary === "suite" || primary === "bundle";
    const byName = p.type === "software" && /\b(bundle|suite)\b/i.test(p.entry.name ?? "");
    if (!byCategory && !byName) continue;
    findings.push({
      check: "bundle-entry",
      severity: "warning",
      needsLlmReview: true,
      collection: p.type,
      name: p.entry.name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail:
        (byCategory
          ? `primaryCategory '${primary}' marks this as a bundle/suite. `
          : "Name suggests a bundle/suite. ") +
        "Standalone bundle entries are not accepted — import the member products and delete this, " +
        "or allowlist it in scripts/dataset-audit.ts if it is an integrated product.",
    });
  }
  return findings;
}

/**
 * `connection: pin` is a bulk-import dumping ground that means at least four
 * different physical things in the data: RCA "pin jacks" (Japanese-manual
 * phrasing on line/phono ports), bare terminal strips on install amps
 * (euroblock/barrier), speaker binding posts, and genuine phono-cartridge
 * pins — only the last is correctly `pin`. Since the connector decides what
 * the setup graph lets a user plug in, every remaining instance needs a
 * human/LLM look: reclassify to the real connector, or keep `pin` for
 * cartridge pins. One finding per product, not per port.
 */
function checkSuspectPins(products: LoadedProduct[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    const io = (p.entry as { io?: { name?: string; connection?: string }[] }).io;
    if (!io) continue;
    const pins = io.filter((port) => port.connection === "pin");
    if (pins.length === 0) continue;
    findings.push({
      check: "suspect-pin",
      severity: "info",
      needsLlmReview: true,
      collection: p.type,
      name: p.entry.name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail:
        `${pins.length} io port(s) use connection 'pin' (${pins
          .map((port) => port.name ?? "?")
          .slice(0, 4)
          .join(", ")}${pins.length > 4 ? ", …" : ""}). ` +
        "Reclassify to the real connector (rca, euroblock, binding-post, …) from the manual/photos, " +
        "or keep 'pin' only for genuine pin contacts (phono-cartridge pins, 500-series card edges).",
    });
  }
  return findings;
}

/** One io port as the audit reads it: only the keys the io checks look at. */
interface AuditIoPort {
  name?: string;
  category?: string;
  type?: string;
}

/** The io list of a hardware entry, empty for every other collection. */
function ioOf(entry: Product): AuditIoPort[] {
  const io = (entry as { io?: AuditIoPort[] }).io;
  return Array.isArray(io) ? io : [];
}

/** Analog control types that belong under `audio`; `word clock` is digital and stays so. */
const CV_AUDIO_TYPES = new Set(["cv/gate", "clock"]);
const EXPRESSION_NAME = /expression|pedal/i;

/** Up to four port names for a finding's detail, with an ellipsis past that. */
function portNames(ports: AuditIoPort[]): string {
  return (
    ports
      .map((port) => port.name ?? "?")
      .slice(0, 4)
      .join(", ") + (ports.length > 4 ? ", …" : "")
  );
}

/**
 * `cv/gate` and `clock` jacks filed under a category other than `audio`.
 * The catalog carries 2,060 cv/gate jacks under `audio` against 461 under
 * `digital` and 8 under `midi`, and the setup graph coloured a port by its
 * category, so a patch cable between a Maths and a Toolbox changed colour
 * at one end. The app now resolves CV by type first (AUREO-1099), which
 * hides the split on the canvas and nowhere else, and the next import adds
 * to it unless something says so. Deterministic: the fix is
 * `category: audio`. One finding per product, not per port.
 */
export function checkCvGateCategory(products: LoadedProduct[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    const off = ioOf(p.entry).filter(
      (port) => CV_AUDIO_TYPES.has(port.type ?? "") && port.category !== "audio"
    );
    if (off.length === 0) continue;
    const categories = [...new Set(off.map((port) => port.category ?? "?"))].join(", ");
    findings.push({
      check: "cv-gate-category",
      severity: "info",
      needsLlmReview: false,
      collection: p.type,
      name: p.entry.name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail:
        `${off.length} cv/gate or clock port(s) filed under category ${categories} ` +
        `(${portNames(off)}). CV, gate and clock jacks are category audio; word clock stays digital.`,
    });
  }
  return findings;
}

/**
 * A jack typed `cv/gate` whose name says it is an expression or pedal
 * jack. The convention (CLAUDE.md, "Footswitch and expression jacks")
 * already makes these `type: expression`; Strymon and Fender entries type
 * them `cv/gate` and Chase Bliss entries `expression`, and since
 * AUREO-1098 the setup graph draws that as a square on one pedal and a
 * triangle on the next for the same kind of jack. Mostly mechanical, but
 * a module's "Expression CV In" really is a CV input fed by a pedal, so
 * each one gets a Tier-2 look rather than a blanket rewrite. Direction is
 * deliberately not a filter: an "Expression Out" that drives a pedal's
 * expression input (Cre8audio NiftyKEYZ, ALM SBG) is an expression jack
 * on the sending side, and only the review can say whether it is.
 */
export function checkExpressionTypedCv(products: LoadedProduct[]): Finding[] {
  const findings: Finding[] = [];
  for (const p of products) {
    const typed = ioOf(p.entry).filter(
      (port) => port.type === "cv/gate" && EXPRESSION_NAME.test(port.name ?? "")
    );
    if (typed.length === 0) continue;
    findings.push({
      check: "expression-typed-cv",
      severity: "info",
      needsLlmReview: true,
      collection: p.type,
      name: p.entry.name,
      manufacturer: p.entry.manufacturer,
      files: [relPath(p.file)],
      detail:
        `${typed.length} port(s) named for an expression or pedal jack are typed cv/gate ` +
        `(${portNames(typed)}). Footswitch and expression jacks are category audio, type expression; ` +
        "keep cv/gate only where the jack is a CV input that happens to accept a pedal.",
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
    ...checkAggregatorUrls(dataset),
    ...checkNameTaglines(dataset.products),
    ...checkBundleEntries(dataset.products),
    ...checkSuspectPins(dataset.products),
    ...checkCvGateCategory(dataset.products),
    ...checkExpressionTypedCv(dataset.products),
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
    aggregatorUrl: findings.filter((f) => f.check === "aggregator-url").length,
    nameTagline: findings.filter((f) => f.check === "name-tagline").length,
    bundleEntry: findings.filter((f) => f.check === "bundle-entry").length,
    suspectPin: findings.filter((f) => f.check === "suspect-pin").length,
    cvGateCategory: findings.filter((f) => f.check === "cv-gate-category").length,
    expressionTypedCv: findings.filter((f) => f.check === "expression-typed-cv").length,
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
  console.log(`  Aggregator urls:        ${audit.summary.byCheck.aggregatorUrl}`);
  console.log(`  Name taglines:          ${audit.summary.byCheck.nameTagline}`);
  console.log(`  Bundle entries:         ${audit.summary.byCheck.bundleEntry}`);
  console.log(`  Suspect pin connectors: ${audit.summary.byCheck.suspectPin}`);
  console.log(`  CV/clock not audio:     ${audit.summary.byCheck.cvGateCategory}`);
  console.log(`  Expression typed cv:    ${audit.summary.byCheck.expressionTypedCv}`);
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
    { title: "🔀 Aggregator canonical urls", check: "aggregator-url", limit: 20 },
    { title: "✂️  Possible name taglines", check: "name-tagline", limit: 20 },
    { title: "📦 Bundle entries", check: "bundle-entry", limit: 20 },
    { title: "📌 Suspect pin connectors", check: "suspect-pin", limit: 20 },
    { title: "🎛  CV and clock jacks outside audio", check: "cv-gate-category", limit: 20 },
    { title: "🦶 Expression jacks typed cv/gate", check: "expression-typed-cv", limit: 20 },
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

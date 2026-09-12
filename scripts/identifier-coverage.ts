#!/usr/bin/env tsx
/**
 * Identifier Coverage Report
 *
 * Generates a report of identifier coverage across software entries:
 * - Overall coverage percentage
 * - Coverage by format type
 * - Priority list of entries missing identifiers
 *
 * Every figure counts what the build resolves onto `software_formats`,
 * fallbacks included (lib/identifier-fallback.ts): an entry is covered when
 * at least one of its listed formats gets an identifier, and a format is
 * missing when the resolver yields nothing for it. A `productId` key or a
 * `default` on an entry with no formats declares something and covers
 * nothing, and is reported that way.
 *
 * Usage:
 *   pnpm identifier-coverage             # Console output
 *   pnpm identifier-coverage --json      # JSON output
 */

import path from "node:path";
import { resolveFormatIdentifier } from "./lib/identifier-fallback.js";
import { validateIdentifier } from "./lib/identifier-validation.js";
import type { Software } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

// =============================================================================
// TYPES
// =============================================================================

interface SoftwareEntry {
  file: string;
  name: string;
  formats: string[];
  /** At least one listed format resolves to an identifier. */
  hasIdentifiers: boolean;
  identifiers: Record<string, string>;
  resolvedFormats: string[];
  missingFormats: string[];
  invalidIdentifiers: { format: string; value: string; error: string }[];
}

interface FormatCoverage {
  format: string;
  entriesWithFormat: number;
  entriesWithIdentifier: number;
  coveragePercent: number;
}

interface CoverageReport {
  generatedAt: string;
  summary: {
    totalSoftware: number;
    withIdentifiers: number;
    withoutIdentifiers: number;
    /** Entries carrying an `identifiers` block that resolves onto no format. */
    declaredUnresolved: number;
    coveragePercent: number;
    invalidIdentifiers: number;
  };
  byFormat: FormatCoverage[];
  priority: {
    high: SoftwareEntry[];
    medium: SoftwareEntry[];
    low: SoftwareEntry[];
  };
  invalidIdentifiers: {
    file: string;
    name: string;
    format: string;
    value: string;
    error: string;
  }[];
}

// =============================================================================
// ANALYSIS
// =============================================================================

function analyzeSoftware(filePath: string, data: Software): SoftwareEntry {
  const relativePath = path.relative(DATA_DIR, filePath);
  const formats = data.formats || [];
  const identifiers = data.identifiers || {};

  // What the build writes: a format resolves or it does not, fallbacks included
  const resolvedFormats = formats.filter((f) => resolveFormatIdentifier(identifiers, f) !== null);
  const missingFormats = formats.filter(
    (f) => resolveFormatIdentifier(identifiers, f) === null && f !== "standalone"
  );
  const hasIdentifiers = resolvedFormats.length > 0;

  // Validate existing identifiers
  const invalidIdentifiers: { format: string; value: string; error: string }[] = [];
  for (const [format, value] of Object.entries(identifiers)) {
    const result = validateIdentifier(format, value);
    if (!result.valid && result.error) {
      invalidIdentifiers.push({ format, value, error: result.error });
    }
  }

  return {
    file: relativePath,
    name: data.name,
    formats,
    hasIdentifiers,
    identifiers,
    resolvedFormats,
    missingFormats,
    invalidIdentifiers,
  };
}

function calculateFormatCoverage(entries: SoftwareEntry[]): FormatCoverage[] {
  const formatStats = new Map<string, { withFormat: number; withIdentifier: number }>();

  for (const entry of entries) {
    for (const format of entry.formats) {
      if (format === "standalone") continue; // Skip standalone

      if (!formatStats.has(format)) {
        formatStats.set(format, { withFormat: 0, withIdentifier: 0 });
      }

      const stats = formatStats.get(format);
      if (stats) {
        stats.withFormat++;
        if (resolveFormatIdentifier(entry.identifiers, format)) {
          stats.withIdentifier++;
        }
      }
    }
  }

  const coverage: FormatCoverage[] = [];
  for (const [format, stats] of formatStats) {
    coverage.push({
      format,
      entriesWithFormat: stats.withFormat,
      entriesWithIdentifier: stats.withIdentifier,
      coveragePercent:
        stats.withFormat > 0 ? Math.round((stats.withIdentifier / stats.withFormat) * 100) : 0,
    });
  }

  // Sort by number of entries with format (descending)
  return coverage.sort((a, b) => b.entriesWithFormat - a.entriesWithFormat);
}

function categorizePriority(entries: SoftwareEntry[]): CoverageReport["priority"] {
  const high: SoftwareEntry[] = [];
  const medium: SoftwareEntry[] = [];
  const low: SoftwareEntry[] = [];

  for (const entry of entries) {
    // Every listed format resolves: nothing to add. An entry whose formats
    // resolve only partly (a `bundle` beside vst3 and aax) is listed by what
    // is still missing, since a declared key is not coverage of the rest.
    if (entry.hasIdentifiers && entry.missingFormats.length === 0) continue;

    // High priority: an AU, VST3, AAX or CLAP row will carry no identifier
    const missingPluginFormat = entry.missingFormats.some((f) =>
      ["au", "vst3", "aax", "clap"].includes(f)
    );

    if (missingPluginFormat) {
      high.push(entry);
    } else if (entry.missingFormats.length > 0) {
      // Medium priority: other plugin formats without an identifier
      medium.push(entry);
    } else {
      // Low priority: standalone only or no formats
      low.push(entry);
    }
  }

  return { high, medium, low };
}

// =============================================================================
// MAIN
// =============================================================================

function generateReport(): CoverageReport {
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  const entries: SoftwareEntry[] = [];

  for (const file of softwareFiles) {
    const data = loadYamlFile<Software>(file);
    entries.push(analyzeSoftware(file, data));
  }

  const withIdentifiers = entries.filter((e) => e.hasIdentifiers).length;
  const withoutIdentifiers = entries.length - withIdentifiers;
  const declaredUnresolved = entries.filter(
    (e) => !e.hasIdentifiers && Object.keys(e.identifiers).length > 0
  ).length;

  const allInvalid: CoverageReport["invalidIdentifiers"] = [];
  for (const entry of entries) {
    for (const invalid of entry.invalidIdentifiers) {
      allInvalid.push({
        file: entry.file,
        name: entry.name,
        ...invalid,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSoftware: entries.length,
      withIdentifiers,
      withoutIdentifiers,
      declaredUnresolved,
      coveragePercent:
        entries.length > 0 ? Math.round((withIdentifiers / entries.length) * 100) : 0,
      invalidIdentifiers: allInvalid.length,
    },
    byFormat: calculateFormatCoverage(entries),
    priority: categorizePriority(entries),
    invalidIdentifiers: allInvalid,
  };
}

function printConsoleReport(report: CoverageReport): void {
  console.log("\n📊 Identifier Coverage Report");
  console.log("═".repeat(60));
  console.log(`Generated: ${report.generatedAt}`);
  console.log();

  // Summary
  console.log("📈 Summary");
  console.log("─".repeat(40));
  console.log(`  Total software:      ${report.summary.totalSoftware}`);
  console.log(`  With identifiers:    ${report.summary.withIdentifiers}`);
  console.log(`  Without identifiers: ${report.summary.withoutIdentifiers}`);
  if (report.summary.declaredUnresolved > 0) {
    console.log(`    declared, unusable: ${report.summary.declaredUnresolved}`);
  }
  console.log(`  Coverage:            ${report.summary.coveragePercent}%`);
  if (report.summary.invalidIdentifiers > 0) {
    console.log(`  Invalid identifiers: ${report.summary.invalidIdentifiers}`);
  }
  console.log();

  // Coverage by format
  if (report.byFormat.length > 0) {
    console.log("📋 Coverage by Format");
    console.log("─".repeat(40));
    console.log("  Format     Entries   With ID   Coverage");
    console.log(`  ${"─".repeat(38)}`);
    for (const fc of report.byFormat) {
      const format = fc.format.padEnd(10);
      const entries = String(fc.entriesWithFormat).padStart(7);
      const withId = String(fc.entriesWithIdentifier).padStart(9);
      const coverage = `${fc.coveragePercent}%`.padStart(10);
      console.log(`  ${format}${entries}${withId}${coverage}`);
    }
    console.log();
  }

  // High priority missing
  if (report.priority.high.length > 0) {
    console.log("🔴 High Priority (missing AU/VST3/AAX/CLAP identifiers)");
    console.log("─".repeat(40));
    for (const entry of report.priority.high.slice(0, 10)) {
      console.log(`  ${entry.file}`);
      console.log(`    ${entry.name} - missing: ${entry.missingFormats.join(", ")}`);
    }
    if (report.priority.high.length > 10) {
      console.log(`  ... and ${report.priority.high.length - 10} more`);
    }
    console.log();
  }

  // Invalid identifiers
  if (report.invalidIdentifiers.length > 0) {
    console.log("⚠️  Invalid Identifiers");
    console.log("─".repeat(40));
    for (const inv of report.invalidIdentifiers.slice(0, 10)) {
      console.log(`  ${inv.file}`);
      console.log(`    ${inv.format}: ${inv.value}`);
      console.log(`    Error: ${inv.error}`);
    }
    if (report.invalidIdentifiers.length > 10) {
      console.log(`  ... and ${report.invalidIdentifiers.length - 10} more`);
    }
    console.log();
  }

  console.log("═".repeat(60));
}

// Run
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

const report = generateReport();

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printConsoleReport(report);
}

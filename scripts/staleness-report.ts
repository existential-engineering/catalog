#!/usr/bin/env tsx
/**
 * Staleness Report Script
 *
 * Generates a report of entries that may need verification:
 * - Entries never verified
 * - Entries not verified in a long time
 * - Prices that may be outdated
 * - Potentially discontinued products
 *
 * Usage:
 *   pnpm staleness-report             # Console output
 *   pnpm staleness-report --json      # JSON output
 */

import path from "node:path";
import { loadYamlFile, getYamlFiles, DATA_DIR } from "./lib/utils.js";
import type { Software, Hardware, Price } from "./lib/types.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Days after which an entry is considered stale */
const ENTRY_STALE_DAYS = 180;

/** Days after which a price is considered stale */
const PRICE_STALE_DAYS = 90;

// =============================================================================
// TYPES
// =============================================================================

interface StaleEntry {
  file: string;
  name: string;
  type: "software" | "hardware";
  lastVerified?: string;
  daysSinceVerification?: number;
  status?: string;
}

interface StalePrice {
  file: string;
  name: string;
  type: "software" | "hardware";
  priceAsOf?: string;
  daysSincePriceCheck?: number;
  amount: number;
  currency: string;
}

interface StalenessReport {
  generatedAt: string;
  thresholds: {
    entryDays: number;
    priceDays: number;
  };
  summary: {
    totalEntries: number;
    neverVerified: number;
    staleEntries: number;
    stalePrices: number;
    discontinued: number;
  };
  neverVerified: StaleEntry[];
  staleEntries: StaleEntry[];
  stalePrices: StalePrice[];
  discontinued: StaleEntry[];
}

// =============================================================================
// HELPERS
// =============================================================================

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function processEntry(
  filePath: string,
  data: Software | Hardware,
  type: "software" | "hardware",
  report: StalenessReport
): void {
  const relativePath = path.relative(DATA_DIR, filePath);

  // Check verification status
  if (!data.verification?.lastVerified) {
    report.neverVerified.push({
      file: relativePath,
      name: data.name,
      type,
      status: data.verification?.status,
    });
  } else {
    const days = daysSince(data.verification.lastVerified);
    if (days > ENTRY_STALE_DAYS) {
      report.staleEntries.push({
        file: relativePath,
        name: data.name,
        type,
        lastVerified: data.verification.lastVerified,
        daysSinceVerification: days,
        status: data.verification?.status,
      });
    }
  }

  // Check for discontinued status
  if (data.verification?.status === "discontinued") {
    report.discontinued.push({
      file: relativePath,
      name: data.name,
      type,
      lastVerified: data.verification.lastVerified,
      status: "discontinued",
    });
  }

  // Check prices
  if (data.prices) {
    for (const price of data.prices) {
      if (price.asOf) {
        const days = daysSince(price.asOf);
        if (days > PRICE_STALE_DAYS) {
          report.stalePrices.push({
            file: relativePath,
            name: data.name,
            type,
            priceAsOf: price.asOf,
            daysSincePriceCheck: days,
            amount: price.amount,
            currency: price.currency,
          });
        }
      }
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

function generateReport(): StalenessReport {
  const report: StalenessReport = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      entryDays: ENTRY_STALE_DAYS,
      priceDays: PRICE_STALE_DAYS,
    },
    summary: {
      totalEntries: 0,
      neverVerified: 0,
      staleEntries: 0,
      stalePrices: 0,
      discontinued: 0,
    },
    neverVerified: [],
    staleEntries: [],
    stalePrices: [],
    discontinued: [],
  };

  // Process software entries
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  for (const file of softwareFiles) {
    const data = loadYamlFile<Software>(file);
    processEntry(file, data, "software", report);
    report.summary.totalEntries++;
  }

  // Process hardware entries
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  for (const file of hardwareFiles) {
    const data = loadYamlFile<Hardware>(file);
    processEntry(file, data, "hardware", report);
    report.summary.totalEntries++;
  }

  // Update summary counts
  report.summary.neverVerified = report.neverVerified.length;
  report.summary.staleEntries = report.staleEntries.length;
  report.summary.stalePrices = report.stalePrices.length;
  report.summary.discontinued = report.discontinued.length;

  return report;
}

function printConsoleReport(report: StalenessReport): void {
  console.log("\n📊 Staleness Report");
  console.log("═".repeat(60));
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Thresholds: ${report.thresholds.entryDays} days (entries), ${report.thresholds.priceDays} days (prices)`);
  console.log();

  // Summary
  console.log("📈 Summary");
  console.log("─".repeat(40));
  console.log(`  Total entries:    ${report.summary.totalEntries}`);
  console.log(`  Never verified:   ${report.summary.neverVerified}`);
  console.log(`  Stale entries:    ${report.summary.staleEntries}`);
  console.log(`  Stale prices:     ${report.summary.stalePrices}`);
  console.log(`  Discontinued:     ${report.summary.discontinued}`);
  console.log();

  // Never verified
  if (report.neverVerified.length > 0) {
    console.log("🔍 Never Verified");
    console.log("─".repeat(40));
    for (const entry of report.neverVerified.slice(0, 20)) {
      console.log(`  ${entry.file}`);
      console.log(`    ${entry.name} (${entry.type})`);
    }
    if (report.neverVerified.length > 20) {
      console.log(`  ... and ${report.neverVerified.length - 20} more`);
    }
    console.log();
  }

  // Stale entries
  if (report.staleEntries.length > 0) {
    console.log("⏰ Stale Entries (not verified in 180+ days)");
    console.log("─".repeat(40));
    for (const entry of report.staleEntries.slice(0, 10)) {
      console.log(`  ${entry.file}`);
      console.log(`    ${entry.name} - last verified ${entry.daysSinceVerification} days ago`);
    }
    if (report.staleEntries.length > 10) {
      console.log(`  ... and ${report.staleEntries.length - 10} more`);
    }
    console.log();
  }

  // Stale prices
  if (report.stalePrices.length > 0) {
    console.log("💰 Stale Prices (not checked in 90+ days)");
    console.log("─".repeat(40));
    for (const price of report.stalePrices.slice(0, 10)) {
      console.log(`  ${price.file}`);
      console.log(`    ${price.name} - ${price.currency} ${price.amount} (${price.daysSincePriceCheck} days old)`);
    }
    if (report.stalePrices.length > 10) {
      console.log(`  ... and ${report.stalePrices.length - 10} more`);
    }
    console.log();
  }

  // Discontinued
  if (report.discontinued.length > 0) {
    console.log("🚫 Discontinued Products");
    console.log("─".repeat(40));
    for (const entry of report.discontinued) {
      console.log(`  ${entry.file}`);
      console.log(`    ${entry.name} (${entry.type})`);
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

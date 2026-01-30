#!/usr/bin/env tsx
/**
 * Query Performance Benchmark
 *
 * Measures query performance for common database operations.
 * Helps identify potential performance regressions.
 *
 * Usage:
 *   pnpm benchmark             # Run benchmarks
 *   pnpm benchmark --json      # JSON output
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR } from "./lib/utils.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const ITERATIONS = 100;
const OUTPUT_FILE = path.join(OUTPUT_DIR, "catalog.sqlite");

// =============================================================================
// TYPES
// =============================================================================

interface BenchmarkResult {
  name: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  iterations: number;
}

interface BenchmarkReport {
  generatedAt: string;
  databaseSize: number;
  databaseSizeKB: number;
  counts: {
    manufacturers: number;
    software: number;
    hardware: number;
  };
  benchmarks: BenchmarkResult[];
}

// =============================================================================
// BENCHMARK RUNNER
// =============================================================================

function benchmark(
  name: string,
  fn: () => void
): BenchmarkResult {
  const times: number[] = [];

  // Warm up
  for (let i = 0; i < 10; i++) {
    fn();
  }

  // Measure
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  return {
    name,
    avgMs: times.reduce((a, b) => a + b, 0) / times.length,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    iterations: ITERATIONS,
  };
}

// =============================================================================
// MAIN
// =============================================================================

function runBenchmarks(): BenchmarkReport {
  // Check if database exists
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`Database not found: ${OUTPUT_FILE}`);
    console.error("Run 'pnpm build' first to generate the database.");
    process.exit(1);
  }

  const db = new Database(OUTPUT_FILE, { readonly: true });
  const stats = fs.statSync(OUTPUT_FILE);

  // Get counts
  const manufacturerCount = (
    db.prepare("SELECT COUNT(*) as count FROM manufacturers").get() as {
      count: number;
    }
  ).count;
  const softwareCount = (
    db.prepare("SELECT COUNT(*) as count FROM software").get() as {
      count: number;
    }
  ).count;
  const hardwareCount = (
    db.prepare("SELECT COUNT(*) as count FROM hardware").get() as {
      count: number;
    }
  ).count;

  // Prepare statements for benchmarks
  const stmts = {
    // FTS queries
    ftsSimple: db.prepare(
      "SELECT * FROM software_fts WHERE software_fts MATCH ? LIMIT 10"
    ),
    ftsManufacturer: db.prepare(
      "SELECT * FROM software_fts WHERE software_fts MATCH ? LIMIT 10"
    ),
    ftsHardware: db.prepare(
      "SELECT * FROM hardware_fts WHERE hardware_fts MATCH ? LIMIT 10"
    ),

    // Lookups
    softwareById: db.prepare("SELECT * FROM software WHERE id = ?"),
    softwareByManufacturer: db.prepare(
      "SELECT * FROM software WHERE manufacturer_id = ?"
    ),
    manufacturerByName: db.prepare(
      "SELECT * FROM manufacturers WHERE name LIKE ?"
    ),

    // Joins
    softwareWithManufacturer: db.prepare(`
      SELECT s.*, m.name as manufacturer_name
      FROM software s
      JOIN manufacturers m ON s.manufacturer_id = m.id
      LIMIT 20
    `),
    hardwareWithManufacturer: db.prepare(`
      SELECT h.*, m.name as manufacturer_name
      FROM hardware h
      JOIN manufacturers m ON h.manufacturer_id = m.id
      LIMIT 20
    `),

    // Pagination
    paginationPage1: db.prepare("SELECT * FROM software LIMIT 20 OFFSET 0"),
    paginationPage5: db.prepare("SELECT * FROM software LIMIT 20 OFFSET 80"),

    // Aggregations
    categoryCounts: db.prepare(`
      SELECT category, COUNT(*) as count
      FROM software_categories
      GROUP BY category
      ORDER BY count DESC
    `),
    formatCounts: db.prepare(`
      SELECT format, COUNT(*) as count
      FROM software_formats
      GROUP BY format
      ORDER BY count DESC
    `),

    // Complex queries
    softwareByCategory: db.prepare(`
      SELECT s.*, m.name as manufacturer_name
      FROM software s
      JOIN manufacturers m ON s.manufacturer_id = m.id
      JOIN software_categories sc ON s.id = sc.software_id
      WHERE sc.category = ?
      LIMIT 20
    `),
  };

  // Get a sample manufacturer ID for lookups
  const sampleManufacturer = db
    .prepare("SELECT id FROM manufacturers LIMIT 1")
    .get() as { id: string } | undefined;
  const sampleManufacturerId = sampleManufacturer?.id || "";
  if (!sampleManufacturer) {
    console.warn("Warning: No manufacturers found - lookup benchmarks will query empty results");
  }

  // Get a sample software ID
  const sampleSoftware = db
    .prepare("SELECT id FROM software LIMIT 1")
    .get() as { id: string } | undefined;
  const sampleSoftwareId = sampleSoftware?.id || "";
  if (!sampleSoftware) {
    console.warn("Warning: No software found - lookup benchmarks will query empty results");
  }

  // Run benchmarks
  const benchmarks: BenchmarkResult[] = [
    // FTS
    benchmark("FTS: simple term (synth)", () => {
      stmts.ftsSimple.all("synth");
    }),
    benchmark("FTS: manufacturer name", () => {
      stmts.ftsManufacturer.all("native instruments");
    }),
    benchmark("FTS: hardware search", () => {
      stmts.ftsHardware.all("audio interface");
    }),

    // Lookups
    benchmark("Lookup: software by ID", () => {
      stmts.softwareById.get(sampleSoftwareId);
    }),
    benchmark("Lookup: software by manufacturer", () => {
      stmts.softwareByManufacturer.all(sampleManufacturerId);
    }),
    benchmark("Lookup: manufacturer by name (LIKE)", () => {
      stmts.manufacturerByName.all("Native%");
    }),

    // Joins
    benchmark("Join: software + manufacturer", () => {
      stmts.softwareWithManufacturer.all();
    }),
    benchmark("Join: hardware + manufacturer", () => {
      stmts.hardwareWithManufacturer.all();
    }),

    // Pagination
    benchmark("Pagination: page 1 (offset 0)", () => {
      stmts.paginationPage1.all();
    }),
    benchmark("Pagination: page 5 (offset 80)", () => {
      stmts.paginationPage5.all();
    }),

    // Aggregations
    benchmark("Aggregate: category counts", () => {
      stmts.categoryCounts.all();
    }),
    benchmark("Aggregate: format counts", () => {
      stmts.formatCounts.all();
    }),

    // Complex
    benchmark("Complex: software by category (join)", () => {
      stmts.softwareByCategory.all("synthesizer");
    }),
  ];

  db.close();

  return {
    generatedAt: new Date().toISOString(),
    databaseSize: stats.size,
    databaseSizeKB: Math.round(stats.size / 1024),
    counts: {
      manufacturers: manufacturerCount,
      software: softwareCount,
      hardware: hardwareCount,
    },
    benchmarks,
  };
}

function printConsoleReport(report: BenchmarkReport): void {
  console.log("\n📊 Query Performance Benchmarks");
  console.log("═".repeat(70));
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Database size: ${report.databaseSizeKB} KB`);
  console.log(
    `Entries: ${report.counts.manufacturers} manufacturers, ` +
      `${report.counts.software} software, ${report.counts.hardware} hardware`
  );
  console.log(`Iterations per benchmark: ${ITERATIONS}`);
  console.log();

  console.log("Query".padEnd(45) + "Avg (ms)".padStart(10) + "Min".padStart(10) + "Max".padStart(10));
  console.log("─".repeat(75));

  for (const result of report.benchmarks) {
    const name = result.name.length > 44 ? result.name.slice(0, 41) + "..." : result.name;
    console.log(
      name.padEnd(45) +
        result.avgMs.toFixed(3).padStart(10) +
        result.minMs.toFixed(3).padStart(10) +
        result.maxMs.toFixed(3).padStart(10)
    );
  }

  console.log("─".repeat(75));

  // Summary
  const avgOfAvg =
    report.benchmarks.reduce((sum, r) => sum + r.avgMs, 0) / report.benchmarks.length;
  console.log(`\nOverall average: ${avgOfAvg.toFixed(3)} ms`);

  // Warn about slow queries
  const slowQueries = report.benchmarks.filter((r) => r.avgMs > 1);
  if (slowQueries.length > 0) {
    console.log("\n⚠️  Queries exceeding 1ms:");
    for (const q of slowQueries) {
      console.log(`   ${q.name}: ${q.avgMs.toFixed(3)} ms`);
    }
  }

  console.log("\n" + "═".repeat(70));
}

// Run
const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");

const report = runBenchmarks();

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printConsoleReport(report);
}

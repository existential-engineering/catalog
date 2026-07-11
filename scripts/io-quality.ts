#!/usr/bin/env tsx
/**
 * IO Quality & Coverage Report
 *
 * Scores every hardware entry's I/O data and emits a prioritized worklist for
 * enrichment (issue #212 follow-up). Surfaces three kinds of gap:
 *
 *   1. Correctness smells — likely-wrong I/O that needs fixing:
 *      - combine candidates: maxConnections > 1 on a single-jack connection
 *        (each physical jack should be its own entry with maxConnections: 1)
 *      - collapsed-pair names: one entry named like a stereo/numbered pair
 *        ("Outputs 1/2", "Analog In L/R") that likely represents two jacks
 *      - uniform position: many jacks all sharing one `position` (a guessed
 *        import default, like the H90's original "all Bottom")
 *   2. Missing I/O — connectivity-heavy devices with no `io` at all.
 *   3. Spatial gap — entries with I/O but no columnPosition/rowPosition, the
 *      raw material the setup graph needs (densest devices first).
 *
 * The report is advisory triage: heuristics favor recall, so a human reviews
 * the worklist. The high-precision subset is enforced separately as warning
 * W128 in `pnpm validate`.
 *
 * Usage:
 *   pnpm io-quality                # console report
 *   pnpm io-quality --json         # machine-readable
 *   pnpm io-quality --limit 40     # rows per worklist (default 20)
 */

import path from "node:path";
import { isIoCombineCandidate } from "./lib/io-heuristics.js";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, SCHEMA_DIR } from "./lib/utils.js";

// =============================================================================
// HEURISTIC CONFIG
// =============================================================================

/**
 * Names that look like a collapsed stereo/numbered pair ("Outputs 1/2",
 * "Analog In L/R"). The numbered form excludes connector sizes like "1/4-inch"
 * or "1/8 inch" so a port that merely names its jack size isn't flagged.
 */
const COLLAPSED_PAIR_NAME =
  /\bl\s*\/\s*r\b|\bl\s*\+\s*r\b|\b\d+\s*\/\s*\d+\b(?!\s*-?\s*(inch|mm|"|”))/i;

/** Minimum jack count before "everything on one edge" is treated as a smell. */
const UNIFORM_POSITION_MIN_IO = 4;

/**
 * Categories where a device almost always has meaningful connectivity, so a
 * missing `io` array is a real gap. Weight drives worklist ordering.
 */
const CONNECTIVITY_WEIGHTS: Record<string, number> = {
  "audio-interface": 10,
  mixer: 10,
  "control-surface": 8,
  synthesizer: 8,
  sampler: 8,
  groovebox: 8,
  "drum-machine": 8,
  "multi-effect": 7,
  sequencer: 7,
  preamp: 6,
  compressor: 6,
  equalizer: 6,
  "midi-controller": 6,
  "guitar-amplifier": 5,
  "power-amp": 5,
  pedal: 5,
  "di-box": 5,
  "studio-monitor": 4,
  subwoofer: 4,
  speaker: 3,
};

// =============================================================================
// ANALYSIS
// =============================================================================

interface HardwareIoEntry {
  file: string;
  name: string;
  category: string;
  ioCount: number;
  hasIo: boolean;
  combineCandidates: number;
  collapsedNames: number;
  uniformPosition: boolean;
  spatialCoverage: number; // 0..1 of io entries with column/row
  spatialGap: boolean; // has io but zero column/row
  missingIo: boolean; // connectivity category with no io
  correctnessScore: number;
}

function analyze(filePath: string, data: Hardware, positionExempt: Set<string>): HardwareIoEntry {
  const io = Array.isArray(data.io) ? data.io : [];
  const category = data.primaryCategory ?? "";
  const exempt = positionExempt.has(category);

  const combineCandidates = io.filter(isIoCombineCandidate).length;
  const collapsedNames = io.filter((p) => p.name && COLLAPSED_PAIR_NAME.test(p.name)).length;

  const positions = io.map((p) => p.position).filter(Boolean);
  const uniformPosition =
    !exempt &&
    io.length >= UNIFORM_POSITION_MIN_IO &&
    positions.length === io.length &&
    new Set(positions).size === 1;

  const withColRow = io.filter(
    (p) => p.columnPosition !== undefined || p.rowPosition !== undefined
  ).length;
  const spatialCoverage = io.length > 0 ? withColRow / io.length : 0;

  const correctnessScore = combineCandidates * 5 + collapsedNames * 3 + (uniformPosition ? 2 : 0);

  return {
    file: path.relative(DATA_DIR, filePath),
    name: data.name,
    category,
    ioCount: io.length,
    hasIo: io.length > 0,
    combineCandidates,
    collapsedNames,
    uniformPosition,
    spatialCoverage,
    spatialGap: io.length > 0 && withColRow === 0 && !exempt,
    missingIo: io.length === 0 && category in CONNECTIVITY_WEIGHTS,
    correctnessScore,
  };
}

interface IoQualityReport {
  generatedAt: string;
  summary: {
    totalHardware: number;
    withIo: number;
    withIoPercent: number;
    withSpatial: number;
    withSpatialPercent: number;
    combineCandidates: number;
    collapsedNameEntries: number;
    uniformPositionEntries: number;
    missingIoInConnectivityCategories: number;
  };
  worklists: {
    correctness: HardwareIoEntry[];
    missingIo: HardwareIoEntry[];
    spatial: HardwareIoEntry[];
  };
}

function generateReport(limit: number): IoQualityReport {
  const groups = loadYamlFile<{ groups: Record<string, string[]> }>(
    path.join(SCHEMA_DIR, "category-groups.yaml")
  );
  const positionExempt = new Set(groups.groups.Instruments ?? []);

  const files = getYamlFiles(path.join(DATA_DIR, "hardware"));
  const entries = files.map((f) => analyze(f, loadYamlFile<Hardware>(f), positionExempt));

  const withIo = entries.filter((e) => e.hasIo).length;
  const withSpatial = entries.filter((e) => e.spatialCoverage > 0).length;
  const pct = (n: number) => (entries.length > 0 ? Math.round((n / entries.length) * 100) : 0);

  const correctness = entries
    .filter((e) => e.correctnessScore > 0)
    .sort((a, b) => b.correctnessScore - a.correctnessScore || b.ioCount - a.ioCount)
    .slice(0, limit);

  const missingIo = entries
    .filter((e) => e.missingIo)
    .sort(
      (a, b) =>
        (CONNECTIVITY_WEIGHTS[b.category] ?? 0) - (CONNECTIVITY_WEIGHTS[a.category] ?? 0) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit);

  const spatial = entries
    .filter((e) => e.spatialGap)
    .sort((a, b) => b.ioCount - a.ioCount || a.name.localeCompare(b.name))
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalHardware: entries.length,
      withIo,
      withIoPercent: pct(withIo),
      withSpatial,
      withSpatialPercent: pct(withSpatial),
      combineCandidates: entries.reduce((s, e) => s + e.combineCandidates, 0),
      collapsedNameEntries: entries.filter((e) => e.collapsedNames > 0).length,
      uniformPositionEntries: entries.filter((e) => e.uniformPosition).length,
      missingIoInConnectivityCategories: entries.filter((e) => e.missingIo).length,
    },
    worklists: { correctness, missingIo, spatial },
  };
}

// =============================================================================
// OUTPUT
// =============================================================================

function printReport(report: IoQualityReport, limit: number): void {
  const s = report.summary;
  console.log("\n🔌 IO Quality & Coverage Report");
  console.log("═".repeat(64));
  console.log(`Generated: ${report.generatedAt}\n`);

  console.log("📈 Summary");
  console.log("─".repeat(48));
  console.log(`  Hardware entries:          ${s.totalHardware}`);
  console.log(`  With I/O data:             ${s.withIo} (${s.withIoPercent}%)`);
  console.log(`  With column/row layout:    ${s.withSpatial} (${s.withSpatialPercent}%)`);
  console.log(`  Combine candidates:        ${s.combineCandidates}`);
  console.log(`  Collapsed-pair-name entries:${s.collapsedNameEntries}`);
  console.log(`  Uniform-position entries:  ${s.uniformPositionEntries}`);
  console.log(`  Missing I/O (connectivity):${s.missingIoInConnectivityCategories}`);
  console.log();

  const section = (
    title: string,
    rows: HardwareIoEntry[],
    detail: (e: HardwareIoEntry) => string
  ) => {
    console.log(title);
    console.log("─".repeat(48));
    if (rows.length === 0) {
      console.log("  (none)\n");
      return;
    }
    for (const e of rows) {
      console.log(`  ${e.file}`);
      console.log(`    ${e.name} — ${detail(e)}`);
    }
    console.log();
  };

  section(
    `🔴 Correctness worklist (likely-wrong I/O, top ${limit})`,
    report.worklists.correctness,
    (e) => {
      const bits: string[] = [];
      if (e.combineCandidates) bits.push(`${e.combineCandidates} combine`);
      if (e.collapsedNames) bits.push(`${e.collapsedNames} collapsed-name`);
      if (e.uniformPosition) bits.push("uniform position");
      return `${bits.join(", ")} (${e.ioCount} io)`;
    }
  );

  section(
    `🟠 Missing I/O in connectivity categories (top ${limit})`,
    report.worklists.missingIo,
    (e) => e.category
  );

  section(
    `🟡 Spatial enrichment — has I/O, no column/row (densest first, top ${limit})`,
    report.worklists.spatial,
    (e) => `${e.ioCount} ports, ${e.category}`
  );

  console.log("═".repeat(64));
  console.log("Enrich column/row with: pnpm enrich-io <slug>");
}

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Math.max(1, Number.parseInt(args[limitArg + 1] ?? "", 10) || 20) : 20;

const report = generateReport(limit);
if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report, limit);
}

#!/usr/bin/env tsx
/**
 * Apply Discontinued Tags Script
 *
 * Adds the `discontinued` category to YAML entries surfaced by
 * `discontinued-candidates.ts`. Three modes:
 *
 *   --signal superseded (default)  Tier 1: entries superseded by another
 *                                  entry. Definitive, auto-tag-safe.
 *   --signal defunct               Tier 1: entries whose manufacturer is
 *                                  marked `defunct: true`. Auto-tag-safe —
 *                                  the care lives in the manufacturer flag.
 *   --files <list.txt>             Reviewed list: newline-separated entry
 *                                  paths (relative to data/ or absolute),
 *                                  e.g. curated from the report's review
 *                                  tiers (vintagesynth-linked, age cutoff).
 *
 * Defaults to dry-run; pass `--apply` to actually write changes.
 *
 * Usage:
 *   pnpm discontinued:apply                        # dry run, superseded
 *   pnpm discontinued:apply --apply                # write superseded tags
 *   pnpm discontinued:apply --signal defunct --apply
 *   pnpm discontinued:apply --files reviewed.txt --apply
 *   pnpm discontinued:apply --apply --limit 25
 */

import fs from "node:fs";
import path from "node:path";
import { isSeq, parseDocument } from "yaml";
import type { Accessory, Content, Hardware, Software } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadDefunctManufacturers, loadYamlFile } from "./lib/utils.js";

const DISCONTINUED_CATEGORY = "discontinued";
const ENTRY_TYPES = ["software", "content", "hardware", "accessories"] as const;

type Entry = Software | Content | Hardware | Accessory;

interface Candidate {
  file: string;
  entry: Entry;
  /** Human-readable justification shown in the run log. */
  reason: string;
}

interface Change {
  file: string;
  name: string;
  manufacturer: string;
  reason: string;
}

function hasCategory(entry: Entry, slug: string): boolean {
  if (entry.primaryCategory === slug || entry.secondaryCategory === slug) return true;
  return Array.isArray(entry.categories) && entry.categories.includes(slug);
}

function loadAllEntries(): Array<{ file: string; entry: Entry }> {
  const all: Array<{ file: string; entry: Entry }> = [];
  for (const type of ENTRY_TYPES) {
    for (const file of getYamlFiles(path.join(DATA_DIR, type))) {
      all.push({ file, entry: loadYamlFile<Entry>(file) });
    }
  }
  return all;
}

function findSupersededCandidates(): Candidate[] {
  const entries = loadAllEntries();
  const supersededBy = new Map<string, string[]>();
  const supersedesOf = new Map<string, string>();

  for (const { entry } of entries) {
    // Skip self-loops; they'd auto-tag the entry as its own successor.
    if (entry.supersedes && entry.id && entry.supersedes !== entry.id) {
      const list = supersededBy.get(entry.supersedes) ?? [];
      list.push(entry.id);
      supersededBy.set(entry.supersedes, list);
      supersedesOf.set(entry.id, entry.supersedes);
    }
  }

  // Prune 2-cycles (A.supersedes === B && B.supersedes === A): ambiguous,
  // skip both directions from the auto-tag path.
  for (const [targetId, sourceIds] of supersededBy.entries()) {
    const filtered = sourceIds.filter((sourceId) => supersedesOf.get(targetId) !== sourceId);
    if (filtered.length === 0) {
      supersededBy.delete(targetId);
    } else {
      supersededBy.set(targetId, filtered);
    }
  }

  const candidates: Candidate[] = [];
  for (const { file, entry } of entries) {
    const supersessors = entry.id ? supersededBy.get(entry.id) : undefined;
    if (!supersessors || supersessors.length === 0) continue;
    if (hasCategory(entry, DISCONTINUED_CATEGORY)) continue;
    candidates.push({ file, entry, reason: `superseded by ${supersessors.join(", ")}` });
  }
  return candidates;
}

function findDefunctCandidates(): Candidate[] {
  const defunct = loadDefunctManufacturers();
  if (defunct.size === 0) {
    console.error("No manufacturers are marked `defunct: true`; nothing to do.");
    return [];
  }
  const candidates: Candidate[] = [];
  for (const { file, entry } of loadAllEntries()) {
    if (!defunct.has(entry.manufacturer)) continue;
    if (hasCategory(entry, DISCONTINUED_CATEGORY)) continue;
    candidates.push({ file, entry, reason: `manufacturer ${entry.manufacturer} is defunct` });
  }
  return candidates;
}

/**
 * Reviewed-list mode: each non-empty, non-comment line is an entry path,
 * either absolute, repo-relative (data/hardware/foo.yaml), or
 * data-relative (hardware/foo.yaml). Unknown paths are fatal — a typo in
 * a curated list should stop the run, not shrink it silently.
 */
function findFileListCandidates(listPath: string): Candidate[] {
  const lines = fs
    .readFileSync(listPath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const resolved = [
      path.isAbsolute(line) ? line : null,
      path.join(DATA_DIR, line),
      path.join(DATA_DIR, "..", line),
    ].find((p): p is string => p !== null && fs.existsSync(p));
    if (!resolved) {
      console.error(`Error: cannot resolve entry path "${line}" from ${listPath}`);
      process.exit(1);
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const entry = loadYamlFile<Entry>(resolved);
    if (hasCategory(entry, DISCONTINUED_CATEGORY)) continue;
    candidates.push({ file: resolved, entry, reason: `reviewed list ${path.basename(listPath)}` });
  }
  return candidates;
}

function tagFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const doc = parseDocument(content);

  const categoriesNode = doc.get("categories");
  if (isSeq(categoriesNode)) {
    // Defensive guard — caller already filtered, but parser sees raw YAML.
    const existing = categoriesNode.toJSON() as unknown[];
    if (existing.includes(DISCONTINUED_CATEGORY)) return false;
    categoriesNode.add(DISCONTINUED_CATEGORY);
  } else {
    doc.set("categories", [DISCONTINUED_CATEGORY]);
  }

  fs.writeFileSync(filePath, doc.toString());
  return true;
}

function parseArgs(): {
  apply: boolean;
  limit: number | null;
  signal: "superseded" | "defunct";
  files: string | null;
} {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  const readValue = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    if (idx === -1) return null;
    const raw = args[idx + 1];
    if (raw === undefined || raw.startsWith("--")) {
      console.error(`Error: ${flag} requires a value`);
      process.exit(1);
    }
    return raw;
  };

  const signalRaw = readValue("--signal") ?? "superseded";
  if (signalRaw !== "superseded" && signalRaw !== "defunct") {
    console.error(`Error: --signal must be "superseded" or "defunct", got "${signalRaw}"`);
    process.exit(1);
  }

  const files = readValue("--files");
  if (files && args.includes("--signal")) {
    console.error("Error: --files and --signal are mutually exclusive");
    process.exit(1);
  }

  let limit: number | null = null;
  const limitRaw = readValue("--limit");
  if (limitRaw !== null) {
    const parsed = Number(limitRaw);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      console.error(`Error: --limit value "${limitRaw}" must be a positive integer`);
      process.exit(1);
    }
    limit = parsed;
  }
  return { apply, limit, signal: signalRaw, files };
}

function main(): void {
  const { apply, limit, signal, files } = parseArgs();
  const candidates = files
    ? findFileListCandidates(files)
    : signal === "defunct"
      ? findDefunctCandidates()
      : findSupersededCandidates();
  const targets = limit !== null ? candidates.slice(0, limit) : candidates;
  const changes: Change[] = [];
  const mode = files ? `files:${path.basename(files)}` : `signal:${signal}`;

  console.log(
    `\n🗂  Discontinued auto-tag [${mode}] — ${apply ? "APPLY" : "DRY RUN"} (${targets.length}/${candidates.length} candidates)\n`
  );

  for (const { file, entry, reason } of targets) {
    const relPath = path.relative(DATA_DIR, file);
    if (apply) {
      const changed = tagFile(file);
      if (!changed) {
        console.log(`  skip  ${relPath} (already tagged)`);
        continue;
      }
      console.log(`  tag   ${relPath} (${reason})`);
    } else {
      console.log(`  would tag  ${relPath} (${reason})`);
    }
    changes.push({
      file: relPath,
      name: entry.name,
      manufacturer: entry.manufacturer,
      reason,
    });
  }

  console.log();
  if (apply) {
    console.log(`✅ Tagged ${changes.length} file(s) with the discontinued category.`);
    console.log("Run `pnpm format` to normalize YAML output before committing.");
  } else {
    console.log(`Dry run only — pass --apply to write changes.`);
  }
}

main();

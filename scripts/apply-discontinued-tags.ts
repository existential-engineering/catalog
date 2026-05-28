#!/usr/bin/env tsx
/**
 * Apply Discontinued Tags Script
 *
 * Adds the `discontinued` category to YAML entries that are superseded
 * by another entry but lack the tag. Operates on tier-1 candidates
 * surfaced by `discontinued-candidates.ts` — the safest, most definitive
 * signal class.
 *
 * Defaults to dry-run; pass `--apply` to actually write changes.
 *
 * Usage:
 *   pnpm discontinued:apply               # dry run, show what would change
 *   pnpm discontinued:apply --apply       # write changes to YAML
 *   pnpm discontinued:apply --apply --limit 25
 */

import fs from "node:fs";
import path from "node:path";
import { isSeq, parseDocument } from "yaml";
import type { Accessory, Content, Hardware, Software } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

const DISCONTINUED_CATEGORY = "discontinued";
const ENTRY_TYPES = ["software", "content", "hardware", "accessories"] as const;

type Entry = Software | Content | Hardware | Accessory;

interface Change {
  file: string;
  name: string;
  manufacturer: string;
  supersededBy: string[];
}

function hasCategory(entry: Entry, slug: string): boolean {
  if (entry.primaryCategory === slug || entry.secondaryCategory === slug) return true;
  return Array.isArray(entry.categories) && entry.categories.includes(slug);
}

function findTier1Candidates(): Array<{ file: string; entry: Entry; supersededBy: string[] }> {
  const entriesById = new Map<string, { file: string; entry: Entry }>();
  const supersededBy = new Map<string, string[]>();
  const supersedesOf = new Map<string, string>();

  for (const type of ENTRY_TYPES) {
    const files = getYamlFiles(path.join(DATA_DIR, type));
    for (const file of files) {
      const entry = loadYamlFile<Entry>(file);
      if (entry.id) entriesById.set(entry.id, { file, entry });
      // Skip self-loops; they'd auto-tag the entry as its own successor.
      if (entry.supersedes && entry.id && entry.supersedes !== entry.id) {
        const list = supersededBy.get(entry.supersedes) ?? [];
        list.push(entry.id);
        supersededBy.set(entry.supersedes, list);
        supersedesOf.set(entry.id, entry.supersedes);
      }
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

  const candidates: Array<{ file: string; entry: Entry; supersededBy: string[] }> = [];
  for (const { file, entry } of entriesById.values()) {
    const supersessors = entry.id ? supersededBy.get(entry.id) : undefined;
    if (!supersessors || supersessors.length === 0) continue;
    if (hasCategory(entry, DISCONTINUED_CATEGORY)) continue;
    candidates.push({ file, entry, supersededBy: supersessors });
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

function parseArgs(): { apply: boolean; limit: number | null } {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitIdx = args.indexOf("--limit");
  let limit: number | null = null;
  if (limitIdx !== -1) {
    const raw = args[limitIdx + 1];
    if (raw === undefined) {
      console.error("Error: --limit requires a positive integer (e.g., --limit 25)");
      process.exit(1);
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      console.error(`Error: --limit value "${raw}" must be a positive integer`);
      process.exit(1);
    }
    limit = parsed;
  }
  return { apply, limit };
}

function main(): void {
  const { apply, limit } = parseArgs();
  const candidates = findTier1Candidates();
  const targets = limit !== null ? candidates.slice(0, limit) : candidates;
  const changes: Change[] = [];

  console.log(
    `\n🗂  Discontinued auto-tag — ${apply ? "APPLY" : "DRY RUN"} (${targets.length}/${candidates.length} candidates)\n`
  );

  for (const { file, entry, supersededBy } of targets) {
    const relPath = path.relative(DATA_DIR, file);
    if (apply) {
      const changed = tagFile(file);
      if (!changed) {
        console.log(`  skip  ${relPath} (already tagged)`);
        continue;
      }
      console.log(`  tag   ${relPath}`);
    } else {
      console.log(`  would tag  ${relPath}`);
    }
    changes.push({
      file: relPath,
      name: entry.name,
      manufacturer: entry.manufacturer,
      supersededBy,
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

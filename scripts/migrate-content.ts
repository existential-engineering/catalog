/**
 * Content Migration Script
 *
 * Moves content entries (presets, sample packs, sound libraries, etc.)
 * from data/software/ to data/content/ using git mv to preserve history.
 *
 * Run with: npx tsx scripts/migrate-content.ts
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type { CategoryAliasesSchema } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, SCHEMA_DIR } from "./lib/utils.js";

// Content categories that indicate a file should move to data/content/
const CONTENT_CATEGORIES = new Set([
  "preset",
  "preset-pack",
  "sample-pack",
  "drum-sample-pack",
  "loop-pack",
  "sound-library",
  "soundfont",
  "impulse-response",
  "multisample",
]);

// Load category aliases to resolve aliases to canonical forms
const categoryAliasesSchema = loadYamlFile<CategoryAliasesSchema>(
  path.join(SCHEMA_DIR, "category-aliases.yaml")
);
const CATEGORY_ALIASES = new Map<string, string>(Object.entries(categoryAliasesSchema.aliases));

function resolveCategory(category: string): string {
  return CATEGORY_ALIASES.get(category) ?? category;
}

function isContentCategory(category: string): boolean {
  return CONTENT_CATEGORIES.has(resolveCategory(category));
}

const softwareDir = path.join(DATA_DIR, "software");
const contentDir = path.join(DATA_DIR, "content");

// Ensure content directory exists
fs.mkdirSync(contentDir, { recursive: true });

const softwareFiles = getYamlFiles(softwareDir);
const filesToMove: string[] = [];

for (const file of softwareFiles) {
  try {
    const rawContent = fs.readFileSync(file, "utf-8");
    const data = parseYaml(rawContent) as { primaryCategory?: string };

    if (data.primaryCategory && isContentCategory(data.primaryCategory)) {
      filesToMove.push(file);
    }
  } catch (err) {
    console.error(`Error reading ${file}: ${err}`);
  }
}

console.log(
  `Found ${filesToMove.length} content entries to move from data/software/ to data/content/\n`
);

if (filesToMove.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

let moved = 0;
let failed = 0;

for (const file of filesToMove) {
  const filename = path.basename(file);
  const dest = path.join(contentDir, filename);

  if (fs.existsSync(dest)) {
    console.error(`  ✗ Skipping ${filename}: already exists in data/content/`);
    failed++;
    continue;
  }

  try {
    const relSrc = path.relative(process.cwd(), file);
    const relDest = path.relative(process.cwd(), dest);
    execSync(`git mv "${relSrc}" "${relDest}"`, { stdio: "pipe" });
    moved++;
  } catch (err) {
    console.error(`  ✗ Failed to move ${filename}: ${err}`);
    failed++;
  }
}

console.log(`\nMigration complete:`);
console.log(`  ✓ Moved: ${moved}`);
if (failed > 0) {
  console.log(`  ✗ Failed: ${failed}`);
}

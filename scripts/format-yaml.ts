/**
 * Format YAML Script
 *
 * Moves `id` field to the top of each YAML file, then runs Prettier.
 * Replaces plain `prettier --write` for YAML formatting.
 *
 * Usage: tsx scripts/format-yaml.ts
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

const COLLECTIONS = ["manufacturers", "software", "content", "hardware", "accessories"];

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

function moveIdToTop(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const doc = parseDocument(content);
  const data = doc.toJSON() as Record<string, unknown>;

  // Skip files without an id field
  if (typeof data.id !== "string" || data.id.length === 0) {
    return false;
  }

  const items = doc.contents as { items?: { key: { value: string } }[] };
  if (!items?.items) {
    return false;
  }

  const idIndex = items.items.findIndex((item) => item.key?.value === "id");
  if (idIndex <= 0) {
    // Already first, or not found
    return false;
  }

  const [idItem] = items.items.splice(idIndex, 1);
  items.items.unshift(idItem);
  fs.writeFileSync(filePath, doc.toString());
  return true;
}

let reordered = 0;

for (const collection of COLLECTIONS) {
  const files = getYamlFiles(path.join(DATA_DIR, collection));
  for (const file of files) {
    if (moveIdToTop(file)) {
      reordered++;
    }
  }
}

if (reordered > 0) {
  console.log(`Moved id to top in ${reordered} files`);
}

// Run Prettier on all YAML files
console.log("Running Prettier...");
execSync('prettier --write "data/**/*.yaml"', {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

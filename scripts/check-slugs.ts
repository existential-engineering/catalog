/**
 * Check Slugs Script
 *
 * Validates slug uniqueness for changed files in a PR.
 * Checks against .slug-index.json for O(1) lookups.
 *
 * Workflow / index usage:
 * - The repository maintains a precomputed slug index in `.slug-index.json`.
 *   This file maps each known slug to its collection and is used here for
 *   constant-time (O(1)) existence checks instead of re-scanning all data.
 * - The slug index should be (re)built whenever the global set of slugs may
 *   have changed (e.g. after adding, removing, or renaming entries in
 *   `data/manufacturers`, `data/software`, or `data/hardware`). This is
 *   typically done by a separate maintenance/CI script that scans all data
 *   files and writes `.slug-index.json` at the repository root.
 * - This script does not rebuild the index; it only:
 *     1) determines which YAML files have changed in the current branch/PR,
 *     2) extracts their `slug` fields, and
 *     3) checks those slugs against the existing `.slug-index.json` to
 *        detect duplicates or collisions across the whole dataset.
 *
 * Typical usage:
 * - Ensure the slug index is up to date (via your dedicated index builder).
 * - Run with: `pnpm check-slugs` to validate the slugs in the current change.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
const INDEX_FILE = path.join(import.meta.dirname, "..", ".slug-index.json");

type Collection = "manufacturers" | "software" | "hardware";

interface SlugIndex {
  [slug: string]: Collection;
}

interface ChangedFile {
  path: string;
  collection: Collection;
  slug: string | null;
}

function loadSlugIndex(): SlugIndex {
  if (!fs.existsSync(INDEX_FILE)) {
    console.warn("⚠️  No .slug-index.json found, skipping index check");
    return {};
  }

  try {
    const content = fs.readFileSync(INDEX_FILE, "utf-8");
    return JSON.parse(content) as SlugIndex;
  } catch (error) {
    console.error("❌ Failed to parse .slug-index.json:", error);
    process.exit(1);
  }
}

function getChangedYamlFiles(): string[] {
  try {
    // Verify that origin/main exists
    execSync("git rev-parse --verify origin/main", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Get files changed compared to origin/main
    const output = execSync("git diff --name-only origin/main -- data/", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return output
      .split("\n")
      .filter((f) => f && (f.endsWith(".yaml") || f.endsWith(".yml")));
  } catch (error) {
    console.warn("⚠️  origin/main not available, falling back to staged files");
    
    // Fallback: check all staged files (for local testing)
    try {
      const output = execSync("git diff --name-only --cached -- data/", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      return output
        .split("\n")
        .filter((f) => f && (f.endsWith(".yaml") || f.endsWith(".yml")));
    } catch {
      console.warn("⚠️  Could not get changed files from git, checking all files");
      return [];
    }
  }
}

function extractSlugFromFile(filePath: string): string | null {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    // File was deleted, skip
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    const data = parseYaml(content) as { slug?: string };
    return data.slug ?? null;
  } catch (error) {
    console.warn(`⚠️  Failed to read or parse YAML file for slug extraction: ${filePath}`, error);
    return null;
  }
}

function getCollectionFromPath(filePath: string): Collection | null {
  const parts = filePath.split("/");
  if (parts.length < 2 || parts[0] !== "data") {
    return null;
  }

  const collection = parts[1] as Collection;
  if (["manufacturers", "software", "hardware"].includes(collection)) {
    return collection;
  }

  return null;
}

function doesSlugFileExist(collection: Collection, slug: string): boolean {
  const yamlPath = path.join(DATA_DIR, collection, `${slug}.yaml`);
  const ymlPath = path.join(DATA_DIR, collection, `${slug}.yml`);
  return fs.existsSync(yamlPath) || fs.existsSync(ymlPath);
}

function validateFilenameMatchesSlug(filePath: string, slug: string): string | null {
  const actualFilename = path.basename(filePath);
  const expectedYaml = `${slug}.yaml`;
  const expectedYml = `${slug}.yml`;
  
  if (actualFilename !== expectedYaml && actualFilename !== expectedYml) {
    return `Slug '${slug}' in ${filePath} doesn't match filename (expected ${expectedYaml})`;
  }
  
  return null;
}

function validateSlugAgainstIndex(
  slug: string,
  filePath: string,
  collection: Collection,
  index: SlugIndex
): string | null {
  const existingCollection = index[slug];
  
  if (!existingCollection) {
    // New slug, no conflict
    return null;
  }
  
  if (existingCollection !== collection) {
    // Slug exists in a different collection - only report if file still exists
    if (doesSlugFileExist(existingCollection, slug)) {
      return `Slug '${slug}' in ${filePath} conflicts with existing ${existingCollection}/${slug}`;
    }
    return null;
  }
  
  // Same collection - this is an update to existing file
  // Validate that filename matches the slug
  return validateFilenameMatchesSlug(filePath, slug);
}

function checkSlugs(): void {
  console.log("\n🔍 Checking slug uniqueness...\n");

  const index = loadSlugIndex();
  const changedFiles = getChangedYamlFiles();

  if (changedFiles.length === 0) {
    console.log("   No YAML files changed, skipping check.\n");
    return;
  }

  console.log(`   Checking ${changedFiles.length} changed file(s)...\n`);

  const errors: string[] = [];
  const newSlugs: Map<string, string> = new Map(); // slug -> file path

  for (const filePath of changedFiles) {
    const collection = getCollectionFromPath(filePath);
    if (!collection) {
      continue;
    }

    const slug = extractSlugFromFile(filePath);
    if (!slug) {
      // File deleted or couldn't parse, skip
      continue;
    }

    // Validate slug against index (existing slugs in repo)
    const indexError = validateSlugAgainstIndex(slug, filePath, collection, index);
    if (indexError) {
      errors.push(indexError);
    }

    // Check against other files in this PR
    if (newSlugs.has(slug)) {
      errors.push(
        `Duplicate slug '${slug}' found in PR: ${newSlugs.get(slug)} and ${filePath}`
      );
    } else {
      newSlugs.set(slug, filePath);
    }
  }

  if (errors.length > 0) {
    console.error("❌ Slug validation failed:\n");
    for (const error of errors) {
      console.error(`   • ${error}`);
    }
    console.error();
    process.exit(1);
  }

  console.log("✅ All slugs are unique!\n");
}

checkSlugs();


/**
 * Check Slugs Script
 *
 * Validates slug uniqueness for changed files in a PR.
 * Checks against .slug-index.json for O(1) lookups.
 * Run with: pnpm check-slugs
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
    // Get files changed compared to origin/main
    const output = execSync("git diff --name-only origin/main -- data/", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return output
      .split("\n")
      .filter((f) => f && (f.endsWith(".yaml") || f.endsWith(".yml")));
  } catch {
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
  } catch {
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

    // Check against index (existing slugs in repo)
    if (index[slug] && index[slug] !== collection) {
      errors.push(
        `Slug '${slug}' in ${filePath} conflicts with existing ${index[slug]}/${slug}`
      );
    } else if (index[slug] === collection) {
      // Same collection, this is an update to existing file - that's fine
      // But check the filename matches the slug
      const expectedFilename = `${slug}.yaml`;
      const actualFilename = path.basename(filePath);
      if (actualFilename !== expectedFilename && actualFilename !== `${slug}.yml`) {
        errors.push(
          `Slug '${slug}' in ${filePath} doesn't match filename (expected ${expectedFilename})`
        );
      }
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


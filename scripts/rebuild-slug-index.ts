/**
 * Rebuild Slug Index Script
 *
 * Regenerates .slug-index.json from all YAML files in data/.
 * Run with: pnpm rebuild-slug-index
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
const INDEX_FILE = path.join(import.meta.dirname, "..", ".slug-index.json");

type Collection = "manufacturers" | "software" | "hardware";

interface SlugIndex {
  [slug: string]: Collection;
}

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

function extractSlug(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = parseYaml(content) as { slug?: string };
    return data.slug ?? null;
  } catch {
    return null;
  }
}

function rebuildIndex(): void {
  const index: SlugIndex = {};
  const duplicates: Array<{ slug: string; collections: string[] }> = [];
  const slugLocations: Map<string, string[]> = new Map();

  const collections: Collection[] = ["manufacturers", "software", "hardware"];

  for (const collection of collections) {
    const files = getYamlFiles(path.join(DATA_DIR, collection));

    for (const file of files) {
      const slug = extractSlug(file);
      if (!slug) {
        console.warn(`⚠️  Could not extract slug from ${path.relative(process.cwd(), file)}`);
        continue;
      }

      // Track where this slug appears
      const locations = slugLocations.get(slug) ?? [];
      locations.push(`${collection}/${path.basename(file)}`);
      slugLocations.set(slug, locations);

      // Check for duplicates
      if (index[slug]) {
        // Already exists in another collection
        const existing = duplicates.find((d) => d.slug === slug);
        if (existing) {
          existing.collections.push(collection);
        } else {
          duplicates.push({ slug, collections: [index[slug], collection] });
        }
      } else {
        index[slug] = collection;
      }
    }
  }

  // Report duplicates
  if (duplicates.length > 0) {
    console.error("\n❌ Duplicate slugs found:\n");
    for (const dup of duplicates) {
      const locations = slugLocations.get(dup.slug) ?? [];
      console.error(`   ${dup.slug}:`);
      for (const loc of locations) {
        console.error(`     - ${loc}`);
      }
    }
    console.error();
    process.exit(1);
  }

  // Sort index alphabetically
  const sortedIndex: SlugIndex = {};
  for (const key of Object.keys(index).sort()) {
    sortedIndex[key] = index[key];
  }

  // Write index file
  fs.writeFileSync(INDEX_FILE, JSON.stringify(sortedIndex, null, 2) + "\n");

  const count = Object.keys(sortedIndex).length;
  console.log(`\n✅ Slug index rebuilt successfully!`);
  console.log(`   Total slugs: ${count}`);
  console.log(`   Output: ${path.relative(process.cwd(), INDEX_FILE)}\n`);
}

rebuildIndex();


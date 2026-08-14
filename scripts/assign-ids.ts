/**
 * Assign IDs Script (PR Creation)
 *
 * Assigns nanoid-based string IDs to any YAML entries that don't have one.
 * Run on PR creation/sync: pnpm assign-ids
 *
 * This script:
 * 1. Loads all existing IDs into a Set for collision checking
 * 2. Scans all YAML files for entries without an `id` field
 * 3. Generates a unique nanoid for each new entry
 * 4. Updates the YAML files with the new ID
 */

import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { parseDocument } from "yaml";
import { assignIoKeys } from "./lib/io-keys.js";
import type { Collection } from "./lib/types.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

/** Load all existing IDs across all collections into a Set */
function loadExistingIds(): Set<string> {
  const ids = new Set<string>();
  const collections: Collection[] = [
    "manufacturers",
    "software",
    "content",
    "hardware",
    "accessories",
  ];

  for (const collection of collections) {
    const files = getYamlFiles(path.join(DATA_DIR, collection));
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const doc = parseDocument(content);
      const data = doc.toJSON() as Record<string, unknown>;
      if (typeof data.id === "string" && data.id.length > 0) {
        ids.add(data.id);
      }
    }
  }

  return ids;
}

/** Generate a unique nanoid that doesn't collide with existing IDs */
function generateUniqueId(existingIds: Set<string>): string {
  let id: string;
  do {
    id = nanoid();
  } while (existingIds.has(id));
  existingIds.add(id);
  return id;
}

function assignIds(): void {
  const existingIds = loadExistingIds();
  const collections: Collection[] = [
    "manufacturers",
    "software",
    "content",
    "hardware",
    "accessories",
  ];
  const stats = { assigned: 0, skipped: 0, ioKeys: 0 };

  for (const collection of collections) {
    const files = getYamlFiles(path.join(DATA_DIR, collection));

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const doc = parseDocument(content);
      const data = doc.toJSON() as Record<string, unknown>;

      let changed = false;

      if (typeof data.id === "string" && data.id.length > 0) {
        stats.skipped++;
      } else {
        // Assign a unique nanoid
        const newId = generateUniqueId(existingIds);

        // Add id at the beginning of the document
        doc.set("id", newId);

        // Reorder to put id first
        const items = doc.contents as { items?: { key: { value: string } }[] };
        if (items?.items) {
          const idIndex = items.items.findIndex((item) => item.key?.value === "id");
          if (idIndex > 0) {
            const [idItem] = items.items.splice(idIndex, 1);
            items.items.unshift(idItem);
          }
        }

        console.log(`  ✓ ${collection}/${path.basename(file)}: assigned id ${newId}`);
        stats.assigned++;
        changed = true;
      }

      // Hardware ports get stable per-port keys (AUREO-702)
      if (collection === "hardware") {
        const keysAssigned = assignIoKeys(doc);
        if (keysAssigned > 0) {
          console.log(
            `  ✓ ${collection}/${path.basename(file)}: assigned ${keysAssigned} io key(s)`
          );
          stats.ioKeys += keysAssigned;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(file, doc.toString());
      }
    }
  }

  console.log(`\n✅ ID assignment complete!`);
  console.log(`   Assigned: ${stats.assigned}`);
  console.log(`   Already had ID: ${stats.skipped}`);
  console.log(`   IO keys assigned: ${stats.ioKeys}`);

  if (stats.assigned > 0 || stats.ioKeys > 0) {
    console.log(`\nNext steps:`);
    console.log(`  1. Run 'pnpm format' to normalize YAML formatting`);
    console.log(`  2. Commit the changes`);
  }
}

assignIds();

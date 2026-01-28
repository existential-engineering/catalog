/**
 * One-time Migration Script
 *
 * Replaces all existing numeric IDs with nanoid strings.
 * Run once: tsx scripts/migrate-ids.ts
 *
 * This script:
 * 1. Iterates all YAML files across all 3 collections
 * 2. Replaces each numeric `id` with a new nanoid
 * 3. Logs a mapping of old -> new IDs for reference
 */

import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { parseDocument } from "yaml";
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

function migrateIds(): void {
  const collections: Collection[] = ["manufacturers", "software", "hardware"];
  const usedIds = new Set<string>();
  const mapping: Record<string, Record<string, string>> = {};
  let migrated = 0;

  for (const collection of collections) {
    mapping[collection] = {};
    const files = getYamlFiles(path.join(DATA_DIR, collection));

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const doc = parseDocument(content);
      const data = doc.toJSON() as Record<string, unknown>;

      if (data.id === undefined) {
        continue; // No ID to migrate
      }

      const oldId = String(data.id);

      // Generate a unique nanoid
      let newId: string;
      do {
        newId = nanoid();
      } while (usedIds.has(newId));
      usedIds.add(newId);

      // Replace the ID
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

      // Write back
      fs.writeFileSync(file, doc.toString());
      mapping[collection][oldId] = newId;
      console.log(`  ✓ ${collection}/${path.basename(file)}: ${oldId} -> ${newId}`);
      migrated++;
    }
  }

  console.log(`\n✅ Migration complete! Migrated ${migrated} IDs.`);

  // Write mapping for reference
  const distDir = path.join(REPO_ROOT, "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  const mapFile = path.join(distDir, "id-migration-map.json");
  fs.writeFileSync(mapFile, JSON.stringify(mapping, null, 2) + "\n");
  console.log(`\nMapping written to ${mapFile}`);
}

migrateIds();

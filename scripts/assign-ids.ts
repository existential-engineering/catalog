/**
 * Assign IDs Script (Post-Merge)
 *
 * Assigns IDs to any YAML entries that don't have one.
 * Run after merging PRs: pnpm assign-ids
 *
 * This script:
 * 1. Scans all YAML files for entries without an `id` field
 * 2. Assigns the next available ID from .id-counter.json
 * 3. Updates the YAML files with the new ID
 * 4. Updates .id-counter.json with new next values
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml, parseDocument } from "yaml";
import type { Collection, IdCounter } from "./lib/types.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const ID_COUNTER_FILE = path.join(REPO_ROOT, ".id-counter.json");

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

function loadIdCounter(): IdCounter {
  if (!fs.existsSync(ID_COUNTER_FILE)) {
    return {
      manufacturers: 1,
      software: 1,
      hardware: 1,
    };
  }
  return JSON.parse(fs.readFileSync(ID_COUNTER_FILE, "utf-8")) as IdCounter;
}

function saveIdCounter(counter: IdCounter): void {
  fs.writeFileSync(ID_COUNTER_FILE, JSON.stringify(counter, null, 2) + "\n");
}

function assignIds(): void {
  const counter = loadIdCounter();
  const collections: Collection[] = ["manufacturers", "software", "hardware"];
  const stats = { assigned: 0, skipped: 0 };

  for (const collection of collections) {
    const files = getYamlFiles(path.join(DATA_DIR, collection));

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const doc = parseDocument(content);
      const data = doc.toJSON() as Record<string, unknown>;

      // Skip if already has an id
      if (data.id !== undefined) {
        stats.skipped++;
        continue;
      }

      // Assign the next ID
      const newId = counter[collection];
      counter[collection]++;

      // Add id at the beginning of the document
      // We need to preserve the original formatting, so we'll use parseDocument
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
      console.log(`  ✓ ${collection}/${path.basename(file)}: assigned id ${newId}`);
      stats.assigned++;
    }
  }

  // Save updated counter
  saveIdCounter(counter);

  console.log(`\n✅ ID assignment complete!`);
  console.log(`   Assigned: ${stats.assigned}`);
  console.log(`   Already had ID: ${stats.skipped}`);

  if (stats.assigned > 0) {
    console.log(`\nNext steps:`);
    console.log(`  1. Run 'pnpm format' to normalize YAML formatting`);
    console.log(`  2. Commit the changes`);
  }
}

assignIds();

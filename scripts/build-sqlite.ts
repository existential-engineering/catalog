/**
 * SQLite Build Script
 *
 * Generates a SQLite database from YAML source files.
 * Run with: pnpm build
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
const SCHEMA_FILE = path.join(import.meta.dirname, "schema.sql");
const OUTPUT_DIR = path.join(import.meta.dirname, "..", "dist");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "catalog.sqlite");

// =============================================================================
// TYPES
// =============================================================================

interface Manufacturer {
  slug: string;
  name: string;
  website?: string;
}

interface Software {
  slug: string;
  name: string;
  manufacturer: string;
  type: string;
  categories: string[];
  formats?: string[];
  platforms?: string[];
  identifiers?: Record<string, string>;
  website?: string;
  description?: string;
}

interface Daw {
  slug: string;
  name: string;
  manufacturer: string;
  bundleIdentifier?: string;
  platforms?: string[];
  website?: string;
}

interface Hardware {
  slug: string;
  name: string;
  manufacturer: string;
  type?: string;
  website?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function loadYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseYaml(content) as T;
}

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

// =============================================================================
// BUILD FUNCTIONS
// =============================================================================

function buildDatabase(version: number): void {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Remove existing database
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
  }

  // Create new database
  const db = new Database(OUTPUT_FILE);

  // Apply schema
  const schema = fs.readFileSync(SCHEMA_FILE, "utf-8");
  db.exec(schema);

  // Load and insert manufacturers
  const manufacturerFiles = getYamlFiles(path.join(DATA_DIR, "manufacturers"));
  const manufacturers = new Map<string, Manufacturer>();

  const insertManufacturer = db.prepare(`
    INSERT INTO manufacturers (id, name, website)
    VALUES (?, ?, ?)
  `);

  for (const file of manufacturerFiles) {
    const data = loadYamlFile<Manufacturer>(file);
    manufacturers.set(data.slug, data);
    insertManufacturer.run(data.slug, data.name, data.website ?? null);
  }

  console.log(`  ✓ Inserted ${manufacturers.size} manufacturers`);

  // Load and insert software
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  let softwareCount = 0;

  const insertSoftware = db.prepare(`
    INSERT INTO software (id, name, manufacturer_id, type, website, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCategory = db.prepare(`
    INSERT INTO software_categories (software_id, category)
    VALUES (?, ?)
  `);
  const insertFormat = db.prepare(`
    INSERT INTO software_formats (software_id, format, identifier)
    VALUES (?, ?, ?)
  `);
  const insertPlatform = db.prepare(`
    INSERT INTO software_platforms (software_id, platform)
    VALUES (?, ?)
  `);
  const insertSoftwareFts = db.prepare(`
    INSERT INTO software_fts (id, name, manufacturer_name, categories)
    VALUES (?, ?, ?, ?)
  `);

  for (const file of softwareFiles) {
    const data = loadYamlFile<Software>(file);
    const manufacturer = manufacturers.get(data.manufacturer);

    insertSoftware.run(
      data.slug,
      data.name,
      data.manufacturer,
      data.type,
      data.website ?? null,
      data.description ?? null
    );

    // Insert categories
    for (const category of data.categories) {
      insertCategory.run(data.slug, category);
    }

    // Insert formats
    if (data.formats) {
      for (const format of data.formats) {
        const identifier = data.identifiers?.[format] ?? null;
        insertFormat.run(data.slug, format, identifier);
      }
    }

    // Insert platforms
    if (data.platforms) {
      for (const platform of data.platforms) {
        insertPlatform.run(data.slug, platform);
      }
    }

    // Insert FTS entry
    insertSoftwareFts.run(
      data.slug,
      data.name,
      manufacturer?.name ?? "",
      data.categories.join(" ")
    );

    softwareCount++;
  }

  console.log(`  ✓ Inserted ${softwareCount} software entries`);

  // Load and insert DAWs
  const dawFiles = getYamlFiles(path.join(DATA_DIR, "daws"));
  let dawCount = 0;

  const insertDaw = db.prepare(`
    INSERT INTO daws (id, name, manufacturer_id, bundle_identifier, website)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertDawPlatform = db.prepare(`
    INSERT INTO daw_platforms (daw_id, platform)
    VALUES (?, ?)
  `);
  const insertDawFts = db.prepare(`
    INSERT INTO daws_fts (id, name, manufacturer_name)
    VALUES (?, ?, ?)
  `);

  for (const file of dawFiles) {
    const data = loadYamlFile<Daw>(file);
    const manufacturer = manufacturers.get(data.manufacturer);

    insertDaw.run(
      data.slug,
      data.name,
      data.manufacturer,
      data.bundleIdentifier ?? null,
      data.website ?? null
    );

    // Insert platforms
    if (data.platforms) {
      for (const platform of data.platforms) {
        insertDawPlatform.run(data.slug, platform);
      }
    }

    // Insert FTS entry
    insertDawFts.run(data.slug, data.name, manufacturer?.name ?? "");

    dawCount++;
  }

  console.log(`  ✓ Inserted ${dawCount} DAW entries`);

  // Load and insert hardware
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  let hardwareCount = 0;

  const insertHardware = db.prepare(`
    INSERT INTO hardware (id, name, manufacturer_id, type, website)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const file of hardwareFiles) {
    const data = loadYamlFile<Hardware>(file);
    insertHardware.run(
      data.slug,
      data.name,
      data.manufacturer,
      data.type ?? null,
      data.website ?? null
    );
    hardwareCount++;
  }

  console.log(`  ✓ Inserted ${hardwareCount} hardware entries`);

  // Update metadata
  const updateMeta = db.prepare(`
    INSERT OR REPLACE INTO catalog_meta (key, value)
    VALUES (?, ?)
  `);
  updateMeta.run("version", String(version));
  updateMeta.run("updated_at", new Date().toISOString());

  // Optimize database
  db.exec("VACUUM");
  db.exec("ANALYZE");

  db.close();

  // Get file size
  const stats = fs.statSync(OUTPUT_FILE);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`\n✅ Database built successfully!`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`   Version: ${version}`);
}

// =============================================================================
// MAIN
// =============================================================================

// Get version from argument or default to 1
const version = parseInt(process.argv[2] ?? "1", 10);

console.log("\n🔨 Building catalog database...\n");
buildDatabase(version);
console.log();


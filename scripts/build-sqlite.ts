/**
 * SQLite Build Script
 *
 * Generates a SQLite database from YAML source files.
 * Run with: pnpm build
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import type { Manufacturer, Software, Hardware, IO, Version, Price, Link, Revision, Image, CategoryAliasesSchema } from "./lib/types.js";
import { DATA_DIR, OUTPUT_DIR, SCHEMA_DIR, loadYamlFile, getYamlFiles } from "./lib/utils.js";

// Load category aliases for normalization
const categoryAliasesSchema = loadYamlFile<CategoryAliasesSchema>(
  path.join(SCHEMA_DIR, "category-aliases.yaml")
);
const CATEGORY_ALIASES = new Map<string, string>(
  Object.entries(categoryAliasesSchema.aliases)
);

// Normalize a category to its canonical form
function normalizeCategory(category: string): string {
  return CATEGORY_ALIASES.get(category) ?? category;
}

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../package.json"), "utf-8"));
const CATALOG_VERSION = packageJson.version;

const SCHEMA_FILE = path.join(import.meta.dirname, "schema.sql");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "catalog.sqlite");

// =============================================================================
// BUILD FUNCTIONS
// =============================================================================

function buildDatabase(version: string): void {
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
    INSERT INTO manufacturers (id, name, company_name, website, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateManufacturerParent = db.prepare(`
    UPDATE manufacturers SET parent_company_id = ? WHERE id = ?
  `);
  const insertManufacturerSearchTerm = db.prepare(`
    INSERT INTO manufacturer_search_terms (manufacturer_id, term)
    VALUES (?, ?)
  `);
  const insertManufacturerImage = db.prepare(`
    INSERT INTO manufacturer_images (manufacturer_id, source, alt, position)
    VALUES (?, ?, ?, ?)
  `);

  // First pass: insert all manufacturers without parent references
  for (const file of manufacturerFiles) {
    const data = loadYamlFile<Manufacturer>(file);
    manufacturers.set(data.slug, data);
    insertManufacturer.run(
      data.slug,
      data.name,
      data.companyName ?? null,
      data.website ?? null,
      data.description ?? null
    );

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertManufacturerSearchTerm.run(data.slug, term);
      }
    }

    // Insert images
    if (data.images) {
      data.images.forEach((img, index) => {
        insertManufacturerImage.run(data.slug, img.source, img.alt ?? null, index);
      });
    }
  }

  // Second pass: update parent company references
  for (const data of manufacturers.values()) {
    if (data.parentCompany) {
      updateManufacturerParent.run(data.parentCompany, data.slug);
    }
  }

  console.log(`  ✓ Inserted ${manufacturers.size} manufacturers`);

  // Load and insert software
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  let softwareCount = 0;

  const insertSoftware = db.prepare(`
    INSERT INTO software (id, name, manufacturer_id, website, release_date, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCategory = db.prepare(`
    INSERT INTO software_categories (software_id, category)
    VALUES (?, ?)
  `);
  const insertSearchTerm = db.prepare(`
    INSERT INTO software_search_terms (software_id, term)
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
  const insertSoftwareVersion = db.prepare(`
    INSERT INTO software_versions (software_id, name, release_date, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwarePrice = db.prepare(`
    INSERT INTO software_prices (software_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertSoftwareLink = db.prepare(`
    INSERT INTO software_links (software_id, type, title, url, video_id, provider, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwareImage = db.prepare(`
    INSERT INTO software_images (software_id, source, alt, position)
    VALUES (?, ?, ?, ?)
  `);
  const insertSoftwareFts = db.prepare(`
    INSERT INTO software_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const file of softwareFiles) {
    const data = loadYamlFile<Software>(file);
    const manufacturer = manufacturers.get(data.manufacturer);

    // Normalize categories to canonical form
    const normalizedCategories = data.categories?.map(normalizeCategory) ?? [];
    const normalizedPrimaryCategory = data.primaryCategory ? normalizeCategory(data.primaryCategory) : null;
    const normalizedSecondaryCategory = data.secondaryCategory ? normalizeCategory(data.secondaryCategory) : null;

    insertSoftware.run(
      data.slug,
      data.name,
      data.manufacturer,
      data.website ?? null,
      data.releaseDate ?? null,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      data.description ?? null,
      data.details ?? null,
      data.specs ?? null
    );

    // Insert categories (normalized)
    for (const category of normalizedCategories) {
      insertCategory.run(data.slug, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertSearchTerm.run(data.slug, term);
      }
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

    // Insert versions
    if (data.versions) {
      for (const ver of data.versions) {
        insertSoftwareVersion.run(
          data.slug,
          ver.name,
          ver.releaseDate ?? null,
          ver.preRelease ? 1 : 0,
          ver.unofficial ? 1 : 0,
          ver.url ?? null,
          ver.description ?? null
        );
      }
    }

    // Insert prices
    if (data.prices) {
      for (const price of data.prices) {
        insertSoftwarePrice.run(data.slug, price.amount, price.currency);
      }
    }

    // Insert links
    if (data.links) {
      for (const link of data.links) {
        insertSoftwareLink.run(
          data.slug,
          link.type,
          link.title ?? null,
          link.url ?? null,
          link.videoId ?? null,
          link.provider ?? null,
          link.description ?? null
        );
      }
    }

    // Insert images
    if (data.images) {
      data.images.forEach((img, index) => {
        insertSoftwareImage.run(data.slug, img.source, img.alt ?? null, index);
      });
    }

    // Insert FTS entry (with normalized categories)
    insertSoftwareFts.run(
      data.slug,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      data.description ?? ""
    );

    softwareCount++;
  }

  console.log(`  ✓ Inserted ${softwareCount} software entries`);

  // Load and insert hardware
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  let hardwareCount = 0;

  const insertHardware = db.prepare(`
    INSERT INTO hardware (id, name, manufacturer_id, website, release_date, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareCategory = db.prepare(`
    INSERT INTO hardware_categories (hardware_id, category)
    VALUES (?, ?)
  `);
  const insertHardwareSearchTerm = db.prepare(`
    INSERT INTO hardware_search_terms (hardware_id, term)
    VALUES (?, ?)
  `);
  const insertHardwareIO = db.prepare(`
    INSERT INTO hardware_io (hardware_id, name, signal_flow, category, type, connection, max_connections, position, column_position, row_position, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareVersion = db.prepare(`
    INSERT INTO hardware_versions (hardware_id, name, release_date, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareRevision = db.prepare(`
    INSERT INTO hardware_revisions (hardware_id, name, release_date, url, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareRevisionIO = db.prepare(`
    INSERT INTO hardware_revision_io (revision_id, name, signal_flow, category, type, connection, max_connections, position, column_position, row_position, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareRevisionVersion = db.prepare(`
    INSERT INTO hardware_revision_versions (revision_id, name, release_date, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwarePrice = db.prepare(`
    INSERT INTO hardware_prices (hardware_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertHardwareRevisionPrice = db.prepare(`
    INSERT INTO hardware_revision_prices (revision_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertHardwareLink = db.prepare(`
    INSERT INTO hardware_links (hardware_id, type, title, url, video_id, provider, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareRevisionLink = db.prepare(`
    INSERT INTO hardware_revision_links (revision_id, type, title, url, video_id, provider, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareImage = db.prepare(`
    INSERT INTO hardware_images (hardware_id, source, alt, position)
    VALUES (?, ?, ?, ?)
  `);
  const insertHardwareFts = db.prepare(`
    INSERT INTO hardware_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const file of hardwareFiles) {
    const data = loadYamlFile<Hardware>(file);
    const manufacturer = manufacturers.get(data.manufacturer);

    // Normalize categories to canonical form
    const normalizedCategories = data.categories?.map(normalizeCategory) ?? [];
    const normalizedPrimaryCategory = data.primaryCategory ? normalizeCategory(data.primaryCategory) : null;
    const normalizedSecondaryCategory = data.secondaryCategory ? normalizeCategory(data.secondaryCategory) : null;

    insertHardware.run(
      data.slug,
      data.name,
      data.manufacturer,
      data.website ?? null,
      data.releaseDate ?? null,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      data.description ?? null,
      data.details ?? null,
      data.specs ?? null
    );

    // Insert categories (normalized)
    for (const category of normalizedCategories) {
      insertHardwareCategory.run(data.slug, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertHardwareSearchTerm.run(data.slug, term);
      }
    }

    // Insert I/O ports
    if (data.io) {
      for (const io of data.io) {
        insertHardwareIO.run(
          data.slug,
          io.name,
          io.signalFlow,
          io.category,
          io.type,
          io.connection,
          io.maxConnections ?? 1,
          io.position ?? null,
          io.columnPosition ?? null,
          io.rowPosition ?? null,
          io.description ?? null
        );
      }
    }

    // Insert versions (firmware)
    if (data.versions) {
      for (const ver of data.versions) {
        insertHardwareVersion.run(
          data.slug,
          ver.name,
          ver.releaseDate ?? null,
          ver.preRelease ? 1 : 0,
          ver.unofficial ? 1 : 0,
          ver.url ?? null,
          ver.description ?? null
        );
      }
    }

    // Insert revisions
    if (data.revisions) {
      for (const rev of data.revisions) {
        const result = insertHardwareRevision.run(
          data.slug,
          rev.name,
          rev.releaseDate ?? null,
          rev.url ?? null,
          rev.description ?? null
        );
        const revisionId = result.lastInsertRowid;

        // Insert revision I/O
        if (rev.io) {
          for (const io of rev.io) {
            insertHardwareRevisionIO.run(
              revisionId,
              io.name,
              io.signalFlow,
              io.category,
              io.type,
              io.connection,
              io.maxConnections ?? 1,
              io.position ?? null,
              io.columnPosition ?? null,
              io.rowPosition ?? null,
              io.description ?? null
            );
          }
        }

        // Insert revision versions
        if (rev.versions) {
          for (const ver of rev.versions) {
            insertHardwareRevisionVersion.run(
              revisionId,
              ver.name,
              ver.releaseDate ?? null,
              ver.preRelease ? 1 : 0,
              ver.unofficial ? 1 : 0,
              ver.url ?? null,
              ver.description ?? null
            );
          }
        }

        // Insert revision prices
        if (rev.prices) {
          for (const price of rev.prices) {
            insertHardwareRevisionPrice.run(revisionId, price.amount, price.currency);
          }
        }

        // Insert revision links
        if (rev.links) {
          for (const link of rev.links) {
            insertHardwareRevisionLink.run(
              revisionId,
              link.type,
              link.title ?? null,
              link.url ?? null,
              link.videoId ?? null,
              link.provider ?? null,
              link.description ?? null
            );
          }
        }
      }
    }

    // Insert prices
    if (data.prices) {
      for (const price of data.prices) {
        insertHardwarePrice.run(data.slug, price.amount, price.currency);
      }
    }

    // Insert links
    if (data.links) {
      for (const link of data.links) {
        insertHardwareLink.run(
          data.slug,
          link.type,
          link.title ?? null,
          link.url ?? null,
          link.videoId ?? null,
          link.provider ?? null,
          link.description ?? null
        );
      }
    }

    // Insert images
    if (data.images) {
      data.images.forEach((img, index) => {
        insertHardwareImage.run(data.slug, img.source, img.alt ?? null, index);
      });
    }

    // Insert FTS entry (with normalized categories)
    insertHardwareFts.run(
      data.slug,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      data.description ?? ""
    );

    hardwareCount++;
  }

  console.log(`  ✓ Inserted ${hardwareCount} hardware entries`);

  // Update metadata
  const updateMeta = db.prepare(`
    INSERT OR REPLACE INTO catalog_meta (key, value)
    VALUES (?, ?)
  `);
  updateMeta.run("version", version);
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

console.log("\n🔨 Building catalog database...\n");
buildDatabase(CATALOG_VERSION);
console.log();



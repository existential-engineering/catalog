/**
 * SQLite Build Script
 *
 * Generates a SQLite database from YAML source files.
 * Converts Markdown fields to HTML for consumption by apps.
 * Run with: pnpm build
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

import type { Manufacturer, Software, Hardware, IO, Version, Price, Link, Revision, CategoryAliasesSchema, LocalesSchema, ContentTranslation } from "./lib/types.js";
import { DATA_DIR, OUTPUT_DIR, SCHEMA_DIR, loadYamlFile, getYamlFiles } from "./lib/utils.js";

// Configure marked for safe HTML output
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false, // Don't convert \n to <br>
});

/**
 * Convert Markdown to HTML, or return null if input is empty
 */
function markdownToHtml(markdown: string | undefined | null): string | null {
  if (!markdown) return null;
  const html = marked.parse(markdown);
  // marked.parse can return a Promise in async mode, but we're using sync mode
  return typeof html === "string" ? html.trim() : null;
}

// Load category aliases for normalization
const categoryAliasesSchema = loadYamlFile<CategoryAliasesSchema>(
  path.join(SCHEMA_DIR, "category-aliases.yaml")
);
const CATEGORY_ALIASES = new Map<string, string>(
  Object.entries(categoryAliasesSchema.aliases)
);

// Load approved locales
const localesSchema = loadYamlFile<LocalesSchema>(
  path.join(SCHEMA_DIR, "locales.yaml")
);
const APPROVED_LOCALES = new Set(localesSchema.locales.map(l => l.code));

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

  // Insert approved locales
  const insertLocale = db.prepare(`
    INSERT INTO locales (code, name, native_name, enabled)
    VALUES (?, ?, ?, 1)
  `);
  for (const locale of localesSchema.locales) {
    insertLocale.run(locale.code, locale.name, locale.nativeName);
  }
  console.log(`  ✓ Inserted ${localesSchema.locales.length} locales`);

  // Load and insert manufacturers
  const manufacturerFiles = getYamlFiles(path.join(DATA_DIR, "manufacturers"));
  const manufacturers = new Map<string, Manufacturer>();
  const manufacturerIds = new Map<string, string>(); // slug -> id mapping

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
  const insertManufacturerTranslation = db.prepare(`
    INSERT INTO manufacturer_translations (manufacturer_id, locale, description, website)
    VALUES (?, ?, ?, ?)
  `);

  // First pass: insert all manufacturers without parent references
  for (const file of manufacturerFiles) {
    const data = loadYamlFile<Manufacturer>(file);
    const slug = path.basename(file, path.extname(file));
    manufacturers.set(slug, data);

    // Get ID from YAML (must be present - run 'pnpm assign-ids' if missing)
    const id = data.id;
    if (!id) {
      throw new Error(`Missing id in ${file}. Run 'pnpm assign-ids' to assign IDs to new entries.`);
    }
    manufacturerIds.set(slug, id);

    insertManufacturer.run(
      id,
      data.name,
      data.companyName ?? null,
      data.website ?? null,
      markdownToHtml(data.description)
    );

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertManufacturerSearchTerm.run(id, term);
      }
    }

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;
        if (trans.description || trans.website) {
          insertManufacturerTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            trans.website ?? null
          );
        }
      }
    }
  }

  // Second pass: update parent company references
  for (const [slug, data] of manufacturers.entries()) {
    if (data.parentCompany) {
      const parentId = manufacturerIds.get(data.parentCompany);
      const childId = manufacturerIds.get(slug);
      if (parentId && childId) {
        updateManufacturerParent.run(parentId, childId);
      }
    }
  }

  console.log(`  ✓ Inserted ${manufacturers.size} manufacturers`);

  // Load and insert software
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  let softwareCount = 0;

  const insertSoftware = db.prepare(`
    INSERT INTO software (id, name, manufacturer_id, website, release_date, release_date_year_only, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    INSERT INTO software_versions (software_id, name, release_date, release_date_year_only, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwarePrice = db.prepare(`
    INSERT INTO software_prices (software_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertSoftwareLink = db.prepare(`
    INSERT INTO software_links (software_id, type, title, url, video_id, provider, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwareFts = db.prepare(`
    INSERT INTO software_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSoftwareTranslation = db.prepare(`
    INSERT INTO software_translations (software_id, locale, description, details, specs, website)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwareLinkLocalized = db.prepare(`
    INSERT INTO software_links_localized (software_id, locale, type, title, url, video_id, provider, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of softwareFiles) {
    const data = loadYamlFile<Software>(file);
    const manufacturer = manufacturers.get(data.manufacturer);
    const manufacturerId = manufacturerIds.get(data.manufacturer);

    // Get ID from YAML (must be present - run 'pnpm assign-ids' if missing)
    const id = data.id;
    if (!id) {
      throw new Error(`Missing id in ${file}. Run 'pnpm assign-ids' to assign IDs to new entries.`);
    }

    // Normalize categories to canonical form
    const normalizedCategories = data.categories?.map(normalizeCategory) ?? [];
    const normalizedPrimaryCategory = data.primaryCategory ? normalizeCategory(data.primaryCategory) : null;
    const normalizedSecondaryCategory = data.secondaryCategory ? normalizeCategory(data.secondaryCategory) : null;

    insertSoftware.run(
      id,
      data.name,
      manufacturerId ?? null,
      data.website ?? null,
      data.releaseDate ?? null,
      data.releaseDateYearOnly ? 1 : 0,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      markdownToHtml(data.description),
      markdownToHtml(data.details),
      markdownToHtml(data.specs)
    );

    // Insert categories (normalized)
    for (const category of normalizedCategories) {
      insertCategory.run(id, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertSearchTerm.run(id, term);
      }
    }

    // Insert formats
    if (data.formats) {
      for (const format of data.formats) {
        const identifier = data.identifiers?.[format] ?? null;
        insertFormat.run(id, format, identifier);
      }
    }

    // Insert platforms
    if (data.platforms) {
      for (const platform of data.platforms) {
        insertPlatform.run(id, platform);
      }
    }

    // Insert versions
    if (data.versions) {
      for (const ver of data.versions) {
        insertSoftwareVersion.run(
          id,
          ver.name,
          ver.releaseDate ?? null,
          ver.releaseDateYearOnly ? 1 : 0,
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
        insertSoftwarePrice.run(id, price.amount, price.currency);
      }
    }

    // Insert links
    if (data.links) {
      for (const link of data.links) {
        insertSoftwareLink.run(
          id,
          link.type,
          link.title ?? null,
          link.url ?? null,
          link.videoId ?? null,
          link.provider ?? null,
          link.description ?? null
        );
      }
    }

    // Insert FTS entry (with normalized categories)
    insertSoftwareFts.run(
      id,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      data.description ?? ""
    );

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;

        // Insert content translation
        if (trans.description || trans.details || trans.specs || trans.website) {
          insertSoftwareTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            markdownToHtml(trans.details),
            markdownToHtml(trans.specs),
            trans.website ?? null
          );
        }

        // Insert localized links (replaces default links for this locale)
        if (trans.links) {
          for (const link of trans.links) {
            insertSoftwareLinkLocalized.run(
              id,
              locale,
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

    softwareCount++;
  }

  console.log(`  ✓ Inserted ${softwareCount} software entries`);

  // Load and insert hardware
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  let hardwareCount = 0;

  const insertHardware = db.prepare(`
    INSERT INTO hardware (id, name, manufacturer_id, website, release_date, release_date_year_only, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    INSERT INTO hardware_versions (hardware_id, name, release_date, release_date_year_only, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareRevision = db.prepare(`
    INSERT INTO hardware_revisions (hardware_id, name, release_date, release_date_year_only, url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareRevisionIO = db.prepare(`
    INSERT INTO hardware_revision_io (revision_id, name, signal_flow, category, type, connection, max_connections, position, column_position, row_position, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareRevisionVersion = db.prepare(`
    INSERT INTO hardware_revision_versions (revision_id, name, release_date, release_date_year_only, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
  const insertHardwareFts = db.prepare(`
    INSERT INTO hardware_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareTranslation = db.prepare(`
    INSERT INTO hardware_translations (hardware_id, locale, description, details, specs, website)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareLinkLocalized = db.prepare(`
    INSERT INTO hardware_links_localized (hardware_id, locale, type, title, url, video_id, provider, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareIOTranslation = db.prepare(`
    INSERT INTO hardware_io_translations (hardware_id, locale, original_name, translated_name, translated_description)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const file of hardwareFiles) {
    const data = loadYamlFile<Hardware>(file);
    const slug = path.basename(file, path.extname(file));
    const manufacturer = manufacturers.get(data.manufacturer);
    const manufacturerId = manufacturerIds.get(data.manufacturer);

    // Get ID from YAML (must be present - run 'pnpm assign-ids' if missing)
    const id = data.id;
    if (!id) {
      throw new Error(`Missing id in ${file}. Run 'pnpm assign-ids' to assign IDs to new entries.`);
    }

    // Normalize categories to canonical form
    const normalizedCategories = data.categories?.map(normalizeCategory) ?? [];
    const normalizedPrimaryCategory = data.primaryCategory ? normalizeCategory(data.primaryCategory) : null;
    const normalizedSecondaryCategory = data.secondaryCategory ? normalizeCategory(data.secondaryCategory) : null;

    insertHardware.run(
      id,
      data.name,
      manufacturerId ?? null,
      data.website ?? null,
      data.releaseDate ?? null,
      data.releaseDateYearOnly ? 1 : 0,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      markdownToHtml(data.description),
      markdownToHtml(data.details),
      markdownToHtml(data.specs)
    );

    // Insert categories (normalized)
    for (const category of normalizedCategories) {
      insertHardwareCategory.run(id, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertHardwareSearchTerm.run(id, term);
      }
    }

    // Insert I/O ports
    if (data.io) {
      for (const io of data.io) {
        insertHardwareIO.run(
          id,
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
          id,
          ver.name,
          ver.releaseDate ?? null,
          ver.releaseDateYearOnly ? 1 : 0,
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
          id,
          rev.name,
          rev.releaseDate ?? null,
          rev.releaseDateYearOnly ? 1 : 0,
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
              ver.releaseDateYearOnly ? 1 : 0,
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
        insertHardwarePrice.run(id, price.amount, price.currency);
      }
    }

    // Insert links
    if (data.links) {
      for (const link of data.links) {
        insertHardwareLink.run(
          id,
          link.type,
          link.title ?? null,
          link.url ?? null,
          link.videoId ?? null,
          link.provider ?? null,
          link.description ?? null
        );
      }
    }

    // Insert FTS entry (with normalized categories)
    insertHardwareFts.run(
      id,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      data.description ?? ""
    );

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;

        // Insert content translation
        if (trans.description || trans.details || trans.specs || trans.website) {
          insertHardwareTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            markdownToHtml(trans.details),
            markdownToHtml(trans.specs),
            trans.website ?? null
          );
        }

        // Insert localized links (replaces default links for this locale)
        if (trans.links) {
          for (const link of trans.links) {
            insertHardwareLinkLocalized.run(
              id,
              locale,
              link.type,
              link.title ?? null,
              link.url ?? null,
              link.videoId ?? null,
              link.provider ?? null,
              link.description ?? null
            );
          }
        }

        // Insert I/O translations (merge semantics)
        if (trans.io) {
          const sourceIONames = new Set(data.io?.map(io => io.name) ?? []);
          for (const ioTrans of trans.io) {
            if (!sourceIONames.has(ioTrans.originalName)) {
              console.warn(
                `  ⚠️  Warning: hardware '${slug}' locale '${locale}' references unknown I/O port '${ioTrans.originalName}'. ` +
                `Available: ${[...sourceIONames].join(", ") || "(none)"}`
              );
              continue;
            }
            insertHardwareIOTranslation.run(
              id,
              locale,
              ioTrans.originalName,
              ioTrans.name ?? null,
              ioTrans.description ?? null
            );
          }
        }
      }
    }

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



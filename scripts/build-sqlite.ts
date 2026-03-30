/**
 * SQLite Build Script
 *
 * Generates a SQLite database from YAML source files.
 * Converts Markdown fields to HTML for consumption by apps.
 * Run with: pnpm build
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { marked } from "marked";

import type {
  Accessory,
  CategoryAliasesSchema,
  Content,
  Hardware,
  LocalesSchema,
  Manufacturer,
  Software,
} from "./lib/types.js";
import {
  DATA_DIR,
  getYamlFiles,
  loadYamlFile,
  normalizeMarkdown,
  OUTPUT_DIR,
  SCHEMA_DIR,
  slugify,
} from "./lib/utils.js";

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
const CATEGORY_ALIASES = new Map<string, string>(Object.entries(categoryAliasesSchema.aliases));

// Load approved locales
const localesSchema = loadYamlFile<LocalesSchema>(path.join(SCHEMA_DIR, "locales.yaml"));
const APPROVED_LOCALES = new Set(localesSchema.locales.map((l) => l.code));

// Normalize a category to its canonical form
function normalizeCategory(category: string): string {
  return CATEGORY_ALIASES.get(category) ?? category;
}

// Load IO position and connection aliases for normalization
import { loadSchemaContext } from "./lib/schema-loader.js";

const _schemaContext = loadSchemaContext();
const IO_POSITION_ALIASES = new Map<string, string>(
  Object.entries(_schemaContext.ioPositionAliases)
);
const IO_CONNECTION_ALIASES = new Map<string, string>(
  Object.entries(_schemaContext.ioConnectionAliases)
);

// Normalize an IO position to its canonical form
function normalizeIOPosition(position: string): string {
  return IO_POSITION_ALIASES.get(position) ?? position;
}

// Normalize an IO connection to its canonical form
function normalizeIOConnection(connection: string): string {
  return IO_CONNECTION_ALIASES.get(connection) ?? connection;
}

// Normalize bidirectional signal flow to input for studio compatibility
function normalizeIOSignalFlow(signalFlow: string): string {
  return signalFlow === "bidirectional" ? "input" : signalFlow;
}

// Read version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "../package.json"), "utf-8")
);
const CATALOG_VERSION = packageJson.version;

const SCHEMA_FILE = path.join(import.meta.dirname, "schema.sql");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "catalog.sqlite");

// =============================================================================
// BUILD FUNCTIONS
/**
 * Builds the catalog SQLite database file from schema and YAML source data, inserting locales, manufacturers, software, and hardware, then records metadata and optimizes the database.
 *
 * @param version - The catalog version string to store in the database metadata
 * @throws Error if a YAML entry is missing an `id` (e.g., when new entries need IDs assigned)
 */
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
    INSERT INTO manufacturers (id, name, company_name, url, description)
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
    INSERT INTO manufacturer_translations (manufacturer_id, locale, description, url)
    VALUES (?, ?, ?, ?)
  `);
  const insertManufacturerFts = db.prepare(`
    INSERT INTO manufacturers_fts (id, name, company_name, description)
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
      data.url ?? null,
      markdownToHtml(data.description)
    );

    // Insert FTS entry (include searchTerms for synonym matching)
    const mfrFtsDescription = [data.description ?? "", ...(data.searchTerms ?? [])].join(" ");
    insertManufacturerFts.run(id, data.name, data.companyName ?? "", mfrFtsDescription);

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
        if (trans.description || trans.url) {
          insertManufacturerTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            trans.url ?? null
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
  const softwareSupersedes = new Map<string, string>(); // id -> supersedes_id
  let softwareCount = 0;

  // Build slug -> nanoid lookup for resolving compatibility references
  const slugToId = new Map<string, string>();
  for (const file of softwareFiles) {
    const data = loadYamlFile<Software>(file);
    const slug = path.basename(file, ".yaml");
    if (data.id) slugToId.set(slug, data.id);
  }

  // Build hardware slug -> nanoid lookup for resolving content-to-hardware compatibility
  const hardwareSlugToId = new Map<string, string>();
  for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
    const data = loadYamlFile<Hardware>(file);
    const slug = path.basename(file, ".yaml");
    if (data.id) hardwareSlugToId.set(slug, data.id);
  }

  const insertSoftware = db.prepare(`
    INSERT INTO software (id, name, manufacturer_id, url, release_date, release_date_year_only, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSoftwareSupersedes = db.prepare(`
    UPDATE software SET supersedes_id = ? WHERE id = ?
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
    INSERT INTO software_links (software_id, type, title, url, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSoftwareVideo = db.prepare(`
    INSERT INTO software_videos (software_id, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSoftwareFts = db.prepare(`
    INSERT INTO software_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSoftwareTranslation = db.prepare(`
    INSERT INTO software_translations (software_id, locale, description, details, specs, url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwareLinkLocalized = db.prepare(`
    INSERT INTO software_links_localized (software_id, locale, type, title, url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSoftwareVideoLocalized = db.prepare(`
    INSERT INTO software_videos_localized (software_id, locale, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCompatibility = db.prepare(`
    INSERT INTO software_compatibility (software_id, compatible_with_id)
    VALUES (?, ?)
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
    const normalizedPrimaryCategory = data.primaryCategory
      ? normalizeCategory(data.primaryCategory)
      : null;
    const normalizedSecondaryCategory = data.secondaryCategory
      ? normalizeCategory(data.secondaryCategory)
      : null;

    insertSoftware.run(
      id,
      data.name,
      manufacturerId ?? null,
      data.url ?? null,
      data.releaseDate ?? null,
      data.releaseDateYearOnly ? 1 : 0,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      markdownToHtml(data.description),
      markdownToHtml(normalizeMarkdown(data.details)),
      markdownToHtml(normalizeMarkdown(data.specs))
    );

    // Store supersedes for later update
    if (data.supersedes) {
      softwareSupersedes.set(id, data.supersedes);
    }

    // Insert categories (normalized, deduplicated)
    const seenCategories = new Set<string>();
    for (const category of normalizedCategories) {
      if (seenCategories.has(category)) {
        console.warn(`  ⚠ Duplicate category "${category}" in ${file} (after normalization)`);
        continue;
      }
      seenCategories.add(category);
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

    // Insert compatibility references (resolve slugs to nanoid IDs)
    if (data.compatibleWith) {
      for (const slug of data.compatibleWith) {
        const resolvedId = slugToId.get(slug);
        if (resolvedId) {
          insertCompatibility.run(id, resolvedId);
        } else {
          console.warn(`  ⚠ Unknown compatibility slug "${slug}" in ${file}`);
        }
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
          link.url,
          link.description ?? null
        );
      }
    }

    // Insert videos
    if (data.videos) {
      for (const video of data.videos) {
        insertSoftwareVideo.run(
          id,
          video.videoId,
          video.provider ?? "youtube",
          video.title ?? null,
          video.description ?? null
        );
      }
    }

    // Insert FTS entry (with normalized categories + searchTerms)
    const softwareFtsDescription = [data.description ?? "", ...(data.searchTerms ?? [])].join(" ");
    insertSoftwareFts.run(
      id,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      softwareFtsDescription
    );

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;

        // Insert content translation
        if (trans.description || trans.details || trans.specs || trans.url) {
          insertSoftwareTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            markdownToHtml(trans.details),
            markdownToHtml(trans.specs),
            trans.url ?? null
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
              link.url,
              link.description ?? null
            );
          }
        }

        // Insert localized videos (replaces default videos for this locale)
        if (trans.videos) {
          for (const video of trans.videos) {
            insertSoftwareVideoLocalized.run(
              id,
              locale,
              video.videoId,
              video.provider ?? "youtube",
              video.title ?? null,
              video.description ?? null
            );
          }
        }
      }
    }

    softwareCount++;
  }

  console.log(`  ✓ Inserted ${softwareCount} software entries`);

  // Second pass: update supersedes relationships
  for (const [id, supersedesId] of softwareSupersedes) {
    updateSoftwareSupersedes.run(supersedesId, id);
  }

  // Load and insert content
  const contentFiles = getYamlFiles(path.join(DATA_DIR, "content"));
  const contentSupersedes = new Map<string, string>(); // id -> supersedes_id
  let contentCount = 0;

  const insertContent = db.prepare(`
    INSERT INTO content (id, name, manufacturer_id, url, release_date, release_date_year_only, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateContentSupersedes = db.prepare(`
    UPDATE content SET supersedes_id = ? WHERE id = ?
  `);
  const insertContentCategory = db.prepare(`
    INSERT INTO content_categories (content_id, category)
    VALUES (?, ?)
  `);
  const insertContentSearchTerm = db.prepare(`
    INSERT INTO content_search_terms (content_id, term)
    VALUES (?, ?)
  `);
  const insertContentCompatibility = db.prepare(`
    INSERT INTO content_compatibility (content_id, compatible_with_id)
    VALUES (?, ?)
  `);
  const insertContentHardwareCompatibility = db.prepare(`
    INSERT INTO content_hardware_compatibility (content_id, compatible_with_id)
    VALUES (?, ?)
  `);
  const deferredContentHardwareCompat: { contentId: string; hardwareId: string }[] = [];
  const insertContentVersion = db.prepare(`
    INSERT INTO content_versions (content_id, name, release_date, release_date_year_only, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertContentPrice = db.prepare(`
    INSERT INTO content_prices (content_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertContentLink = db.prepare(`
    INSERT INTO content_links (content_id, type, title, url, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertContentVideo = db.prepare(`
    INSERT INTO content_videos (content_id, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertContentFts = db.prepare(`
    INSERT INTO content_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertContentTranslation = db.prepare(`
    INSERT INTO content_translations (content_id, locale, description, details, specs, url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertContentLinkLocalized = db.prepare(`
    INSERT INTO content_links_localized (content_id, locale, type, title, url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertContentVideoLocalized = db.prepare(`
    INSERT INTO content_videos_localized (content_id, locale, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const file of contentFiles) {
    const data = loadYamlFile<Content>(file);
    const manufacturer = manufacturers.get(data.manufacturer);
    const manufacturerId = manufacturerIds.get(data.manufacturer);

    const id = data.id;
    if (!id) {
      throw new Error(`Missing id in ${file}. Run 'pnpm assign-ids' to assign IDs to new entries.`);
    }

    const normalizedCategories = data.categories?.map(normalizeCategory) ?? [];
    const normalizedPrimaryCategory = data.primaryCategory
      ? normalizeCategory(data.primaryCategory)
      : null;
    const normalizedSecondaryCategory = data.secondaryCategory
      ? normalizeCategory(data.secondaryCategory)
      : null;

    insertContent.run(
      id,
      data.name,
      manufacturerId ?? null,
      data.url ?? null,
      data.releaseDate ?? null,
      data.releaseDateYearOnly ? 1 : 0,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      markdownToHtml(data.description),
      markdownToHtml(normalizeMarkdown(data.details)),
      markdownToHtml(normalizeMarkdown(data.specs))
    );

    if (data.supersedes) {
      contentSupersedes.set(id, data.supersedes);
    }

    // Insert categories
    const seenContentCategories = new Set<string>();
    for (const category of normalizedCategories) {
      if (seenContentCategories.has(category)) {
        console.warn(`  ⚠ Duplicate category "${category}" in ${file} (after normalization)`);
        continue;
      }
      seenContentCategories.add(category);
      insertContentCategory.run(id, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertContentSearchTerm.run(id, term);
      }
    }

    // Insert compatibility references (resolve slugs to software or hardware IDs)
    // Hardware compatibility inserts are deferred until after hardware rows exist
    if (data.compatibleWith) {
      for (const slug of data.compatibleWith) {
        const softwareId = slugToId.get(slug);
        const hardwareId = hardwareSlugToId.get(slug);
        if (softwareId && hardwareId) {
          throw new Error(
            `Ambiguous compatibility slug "${slug}" in ${file}: exists as both software and hardware. Rename one to remove the conflict.`
          );
        } else if (softwareId) {
          insertContentCompatibility.run(id, softwareId);
        } else if (hardwareId) {
          deferredContentHardwareCompat.push({ contentId: id, hardwareId });
        } else {
          console.warn(`  ⚠ Unknown compatibility slug "${slug}" in ${file}`);
        }
      }
    }

    // Insert versions
    if (data.versions) {
      for (const ver of data.versions) {
        insertContentVersion.run(
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
        insertContentPrice.run(id, price.amount, price.currency);
      }
    }

    // Insert links
    if (data.links) {
      for (const link of data.links) {
        insertContentLink.run(
          id,
          link.type,
          link.title ?? null,
          link.url,
          link.description ?? null
        );
      }
    }

    // Insert videos
    if (data.videos) {
      for (const video of data.videos) {
        insertContentVideo.run(
          id,
          video.videoId,
          video.provider ?? "youtube",
          video.title ?? null,
          video.description ?? null
        );
      }
    }

    // Insert FTS entry (with searchTerms)
    const contentFtsDescription = [data.description ?? "", ...(data.searchTerms ?? [])].join(" ");
    insertContentFts.run(
      id,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      contentFtsDescription
    );

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;

        if (trans.description || trans.details || trans.specs || trans.url) {
          insertContentTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            markdownToHtml(trans.details),
            markdownToHtml(trans.specs),
            trans.url ?? null
          );
        }

        if (trans.links) {
          for (const link of trans.links) {
            insertContentLinkLocalized.run(
              id,
              locale,
              link.type,
              link.title ?? null,
              link.url,
              link.description ?? null
            );
          }
        }

        if (trans.videos) {
          for (const video of trans.videos) {
            insertContentVideoLocalized.run(
              id,
              locale,
              video.videoId,
              video.provider ?? "youtube",
              video.title ?? null,
              video.description ?? null
            );
          }
        }
      }
    }

    contentCount++;
  }

  console.log(`  ✓ Inserted ${contentCount} content entries`);

  // Update content supersedes relationships
  for (const [id, supersedesId] of contentSupersedes) {
    updateContentSupersedes.run(supersedesId, id);
  }

  // Load and insert hardware
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  const hardwareSupersedes = new Map<string, string>(); // id -> supersedes_id
  let hardwareCount = 0;

  const insertHardware = db.prepare(`
    INSERT INTO hardware (id, name, manufacturer_id, url, release_date, release_date_year_only, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateHardwareSupersedes = db.prepare(`
    UPDATE hardware SET supersedes_id = ? WHERE id = ?
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
    INSERT INTO hardware_io (hardware_id, name, signal_flow, category, type, connection, connector_detail, max_connections, position, column_position, row_position, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareVersion = db.prepare(`
    INSERT INTO hardware_versions (hardware_id, name, release_date, release_date_year_only, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareVariant = db.prepare(`
    INSERT INTO hardware_variants (hardware_id, name, slug, release_date, release_date_year_only, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertHardwarePrice = db.prepare(`
    INSERT INTO hardware_prices (hardware_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertHardwareVariantPrice = db.prepare(`
    INSERT INTO hardware_variant_prices (variant_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertHardwareLink = db.prepare(`
    INSERT INTO hardware_links (hardware_id, type, title, url, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareVideo = db.prepare(`
    INSERT INTO hardware_videos (hardware_id, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareVariantLink = db.prepare(`
    INSERT INTO hardware_variant_links (variant_id, type, title, url, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareVariantVideo = db.prepare(`
    INSERT INTO hardware_variant_videos (variant_id, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareFts = db.prepare(`
    INSERT INTO hardware_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertHardwareTranslation = db.prepare(`
    INSERT INTO hardware_translations (hardware_id, locale, description, details, specs, url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareLinkLocalized = db.prepare(`
    INSERT INTO hardware_links_localized (hardware_id, locale, type, title, url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertHardwareVideoLocalized = db.prepare(`
    INSERT INTO hardware_videos_localized (hardware_id, locale, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
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
    const normalizedPrimaryCategory = data.primaryCategory
      ? normalizeCategory(data.primaryCategory)
      : null;
    const normalizedSecondaryCategory = data.secondaryCategory
      ? normalizeCategory(data.secondaryCategory)
      : null;

    insertHardware.run(
      id,
      data.name,
      manufacturerId ?? null,
      data.url ?? null,
      data.releaseDate ?? null,
      data.releaseDateYearOnly ? 1 : 0,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      markdownToHtml(data.description),
      markdownToHtml(normalizeMarkdown(data.details)),
      markdownToHtml(normalizeMarkdown(data.specs))
    );

    // Store supersedes for later update
    if (data.supersedes) {
      hardwareSupersedes.set(id, data.supersedes);
    }

    // Insert categories (normalized, deduplicated)
    const seenHwCategories = new Set<string>();
    for (const category of normalizedCategories) {
      if (seenHwCategories.has(category)) {
        console.warn(`  ⚠ Duplicate category "${category}" in ${file} (after normalization)`);
        continue;
      }
      seenHwCategories.add(category);
      insertHardwareCategory.run(id, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertHardwareSearchTerm.run(id, term);
      }
    }

    // Insert I/O ports (with normalization)
    if (data.io) {
      for (const io of data.io) {
        insertHardwareIO.run(
          id,
          io.name,
          normalizeIOSignalFlow(io.signalFlow),
          io.category,
          io.type,
          normalizeIOConnection(io.connection),
          io.connectorDetail ? JSON.stringify(io.connectorDetail) : null,
          io.maxConnections ?? 1,
          io.position ? normalizeIOPosition(io.position) : null,
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

    // Insert variants (cosmetic-only: colors, finishes, limited editions)
    if (data.variants) {
      const usedSlugs = new Set<string>();
      for (const variant of data.variants) {
        const variantSlug = variant.slug ?? slugify(variant.name);
        if (usedSlugs.has(variantSlug)) {
          throw new Error(
            `Duplicate variant slug '${variantSlug}' in ${file}. Add explicit slugs to disambiguate.`
          );
        }
        usedSlugs.add(variantSlug);

        const result = insertHardwareVariant.run(
          id,
          variant.name,
          variantSlug,
          variant.releaseDate ?? null,
          variant.releaseDateYearOnly ? 1 : 0,
          variant.url ?? null,
          variant.description ?? null
        );
        const variantId = result.lastInsertRowid;

        // Insert variant prices
        if (variant.prices) {
          for (const price of variant.prices) {
            insertHardwareVariantPrice.run(variantId, price.amount, price.currency);
          }
        }

        // Insert variant links
        if (variant.links) {
          for (const link of variant.links) {
            insertHardwareVariantLink.run(
              variantId,
              link.type,
              link.title ?? null,
              link.url,
              link.description ?? null
            );
          }
        }

        // Insert variant videos
        if (variant.videos) {
          for (const video of variant.videos) {
            insertHardwareVariantVideo.run(
              variantId,
              video.videoId,
              video.provider ?? "youtube",
              video.title ?? null,
              video.description ?? null
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
          link.url,
          link.description ?? null
        );
      }
    }

    // Insert videos
    if (data.videos) {
      for (const video of data.videos) {
        insertHardwareVideo.run(
          id,
          video.videoId,
          video.provider ?? "youtube",
          video.title ?? null,
          video.description ?? null
        );
      }
    }

    // Insert FTS entry (with normalized categories + searchTerms)
    const hardwareFtsDescription = [data.description ?? "", ...(data.searchTerms ?? [])].join(" ");
    insertHardwareFts.run(
      id,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      hardwareFtsDescription
    );

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;

        // Insert content translation
        if (trans.description || trans.details || trans.specs || trans.url) {
          insertHardwareTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            markdownToHtml(trans.details),
            markdownToHtml(trans.specs),
            trans.url ?? null
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
              link.url,
              link.description ?? null
            );
          }
        }

        // Insert localized videos (replaces default videos for this locale)
        if (trans.videos) {
          for (const video of trans.videos) {
            insertHardwareVideoLocalized.run(
              id,
              locale,
              video.videoId,
              video.provider ?? "youtube",
              video.title ?? null,
              video.description ?? null
            );
          }
        }

        // Insert I/O translations (merge semantics)
        if (trans.io) {
          const sourceIONames = new Set(data.io?.map((io) => io.name) ?? []);
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

  // Second pass: update supersedes relationships
  for (const [id, supersedesId] of hardwareSupersedes) {
    updateHardwareSupersedes.run(supersedesId, id);
  }

  // Insert deferred content-to-hardware compatibility (hardware rows now exist)
  for (const { contentId, hardwareId } of deferredContentHardwareCompat) {
    insertContentHardwareCompatibility.run(contentId, hardwareId);
  }

  // Load and insert accessories
  const accessoryFiles = getYamlFiles(path.join(DATA_DIR, "accessories"));
  const accessorySupersedes = new Map<string, string>(); // id -> supersedes_id
  let accessoryCount = 0;

  const insertAccessory = db.prepare(`
    INSERT INTO accessories (id, name, manufacturer_id, url, release_date, release_date_year_only, primary_category, secondary_category, description, details, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateAccessorySupersedes = db.prepare(`
    UPDATE accessories SET supersedes_id = ? WHERE id = ?
  `);
  const insertAccessoryCategory = db.prepare(`
    INSERT INTO accessories_categories (accessory_id, category)
    VALUES (?, ?)
  `);
  const insertAccessorySearchTerm = db.prepare(`
    INSERT INTO accessories_search_terms (accessory_id, term)
    VALUES (?, ?)
  `);
  const insertAccessoryVersion = db.prepare(`
    INSERT INTO accessories_versions (accessory_id, name, release_date, release_date_year_only, pre_release, unofficial, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAccessoryPrice = db.prepare(`
    INSERT INTO accessories_prices (accessory_id, amount, currency)
    VALUES (?, ?, ?)
  `);
  const insertAccessoryLink = db.prepare(`
    INSERT INTO accessories_links (accessory_id, type, title, url, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertAccessoryVideo = db.prepare(`
    INSERT INTO accessories_videos (accessory_id, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertAccessoryFts = db.prepare(`
    INSERT INTO accessories_fts (id, name, manufacturer_name, categories, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertAccessoryTranslation = db.prepare(`
    INSERT INTO accessories_translations (accessory_id, locale, description, details, specs, url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAccessoryLinkLocalized = db.prepare(`
    INSERT INTO accessories_links_localized (accessory_id, locale, type, title, url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAccessoryVideoLocalized = db.prepare(`
    INSERT INTO accessories_videos_localized (accessory_id, locale, video_id, provider, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const file of accessoryFiles) {
    const data = loadYamlFile<Accessory>(file);
    const manufacturer = manufacturers.get(data.manufacturer);
    const manufacturerId = manufacturerIds.get(data.manufacturer);

    const id = data.id;
    if (!id) {
      throw new Error(`Missing id in ${file}. Run 'pnpm assign-ids' to assign IDs to new entries.`);
    }

    const normalizedCategories = data.categories?.map(normalizeCategory) ?? [];
    const normalizedPrimaryCategory = data.primaryCategory
      ? normalizeCategory(data.primaryCategory)
      : null;
    const normalizedSecondaryCategory = data.secondaryCategory
      ? normalizeCategory(data.secondaryCategory)
      : null;

    insertAccessory.run(
      id,
      data.name,
      manufacturerId ?? null,
      data.url ?? null,
      data.releaseDate ?? null,
      data.releaseDateYearOnly ? 1 : 0,
      normalizedPrimaryCategory,
      normalizedSecondaryCategory,
      markdownToHtml(data.description),
      markdownToHtml(normalizeMarkdown(data.details)),
      markdownToHtml(normalizeMarkdown(data.specs))
    );

    if (data.supersedes) {
      accessorySupersedes.set(id, data.supersedes);
    }

    // Insert categories
    const seenAccCategories = new Set<string>();
    for (const category of normalizedCategories) {
      if (seenAccCategories.has(category)) {
        console.warn(`  ⚠ Duplicate category "${category}" in ${file} (after normalization)`);
        continue;
      }
      seenAccCategories.add(category);
      insertAccessoryCategory.run(id, category);
    }

    // Insert search terms
    if (data.searchTerms) {
      for (const term of data.searchTerms) {
        insertAccessorySearchTerm.run(id, term);
      }
    }

    // Insert versions
    if (data.versions) {
      for (const ver of data.versions) {
        insertAccessoryVersion.run(
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
        insertAccessoryPrice.run(id, price.amount, price.currency);
      }
    }

    // Insert links
    if (data.links) {
      for (const link of data.links) {
        insertAccessoryLink.run(
          id,
          link.type,
          link.title ?? null,
          link.url,
          link.description ?? null
        );
      }
    }

    // Insert videos
    if (data.videos) {
      for (const video of data.videos) {
        insertAccessoryVideo.run(
          id,
          video.videoId,
          video.provider ?? "youtube",
          video.title ?? null,
          video.description ?? null
        );
      }
    }

    // Insert FTS entry (with searchTerms)
    const accessoryFtsDescription = [data.description ?? "", ...(data.searchTerms ?? [])].join(" ");
    insertAccessoryFts.run(
      id,
      data.name,
      manufacturer?.name ?? "",
      normalizedCategories.join(" "),
      accessoryFtsDescription
    );

    // Insert translations
    if (data.translations) {
      for (const [locale, trans] of Object.entries(data.translations)) {
        if (!APPROVED_LOCALES.has(locale)) continue;

        if (trans.description || trans.details || trans.specs || trans.url) {
          insertAccessoryTranslation.run(
            id,
            locale,
            markdownToHtml(trans.description),
            markdownToHtml(trans.details),
            markdownToHtml(trans.specs),
            trans.url ?? null
          );
        }

        if (trans.links) {
          for (const link of trans.links) {
            insertAccessoryLinkLocalized.run(
              id,
              locale,
              link.type,
              link.title ?? null,
              link.url,
              link.description ?? null
            );
          }
        }

        if (trans.videos) {
          for (const video of trans.videos) {
            insertAccessoryVideoLocalized.run(
              id,
              locale,
              video.videoId,
              video.provider ?? "youtube",
              video.title ?? null,
              video.description ?? null
            );
          }
        }
      }
    }

    accessoryCount++;
  }

  console.log(`  ✓ Inserted ${accessoryCount} accessory entries`);

  // Update accessory supersedes relationships
  for (const [id, supersedesId] of accessorySupersedes) {
    updateAccessorySupersedes.run(supersedesId, id);
  }

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

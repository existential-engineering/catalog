/**
 * Shared schema loader module
 *
 * Provides a single source of truth for loading and accessing schema data.
 * Used by validation scripts, build scripts, and the Claude /add-entry command.
 */

import fs from "node:fs";
import path from "node:path";
import { loadYamlFile, REPO_ROOT, SCHEMA_DIR } from "./utils.js";

// =============================================================================
// TYPES
// =============================================================================

export interface LocaleInfo {
  code: string;
  name: string;
  nativeName: string;
}

export interface SchemaContext {
  /** All canonical category values */
  categories: string[];
  /** Map of alias -> canonical category */
  categoryAliases: Record<string, string>;
  /** All valid formats (au, vst3, etc.) */
  formats: string[];
  /** All valid platforms (mac, windows, etc.) */
  platforms: string[];
  /** All approved locales with their info */
  locales: LocaleInfo[];
  /** Just the locale codes for quick validation */
  localeCodes: string[];
}

interface CategoriesYaml {
  categories: string[];
}

interface CategoryAliasesYaml {
  aliases: Record<string, string>;
}

interface FormatsYaml {
  formats: string[];
}

interface PlatformsYaml {
  platforms: string[];
}

interface LocalesYaml {
  locales: LocaleInfo[];
}

type SlugIndex = Record<string, "manufacturers" | "software" | "hardware">;

// =============================================================================
// CACHED DATA
// =============================================================================

let cachedContext: SchemaContext | null = null;
let cachedSlugIndex: SlugIndex | null = null;

// =============================================================================
// SCHEMA LOADING
// =============================================================================

/**
 * Load all schema context data
 * Results are cached for performance
 */
export function loadSchemaContext(): SchemaContext {
  if (cachedContext) {
    return cachedContext;
  }

  const categoriesData = loadYamlFile<CategoriesYaml>(
    path.join(SCHEMA_DIR, "categories.yaml")
  );

  const aliasesData = loadYamlFile<CategoryAliasesYaml>(
    path.join(SCHEMA_DIR, "category-aliases.yaml")
  );

  const formatsData = loadYamlFile<FormatsYaml>(
    path.join(SCHEMA_DIR, "formats.yaml")
  );

  const platformsData = loadYamlFile<PlatformsYaml>(
    path.join(SCHEMA_DIR, "platforms.yaml")
  );

  const localesData = loadYamlFile<LocalesYaml>(
    path.join(SCHEMA_DIR, "locales.yaml")
  );

  cachedContext = {
    categories: categoriesData.categories,
    categoryAliases: aliasesData.aliases,
    formats: formatsData.formats,
    platforms: platformsData.platforms,
    locales: localesData.locales,
    localeCodes: localesData.locales.map((l) => l.code),
  };

  return cachedContext;
}

/**
 * Load the slug index (maps slugs to their collection type)
 * Results are cached for performance
 */
export function loadSlugIndex(): SlugIndex {
  if (cachedSlugIndex) {
    return cachedSlugIndex;
  }

  const indexPath = path.join(REPO_ROOT, ".slug-index.json");
  if (!fs.existsSync(indexPath)) {
    cachedSlugIndex = {};
    return cachedSlugIndex;
  }

  const content = fs.readFileSync(indexPath, "utf-8");
  try {
    cachedSlugIndex = JSON.parse(content) as SlugIndex;
  } catch (error) {
    console.error(`Warning: Failed to parse .slug-index.json: ${error instanceof Error ? error.message : error}`);
    cachedSlugIndex = {};
  }
  return cachedSlugIndex;
}

/**
 * Clear cached data (useful for testing or after schema changes)
 */
export function clearSchemaCache(): void {
  cachedContext = null;
  cachedSlugIndex = null;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if a category is valid (either canonical or alias)
 */
export function isValidCategory(category: string): boolean {
  const context = loadSchemaContext();
  return (
    context.categories.includes(category) ||
    category in context.categoryAliases
  );
}

/**
 * Get the canonical form of a category (resolves aliases)
 */
export function getCanonicalCategory(category: string): string {
  const context = loadSchemaContext();
  if (context.categories.includes(category)) {
    return category;
  }
  return context.categoryAliases[category] ?? category;
}

/**
 * Check if a format is valid
 */
export function isValidFormat(format: string): boolean {
  const context = loadSchemaContext();
  return context.formats.includes(format);
}

/**
 * Check if a platform is valid
 */
export function isValidPlatform(platform: string): boolean {
  const context = loadSchemaContext();
  return context.platforms.includes(platform);
}

/**
 * Check if a locale code is valid
 */
export function isValidLocale(locale: string): boolean {
  const context = loadSchemaContext();
  return context.localeCodes.includes(locale);
}

// =============================================================================
// SLUG HELPERS
// =============================================================================

/** Regex pattern for valid slugs */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * Check if a slug format is valid
 */
export function isValidSlugFormat(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Check if a slug is available (not already in use)
 */
export function isSlugAvailable(slug: string): boolean {
  const index = loadSlugIndex();
  return !(slug in index);
}

/**
 * Get the collection type for an existing slug
 */
export function getSlugCollection(
  slug: string
): "manufacturers" | "software" | "hardware" | null {
  const index = loadSlugIndex();
  return index[slug] ?? null;
}

/**
 * Generate a slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Get all manufacturer slugs from the slug index
 */
export function getManufacturerSlugs(): Set<string> {
  const index = loadSlugIndex();
  return new Set(
    Object.entries(index)
      .filter(([, type]) => type === "manufacturers")
      .map(([slug]) => slug)
  );
}

// =============================================================================
// CONVENIENCE GETTERS
// =============================================================================

/**
 * Get all valid categories as a Set (for quick lookup)
 */
export function getCategoriesSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.categories);
}

/**
 * Get all valid categories including aliases as a Set
 */
export function getAllValidCategoriesSet(): Set<string> {
  const context = loadSchemaContext();
  const all = new Set(context.categories);
  for (const alias of Object.keys(context.categoryAliases)) {
    all.add(alias);
  }
  return all;
}

/**
 * Get all valid formats as a Set
 */
export function getFormatsSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.formats);
}

/**
 * Get all valid platforms as a Set
 */
export function getPlatformsSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.platforms);
}

/**
 * Get all valid locale codes as a Set
 */
export function getLocaleCodesSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.localeCodes);
}

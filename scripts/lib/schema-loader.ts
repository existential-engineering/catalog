/**
 * Shared schema loader module
 *
 * Provides a single source of truth for loading and accessing schema data.
 * Used by validation scripts, build scripts, and the Claude /add-entry command.
 */

import path from "node:path";
import { loadYamlFile, SCHEMA_DIR } from "./utils.js";

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

  // IO field schemas
  /** Valid IO signal flow directions (strict) */
  ioSignalFlows: string[];
  /** Valid IO categories (strict) */
  ioCategories: string[];
  /** Valid IO positions (strict) */
  ioPositions: string[];
  /** Map of alias -> canonical IO position */
  ioPositionAliases: Record<string, string>;
  /** Known IO type values (advisory) */
  ioTypes: string[];
  /** Known IO connection values (advisory) */
  ioConnections: string[];
  /** Map of alias -> canonical IO connection */
  ioConnectionAliases: Record<string, string>;
  /** Valid connectorDetail values per connection type (strict) */
  ioConnectorDetails: Record<string, string[]>;

  // Link and currency schemas
  /** Known link type values (advisory) */
  linkTypes: string[];
  /** Valid ISO 4217 currency codes (strict) */
  currencies: string[];
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

interface IOSignalFlowsYaml {
  signal_flows: string[];
}

interface IOCategoriesYaml {
  categories: string[];
}

interface IOPositionsYaml {
  positions: string[];
  aliases?: Record<string, string>;
}

interface IOTypesYaml {
  types: string[];
}

interface IOConnectionsYaml {
  connections: string[];
  aliases?: Record<string, string>;
}

interface IOConnectorDetailsYaml {
  connector_details: Record<string, string[]>;
}

interface LinkTypesYaml {
  types: string[];
}

interface CurrenciesYaml {
  currencies: string[];
}

// =============================================================================
// CACHED DATA
// =============================================================================

let cachedContext: SchemaContext | null = null;

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

  const categoriesData = loadYamlFile<CategoriesYaml>(path.join(SCHEMA_DIR, "categories.yaml"));

  const aliasesData = loadYamlFile<CategoryAliasesYaml>(
    path.join(SCHEMA_DIR, "category-aliases.yaml")
  );

  const formatsData = loadYamlFile<FormatsYaml>(path.join(SCHEMA_DIR, "formats.yaml"));

  const platformsData = loadYamlFile<PlatformsYaml>(path.join(SCHEMA_DIR, "platforms.yaml"));

  const localesData = loadYamlFile<LocalesYaml>(path.join(SCHEMA_DIR, "locales.yaml"));

  // IO field schemas
  const ioSignalFlowsData = loadYamlFile<IOSignalFlowsYaml>(
    path.join(SCHEMA_DIR, "io-signal-flows.yaml")
  );

  const ioCategoriesData = loadYamlFile<IOCategoriesYaml>(
    path.join(SCHEMA_DIR, "io-categories.yaml")
  );

  const ioPositionsData = loadYamlFile<IOPositionsYaml>(path.join(SCHEMA_DIR, "io-positions.yaml"));

  const ioTypesData = loadYamlFile<IOTypesYaml>(path.join(SCHEMA_DIR, "io-types.yaml"));

  const ioConnectionsData = loadYamlFile<IOConnectionsYaml>(
    path.join(SCHEMA_DIR, "io-connections.yaml")
  );

  const ioConnectorDetailsData = loadYamlFile<IOConnectorDetailsYaml>(
    path.join(SCHEMA_DIR, "io-connector-details.yaml")
  );

  const linkTypesData = loadYamlFile<LinkTypesYaml>(path.join(SCHEMA_DIR, "link-types.yaml"));

  const currenciesData = loadYamlFile<CurrenciesYaml>(path.join(SCHEMA_DIR, "currencies.yaml"));

  cachedContext = {
    categories: categoriesData.categories,
    categoryAliases: aliasesData.aliases,
    formats: formatsData.formats,
    platforms: platformsData.platforms,
    locales: localesData.locales,
    localeCodes: localesData.locales.map((l) => l.code),

    // IO fields
    ioSignalFlows: ioSignalFlowsData.signal_flows,
    ioCategories: ioCategoriesData.categories,
    ioPositions: ioPositionsData.positions,
    ioPositionAliases: ioPositionsData.aliases ?? {},
    ioTypes: ioTypesData.types,
    ioConnections: ioConnectionsData.connections,
    ioConnectionAliases: ioConnectionsData.aliases ?? {},
    ioConnectorDetails: ioConnectorDetailsData.connector_details,

    // Link and currency
    linkTypes: linkTypesData.types,
    currencies: currenciesData.currencies,
  };

  return cachedContext;
}

/**
 * Clear cached data (useful for testing or after schema changes)
 */
export function clearSchemaCache(): void {
  cachedContext = null;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if a category is valid (either canonical or alias)
 */
export function isValidCategory(category: string): boolean {
  const context = loadSchemaContext();
  return context.categories.includes(category) || category in context.categoryAliases;
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
// IO FIELD VALIDATION HELPERS
// =============================================================================

/**
 * Check if an IO signal flow is valid (strict)
 */
export function isValidIOSignalFlow(signalFlow: string): boolean {
  const context = loadSchemaContext();
  return context.ioSignalFlows.includes(signalFlow);
}

/**
 * Check if an IO category is valid (strict)
 */
export function isValidIOCategory(category: string): boolean {
  const context = loadSchemaContext();
  return context.ioCategories.includes(category);
}

/**
 * Check if an IO position is valid (canonical or alias, strict)
 */
export function isValidIOPosition(position: string): boolean {
  const context = loadSchemaContext();
  return context.ioPositions.includes(position) || position in context.ioPositionAliases;
}

/**
 * Get the canonical form of an IO position (resolves aliases)
 */
export function getCanonicalIOPosition(position: string): string {
  const context = loadSchemaContext();
  if (context.ioPositions.includes(position)) {
    return position;
  }
  return context.ioPositionAliases[position] ?? position;
}

/**
 * Check if an IO type is a known value (advisory)
 */
export function isKnownIOType(type: string): boolean {
  const context = loadSchemaContext();
  return context.ioTypes.includes(type);
}

/**
 * Check if an IO connection is a known value (advisory, includes aliases)
 */
export function isKnownIOConnection(connection: string): boolean {
  const context = loadSchemaContext();
  return context.ioConnections.includes(connection) || connection in context.ioConnectionAliases;
}

/**
 * Get the canonical form of an IO connection (resolves aliases)
 */
export function getCanonicalIOConnection(connection: string): string {
  const context = loadSchemaContext();
  if (context.ioConnections.includes(connection)) {
    return connection;
  }
  return context.ioConnectionAliases[connection] ?? connection;
}

/**
 * Get the valid connectorDetail values for a given connection type.
 * Returns undefined if the connection type doesn't support connectorDetail.
 */
export function getValidConnectorDetails(connection: string): string[] | undefined {
  const context = loadSchemaContext();
  return context.ioConnectorDetails[connection];
}

/**
 * Check if a connection type supports connectorDetail
 */
export function connectionSupportsDetail(connection: string): boolean {
  const context = loadSchemaContext();
  return connection in context.ioConnectorDetails;
}

/**
 * Check if a link type is a known value (advisory)
 */
export function isKnownLinkType(type: string): boolean {
  const context = loadSchemaContext();
  return context.linkTypes.includes(type);
}

/**
 * Check if a currency code is valid (strict)
 */
export function isValidCurrency(currency: string): boolean {
  const context = loadSchemaContext();
  return context.currencies.includes(currency);
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

/**
 * Get all valid IO signal flows as a Set
 */
export function getIOSignalFlowsSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.ioSignalFlows);
}

/**
 * Get all valid IO categories as a Set
 */
export function getIOCategoriesSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.ioCategories);
}

/**
 * Get all valid IO positions (canonical + aliases) as a Set
 */
export function getAllValidIOPositionsSet(): Set<string> {
  const context = loadSchemaContext();
  const all = new Set(context.ioPositions);
  for (const alias of Object.keys(context.ioPositionAliases)) {
    all.add(alias);
  }
  return all;
}

/**
 * Get all known IO types as a Set
 */
export function getIOTypesSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.ioTypes);
}

/**
 * Get all known IO connections (canonical + aliases) as a Set
 */
export function getAllKnownIOConnectionsSet(): Set<string> {
  const context = loadSchemaContext();
  const all = new Set(context.ioConnections);
  for (const alias of Object.keys(context.ioConnectionAliases)) {
    all.add(alias);
  }
  return all;
}

/**
 * Get all known link types as a Set
 */
export function getLinkTypesSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.linkTypes);
}

/**
 * Get all valid currencies as a Set
 */
export function getCurrenciesSet(): Set<string> {
  const context = loadSchemaContext();
  return new Set(context.currencies);
}

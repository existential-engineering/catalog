/**
 * Shared type definitions for the catalog
 */

// =============================================================================
// SHARED NESTED TYPES
// =============================================================================

export interface Version {
  name: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  preRelease?: boolean;
  unofficial?: boolean;
  url?: string;
  description?: string;
  prices?: Price[];
  links?: Link[];
  videos?: VideoLink[];
}

export interface Price {
  amount: number;
  currency: string;
  /** ISO date when price was last verified */
  asOf?: string;
  /** Source of price (e.g., "official-website", "retailer") */
  source?: string;
}

// =============================================================================
// VERIFICATION METADATA
// =============================================================================

export type VerificationStatus = "active" | "discontinued" | "unknown";

export interface VerificationMetadata {
  /** ISO date when entry was last verified */
  lastVerified?: string;
  /** Who verified the entry (GitHub username or "automated") */
  verifiedBy?: string;
  /** Product status */
  status?: VerificationStatus;
  /** ISO date when product was discontinued */
  discontinuedDate?: string;
  /** Reason for discontinuation */
  discontinuedReason?: string;
}

export interface Link {
  type: string;
  title?: string;
  url: string;
  description?: string;
}

export interface VideoLink {
  videoId: string;
  provider?: string;
  title?: string;
  description?: string;
}

export interface IO {
  name: string;
  signalFlow: string;
  category: string;
  type: string;
  connection: string;
  connectorDetail?: string[];
  maxConnections?: number;
  position?: string;
  columnPosition?: number;
  rowPosition?: number;
  description?: string;
}

export interface Variant {
  name: string;
  slug?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  url?: string;
  description?: string;
  prices?: Price[];
  links?: Link[];
  videos?: VideoLink[];
}

// =============================================================================
// DATA TYPES
// =============================================================================

export interface Manufacturer {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  companyName?: string;
  parentCompany?: string;
  /**
   * True when the company no longer exists AND nothing it made is still
   * produced under this brand. Products of defunct manufacturers are
   * auto-tagged `discontinued` by `apply-discontinued-tags.ts`. Do not
   * set for revived brands (Oberheim, Crumar) or brands that may gain
   * current products under the same slug.
   */
  defunct?: boolean;
  url?: string;
  description?: string;
  searchTerms?: string[];
  translations?: TranslationsMap;
}

export interface Software {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  manufacturer: string;
  categories?: string[];
  formats?: string[];
  platforms?: string[];
  identifiers?: Record<string, string>;
  url?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  primaryCategory?: string;
  secondaryCategory?: string;
  /** Slug of the software entry this supersedes (for major version upgrades) */
  supersedes?: string;
  /** Software slugs for host products this content is compatible with */
  compatibleWith?: string[];
  searchTerms?: string[];
  description?: string;
  details?: string | string[];
  specs?: string | string[];
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
  videos?: VideoLink[];
  translations?: TranslationsMap;
  verification?: VerificationMetadata;
}

export interface Content {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  manufacturer: string;
  categories?: string[];
  url?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  primaryCategory?: string;
  secondaryCategory?: string;
  /** ID of the content entry this supersedes */
  supersedes?: string;
  /** Software or hardware slugs for host products this content is compatible with */
  compatibleWith?: string[];
  searchTerms?: string[];
  description?: string;
  details?: string | string[];
  specs?: string | string[];
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
  videos?: VideoLink[];
  translations?: TranslationsMap;
  verification?: VerificationMetadata;
}

export interface Hardware {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  manufacturer: string;
  categories?: string[];
  url?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  primaryCategory?: string;
  secondaryCategory?: string;
  /** Slug of the hardware entry this supersedes (for product line upgrades) */
  supersedes?: string;
  searchTerms?: string[];
  description?: string;
  details?: string | string[];
  specs?: string | string[];
  io?: IO[];
  versions?: Version[];
  variants?: Variant[];
  prices?: Price[];
  links?: Link[];
  videos?: VideoLink[];
  translations?: TranslationsMap;
  verification?: VerificationMetadata;
}

export interface Accessory {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  manufacturer: string;
  categories?: string[];
  url?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  primaryCategory?: string;
  secondaryCategory?: string;
  /** ID of the accessory entry this supersedes */
  supersedes?: string;
  searchTerms?: string[];
  description?: string;
  details?: string | string[];
  specs?: string | string[];
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
  videos?: VideoLink[];
  translations?: TranslationsMap;
  verification?: VerificationMetadata;
}

// =============================================================================
// TRANSLATION TYPES
// =============================================================================

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
}

export interface LocalesSchema {
  locales: Locale[];
}

// I/O translation (for hardware)
export interface IOTranslation {
  originalName: string;
  name?: string;
  description?: string;
}

// Content translation (shared fields for manufacturer/software/hardware)
export interface ContentTranslation {
  description?: string;
  details?: string;
  specs?: string;
  url?: string;
  links?: Link[];
  videos?: VideoLink[];
  io?: IOTranslation[];
}

// Map of locale code to translation
export type TranslationsMap = Record<string, ContentTranslation>;

// =============================================================================
// SCHEMA TYPES
// =============================================================================

export interface CategoriesSchema {
  categories: string[];
}

export interface CategoryAliasesSchema {
  aliases: Record<string, string>;
}

export interface FormatsSchema {
  formats: string[];
}

export interface PlatformsSchema {
  platforms: string[];
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

export interface ValidationErrorDetail {
  /** Error code for programmatic handling */
  code?: string;
  /** Human-readable error message */
  message: string;
  /** Path to the field (e.g., "categories[0]") */
  path: string;
  /** Line number in the YAML file (1-indexed) */
  line?: number;
  /** Link to documentation */
  docsUrl?: string;
}

export interface ValidationError {
  file: string;
  errors: string[];
  /** Enhanced error details with line numbers and codes */
  details?: ValidationErrorDetail[];
}

export interface ValidationWarning {
  file: string;
  warnings: ValidationWarningDetail[];
}

export interface ValidationWarningDetail {
  /** Warning code (W-prefixed) */
  code: string;
  /** Human-readable warning message */
  message: string;
  /** Path to the field (e.g., "io[0].type") */
  path: string;
  /** Line number in the YAML file (1-indexed) */
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    manufacturers: number;
    software: number;
    content: number;
    hardware: number;
    accessories: number;
  };
}

// =============================================================================
// PATCH TYPES
// =============================================================================

export interface Change {
  type: "added" | "modified" | "deleted";
  category: "manufacturers" | "software" | "content" | "hardware" | "accessories";
  file: string;
  slug: string;
}

// =============================================================================
// ID TYPES
// =============================================================================

export type Collection = "manufacturers" | "software" | "content" | "hardware" | "accessories";

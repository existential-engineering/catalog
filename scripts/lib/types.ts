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
  url?: string;
  videoId?: string;
  provider?: string;
  description?: string;
}

export interface IO {
  name: string;
  signalFlow: string;
  category: string;
  type: string;
  connection: string;
  maxConnections?: number;
  position?: string;
  columnPosition?: number;
  rowPosition?: number;
  description?: string;
}

export interface Revision {
  name: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  url?: string;
  description?: string;
  io?: IO[];
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
}

// =============================================================================
// DATA TYPES
// =============================================================================

export interface Manufacturer {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  companyName?: string;
  parentCompany?: string;
  website?: string;
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
  website?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  primaryCategory?: string;
  secondaryCategory?: string;
  searchTerms?: string[];
  description?: string;
  details?: string;
  specs?: string;
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
  translations?: TranslationsMap;
  verification?: VerificationMetadata;
}

export interface Hardware {
  id?: string; // Assigned on PR creation via nanoid
  name: string;
  manufacturer: string;
  categories?: string[];
  website?: string;
  releaseDate?: string;
  releaseDateYearOnly?: boolean;
  primaryCategory?: string;
  secondaryCategory?: string;
  searchTerms?: string[];
  description?: string;
  details?: string;
  specs?: string;
  io?: IO[];
  versions?: Version[];
  revisions?: Revision[];
  prices?: Price[];
  links?: Link[];
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
  website?: string;
  links?: Link[];
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

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stats: {
    manufacturers: number;
    software: number;
    hardware: number;
  };
}

// =============================================================================
// PATCH TYPES
// =============================================================================

export interface Change {
  type: "added" | "modified" | "deleted";
  category: "manufacturers" | "software" | "hardware";
  file: string;
  slug: string;
}

// =============================================================================
// ID TYPES
// =============================================================================

export type Collection = "manufacturers" | "software" | "hardware";

/**
 * Shared type definitions for the catalog
 */

// =============================================================================
// SHARED NESTED TYPES
// =============================================================================

export interface Version {
  name: string;
  releaseDate?: string;
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
  url?: string;
  description?: string;
  io?: IO[];
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
}

export interface Image {
  source: string;
  alt?: string;
}

// =============================================================================
// DATA TYPES
// =============================================================================

export interface Manufacturer {
  slug: string;
  name: string;
  companyName?: string;
  parentCompany?: string;
  website?: string;
  description?: string;
  searchTerms?: string[];
  images?: Image[];
}

export interface Software {
  slug: string;
  name: string;
  manufacturer: string;
  categories: string[];
  formats?: string[];
  platforms?: string[];
  identifiers?: Record<string, string>;
  website?: string;
  releaseDate?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  searchTerms?: string[];
  description?: string;
  details?: string;
  specs?: string;
  versions?: Version[];
  prices?: Price[];
  links?: Link[];
  images?: Image[];
}

export interface Daw {
  slug: string;
  name: string;
  manufacturer: string;
  bundleIdentifier?: string;
  platforms?: string[];
  website?: string;
  description?: string;
  searchTerms?: string[];
  images?: Image[];
}

export interface Hardware {
  slug: string;
  name: string;
  manufacturer: string;
  categories?: string[];
  website?: string;
  releaseDate?: string;
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
  images?: Image[];
}

// =============================================================================
// SCHEMA TYPES
// =============================================================================

export interface CategoriesSchema {
  categories: string[];
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

export interface ValidationError {
  file: string;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stats: {
    manufacturers: number;
    software: number;
    daws: number;
    hardware: number;
  };
}

// =============================================================================
// PATCH TYPES
// =============================================================================

export interface Change {
  type: "added" | "modified" | "deleted";
  category: "manufacturers" | "software" | "daws" | "hardware";
  file: string;
  slug: string;
}


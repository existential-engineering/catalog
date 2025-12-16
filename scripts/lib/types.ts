/**
 * Shared type definitions for the catalog
 */

// =============================================================================
// DATA TYPES
// =============================================================================

export interface Manufacturer {
  slug: string;
  name: string;
  website?: string;
}

export interface Software {
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

export interface Daw {
  slug: string;
  name: string;
  manufacturer: string;
  bundleIdentifier?: string;
  platforms?: string[];
  website?: string;
}

export interface Hardware {
  slug: string;
  name: string;
  manufacturer: string;
  type?: string;
  website?: string;
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

export interface TypesSchema {
  types: string[];
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
// CHANGELOG TYPES
// =============================================================================

export interface ChangelogEntry {
  type: "added" | "updated" | "removed";
  category: "manufacturers" | "software" | "daws" | "hardware";
  name: string;
  manufacturer?: string;
  details?: string;
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


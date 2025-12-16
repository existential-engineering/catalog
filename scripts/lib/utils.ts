/**
 * Shared utility functions for the catalog scripts
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

// =============================================================================
// PATHS
// =============================================================================

export const REPO_ROOT = path.join(import.meta.dirname, "..", "..");
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const SCHEMA_DIR = path.join(REPO_ROOT, "schema");
export const OUTPUT_DIR = path.join(REPO_ROOT, "dist");

// =============================================================================
// FILE HELPERS
// =============================================================================

/**
 * Load and parse a YAML file
 */
export function loadYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseYaml(content) as T;
}

/**
 * Get all YAML files in a directory
 */
export function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

// =============================================================================
// STRING HELPERS
// =============================================================================

/**
 * Find the closest match to a string from a set of valid options
 * Uses Levenshtein distance for fuzzy matching
 */
export function findClosestMatch(
  input: string,
  validOptions: Set<string>
): string | null {
  const options = [...validOptions];
  let closest: string | null = null;
  let minDistance = Infinity;

  for (const option of options) {
    const distance = levenshteinDistance(input.toLowerCase(), option.toLowerCase());
    if (distance < minDistance && distance <= 3) {
      minDistance = distance;
      closest = option;
    }
  }

  return closest;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Format a list of valid options for display
 */
export function formatValidOptions(options: Set<string>, limit = 10): string {
  const sorted = [...options].sort();
  if (sorted.length <= limit) {
    return sorted.join(", ");
  }
  return sorted.slice(0, limit).join(", ") + `, ... (${sorted.length} total)`;
}

// =============================================================================
// SQL HELPERS
// =============================================================================

/**
 * Escape a value for SQL insertion
 */
export function escapeSQL(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}



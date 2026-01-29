/**
 * Shared utility functions for the catalog scripts
 */

import fs from "node:fs";
import path from "node:path";
import {
  parse as parseYaml,
  parseDocument,
  LineCounter,
  Document,
  isMap,
  isSeq,
} from "yaml";

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
 * Result of parsing YAML with position tracking
 */
export interface ParsedYamlWithPositions<T> {
  /** Parsed data object */
  data: T;
  /** Line counter for position lookups */
  lineCounter: LineCounter;
  /** YAML document AST */
  document: Document;
  /** Raw file content */
  content: string;
}

/**
 * Load and parse a YAML file with position tracking for error reporting
 */
export function loadYamlFileWithPositions<T>(
  filePath: string
): ParsedYamlWithPositions<T> {
  const content = fs.readFileSync(filePath, "utf-8");
  const lineCounter = new LineCounter();
  const document = parseDocument(content, { lineCounter });

  return {
    data: document.toJS() as T,
    lineCounter,
    document,
    content,
  };
}

/**
 * Get the line number for a path in a YAML document
 *
 * @param document - The parsed YAML document
 * @param lineCounter - The line counter from parsing
 * @param path - Array of keys/indices to traverse (e.g., ["categories", 0])
 * @returns Line number (1-indexed) or null if not found
 */
export function getLineForPath(
  document: Document,
  lineCounter: LineCounter,
  path: (string | number)[]
): number | null {
  let node: unknown = document.contents;

  for (const key of path) {
    if (!node) return null;

    if (isMap(node)) {
      // For maps, get the value node for the key
      const pair = node.items.find((item) => {
        const keyNode = item.key;
        if (!keyNode || typeof keyNode !== "object") return false;
        const keyObj = keyNode as { value?: unknown };
        return keyObj.value === key;
      });
      node = pair?.value;
    } else if (isSeq(node) && typeof key === "number") {
      // For sequences, get the item at index
      node = node.items[key];
    } else {
      return null;
    }
  }

  // Get the range from the node
  if (node && typeof node === "object" && node !== null) {
    const nodeWithRange = node as { range?: [number, number, number] };
    if (nodeWithRange.range) {
      const pos = lineCounter.linePos(nodeWithRange.range[0]);
      return pos.line;
    }
  }

  return null;
}

/**
 * Parse a Zod error path string into an array of keys/indices
 *
 * @param pathStr - Path string like "categories.0" or "manufacturer"
 * @returns Array of keys/indices like ["categories", 0]
 */
export function parseErrorPath(pathStr: string): (string | number)[] {
  if (!pathStr) return [];

  return pathStr.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? part : num;
  });
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






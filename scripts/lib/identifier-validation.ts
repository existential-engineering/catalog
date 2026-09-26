/**
 * Identifier Validation Module
 *
 * Validates plugin identifier formats (bundle IDs, PACE codes, etc.)
 * for different plugin formats.
 */

// =============================================================================
// IDENTIFIER PATTERNS
// =============================================================================

/**
 * Expected patterns for different identifier types
 *
 * Note: These are recommended patterns, not strict requirements.
 * Some legacy plugins may use non-standard formats.
 */
const IDENTIFIER_PATTERNS: Record<string, RegExp> = {
  // Apple bundle IDs (AU, standalone macOS apps)
  // Format: reverse domain notation (e.g., com.vendor.ProductName)
  // Segments may start with digits (e.g., com.fabfilter.Pro-C.AU.3)
  au: /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*){1,}$/,

  // macOS bundle identifier, applied to `au` and `standalone` by the build
  bundle: /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*){1,}$/,

  // Fallback for every listed format without its own key (lib/identifier-fallback.ts)
  default: /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*){1,}$/,

  // VST3: the macOS bundle id (reverse domain) or the class id every
  // platform carries, a 32-digit hex FUID from moduleinfo.json. Studio
  // reads the bundle id on macOS and the class id on Windows and Linux,
  // so either is a value the scanner can look up.
  vst3: /^([0-9A-Fa-f]{32}|[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*){1,})$/,

  // CLAP uses reverse domain notation
  clap: /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*){1,}$/,

  // AAX: PACE iLok codes (4 chars) or reverse domain notation
  aax: /^([A-Za-z0-9]{4}|[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*){1,})$/,

  // LV2 uses URIs
  lv2: /^https?:\/\/.+$/,
};

/**
 * Human-readable format hints for error messages
 */
const FORMAT_HINTS: Record<string, string> = {
  au: "Reverse domain notation (e.g., com.xferrecords.Serum)",
  bundle: "Reverse domain notation (e.g., com.vendor.AppName)",
  default: "Reverse domain notation shared by every format (e.g., com.vendor.Product)",
  vst3: "Reverse domain notation (e.g., com.native-instruments.Massive) or a 32-digit hex class id",
  clap: "Reverse domain notation (e.g., com.u-he.Diva)",
  aax: "4-character PACE code (e.g., XfRc) or reverse domain notation",
  lv2: "URI format (e.g., https://vendor.com/plugins/name)",
};

// =============================================================================
// VALIDATION
// =============================================================================

export interface IdentifierValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validate an identifier for a specific format
 */
export function validateIdentifier(format: string, value: string): IdentifierValidationResult {
  const pattern = IDENTIFIER_PATTERNS[format];

  // Unknown format - accept any value
  if (!pattern) {
    return { valid: true };
  }

  // Empty value
  if (!value || value.trim() === "") {
    return {
      valid: false,
      error: `Empty ${format} identifier`,
      suggestion: FORMAT_HINTS[format],
    };
  }

  // Check pattern
  if (!pattern.test(value)) {
    return {
      valid: false,
      error: `Invalid ${format} identifier format: "${value}"`,
      suggestion: FORMAT_HINTS[format],
    };
  }

  return { valid: true };
}

/**
 * Validate all identifiers for a software entry
 */
export function validateIdentifiers(
  identifiers: Record<string, string>
): Map<string, IdentifierValidationResult> {
  const results = new Map<string, IdentifierValidationResult>();

  for (const [format, value] of Object.entries(identifiers)) {
    results.set(format, validateIdentifier(format, value));
  }

  return results;
}

/**
 * Get the format hint for a specific format type
 */
export function getFormatHint(format: string): string | undefined {
  return FORMAT_HINTS[format];
}

/**
 * Get all known format types that have validation patterns
 */
export function getKnownFormats(): string[] {
  return Object.keys(IDENTIFIER_PATTERNS);
}

/**
 * Check if a format type has a known validation pattern
 */
export function hasValidationPattern(format: string): boolean {
  return format in IDENTIFIER_PATTERNS;
}

// =============================================================================
// COMPONENT IDENTIFIERS AND UNIQUENESS
// =============================================================================

/**
 * Problems within one entry's `componentIdentifiers`: a value repeated under
 * one key, or a value that is already the primary under the same key in
 * `identifiers`. Either would write the same `software_format_identifiers`
 * row twice and reads as a mistake rather than a second binary.
 */
/**
 * The form two identifiers are compared in. A VST3 class id is hex, so its
 * case carries no meaning (the writer's `sameIdentifier` agrees); a
 * reverse-domain id keeps its case, because macOS bundle ids are
 * case-sensitive.
 */
export function identifierKey(value: string): string {
  return /^[0-9A-Fa-f]{32}$/.test(value) ? value.toLowerCase() : value;
}

export function findComponentIdentifierRepeats(
  identifiers: Record<string, string> | undefined,
  componentIdentifiers: Record<string, string[]>
): { key: string; value: string; reason: string }[] {
  const problems: { key: string; value: string; reason: string }[] = [];
  for (const [key, values] of Object.entries(componentIdentifiers)) {
    const seen = new Set<string>();
    const primary = identifiers?.[key];
    for (const value of values) {
      const normalized = identifierKey(value);
      if (seen.has(normalized)) {
        problems.push({ key, value, reason: "listed twice" });
      } else if (primary !== undefined && identifierKey(primary) === normalized) {
        problems.push({ key, value, reason: `already the primary identifiers.${key}` });
      }
      seen.add(normalized);
    }
  }
  return problems;
}

export interface IdentifierOwner {
  slug: string;
  identifiers?: Record<string, string>;
  componentIdentifiers?: Record<string, string[]>;
}

/**
 * Identifiers claimed by more than one software entry. Studio's matcher maps
 * an identifier to one entry, so a value two entries share matches whichever
 * the query returns last, silently. `productId` is exempt: it is a store
 * number that feeds nothing.
 */
export function findSharedIdentifiers(entries: IdentifierOwner[]): Map<string, string[]> {
  const owners = new Map<string, Set<string>>();
  const claim = (value: string, slug: string) => {
    const normalized = identifierKey(value);
    const set = owners.get(normalized) ?? new Set<string>();
    set.add(slug);
    owners.set(normalized, set);
  };
  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry.identifiers ?? {})) {
      if (key !== "productId" && typeof value === "string") claim(value, entry.slug);
    }
    for (const values of Object.values(entry.componentIdentifiers ?? {})) {
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (typeof value === "string") claim(value, entry.slug);
      }
    }
  }
  const shared = new Map<string, string[]>();
  for (const [value, slugs] of owners) {
    if (slugs.size > 1) shared.set(value, [...slugs].sort());
  }
  return shared;
}

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

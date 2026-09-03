/**
 * Validation Error Codes
 *
 * Standardized error codes for validation messages.
 * Each code links to documentation in docs/VALIDATION_ERRORS.md
 */

import { z } from "zod";

// =============================================================================
// ERROR CODE ENUM
// =============================================================================

/**
 * Validation error codes
 *
 * Naming convention:
 * - E1xx: Schema/format errors
 * - E2xx: Reference errors
 * - E3xx: Content errors
 * - E4xx: Identifier errors
 */
export enum ValidationErrorCode {
  // Schema errors (E1xx)
  E100_MISSING_REQUIRED_FIELD = "E100",
  E101_INVALID_FIELD_TYPE = "E101",
  E103_INVALID_URL_FORMAT = "E103",
  E104_INVALID_CATEGORY = "E104",
  E105_INVALID_PLATFORM = "E105",
  E106_INVALID_FORMAT = "E106",
  E107_INVALID_LOCALE = "E107",
  E108_INVALID_DATE_FORMAT = "E108",
  E110_YAML_SYNTAX_ERROR = "E110",
  E111_INVALID_IO_SIGNAL_FLOW = "E111",
  E112_INVALID_IO_CATEGORY = "E112",
  E113_INVALID_IO_POSITION = "E113",
  E114_INVALID_CURRENCY = "E114",
  E115_INVALID_CONNECTOR_DETAIL = "E115",
  E116_INVALID_LINK_TYPE = "E116",
  E117_INVALID_IO_TYPE = "E117",
  E118_NAME_ARTIFACT = "E118",
  E119_INVALID_CAPABILITY = "E119",
  E120_STORAGE_MEDIA_SLOT = "E120",
  E121_UNKNOWN_KEY = "E121",
  E199_VALIDATION_ERROR = "E199",

  // Reference errors (E2xx)
  E200_MANUFACTURER_NOT_FOUND = "E200",
  E202_DUPLICATE_CATEGORY = "E202",
  E205_DUPLICATE_CAPABILITY = "E205",
  E203_PARENT_COMPANY_NOT_FOUND = "E203",
  E204_IO_TRANSLATION_MISMATCH = "E204",

  // Content errors (E3xx)
  E300_INVALID_MARKDOWN = "E300",
  E301_YOUTUBE_URL_FORMAT = "E301",
  E302_UNCLOSED_CODE_BLOCK = "E302",
  E303_UNBALANCED_BACKTICKS = "E303",
  E304_TRUNCATED_CONTENT = "E304",

  // Identifier errors (E4xx)
  E400_INVALID_IDENTIFIER_FORMAT = "E400",
  E401_MISSING_IDENTIFIER = "E401",

  // Advisory warnings (W1xx) — non-blocking
  W120_UNKNOWN_IO_TYPE = "W120",
  W121_UNKNOWN_IO_CONNECTION = "W121",
  W123_UNKNOWN_COMPATIBLE_WITH = "W123",
  W124_DUPLICATE_URL = "W124",
  W125_MANUFACTURER_URL_IN_LINKS = "W125",
  W126_SPECS_OVERLAP = "W126",
  W127_MISSING_SEARCH_TERMS = "W127",
  W128_IO_COMBINE_CANDIDATE = "W128",
  W129_MANUFACTURER_IN_NAME = "W129",
  W130_NAME_TAGLINE = "W130",
  W131_PRICE_TERM_MISSING = "W131",
  W132_UNKNOWN_KEY = "W132",
}

// =============================================================================
// AUTO-FIX SUGGESTIONS
// =============================================================================

export const AutoFixTypeSchema = z.enum(["replace", "add", "remove", "rename"]);
export type AutoFixType = z.infer<typeof AutoFixTypeSchema>;

export const AutoFixSuggestionSchema = z.object({
  /** Type of fix to apply */
  type: AutoFixTypeSchema,
  /** Human-readable description of the fix */
  description: z.string(),
  /** Original value (for replace/remove) */
  oldValue: z.string().optional(),
  /** New value (for replace/add) */
  newValue: z.string().optional(),
  /** Field path where fix applies */
  path: z.string().optional(),
});
export type AutoFixSuggestion = z.infer<typeof AutoFixSuggestionSchema>;

// =============================================================================
// DETAILED ERROR
// =============================================================================

export const DetailedErrorSchema = z.object({
  /** Error code for programmatic handling */
  code: z.nativeEnum(ValidationErrorCode),
  /** Human-readable error message */
  message: z.string(),
  /** Path to the field (e.g., "categories[0]") */
  path: z.string(),
  /** Line number in the YAML file (1-indexed) */
  line: z.number().optional(),
  /** Column number (1-indexed) */
  column: z.number().optional(),
  /** Link to documentation */
  docsUrl: z.string(),
  /** Optional auto-fix suggestion */
  autoFix: AutoFixSuggestionSchema.optional(),
});
export type DetailedError = z.infer<typeof DetailedErrorSchema>;

// =============================================================================
// ERROR INFO REGISTRY
// =============================================================================

const DOCS_BASE_URL =
  "https://github.com/existential-engineering/catalog/blob/main/docs/VALIDATION_ERRORS.md";

const ErrorInfoEntrySchema = z.object({
  /** Short description of the error */
  title: z.string(),
  /** URL anchor for docs link */
  anchor: z.string(),
});
type ErrorInfoEntry = z.infer<typeof ErrorInfoEntrySchema>;

const ERROR_INFO: Record<ValidationErrorCode, ErrorInfoEntry> = {
  // Schema errors
  [ValidationErrorCode.E100_MISSING_REQUIRED_FIELD]: {
    title: "Missing required field",
    anchor: "e100-missing-required-field",
  },
  [ValidationErrorCode.E101_INVALID_FIELD_TYPE]: {
    title: "Invalid field type",
    anchor: "e101-invalid-field-type",
  },
  [ValidationErrorCode.E103_INVALID_URL_FORMAT]: {
    title: "Invalid URL format",
    anchor: "e103-invalid-url-format",
  },
  [ValidationErrorCode.E104_INVALID_CATEGORY]: {
    title: "Invalid category",
    anchor: "e104-invalid-category",
  },
  [ValidationErrorCode.E105_INVALID_PLATFORM]: {
    title: "Invalid platform",
    anchor: "e105-invalid-platform",
  },
  [ValidationErrorCode.E106_INVALID_FORMAT]: {
    title: "Invalid format",
    anchor: "e106-invalid-format",
  },
  [ValidationErrorCode.E107_INVALID_LOCALE]: {
    title: "Invalid locale",
    anchor: "e107-invalid-locale",
  },
  [ValidationErrorCode.E108_INVALID_DATE_FORMAT]: {
    title: "Invalid date format",
    anchor: "e108-invalid-date-format",
  },
  [ValidationErrorCode.E110_YAML_SYNTAX_ERROR]: {
    title: "YAML syntax error",
    anchor: "e110-yaml-syntax-error",
  },
  [ValidationErrorCode.E111_INVALID_IO_SIGNAL_FLOW]: {
    title: "Invalid IO signal flow",
    anchor: "e111-invalid-io-signal-flow",
  },
  [ValidationErrorCode.E112_INVALID_IO_CATEGORY]: {
    title: "Invalid IO category",
    anchor: "e112-invalid-io-category",
  },
  [ValidationErrorCode.E113_INVALID_IO_POSITION]: {
    title: "Invalid IO position",
    anchor: "e113-invalid-io-position",
  },
  [ValidationErrorCode.E114_INVALID_CURRENCY]: {
    title: "Invalid currency code",
    anchor: "e114-invalid-currency",
  },
  [ValidationErrorCode.E115_INVALID_CONNECTOR_DETAIL]: {
    title: "Invalid connector detail",
    anchor: "e115-invalid-connector-detail",
  },
  [ValidationErrorCode.E116_INVALID_LINK_TYPE]: {
    title: "Invalid link type",
    anchor: "e116-invalid-link-type",
  },
  [ValidationErrorCode.E117_INVALID_IO_TYPE]: {
    title: "Invalid IO type",
    anchor: "e117-invalid-io-type",
  },
  [ValidationErrorCode.E118_NAME_ARTIFACT]: {
    title: "Name contains scrape artifacts",
    anchor: "e118-name-contains-scrape-artifacts",
  },
  [ValidationErrorCode.E119_INVALID_CAPABILITY]: {
    title: "Invalid capability",
    anchor: "e119-invalid-capability",
  },
  [ValidationErrorCode.E120_STORAGE_MEDIA_SLOT]: {
    title: "Storage media slot as IO",
    anchor: "e120-storage-media-slot-as-io",
  },
  [ValidationErrorCode.E121_UNKNOWN_KEY]: {
    title: "Key not in the schema",
    anchor: "e121-key-not-in-the-schema",
  },
  [ValidationErrorCode.E199_VALIDATION_ERROR]: {
    title: "Validation error",
    anchor: "e199-validation-error",
  },

  // Reference errors
  [ValidationErrorCode.E200_MANUFACTURER_NOT_FOUND]: {
    title: "Manufacturer not found",
    anchor: "e200-manufacturer-not-found",
  },
  [ValidationErrorCode.E202_DUPLICATE_CATEGORY]: {
    title: "Duplicate category",
    anchor: "e202-duplicate-category",
  },
  [ValidationErrorCode.E203_PARENT_COMPANY_NOT_FOUND]: {
    title: "Parent company not found",
    anchor: "e203-parent-company-not-found",
  },
  [ValidationErrorCode.E204_IO_TRANSLATION_MISMATCH]: {
    title: "I/O translation mismatch",
    anchor: "e204-io-translation-mismatch",
  },
  [ValidationErrorCode.E205_DUPLICATE_CAPABILITY]: {
    title: "Duplicate capability",
    anchor: "e205-duplicate-capability",
  },

  // Content errors
  [ValidationErrorCode.E300_INVALID_MARKDOWN]: {
    title: "Invalid markdown",
    anchor: "e300-invalid-markdown",
  },
  [ValidationErrorCode.E301_YOUTUBE_URL_FORMAT]: {
    title: "Invalid YouTube URL format",
    anchor: "e301-youtube-url-format",
  },
  [ValidationErrorCode.E302_UNCLOSED_CODE_BLOCK]: {
    title: "Unclosed code block",
    anchor: "e302-unclosed-code-block",
  },
  [ValidationErrorCode.E303_UNBALANCED_BACKTICKS]: {
    title: "Unbalanced backticks",
    anchor: "e303-unbalanced-backticks",
  },
  [ValidationErrorCode.E304_TRUNCATED_CONTENT]: {
    title: "Truncated content",
    anchor: "e304-truncated-content",
  },

  // Identifier errors
  [ValidationErrorCode.E400_INVALID_IDENTIFIER_FORMAT]: {
    title: "Invalid identifier format",
    anchor: "e400-invalid-identifier-format",
  },
  [ValidationErrorCode.E401_MISSING_IDENTIFIER]: {
    title: "Missing identifier",
    anchor: "e401-missing-identifier",
  },

  // Advisory warnings
  [ValidationErrorCode.W120_UNKNOWN_IO_TYPE]: {
    title: "Unknown IO type",
    anchor: "w120-unknown-io-type",
  },
  [ValidationErrorCode.W121_UNKNOWN_IO_CONNECTION]: {
    title: "Unknown IO connection",
    anchor: "w121-unknown-io-connection",
  },
  [ValidationErrorCode.W123_UNKNOWN_COMPATIBLE_WITH]: {
    title: "Unknown compatibleWith reference",
    anchor: "w123-unknown-compatible-with",
  },
  [ValidationErrorCode.W124_DUPLICATE_URL]: {
    title: "Duplicate URL",
    anchor: "w124-duplicate-url",
  },
  [ValidationErrorCode.W125_MANUFACTURER_URL_IN_LINKS]: {
    title: "Link matches manufacturer homepage",
    anchor: "w125-manufacturer-url-in-links",
  },
  [ValidationErrorCode.W126_SPECS_OVERLAP]: {
    title: "Specs line overlaps with structured field",
    anchor: "w126-specs-overlap",
  },
  [ValidationErrorCode.W127_MISSING_SEARCH_TERMS]: {
    title: "Entry would benefit from searchTerms",
    anchor: "w127-missing-search-terms",
  },
  [ValidationErrorCode.W128_IO_COMBINE_CANDIDATE]: {
    title: "IO entry may combine multiple physical jacks",
    anchor: "w128-io-entry-may-combine-multiple-physical-jacks",
  },
  [ValidationErrorCode.W129_MANUFACTURER_IN_NAME]: {
    title: "Manufacturer name duplicated in product name",
    anchor: "w129-manufacturer-name-duplicated-in-product-name",
  },
  [ValidationErrorCode.W130_NAME_TAGLINE]: {
    title: "Name contains a tagline-style separator",
    anchor: "w130-name-contains-a-tagline-style-separator",
  },
  [ValidationErrorCode.W131_PRICE_TERM_MISSING]: {
    title: "Several prices in one currency without a term",
    anchor: "w131-several-prices-in-one-currency-without-a-term",
  },
  [ValidationErrorCode.W132_UNKNOWN_KEY]: {
    title: "Key not in the schema",
    anchor: "w132-key-not-in-the-schema",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the documentation URL for an error code
 */
export function getDocsUrl(code: ValidationErrorCode): string {
  const info = ERROR_INFO[code];
  return `${DOCS_BASE_URL}#${info.anchor}`;
}

/**
 * Get the title for an error code
 */
export function getErrorTitle(code: ValidationErrorCode): string {
  return ERROR_INFO[code].title;
}

/**
 * Create a detailed error object
 */
export function createDetailedError(
  code: ValidationErrorCode,
  message: string,
  path: string,
  options?: {
    line?: number;
    column?: number;
    autoFix?: AutoFixSuggestion;
  }
): DetailedError {
  return DetailedErrorSchema.parse({
    code,
    message,
    path,
    line: options?.line,
    column: options?.column,
    docsUrl: getDocsUrl(code),
    autoFix: options?.autoFix,
  });
}

/**
 * Format a detailed error for console output
 */
export function formatDetailedError(error: DetailedError, filePath: string): string {
  const location = error.line
    ? `${filePath}:${error.line}${error.column ? `:${error.column}` : ""}`
    : filePath;

  let output = `${location}\n`;
  output += `  ${error.code}: ${error.message}\n`;
  output += `        Path: ${error.path}\n`;
  output += `        Docs: ${error.docsUrl}\n`;

  if (error.autoFix) {
    output += `        Fix:  ${error.autoFix.description}\n`;
  }

  return output;
}

/**
 * Format multiple errors for a file
 */
export function formatFileErrors(filePath: string, errors: DetailedError[]): string {
  if (errors.length === 0) return "";

  const lines: string[] = [`\n📄 ${filePath}`];

  for (const error of errors) {
    const lineInfo = error.line ? `:${error.line}` : "";
    lines.push(`   ${error.code}${lineInfo}: ${error.message}`);

    if (error.autoFix) {
      lines.push(`         💡 ${error.autoFix.description}`);
    }
  }

  return lines.join("\n");
}

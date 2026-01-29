/**
 * Validation Error Codes
 *
 * Standardized error codes for validation messages.
 * Each code links to documentation in docs/VALIDATION_ERRORS.md
 */

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
  E102_INVALID_SLUG_FORMAT = "E102",
  E103_INVALID_URL_FORMAT = "E103",
  E104_INVALID_CATEGORY = "E104",
  E105_INVALID_PLATFORM = "E105",
  E106_INVALID_FORMAT = "E106",
  E107_INVALID_LOCALE = "E107",
  E108_INVALID_DATE_FORMAT = "E108",
  E109_SLUG_FILENAME_MISMATCH = "E109",

  // Reference errors (E2xx)
  E200_MANUFACTURER_NOT_FOUND = "E200",
  E201_DUPLICATE_SLUG = "E201",
  E202_DUPLICATE_CATEGORY = "E202",
  E203_PARENT_COMPANY_NOT_FOUND = "E203",
  E204_IO_TRANSLATION_MISMATCH = "E204",

  // Content errors (E3xx)
  E300_INVALID_MARKDOWN = "E300",
  E301_YOUTUBE_URL_FORMAT = "E301",
  E302_UNCLOSED_CODE_BLOCK = "E302",
  E303_UNBALANCED_BACKTICKS = "E303",

  // Identifier errors (E4xx)
  E400_INVALID_IDENTIFIER_FORMAT = "E400",
  E401_MISSING_IDENTIFIER = "E401",
}

// =============================================================================
// AUTO-FIX SUGGESTIONS
// =============================================================================

export type AutoFixType = "replace" | "add" | "remove" | "rename";

export interface AutoFixSuggestion {
  /** Type of fix to apply */
  type: AutoFixType;
  /** Human-readable description of the fix */
  description: string;
  /** Original value (for replace/remove) */
  oldValue?: string;
  /** New value (for replace/add) */
  newValue?: string;
  /** Field path where fix applies */
  path?: string;
}

// =============================================================================
// DETAILED ERROR
// =============================================================================

export interface DetailedError {
  /** Error code for programmatic handling */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
  /** Path to the field (e.g., "categories[0]") */
  path: string;
  /** Line number in the YAML file (1-indexed) */
  line?: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Link to documentation */
  docsUrl: string;
  /** Optional auto-fix suggestion */
  autoFix?: AutoFixSuggestion;
}

// =============================================================================
// ERROR INFO REGISTRY
// =============================================================================

const DOCS_BASE_URL =
  "https://github.com/jeffreylouden/catalog/blob/main/docs/VALIDATION_ERRORS.md";

interface ErrorInfoEntry {
  /** Short description of the error */
  title: string;
  /** URL anchor for docs link */
  anchor: string;
}

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
  [ValidationErrorCode.E102_INVALID_SLUG_FORMAT]: {
    title: "Invalid slug format",
    anchor: "e102-invalid-slug-format",
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
  [ValidationErrorCode.E109_SLUG_FILENAME_MISMATCH]: {
    title: "Slug does not match filename",
    anchor: "e109-slug-filename-mismatch",
  },

  // Reference errors
  [ValidationErrorCode.E200_MANUFACTURER_NOT_FOUND]: {
    title: "Manufacturer not found",
    anchor: "e200-manufacturer-not-found",
  },
  [ValidationErrorCode.E201_DUPLICATE_SLUG]: {
    title: "Duplicate slug",
    anchor: "e201-duplicate-slug",
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

  // Identifier errors
  [ValidationErrorCode.E400_INVALID_IDENTIFIER_FORMAT]: {
    title: "Invalid identifier format",
    anchor: "e400-invalid-identifier-format",
  },
  [ValidationErrorCode.E401_MISSING_IDENTIFIER]: {
    title: "Missing identifier",
    anchor: "e401-missing-identifier",
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
  return {
    code,
    message,
    path,
    line: options?.line,
    column: options?.column,
    docsUrl: getDocsUrl(code),
    autoFix: options?.autoFix,
  };
}

/**
 * Format a detailed error for console output
 */
export function formatDetailedError(
  error: DetailedError,
  filePath: string
): string {
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
export function formatFileErrors(
  filePath: string,
  errors: DetailedError[]
): string {
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

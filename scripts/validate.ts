/**
 * YAML Validation Script
 *
 * Validates all YAML files in the data/ directory against schemas.
 * Run with: pnpm validate
 */

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { looksLikeAcronymName } from "./lib/acronym-exclusions.js";
import { getDocsUrl, ValidationErrorCode } from "./lib/error-codes.js";
import { isIoCombineCandidate, STORAGE_MEDIA_SLOT } from "./lib/io-heuristics.js";
import { findDuplicateIoKeys, IO_KEY_PATTERN } from "./lib/io-keys.js";
import {
  findNameArtifacts,
  hasTaglineSeparator,
  manufacturerNameIsPrefix,
  TAGLINE_EXCLUSIONS,
} from "./lib/name-hygiene.js";
import { findUntermedGroups, PRICE_TERMS } from "./lib/price-terms.js";
import type {
  CategoriesSchema,
  CategoryAliasesSchema,
  Collection,
  FormatsSchema,
  PlatformsSchema,
  ValidationError,
  ValidationErrorDetail,
  ValidationResult,
  ValidationWarning,
  ValidationWarningDetail,
} from "./lib/types.js";
import { collectUnknownKeys, formatUnknownKeyPath } from "./lib/unknown-keys.js";
import {
  DATA_DIR,
  findClosestMatch,
  formatValidOptions,
  getLineForPath,
  getYamlFiles,
  loadYamlFile,
  loadYamlFileWithPositions,
  parseErrorPath,
  SCHEMA_DIR,
  slugify,
} from "./lib/utils.js";

// =============================================================================
// LOAD CANONICAL SCHEMAS
// =============================================================================

const categoriesSchema = loadYamlFile<CategoriesSchema>(path.join(SCHEMA_DIR, "categories.yaml"));
const categoryAliasesSchema = loadYamlFile<CategoryAliasesSchema>(
  path.join(SCHEMA_DIR, "category-aliases.yaml")
);
const formatsSchema = loadYamlFile<FormatsSchema>(path.join(SCHEMA_DIR, "formats.yaml"));
const platformsSchema = loadYamlFile<PlatformsSchema>(path.join(SCHEMA_DIR, "platforms.yaml"));

// Canonical categories
const VALID_CATEGORIES = new Set(categoriesSchema.categories);

// Map of alias -> canonical category
const _CATEGORY_ALIASES = new Map<string, string>(Object.entries(categoryAliasesSchema.aliases));

// All valid category inputs (canonical + aliases)
const ALL_VALID_CATEGORY_INPUTS = new Set([
  ...categoriesSchema.categories,
  ...Object.keys(categoryAliasesSchema.aliases),
]);

// Capabilities — a strict, single-dimension vocabulary (what a product DOES).
// No aliases: unlike categories, this axis has no accumulated synonym history
// to absorb, and adding one would reopen the ambiguity the field exists to avoid.
const capabilitiesSchema = loadYamlFile<{ capabilities: string[] }>(
  path.join(SCHEMA_DIR, "capabilities.yaml")
);
const VALID_CAPABILITIES = new Set(capabilitiesSchema.capabilities);

const VALID_FORMATS = new Set(formatsSchema.formats);
const VALID_PLATFORMS = new Set(platformsSchema.platforms);

// Played instruments (guitars, basses, etc.) expose a single output jack with no
// meaningful panel position, so they are exempt from the io `position` requirement
// below — requiring it would force invented Top/Bottom/Left/Right data.
const categoryGroupsSchema = loadYamlFile<{ groups: Record<string, string[]> }>(
  path.join(SCHEMA_DIR, "category-groups.yaml")
);
const POSITION_EXEMPT_CATEGORIES = new Set(categoryGroupsSchema.groups.Instruments ?? []);

// Helper to check if a category is valid (canonical or alias)
function isValidCategory(cat: string): boolean {
  return ALL_VALID_CATEGORY_INPUTS.has(cat);
}

// Capabilities are validated strictly (E119) rather than advisorily. The whole
// value of the field is that two entries' lists are comparable, and a typo or a
// near-miss synonym silently breaks comparability while looking populated.
function createCapabilitiesValidator() {
  return (
    z
      .array(z.string())
      // Omission means "not yet assessed" and is fine. An empty array is a
      // different claim — that the product performs no audio operation at all —
      // and is always wrong for an entry someone bothered to add the key to.
      .min(1, "capabilities must not be empty; omit the field when not yet assessed")
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        for (const cap of ctx.value) {
          if (VALID_CAPABILITIES.has(cap)) continue;
          const suggestion = findClosestMatch(cap, VALID_CAPABILITIES);
          let message = `Invalid capability '${cap}'.`;
          if (suggestion) {
            message += ` Did you mean '${suggestion}'?`;
          }
          message += " Valid values are in schema/capabilities.yaml.";
          ctx.issues.push({ code: "custom", message, input: cap });
        }
        const seen = new Set<string>();
        for (const cap of ctx.value) {
          if (seen.has(cap)) {
            ctx.issues.push({
              code: "custom",
              message: `duplicate capability '${cap}'.`,
              input: cap,
            });
          }
          seen.add(cap);
        }
      })
  );
}

// =============================================================================
// LOAD IO, LINK, AND CURRENCY SCHEMAS
// =============================================================================

import { loadSchemaContext } from "./lib/schema-loader.js";

const schemaContext = loadSchemaContext();

const VALID_IO_SIGNAL_FLOWS = new Set(schemaContext.ioSignalFlows);
const VALID_IO_CATEGORIES = new Set(schemaContext.ioCategories);
const VALID_IO_POSITIONS = new Set(schemaContext.ioPositions);
const ALL_VALID_IO_POSITIONS = new Set([
  ...schemaContext.ioPositions,
  ...Object.keys(schemaContext.ioPositionAliases),
]);
const KNOWN_IO_TYPES = new Set(schemaContext.ioTypes);
const KNOWN_IO_CONNECTIONS = new Set([
  ...schemaContext.ioConnections,
  ...Object.keys(schemaContext.ioConnectionAliases),
]);
const IO_CONNECTOR_DETAILS = schemaContext.ioConnectorDetails;
const VALID_LINK_TYPES = new Set(schemaContext.linkTypes);
const VALID_CURRENCIES = new Set(schemaContext.currencies);

// Configure marked for validation
marked.setOptions({
  gfm: true,
  breaks: false,
});

// =============================================================================
// ERROR CODE MAPPING
// =============================================================================

/**
 * Determine the appropriate error code from a Zod issue
 */
function getErrorCodeFromZodIssue(issue: {
  code: string;
  message: string;
  path: readonly (string | number | symbol)[];
  received?: unknown;
}): ValidationErrorCode {
  const path = issue.path.join(".");
  const message = issue.message.toLowerCase();

  // Name hygiene errors
  if (message.includes("name artifact")) {
    return ValidationErrorCode.E118_NAME_ARTIFACT;
  }

  // URL errors
  if (message.includes("url") || message.includes("invalid url")) {
    if (message.includes("youtube")) {
      return ValidationErrorCode.E301_YOUTUBE_URL_FORMAT;
    }
    return ValidationErrorCode.E103_INVALID_URL_FORMAT;
  }

  // Capability errors
  if (path.includes("capabilities")) {
    // An empty array shares E119's docs section, which is where the
    // omit-versus-empty rule is written down.
    if (message.includes("invalid capability") || message.includes("must not be empty")) {
      return ValidationErrorCode.E119_INVALID_CAPABILITY;
    }
    if (message.includes("duplicate capability")) {
      return ValidationErrorCode.E205_DUPLICATE_CAPABILITY;
    }
  }

  // Category errors
  if (
    path.includes("categories") ||
    path.includes("primaryCategory") ||
    path.includes("secondaryCategory")
  ) {
    if (message.includes("invalid category")) {
      return ValidationErrorCode.E104_INVALID_CATEGORY;
    }
    if (message.includes("duplicate")) {
      return ValidationErrorCode.E202_DUPLICATE_CATEGORY;
    }
  }

  // IO field errors. E120 is raised only by the io name check, so it is
  // keyed to the name path: a connectorDetail VALUE that happens to contain
  // the phrase must still classify as E115, not E120.
  if (path.endsWith(".name") && message.includes("storage media slot")) {
    return ValidationErrorCode.E120_STORAGE_MEDIA_SLOT;
  }
  if (message.includes("invalid io signal flow")) {
    return ValidationErrorCode.E111_INVALID_IO_SIGNAL_FLOW;
  }
  if (message.includes("invalid io category")) {
    return ValidationErrorCode.E112_INVALID_IO_CATEGORY;
  }
  if (message.includes("invalid io position")) {
    return ValidationErrorCode.E113_INVALID_IO_POSITION;
  }
  if (message.includes("invalid io type")) {
    return ValidationErrorCode.E117_INVALID_IO_TYPE;
  }

  // Connector detail errors
  if (message.includes("connectordetail")) {
    return ValidationErrorCode.E115_INVALID_CONNECTOR_DETAIL;
  }

  // Currency errors
  if (message.includes("invalid currency")) {
    return ValidationErrorCode.E114_INVALID_CURRENCY;
  }

  // Link type errors
  if (message.includes("invalid link type")) {
    return ValidationErrorCode.E116_INVALID_LINK_TYPE;
  }

  // Platform errors
  if (path.includes("platforms") && message.includes("invalid platform")) {
    return ValidationErrorCode.E105_INVALID_PLATFORM;
  }

  // Format errors
  if (path.includes("formats") && message.includes("invalid format")) {
    return ValidationErrorCode.E106_INVALID_FORMAT;
  }

  // Markdown errors
  if (message.includes("markdown") || message.includes("code block")) {
    if (message.includes("unclosed code block")) {
      return ValidationErrorCode.E302_UNCLOSED_CODE_BLOCK;
    }
    if (message.includes("unclosed inline code")) {
      return ValidationErrorCode.E303_UNBALANCED_BACKTICKS;
    }
    return ValidationErrorCode.E300_INVALID_MARKDOWN;
  }

  // Missing required field (Zod v4: received === "undefined", fallback: message contains "required")
  if (issue.code === "invalid_type") {
    if (issue.received === "undefined" || message.includes("required")) {
      return ValidationErrorCode.E100_MISSING_REQUIRED_FIELD;
    }
    // Other type errors
    return ValidationErrorCode.E101_INVALID_FIELD_TYPE;
  }

  // Default to generic validation error for unclassified issues
  return ValidationErrorCode.E199_VALIDATION_ERROR;
}

// Helper to validate markdown content
function validateMarkdown(content: string): { valid: boolean; error?: string } {
  try {
    // Try to parse the markdown
    marked.parse(content);

    // Check for common markdown issues
    const issues: string[] = [];

    // Check for unclosed code blocks
    const codeBlockCount = (content.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      issues.push("unclosed code block (``` without closing ```)");
    }

    // Check for unclosed inline code
    const lines = content.split("\n");
    let inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      // Track fenced code blocks (``` and ```language)
      if (trimmedLine.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      // Skip lines that are inside fenced code blocks
      if (inCodeBlock) {
        continue;
      }
      // Count backticks not part of code blocks
      const backtickCount = (line.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        issues.push(`unclosed inline code on line ${i + 1}`);
      }
    }

    if (issues.length > 0) {
      return { valid: false, error: issues.join("; ") };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid markdown",
    };
  }
}

// Helper to normalize string or string[] to a single markdown string
function normalizeToMarkdownString(value: string | string[]): string {
  if (Array.isArray(value)) {
    // Join array items with double newlines (paragraph breaks)
    return value.join("\n\n");
  }
  return value;
}

// Zod schema for markdown content validation (accepts string or string[])
const MarkdownSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) => (val ? normalizeToMarkdownString(val) : val))
  .check((ctx) => {
    if (!ctx.value) return;
    const result = validateMarkdown(ctx.value);
    if (!result.valid) {
      ctx.issues.push({
        code: "custom",
        message: `Invalid markdown: ${result.error}`,
        input: ctx.value,
      });
    }
  });

// =============================================================================
// SHARED ZOD SCHEMAS
// =============================================================================

const PriceSchema = z.object({
  amount: z.number(),
  currency: z.string().check((ctx) => {
    if (!VALID_CURRENCIES.has(ctx.value)) {
      let message = `Invalid currency '${ctx.value}'.`;
      message += ` Valid currencies: ${formatValidOptions(VALID_CURRENCIES)}`;
      ctx.issues.push({ code: "custom", message, input: ctx.value });
    }
  }),
  /** ISO date when price was last verified */
  asOf: z.iso.date().optional(),
  /** Source of price (e.g., "official-website", "retailer") */
  source: z.string().optional(),
  /** What the amount buys when one currency carries several prices (W131). */
  term: z.enum(PRICE_TERMS).optional(),
});

const VideoLinkSchema = z.object({
  videoId: z.string().min(1, "videoId is required"),
  provider: z.enum(["youtube", "vimeo"]).default("youtube"),
  title: z.string().optional(),
  description: z.string().optional(),
});

const LinkSchema = z.object({
  type: z.string().check((ctx) => {
    if (!VALID_LINK_TYPES.has(ctx.value)) {
      let message = `Invalid link type '${ctx.value}'.`;
      const suggestion = findClosestMatch(ctx.value, VALID_LINK_TYPES);
      if (suggestion) {
        message += ` Did you mean '${suggestion}'?`;
      }
      message += ` Valid types: ${formatValidOptions(VALID_LINK_TYPES)}`;
      ctx.issues.push({
        code: "custom",
        message,
        input: ctx.value,
      });
    }
  }),
  title: z.string().optional(),
  url: z.url(),
  description: z.string().optional(),
});

const VersionSchema = z
  .object({
    name: z.string(),
    releaseDate: z.string().optional(),
    releaseDateYearOnly: z.boolean().optional(),
    preRelease: z.boolean().optional(),
    unofficial: z.boolean().optional(),
    url: z.url().optional(),
    description: z.string().optional(),
    prices: z.array(PriceSchema).optional(),
    links: z.array(LinkSchema).optional(),
    videos: z.array(VideoLinkSchema).optional(),
  })
  .refine(
    (data) => !data.releaseDateYearOnly || (!!data.releaseDate && /^\d{4}$/.test(data.releaseDate)),
    {
      message: "releaseDateYearOnly requires releaseDate in YYYY format",
      path: ["releaseDateYearOnly"],
    }
  );

const IOSchema = z
  .object({
    // Stable per-port key (assigned by pnpm assign-ids). Optional until the
    // backfill completes, then flipped to required (AUREO-705). Immutable
    // once assigned: Studio setup edges reference ports by this key.
    key: z
      .string()
      .regex(IO_KEY_PATTERN, "IO key must be exactly 8 alphanumeric characters")
      .optional(),
    name: z.string().check((ctx) => {
      if (STORAGE_MEDIA_SLOT.test(ctx.value)) {
        ctx.issues.push({
          code: "custom",
          message:
            `Storage media slot '${ctx.value}' is not a connectable port. ` +
            `Memory card slots hold media, not cables, so the setup graph cannot ` +
            `use them (same reasoning as Bluetooth/Wi-Fi). Mention the slot in ` +
            `description/details/specs instead. Option and expansion card bays ` +
            `that accept I/O cards stay legal.`,
          input: ctx.value,
        });
      }
    }),
    signalFlow: z.string().check((ctx) => {
      if (!VALID_IO_SIGNAL_FLOWS.has(ctx.value)) {
        const suggestion = findClosestMatch(ctx.value, VALID_IO_SIGNAL_FLOWS);
        let message = `Invalid IO signal flow '${ctx.value}'.`;
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`;
        }
        message += ` Valid values: ${formatValidOptions(VALID_IO_SIGNAL_FLOWS)}`;
        ctx.issues.push({ code: "custom", message, input: ctx.value });
      }
    }),
    category: z.string().check((ctx) => {
      if (!VALID_IO_CATEGORIES.has(ctx.value)) {
        const suggestion = findClosestMatch(ctx.value, VALID_IO_CATEGORIES);
        let message = `Invalid IO category '${ctx.value}'.`;
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`;
        }
        message += ` Valid values: ${formatValidOptions(VALID_IO_CATEGORIES)}`;
        ctx.issues.push({ code: "custom", message, input: ctx.value });
      }
    }),
    type: z.string().check((ctx) => {
      if (!KNOWN_IO_TYPES.has(ctx.value)) {
        const suggestion = findClosestMatch(ctx.value, KNOWN_IO_TYPES);
        let message = `Invalid IO type '${ctx.value}'.`;
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`;
        }
        message += ` Valid values: ${formatValidOptions(KNOWN_IO_TYPES)}`;
        message += ` (If this is a real signal type, add it to schema/io-types.yaml.`;
        message += ` If it names a physical connector, it belongs in \`connection\`.)`;
        ctx.issues.push({ code: "custom", message, input: ctx.value });
      }
    }),
    connection: z.string(),
    connectorDetail: z.array(z.string()).optional(),
    maxConnections: z.number(),
    position: z
      .string()
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        if (!ALL_VALID_IO_POSITIONS.has(ctx.value)) {
          const suggestion = findClosestMatch(ctx.value, VALID_IO_POSITIONS);
          let message = `Invalid IO position '${ctx.value}'.`;
          if (suggestion) {
            message += ` Did you mean '${suggestion}'?`;
          }
          message += ` Valid values: ${formatValidOptions(VALID_IO_POSITIONS)}`;
          ctx.issues.push({ code: "custom", message, input: ctx.value });
        }
      }),
    columnPosition: z.number().optional(),
    rowPosition: z.number().optional(),
    description: z.string().optional(),
  })
  .check((ctx) => {
    const data = ctx.value;
    if (!data.connectorDetail || data.connectorDetail.length === 0) return;
    const canonicalConnection =
      schemaContext.ioConnectionAliases[data.connection] ?? data.connection;
    const validValues = IO_CONNECTOR_DETAILS[canonicalConnection];
    if (!validValues) {
      ctx.issues.push({
        code: "custom",
        message: `connectorDetail is not supported for connection '${data.connection}'. Only supported for: ${Object.keys(IO_CONNECTOR_DETAILS).join(", ")}`,
        path: ["connectorDetail"],
        input: data.connectorDetail,
      });
      return;
    }
    const invalid = data.connectorDetail.filter((v: string) => !validValues.includes(v));
    if (invalid.length > 0) {
      ctx.issues.push({
        code: "custom",
        message: `Invalid connectorDetail value(s) '${invalid.join("', '")}' for connection '${data.connection}'. Valid values: ${validValues.join(", ")}`,
        path: ["connectorDetail"],
        input: data.connectorDetail,
      });
    }
  });

const VariantSchema = z
  .object({
    name: z.string().min(1),
    slug: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9-]{0,49}$/,
        "Slug must be lowercase alphanumeric with hyphens, 1-50 chars"
      )
      .optional(),
    releaseDate: z.string().optional(),
    releaseDateYearOnly: z.boolean().optional(),
    url: z.url().optional(),
    description: z.string().optional(),
    prices: z.array(PriceSchema).optional(),
    links: z.array(LinkSchema).optional(),
    videos: z.array(VideoLinkSchema).optional(),
  })
  .refine(
    (data) => !data.releaseDateYearOnly || (!!data.releaseDate && /^\d{4}$/.test(data.releaseDate)),
    {
      message: "releaseDateYearOnly requires releaseDate in YYYY format",
      path: ["releaseDateYearOnly"],
    }
  );

// Helper for category validation with suggestions
// Accepts both canonical categories and aliases
const createCategoryValidator = () =>
  z.string().check((ctx) => {
    if (!isValidCategory(ctx.value)) {
      // Suggest only canonical categories, not aliases
      const suggestion = findClosestMatch(ctx.value, VALID_CATEGORIES);
      let message = `Invalid category '${ctx.value}'.`;
      if (suggestion) {
        message += ` Did you mean '${suggestion}'?`;
      }
      ctx.issues.push({ code: "custom", message, input: ctx.value });
    }
  });

// Helper for platform validation
const createPlatformArrayValidator = () =>
  z
    .array(z.string())
    .optional()
    .check((ctx) => {
      if (!ctx.value) return;
      const invalid = ctx.value.filter((p) => !VALID_PLATFORMS.has(p));
      if (invalid.length > 0) {
        for (const plat of invalid) {
          let message = `Invalid platform '${plat}'.`;
          message += ` Valid platforms: ${formatValidOptions(VALID_PLATFORMS)}`;
          ctx.issues.push({ code: "custom", message, input: plat });
        }
      }
    });

// Helper for name validation (E118): scraped junk in names hard-fails.
// Advisory name style (manufacturer prefix, taglines) is W129/W130 in
// collectWarnings, since those need the manufacturer map / human judgment.
const createNameValidator = () =>
  z
    .string()
    .min(1, "Name is required")
    .check((ctx) => {
      for (const problem of findNameArtifacts(ctx.value)) {
        ctx.issues.push({
          code: "custom",
          message: `Name artifact: name ${problem}`,
          input: ctx.value,
        });
      }
    });

// =============================================================================
// COLLECTION ZOD SCHEMAS
// =============================================================================

const ManufacturerSchema = z.object({
  name: createNameValidator(),
  companyName: z.string().optional(),
  parentCompany: z.string().optional(),
  defunct: z.boolean().optional(),
  url: z.url().optional(),
  description: MarkdownSchema,
  searchTerms: z.array(z.string()).optional(),
});

const SoftwareSchema = z
  .object({
    name: createNameValidator(),
    manufacturer: z.string().min(1, "Manufacturer reference is required"),
    categories: z
      .array(z.string())
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        // Accept both canonical categories and aliases
        const invalid = ctx.value.filter((c) => !isValidCategory(c));
        if (invalid.length > 0) {
          for (const cat of invalid) {
            // Suggest only canonical categories
            const suggestion = findClosestMatch(cat, VALID_CATEGORIES);
            let message = `Invalid category '${cat}'.`;
            if (suggestion) {
              message += ` Did you mean '${suggestion}'?`;
            }
            ctx.issues.push({ code: "custom", message, input: cat });
          }
        }
      }),
    formats: z
      .array(z.string())
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        const invalid = ctx.value.filter((f) => !VALID_FORMATS.has(f));
        if (invalid.length > 0) {
          for (const fmt of invalid) {
            const suggestion = findClosestMatch(fmt, VALID_FORMATS);
            let message = `Invalid format '${fmt}'.`;
            if (suggestion) {
              message += ` Did you mean '${suggestion}'?`;
            }
            message += ` Valid formats: ${formatValidOptions(VALID_FORMATS)}`;
            ctx.issues.push({ code: "custom", message, input: fmt });
          }
        }
      }),
    platforms: createPlatformArrayValidator(),
    identifiers: z.record(z.string(), z.string()).optional(),
    compatibleWith: z.array(z.string()).optional(),
    url: z.url().optional(),
    releaseDate: z.string().optional(),
    releaseDateYearOnly: z.boolean().optional(),
    primaryCategory: createCategoryValidator(),
    secondaryCategory: createCategoryValidator().optional(),
    supersedes: z.string().optional(),
    searchTerms: z.array(z.string()).optional(),
    description: MarkdownSchema,
    details: MarkdownSchema,
    specs: MarkdownSchema,
    versions: z.array(VersionSchema).optional(),
    prices: z.array(PriceSchema).optional(),
    links: z.array(LinkSchema).optional(),
    videos: z.array(VideoLinkSchema).optional(),
  })
  .refine(
    (data) => !data.releaseDateYearOnly || (!!data.releaseDate && /^\d{4}$/.test(data.releaseDate)),
    {
      message: "releaseDateYearOnly requires releaseDate in YYYY format",
      path: ["releaseDateYearOnly"],
    }
  );

const HardwareSchema = z
  .object({
    name: createNameValidator(),
    manufacturer: z.string().min(1, "Manufacturer reference is required"),
    categories: z
      .array(z.string())
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        // Accept both canonical categories and aliases
        const invalid = ctx.value.filter((c) => !isValidCategory(c));
        if (invalid.length > 0) {
          for (const cat of invalid) {
            // Suggest only canonical categories
            const suggestion = findClosestMatch(cat, VALID_CATEGORIES);
            let message = `Invalid category '${cat}'.`;
            if (suggestion) {
              message += ` Did you mean '${suggestion}'?`;
            }
            ctx.issues.push({ code: "custom", message, input: cat });
          }
        }
      }),
    url: z.url().optional(),
    releaseDate: z.string().optional(),
    releaseDateYearOnly: z.boolean().optional(),
    primaryCategory: createCategoryValidator(),
    secondaryCategory: createCategoryValidator().optional(),
    supersedes: z.string().optional(),
    searchTerms: z.array(z.string()).optional(),
    capabilities: createCapabilitiesValidator(),
    description: MarkdownSchema,
    details: MarkdownSchema,
    specs: MarkdownSchema,
    io: z.array(IOSchema).optional(),
    versions: z.array(VersionSchema).optional(),
    variants: z.array(VariantSchema).optional(),
    prices: z.array(PriceSchema).optional(),
    links: z.array(LinkSchema).optional(),
    videos: z.array(VideoLinkSchema).optional(),
  })
  .check((ctx) => {
    // Every io entry needs a `position`, except on played instruments
    // (guitars, basses, etc.) whose single output jack has no panel position.
    const data = ctx.value;
    if (!data.io || data.io.length === 0) return;
    if (data.primaryCategory && POSITION_EXEMPT_CATEGORIES.has(data.primaryCategory)) return;
    data.io.forEach((port, i) => {
      if (!port.position) {
        ctx.issues.push({
          code: "custom",
          message: `io entry '${port.name ?? i}' is missing required 'position' (${formatValidOptions(VALID_IO_POSITIONS)}).`,
          path: ["io", i, "position"],
          input: port,
        });
      }
    });
  })
  .check((ctx) => {
    // IO keys must be unique within the entry (they identify ports for
    // Studio setup edges — see io-keys.ts).
    const io = ctx.value.io;
    if (!io || io.length === 0) return;
    for (const dup of findDuplicateIoKeys(io)) {
      ctx.issues.push({
        code: "custom",
        message: `duplicate io key '${dup}' — io keys must be unique within an entry.`,
        path: ["io"],
        input: dup,
      });
    }
  })
  .refine(
    (data) => !data.releaseDateYearOnly || (!!data.releaseDate && /^\d{4}$/.test(data.releaseDate)),
    {
      message: "releaseDateYearOnly requires releaseDate in YYYY format",
      path: ["releaseDateYearOnly"],
    }
  )
  .refine(
    (data) => {
      if (!data.variants) return true;
      const slugs = data.variants.map((r) => {
        if (r.slug) return r.slug;
        try {
          return slugify(r.name);
        } catch {
          return "";
        }
      });
      if (slugs.some((s) => !s || s.length > 50)) return false;
      return new Set(slugs).size === slugs.length;
    },
    {
      message:
        "Variant slugs must be unique, non-empty, and at most 50 characters within a hardware entry",
      path: ["variants"],
    }
  );

// Content schema: like Software but without formats, platforms, identifiers
const ContentSchema = z
  .object({
    name: createNameValidator(),
    manufacturer: z.string().min(1, "Manufacturer reference is required"),
    categories: z
      .array(z.string())
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        const invalid = ctx.value.filter((c) => !isValidCategory(c));
        if (invalid.length > 0) {
          for (const cat of invalid) {
            const suggestion = findClosestMatch(cat, VALID_CATEGORIES);
            let message = `Invalid category '${cat}'.`;
            if (suggestion) {
              message += ` Did you mean '${suggestion}'?`;
            }
            ctx.issues.push({ code: "custom", message, input: cat });
          }
        }
      }),
    compatibleWith: z.array(z.string()).optional(),
    url: z.url().optional(),
    releaseDate: z.string().optional(),
    releaseDateYearOnly: z.boolean().optional(),
    primaryCategory: createCategoryValidator(),
    secondaryCategory: createCategoryValidator().optional(),
    supersedes: z.string().optional(),
    searchTerms: z.array(z.string()).optional(),
    description: MarkdownSchema,
    details: MarkdownSchema,
    specs: MarkdownSchema,
    versions: z.array(VersionSchema).optional(),
    prices: z.array(PriceSchema).optional(),
    links: z.array(LinkSchema).optional(),
    videos: z.array(VideoLinkSchema).optional(),
  })
  .refine(
    (data) => !data.releaseDateYearOnly || (!!data.releaseDate && /^\d{4}$/.test(data.releaseDate)),
    {
      message: "releaseDateYearOnly requires releaseDate in YYYY format",
      path: ["releaseDateYearOnly"],
    }
  );

// Accessory schema: like Hardware but without io, variants
const AccessorySchema = z
  .object({
    name: createNameValidator(),
    manufacturer: z.string().min(1, "Manufacturer reference is required"),
    categories: z
      .array(z.string())
      .optional()
      .check((ctx) => {
        if (!ctx.value) return;
        const invalid = ctx.value.filter((c) => !isValidCategory(c));
        if (invalid.length > 0) {
          for (const cat of invalid) {
            const suggestion = findClosestMatch(cat, VALID_CATEGORIES);
            let message = `Invalid category '${cat}'.`;
            if (suggestion) {
              message += ` Did you mean '${suggestion}'?`;
            }
            ctx.issues.push({ code: "custom", message, input: cat });
          }
        }
      }),
    url: z.url().optional(),
    releaseDate: z.string().optional(),
    releaseDateYearOnly: z.boolean().optional(),
    primaryCategory: createCategoryValidator(),
    secondaryCategory: createCategoryValidator().optional(),
    supersedes: z.string().optional(),
    searchTerms: z.array(z.string()).optional(),
    description: MarkdownSchema,
    details: MarkdownSchema,
    specs: MarkdownSchema,
    versions: z.array(VersionSchema).optional(),
    prices: z.array(PriceSchema).optional(),
    links: z.array(LinkSchema).optional(),
    videos: z.array(VideoLinkSchema).optional(),
  })
  .refine(
    (data) => !data.releaseDateYearOnly || (!!data.releaseDate && /^\d{4}$/.test(data.releaseDate)),
    {
      message: "releaseDateYearOnly requires releaseDate in YYYY format",
      path: ["releaseDateYearOnly"],
    }
  );

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * `--strict-unknown-keys` turns W132 into E121. Zod strips a key it does
 * not declare, so without this an import can ship `prices[].type`,
 * `versions[].notes` or a top-level `discontinued: true` and never hear of
 * it (catalog#689). The import lanes pass the flag on their own changed
 * files. The whole-catalog run stays advisory until the 337 files on
 * `main` that predate the check are backfilled, at which point the flag
 * becomes the default.
 */
const STRICT_UNKNOWN_KEYS = process.argv.includes("--strict-unknown-keys");

interface DataWithOptionalFields {
  manufacturer?: string;
  primaryCategory?: string;
  secondaryCategory?: string;
  categories?: string[];
  supersedes?: string;
  description?: string | string[];
  details?: string | string[];
  specs?: string | string[];
}

/**
 * Validate a single YAML data file against the provided Zod schema and collection-level rules.
 *
 * @param filePath - Filesystem path to the YAML file to validate
 * @param schema - Zod schema describing the expected structure for the file's collection
 * @param allManufacturers - Set of known manufacturer IDs used to verify any `manufacturer` reference
 * @param validSupersedesIds - Optional set of valid IDs in the same collection used to verify a `supersedes` reference
 * @returns A ValidationError object containing a summary `errors` array and optional `details` (each with `code`, `message`, `path`, `line`, and `docsUrl`) when validation fails, or `null` when the file is valid
 */
function validateFile(
  filePath: string,
  schema: z.ZodType,
  allManufacturers: Set<string>,
  validSupersedesIds?: Set<string>
): ValidationError | null {
  try {
    // Load YAML with position tracking for line numbers
    const { data: rawData, document, lineCounter } = loadYamlFileWithPositions(filePath);

    // Check for YAML parse errors before proceeding with validation
    if (document.errors && document.errors.length > 0) {
      const relativeFile = path.relative(process.cwd(), filePath);
      const errorCode = ValidationErrorCode.E110_YAML_SYNTAX_ERROR;
      const details: ValidationErrorDetail[] = document.errors.map((err) => ({
        code: errorCode,
        message: err.message,
        path: "(yaml)",
        line: err.linePos?.[0]?.line,
        docsUrl: getDocsUrl(errorCode),
      }));
      const errors = document.errors.map((err) => {
        const lineInfo = err.linePos?.[0]?.line ? `:${err.linePos[0].line}` : "";
        return `yaml${lineInfo}: ${err.message}`;
      });
      return { file: relativeFile, errors, details };
    }

    const data = rawData as DataWithOptionalFields;

    // Reject the non-schema `images` field. Product images are served from
    // R2 by id convention and are never stored in catalog data; the field
    // is not part of any collection schema. Checked on the raw object before
    // Zod (which silently strips unknown keys) so the leak is caught in CI.
    if (rawData && typeof rawData === "object" && "images" in rawData) {
      const message =
        "`images` is not a catalog field. Product images live in R2 (keyed " +
        "by id), not in YAML. Remove the `images` block.";
      const line = getLineForPath(document, lineCounter, ["images"]);
      const errorCode = ValidationErrorCode.E199_VALIDATION_ERROR;

      return {
        file: path.relative(process.cwd(), filePath),
        errors: [`images: ${message}`],
        details: [
          {
            code: errorCode,
            message,
            path: "images",
            line: line ?? undefined,
            docsUrl: getDocsUrl(errorCode),
          },
        ],
      };
    }

    if (STRICT_UNKNOWN_KEYS) {
      const unknown = collectUnknownKeys(schema, rawData);
      if (unknown.length > 0) {
        const errorCode = ValidationErrorCode.E121_UNKNOWN_KEY;
        const details: ValidationErrorDetail[] = unknown.map((finding) => {
          const line = getLineForPath(document, lineCounter, [...finding.parent, finding.key]);
          return {
            code: errorCode,
            message: `Key '${finding.key}' is not in the schema and would be silently dropped. Remove it or add it to the schema.`,
            path: formatUnknownKeyPath(finding),
            line: line ?? undefined,
            docsUrl: getDocsUrl(errorCode),
          };
        });
        return {
          file: path.relative(process.cwd(), filePath),
          errors: details.map((d) => `${d.path}${d.line ? `:${d.line}` : ""}: ${d.message}`),
          details,
        };
      }
    }

    // Validate against Zod schema
    const result = schema.safeParse(rawData);

    if (!result.success) {
      const relativeFile = path.relative(process.cwd(), filePath);
      const details: ValidationErrorDetail[] = [];
      const errors: string[] = [];

      for (const issue of result.error.issues) {
        const pathStr = issue.path.join(".");
        const errorCode = getErrorCodeFromZodIssue(issue);
        const parsedPath = parseErrorPath(pathStr);
        const line = getLineForPath(document, lineCounter, parsedPath);
        const docsUrl = getDocsUrl(errorCode);

        details.push({
          code: errorCode,
          message: issue.message,
          path: pathStr || "(root)",
          line: line ?? undefined,
          docsUrl,
        });

        // Keep simple error for backward compatibility
        const lineInfo = line ? `:${line}` : "";
        errors.push(`${pathStr}${lineInfo}: ${issue.message}`);
      }

      return { file: relativeFile, errors, details };
    }

    // Check manufacturer reference exists
    if ("manufacturer" in data && typeof data.manufacturer === "string") {
      if (!allManufacturers.has(data.manufacturer)) {
        const suggestion = findClosestMatch(data.manufacturer, allManufacturers);
        let message = `Referenced manufacturer '${data.manufacturer}' does not exist.`;
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`;
        }
        if (allManufacturers.size <= 10) {
          message += ` Available: ${[...allManufacturers].join(", ")}`;
        }

        const line = getLineForPath(document, lineCounter, ["manufacturer"]);
        const errorCode = ValidationErrorCode.E200_MANUFACTURER_NOT_FOUND;

        return {
          file: path.relative(process.cwd(), filePath),
          errors: [`manufacturer: ${message}`],
          details: [
            {
              code: errorCode,
              message,
              path: "manufacturer",
              line: line ?? undefined,
              docsUrl: getDocsUrl(errorCode),
            },
          ],
        };
      }
    }

    // Check supersedes reference exists (must be a valid ID in the same collection)
    if (validSupersedesIds && "supersedes" in data && typeof data.supersedes === "string") {
      if (!validSupersedesIds.has(data.supersedes)) {
        const message = `Referenced supersedes ID '${data.supersedes}' does not exist in this collection.`;

        const line = getLineForPath(document, lineCounter, ["supersedes"]);
        const errorCode = ValidationErrorCode.E199_VALIDATION_ERROR;

        return {
          file: path.relative(process.cwd(), filePath),
          errors: [`supersedes: ${message}`],
          details: [
            {
              code: errorCode,
              message,
              path: "supersedes",
              line: line ?? undefined,
              docsUrl: getDocsUrl(errorCode),
            },
          ],
        };
      }
    }

    // Check for duplicate categories
    if (Array.isArray(data.categories)) {
      const categoryErrors: string[] = [];
      const categoryDetails: ValidationErrorDetail[] = [];
      const errorCode = ValidationErrorCode.E202_DUPLICATE_CATEGORY;

      // Check if primaryCategory is duplicated in categories array
      if (data.primaryCategory && data.categories.includes(data.primaryCategory)) {
        const message = `primaryCategory '${data.primaryCategory}' should not be duplicated in categories array`;
        const line = getLineForPath(document, lineCounter, ["categories"]);
        categoryErrors.push(`categories: ${message}`);
        categoryDetails.push({
          code: errorCode,
          message,
          path: "categories",
          line: line ?? undefined,
          docsUrl: getDocsUrl(errorCode),
        });
      }

      // Check if secondaryCategory is duplicated in categories array
      if (data.secondaryCategory && data.categories.includes(data.secondaryCategory)) {
        const message = `secondaryCategory '${data.secondaryCategory}' should not be duplicated in categories array`;
        const line = getLineForPath(document, lineCounter, ["categories"]);
        categoryErrors.push(`categories: ${message}`);
        categoryDetails.push({
          code: errorCode,
          message,
          path: "categories",
          line: line ?? undefined,
          docsUrl: getDocsUrl(errorCode),
        });
      }

      // Check for duplicates within the categories array itself
      const seen = new Set<string>();
      for (let i = 0; i < data.categories.length; i++) {
        const cat = data.categories[i];
        if (seen.has(cat)) {
          const message = `duplicate category '${cat}' in array`;
          const line = getLineForPath(document, lineCounter, ["categories", i]);
          categoryErrors.push(`categories: ${message}`);
          categoryDetails.push({
            code: errorCode,
            message,
            path: `categories[${i}]`,
            line: line ?? undefined,
            docsUrl: getDocsUrl(errorCode),
          });
        }
        seen.add(cat);
      }

      if (categoryErrors.length > 0) {
        return {
          file: path.relative(process.cwd(), filePath),
          errors: categoryErrors,
          details: categoryDetails,
        };
      }
    }

    // Check for truncated description (ending with "...")
    // Matches text cut mid-word ("featur...") or ending with generic ellipsis,
    // but excludes legitimate trailing phrases like "and more..." or "etc..."
    if (data.description) {
      const descText = Array.isArray(data.description)
        ? data.description.join("\n\n")
        : data.description;
      if (/\.{3,}\s*$/.test(descText) && !/(?:more|etc|others|so on)\.{3,}\s*$/i.test(descText)) {
        const line = getLineForPath(document, lineCounter, ["description"]);
        const errorCode = ValidationErrorCode.E304_TRUNCATED_CONTENT;
        const message =
          "Description appears to be truncated (ends with '...'). Provide the full text.";
        return {
          file: path.relative(process.cwd(), filePath),
          errors: [`description: ${message}`],
          details: [
            {
              code: errorCode,
              message,
              path: "description",
              line: line ?? undefined,
              docsUrl: getDocsUrl(errorCode),
            },
          ],
        };
      }
    }

    return null;
  } catch (error) {
    return {
      file: path.relative(process.cwd(), filePath),
      errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Detects a cycle in a chain of supersedes relationships starting from the given ID.
 *
 * @param startId - The ID at which to begin following the supersedes chain
 * @param supersedesMap - Map from an item's ID to the ID it supersedes
 * @param idToSlug - Map from an ID to its corresponding slug used for human-readable paths
 * @returns An array of slugs representing the cycle path (the first slug is repeated at the end to close the cycle), or `null` if no cycle is found
 */
function detectSupersedeCycle(
  startId: string,
  supersedesMap: Map<string, string>,
  idToSlug: Map<string, string>
): string[] | null {
  const visited = new Set<string>();
  const path: string[] = [];
  let current: string | undefined = startId;

  while (current) {
    if (visited.has(current)) {
      // Found a cycle - return the path from the cycle start
      const cycleStartIndex = path.indexOf(current);
      const cyclePath = path.slice(cycleStartIndex);
      cyclePath.push(current); // Complete the cycle
      return cyclePath.map((id) => idToSlug.get(id) || id);
    }
    visited.add(current);
    path.push(current);
    current = supersedesMap.get(current);
  }

  return null;
}

// =============================================================================
// ADVISORY WARNING COLLECTION
// =============================================================================

interface WarningContext {
  name?: string;
  primaryCategory?: string;
  io?: Array<{ name: string; type: string; connection: string; maxConnections?: number }>;
  compatibleWith?: string[];
  url?: string;
  links?: Array<{ url: string }>;
  manufacturer?: string;
  searchTerms?: string[];
  specs?: string;
  formats?: string[];
  platforms?: string[];
  prices?: Array<{ currency?: string; term?: string }>;
}

/**
 * Collect advisory warnings for a validated file.
 * These are non-blocking and do not affect CI exit code.
 */
function collectWarnings(
  filePath: string,
  data: WarningContext,
  document: ReturnType<typeof loadYamlFileWithPositions>["document"],
  lineCounter: ReturnType<typeof loadYamlFileWithPositions>["lineCounter"],
  allSoftwareSlugs?: Set<string>,
  allHardwareSlugs?: Set<string>,
  manufacturerUrlMap?: Map<string, string>,
  manufacturerNameMap?: Map<string, string>,
  schema?: z.ZodType
): ValidationWarning | null {
  const warnings: ValidationWarningDetail[] = [];
  const relativeFile = path.relative(process.cwd(), filePath);

  // W132: a key the schema does not declare. Zod strips it, so the entry
  // validates and builds while the value never reaches the database.
  // `--strict-unknown-keys` reports the same finding as E121 instead.
  if (schema && !STRICT_UNKNOWN_KEYS) {
    for (const finding of collectUnknownKeys(schema, data)) {
      const line = getLineForPath(document, lineCounter, [...finding.parent, finding.key]);
      warnings.push({
        code: ValidationErrorCode.W132_UNKNOWN_KEY,
        message: `Key '${finding.key}' is not in the schema and is silently dropped. Remove it or add it to the schema.`,
        path: formatUnknownKeyPath(finding),
        line: line ?? undefined,
      });
    }
  }

  // W131: several prices in one currency that carry no `term` cannot be
  // told apart (a perpetual licence beside a monthly plan). One price per
  // currency never needs a term.
  if (Array.isArray(data.prices)) {
    for (const group of findUntermedGroups(data.prices)) {
      const first = group.untermed[0] ?? group.repeated[0] ?? 0;
      const line = getLineForPath(document, lineCounter, ["prices", first]);
      const reason =
        group.untermed.length > 0
          ? `${group.untermed.length} of them carry no term`
          : "two of them share a term";
      warnings.push({
        code: ValidationErrorCode.W131_PRICE_TERM_MISSING,
        message: `Several ${group.currency} prices and ${reason}. Set term (${PRICE_TERMS.join(", ")}) on each, or keep one price per currency.`,
        path: `prices[${first}]`,
        line: line ?? undefined,
      });
    }
  }

  // io.type is not checked here: it is a hard error (E117) via the Zod IOSchema,
  // so an unknown value fails validation outright. io.connection remains advisory.
  if (Array.isArray(data.io)) {
    for (let i = 0; i < data.io.length; i++) {
      const io = data.io[i];

      if (io.connection && !KNOWN_IO_CONNECTIONS.has(io.connection)) {
        const line = getLineForPath(document, lineCounter, ["io", i, "connection"]);
        warnings.push({
          code: ValidationErrorCode.W121_UNKNOWN_IO_CONNECTION,
          message: `Unknown IO connection '${io.connection}' on '${io.name}'. Consider adding to schema/io-connections.yaml if valid.`,
          path: `io[${i}].connection`,
          line: line ?? undefined,
        });
      }

      // A single-jack connection carries one physical link; maxConnections>1
      // usually means several jacks were collapsed into one entry (aggregates
      // like "All Slots" are excluded).
      if (isIoCombineCandidate(io, { primaryCategory: data.primaryCategory })) {
        const line = getLineForPath(document, lineCounter, ["io", i, "maxConnections"]);
        warnings.push({
          code: ValidationErrorCode.W128_IO_COMBINE_CANDIDATE,
          message: `IO '${io.name}' sets maxConnections ${io.maxConnections} on a single-jack connection ('${io.connection}'). If this is several physical jacks, give each its own io entry with maxConnections: 1.`,
          path: `io[${i}].maxConnections`,
          line: line ?? undefined,
        });
      }
    }
  }

  // Check compatibleWith references (advisory) — checks both software and hardware slugs
  if (Array.isArray(data.compatibleWith) && (allSoftwareSlugs || allHardwareSlugs)) {
    for (let i = 0; i < data.compatibleWith.length; i++) {
      const slug = data.compatibleWith[i];
      const inSoftware = allSoftwareSlugs?.has(slug) ?? false;
      const inHardware = allHardwareSlugs?.has(slug) ?? false;
      if (!inSoftware && !inHardware) {
        const line = getLineForPath(document, lineCounter, ["compatibleWith", i]);
        warnings.push({
          code: ValidationErrorCode.W123_UNKNOWN_COMPATIBLE_WITH,
          message: `Unknown compatibleWith reference '${slug}'. No matching software or hardware file found.`,
          path: `compatibleWith[${i}]`,
          line: line ?? undefined,
        });
      }
    }
  }

  // Check for duplicate URLs within the file
  if (Array.isArray(data.links)) {
    const seenUrls = new Set<string>();

    // If url is set, treat it as the first seen URL
    if (data.url) {
      seenUrls.add(data.url);
    }

    for (let i = 0; i < data.links.length; i++) {
      const linkUrl = data.links[i].url;
      if (linkUrl && seenUrls.has(linkUrl)) {
        const line = getLineForPath(document, lineCounter, ["links", i, "url"]);
        const source = data.url === linkUrl ? "url" : "links";
        warnings.push({
          code: ValidationErrorCode.W124_DUPLICATE_URL,
          message: `Duplicate URL '${linkUrl}' in links[${i}] (already in ${source}). Remove the duplicate link entry.`,
          path: `links[${i}].url`,
          line: line ?? undefined,
        });
      }
      if (linkUrl) {
        seenUrls.add(linkUrl);
      }
    }
  }

  // Check if url or links match manufacturer homepage (W125)
  if (data.manufacturer && manufacturerUrlMap) {
    const mfrUrl = manufacturerUrlMap.get(data.manufacturer);
    if (mfrUrl) {
      const normalize = (u: string) =>
        u
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/+$/, "")
          .toLowerCase();
      const normalizedMfr = normalize(mfrUrl);

      if (data.url && normalize(data.url) === normalizedMfr) {
        const line = getLineForPath(document, lineCounter, ["url"]);
        warnings.push({
          code: ValidationErrorCode.W125_MANUFACTURER_URL_IN_LINKS,
          message: `Product url '${data.url}' matches manufacturer homepage. Use a product-specific URL or remove it.`,
          path: "url",
          line: line ?? undefined,
        });
      }

      if (Array.isArray(data.links)) {
        for (let i = 0; i < data.links.length; i++) {
          const linkUrl = data.links[i].url;
          if (linkUrl && normalize(linkUrl) === normalizedMfr) {
            const line = getLineForPath(document, lineCounter, ["links", i, "url"]);
            warnings.push({
              code: ValidationErrorCode.W125_MANUFACTURER_URL_IN_LINKS,
              message: `links[${i}].url '${linkUrl}' matches manufacturer homepage. Remove the redundant link entry.`,
              path: `links[${i}].url`,
              line: line ?? undefined,
            });
          }
        }
      }
    }
  }

  // Check specs lines for overlap with the file's own formats/platforms (W126)
  if (typeof data.specs === "string" && data.specs.length > 0) {
    const fileFormats = new Set(data.formats ?? []);
    const filePlatforms = new Set(data.platforms ?? []);

    if (fileFormats.size > 0 || filePlatforms.size > 0) {
      // Map display tokens to canonical format/platform values
      const TOKEN_TO_FORMAT: Record<string, string> = {
        au: "au",
        vst: "vst",
        vst2: "vst2",
        vst3: "vst3",
        aax: "aax",
        rtas: "rtas",
        tdm: "tdm",
        clap: "clap",
        lv2: "lv2",
        standalone: "standalone",
        "rack-extension": "rack-extension",
      };

      const TOKEN_TO_PLATFORM: Record<string, string> = {
        macos: "mac",
        mac: "mac",
        windows: "windows",
        win: "windows",
        pc: "windows",
        linux: "linux",
        ios: "ios",
        ipados: "ios",
        android: "android",
      };

      const FILLER_WORDS = new Set([
        "formats",
        "format",
        "support",
        "supports",
        "compatibility",
        "and",
        "or",
        "operates",
        "as",
        "plugin",
        "plugins",
        "64-bit",
        "64bit",
      ]);

      const specLines = data.specs.split("\n");
      for (const rawLine of specLines) {
        if (!rawLine.startsWith("- ")) continue;

        const stripped = rawLine.slice(2).toLowerCase();
        const rawTokens = stripped
          .split(/[\s,/()]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        const tokens = rawTokens.filter((t) => !FILLER_WORDS.has(t));
        if (tokens.length === 0) continue;

        // Every token must map to a format or platform the file already declares
        let allRedundant = true;
        for (const token of tokens) {
          const canonicalFormat = TOKEN_TO_FORMAT[token];
          const canonicalPlatform = TOKEN_TO_PLATFORM[token];

          if (canonicalFormat && fileFormats.has(canonicalFormat)) continue;
          if (canonicalPlatform && filePlatforms.has(canonicalPlatform)) continue;

          // Token doesn't match a known format/platform in this file's fields
          allRedundant = false;
          break;
        }

        if (allRedundant) {
          const line = getLineForPath(document, lineCounter, ["specs"]);
          warnings.push({
            code: ValidationErrorCode.W126_SPECS_OVERLAP,
            message: `Specs line "${rawLine.trim()}" restates the structured formats/platforms fields. Remove it from specs.`,
            path: "specs",
            line: line ?? undefined,
          });
        }
      }
    }
  }

  // Check if entry would benefit from searchTerms (W127)
  //
  // Model-number / hyphenated names (e.g. DR-110, SM-7B) are intentionally
  // NOT flagged here: brandVariants() in lib/synonyms.ts already produces
  // dash-stripped and space-separated forms at build time, so the FTS index
  // gets "dr110" / "dr 110" automatically. Asking authors to add those by
  // hand is duplicate work.
  //
  // We only flag short all-caps names that look like true acronyms (MPC,
  // ADT, AGL) — those may have meaningful expansions worth indexing that
  // brandVariants cannot derive from the name alone.
  if (!data.searchTerms || data.searchTerms.length === 0) {
    const name: string = data.name ?? "";
    if (looksLikeAcronymName(name)) {
      const line = getLineForPath(document, lineCounter, ["name"]);
      warnings.push({
        code: ValidationErrorCode.W127_MISSING_SEARCH_TERMS,
        message: `Entry '${name.trim()}' looks like an acronym — consider adding searchTerms with the expansion or other forms users might search.`,
        path: "searchTerms",
        line: line ?? undefined,
      });
    }
  }

  // W129: manufacturer display name duplicated at the start of the product
  // name. The manufacturer is stored/indexed separately, so "dbx 286s"
  // under manufacturer dbx should just be "286s".
  if (data.name && data.manufacturer && manufacturerNameMap) {
    const mfrName = manufacturerNameMap.get(data.manufacturer);
    if (mfrName && manufacturerNameIsPrefix(data.name, mfrName)) {
      const line = getLineForPath(document, lineCounter, ["name"]);
      warnings.push({
        code: ValidationErrorCode.W129_MANUFACTURER_IN_NAME,
        message: `Name '${data.name}' starts with the manufacturer name '${mfrName}' — drop the prefix; display and search compose the two.`,
        path: "name",
        line: line ?? undefined,
      });
    }
  }

  // W130: en/em dash or pipe with surrounding spaces — usually a scraped
  // marketing tagline ("Toolbox – Sequencer and Function Generator") or a
  // storefront brand suffix ("Groth | Wavelet Audio"). Officially-styled
  // exceptions live in TAGLINE_EXCLUSIONS.
  if (data.name && hasTaglineSeparator(data.name)) {
    const slug = path.basename(relativeFile, path.extname(relativeFile));
    if (!TAGLINE_EXCLUSIONS.has(slug)) {
      const line = getLineForPath(document, lineCounter, ["name"]);
      warnings.push({
        code: ValidationErrorCode.W130_NAME_TAGLINE,
        message: `Name '${data.name}' contains a tagline-style separator — keep only the product name (or add the slug to TAGLINE_EXCLUSIONS in scripts/lib/name-hygiene.ts if the separator is official).`,
        path: "name",
        line: line ?? undefined,
      });
    }
  }

  return warnings.length > 0 ? { file: relativeFile, warnings } : null;
}

/**
 * Runs full repository validation over manufacturer, software, content, hardware, and accessories YAML files.
 *
 * Performs schema validation against canonical schemas, verifies manufacturer references, validates
 * supersedes references by ID, detects cycles in supersedes chains, and aggregates validation errors
 * and collection statistics.
 *
 * @returns An object with:
 *  - `valid`: `true` if no validation errors were found, `false` otherwise.
 *  - `errors`: an array of `ValidationError` entries describing per-file failures and detailed issues.
 *  - `stats`: an object with counts `{ manufacturers, software, content, hardware, accessories }` of successfully validated files.
 */
function validate(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const stats = { manufacturers: 0, software: 0, content: 0, hardware: 0, accessories: 0 };

  // First pass: collect all slugs (derived from filenames) and IDs
  const manufacturerFiles = getYamlFiles(path.join(DATA_DIR, "manufacturers"));
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  const contentFiles = getYamlFiles(path.join(DATA_DIR, "content"));
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  const accessoryFiles = getYamlFiles(path.join(DATA_DIR, "accessories"));

  const allManufacturers = new Set<string>();

  // Maps for ID-based validation
  const softwareIds = new Set<string>();
  const softwareIdToSlug = new Map<string, string>();
  const softwareSupersedesMap = new Map<string, string>(); // id -> supersedes_id

  const contentIds = new Set<string>();
  const contentIdToSlug = new Map<string, string>();
  const contentSupersedesMap = new Map<string, string>(); // id -> supersedes_id

  const hardwareIds = new Set<string>();
  const hardwareIdToSlug = new Map<string, string>();
  const hardwareSupersedesMap = new Map<string, string>(); // id -> supersedes_id

  const accessoryIds = new Set<string>();
  const accessoryIdToSlug = new Map<string, string>();
  const accessorySupersedesMap = new Map<string, string>(); // id -> supersedes_id

  const manufacturerUrlMap = new Map<string, string>();
  const manufacturerNameMap = new Map<string, string>();
  for (const file of manufacturerFiles) {
    const slug = path.basename(file, path.extname(file));
    allManufacturers.add(slug);
    try {
      const content = fs.readFileSync(file, "utf-8");
      const mfrData = parseYaml(content) as { url?: string; name?: string };
      if (mfrData.url) manufacturerUrlMap.set(slug, mfrData.url);
      if (mfrData.name) manufacturerNameMap.set(slug, mfrData.name);
    } catch {
      // Ignore parse errors - they're caught later
    }
  }

  // allSoftwareSlugs used for compatibleWith validation (software only, not content)
  const allSoftwareSlugs = new Set<string>();
  for (const file of softwareFiles) {
    allSoftwareSlugs.add(path.basename(file, path.extname(file)));
  }

  // allHardwareSlugs used for compatibleWith validation (content can target hardware too)
  const allHardwareSlugs = new Set<string>();
  for (const file of hardwareFiles) {
    allHardwareSlugs.add(path.basename(file, path.extname(file)));
  }

  // Collect software IDs and supersedes relationships
  for (const file of softwareFiles) {
    const slug = path.basename(file, path.extname(file));
    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = parseYaml(content) as { id?: string; supersedes?: string };
      if (data.id) {
        softwareIds.add(data.id);
        softwareIdToSlug.set(data.id, slug);
        if (data.supersedes) {
          softwareSupersedesMap.set(data.id, data.supersedes);
        }
      }
    } catch {
      // Ignore parse errors - they're caught later
    }
  }

  // Collect content IDs and supersedes relationships
  for (const file of contentFiles) {
    const slug = path.basename(file, path.extname(file));
    try {
      const rawContent = fs.readFileSync(file, "utf-8");
      const data = parseYaml(rawContent) as { id?: string; supersedes?: string };
      if (data.id) {
        contentIds.add(data.id);
        contentIdToSlug.set(data.id, slug);
        if (data.supersedes) {
          contentSupersedesMap.set(data.id, data.supersedes);
        }
      }
    } catch {
      // Ignore parse errors - they're caught later
    }
  }

  // Collect hardware IDs and supersedes relationships
  for (const file of hardwareFiles) {
    const slug = path.basename(file, path.extname(file));
    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = parseYaml(content) as { id?: string; supersedes?: string };
      if (data.id) {
        hardwareIds.add(data.id);
        hardwareIdToSlug.set(data.id, slug);
        if (data.supersedes) {
          hardwareSupersedesMap.set(data.id, data.supersedes);
        }
      }
    } catch {
      // Ignore parse errors - they're caught later
    }
  }

  // Collect accessory IDs and supersedes relationships
  for (const file of accessoryFiles) {
    const slug = path.basename(file, path.extname(file));
    try {
      const rawContent = fs.readFileSync(file, "utf-8");
      const data = parseYaml(rawContent) as { id?: string; supersedes?: string };
      if (data.id) {
        accessoryIds.add(data.id);
        accessoryIdToSlug.set(data.id, slug);
        if (data.supersedes) {
          accessorySupersedesMap.set(data.id, data.supersedes);
        }
      }
    } catch {
      // Ignore parse errors - they're caught later
    }
  }

  // Validate manufacturers
  for (const file of manufacturerFiles) {
    const error = validateFile(file, ManufacturerSchema, allManufacturers);
    if (error) {
      errors.push(error);
    } else {
      stats.manufacturers++;
    }
  }

  // Validate software (supersedes must reference valid software ID)
  for (const file of softwareFiles) {
    const error = validateFile(file, SoftwareSchema, allManufacturers, softwareIds);
    if (error) {
      errors.push(error);
    } else {
      stats.software++;
      // Collect advisory warnings for valid files
      try {
        const { data, document, lineCounter } = loadYamlFileWithPositions(file);
        const w = collectWarnings(
          file,
          data as WarningContext,
          document,
          lineCounter,
          allSoftwareSlugs,
          allHardwareSlugs,
          manufacturerUrlMap,
          manufacturerNameMap,
          SoftwareSchema
        );
        if (w) warnings.push(w);
      } catch {
        // Ignore parse errors - they're caught by YAML validation
      }
    }
  }

  // Validate content (supersedes must reference valid content ID)
  for (const file of contentFiles) {
    const error = validateFile(file, ContentSchema, allManufacturers, contentIds);
    if (error) {
      errors.push(error);
    } else {
      stats.content++;
      // Collect advisory warnings for valid files (compatibleWith checks against software and hardware slugs)
      try {
        const { data, document, lineCounter } = loadYamlFileWithPositions(file);
        const w = collectWarnings(
          file,
          data as WarningContext,
          document,
          lineCounter,
          allSoftwareSlugs,
          allHardwareSlugs,
          manufacturerUrlMap,
          manufacturerNameMap,
          ContentSchema
        );
        if (w) warnings.push(w);
      } catch {
        // Ignore parse errors - they're caught by YAML validation
      }
    }
  }

  // Validate hardware (supersedes must reference valid hardware ID)
  for (const file of hardwareFiles) {
    const error = validateFile(file, HardwareSchema, allManufacturers, hardwareIds);
    if (error) {
      errors.push(error);
    } else {
      stats.hardware++;
      // Collect advisory warnings for valid files
      try {
        const { data, document, lineCounter } = loadYamlFileWithPositions(file);
        const w = collectWarnings(
          file,
          data as WarningContext,
          document,
          lineCounter,
          undefined,
          allHardwareSlugs,
          manufacturerUrlMap,
          undefined,
          HardwareSchema
        );
        if (w) warnings.push(w);
      } catch {
        // Ignore parse errors - they're caught by YAML validation
      }
    }
  }

  // Validate accessories (supersedes must reference valid accessory ID)
  for (const file of accessoryFiles) {
    const error = validateFile(file, AccessorySchema, allManufacturers, accessoryIds);
    if (error) {
      errors.push(error);
    } else {
      stats.accessories++;
      // Collect advisory warnings for valid files
      try {
        const { data, document, lineCounter } = loadYamlFileWithPositions(file);
        const w = collectWarnings(
          file,
          data as WarningContext,
          document,
          lineCounter,
          undefined,
          allHardwareSlugs,
          manufacturerUrlMap,
          undefined,
          AccessorySchema
        );
        if (w) warnings.push(w);
      } catch {
        // Ignore parse errors - they're caught by YAML validation
      }
    }
  }

  // Check for cycles in supersedes chains (software)
  for (const [id, _supersedes] of softwareSupersedesMap) {
    const cycle = detectSupersedeCycle(id, softwareSupersedesMap, softwareIdToSlug);
    if (cycle) {
      const slug = softwareIdToSlug.get(id) || id;
      errors.push({
        file: `data/software/${slug}.yaml`,
        errors: [`supersedes: Cycle detected in supersedes chain: ${cycle.join(" → ")}`],
        details: [
          {
            code: ValidationErrorCode.E199_VALIDATION_ERROR,
            message: `Cycle detected in supersedes chain: ${cycle.join(" → ")}`,
            path: "supersedes",
            docsUrl: getDocsUrl(ValidationErrorCode.E199_VALIDATION_ERROR),
          },
        ],
      });
    }
  }

  // Check for cycles in supersedes chains (content)
  for (const [id, _supersedes] of contentSupersedesMap) {
    const cycle = detectSupersedeCycle(id, contentSupersedesMap, contentIdToSlug);
    if (cycle) {
      const slug = contentIdToSlug.get(id) || id;
      errors.push({
        file: `data/content/${slug}.yaml`,
        errors: [`supersedes: Cycle detected in supersedes chain: ${cycle.join(" → ")}`],
        details: [
          {
            code: ValidationErrorCode.E199_VALIDATION_ERROR,
            message: `Cycle detected in supersedes chain: ${cycle.join(" → ")}`,
            path: "supersedes",
            docsUrl: getDocsUrl(ValidationErrorCode.E199_VALIDATION_ERROR),
          },
        ],
      });
    }
  }

  // Check for cycles in supersedes chains (hardware)
  for (const [id, _supersedes] of hardwareSupersedesMap) {
    const cycle = detectSupersedeCycle(id, hardwareSupersedesMap, hardwareIdToSlug);
    if (cycle) {
      const slug = hardwareIdToSlug.get(id) || id;
      errors.push({
        file: `data/hardware/${slug}.yaml`,
        errors: [`supersedes: Cycle detected in supersedes chain: ${cycle.join(" → ")}`],
        details: [
          {
            code: ValidationErrorCode.E199_VALIDATION_ERROR,
            message: `Cycle detected in supersedes chain: ${cycle.join(" → ")}`,
            path: "supersedes",
            docsUrl: getDocsUrl(ValidationErrorCode.E199_VALIDATION_ERROR),
          },
        ],
      });
    }
  }

  // Check for cycles in supersedes chains (accessories)
  for (const [id, _supersedes] of accessorySupersedesMap) {
    const cycle = detectSupersedeCycle(id, accessorySupersedesMap, accessoryIdToSlug);
    if (cycle) {
      const slug = accessoryIdToSlug.get(id) || id;
      errors.push({
        file: `data/accessories/${slug}.yaml`,
        errors: [`supersedes: Cycle detected in supersedes chain: ${cycle.join(" → ")}`],
        details: [
          {
            code: ValidationErrorCode.E199_VALIDATION_ERROR,
            message: `Cycle detected in supersedes chain: ${cycle.join(" → ")}`,
            path: "supersedes",
            docsUrl: getDocsUrl(ValidationErrorCode.E199_VALIDATION_ERROR),
          },
        ],
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

// =============================================================================
// ID VALIDATION
// =============================================================================

interface IdValidationResult {
  valid: boolean;
  errors: string[];
  stats: {
    withIds: number;
    withoutIds: number;
    duplicates: number;
  };
}

function validateIds(): IdValidationResult {
  const errors: string[] = [];
  const stats = {
    withIds: 0,
    withoutIds: 0,
    duplicates: 0,
  };

  const collections: Collection[] = [
    "manufacturers",
    "software",
    "content",
    "hardware",
    "accessories",
  ];

  for (const collection of collections) {
    const files = getYamlFiles(path.join(DATA_DIR, collection));
    const seenIds = new Map<string, string>(); // id -> slug

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const data = parseYaml(content) as { id?: unknown };
        const slug = path.basename(file, path.extname(file));

        if (data.id !== undefined) {
          // Validate ID is a non-empty string
          if (typeof data.id !== "string" || data.id.length === 0) {
            errors.push(
              `${collection}/${slug}: id must be a non-empty string, got ${JSON.stringify(data.id)}`
            );
            continue;
          }

          // Check for duplicates
          if (seenIds.has(data.id)) {
            errors.push(
              `${collection}: duplicate id '${data.id}' in '${seenIds.get(data.id)}' and '${slug}'`
            );
            stats.duplicates++;
          }
          seenIds.set(data.id, slug);
          stats.withIds++;
        } else {
          stats.withoutIds++;
        }
      } catch {
        // Ignore parse errors - they're caught by YAML validation
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats,
  };
}

// =============================================================================
// OUTPUT FUNCTIONS
// =============================================================================

function writeGitHubSummary(result: ValidationResult): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const total =
    result.stats.manufacturers +
    result.stats.software +
    result.stats.content +
    result.stats.hardware +
    result.stats.accessories;

  let summary = "";

  if (result.valid) {
    summary += `## ✅ Validation Passed\n\n`;
    summary += `All files validated successfully!\n\n`;
  } else {
    summary += `## ❌ Validation Failed\n\n`;
    summary += `Found ${result.errors.length} file(s) with errors:\n\n`;

    for (const error of result.errors) {
      summary += `### \`${error.file}\`\n\n`;
      for (const msg of error.errors) {
        summary += `- ${msg}\n`;
      }
      summary += "\n";
    }
  }

  // Advisory warnings section
  if (result.warnings.length > 0) {
    const totalWarnings = result.warnings.reduce((sum, w) => sum + w.warnings.length, 0);
    summary += `## ⚠️ Warnings (non-blocking)\n\n`;
    summary += `Found ${totalWarnings} warning(s) in ${result.warnings.length} file(s):\n\n`;
    for (const fileWarning of result.warnings) {
      summary += `### \`${fileWarning.file}\`\n\n`;
      for (const w of fileWarning.warnings) {
        summary += `- ${w.code}: ${w.message}\n`;
      }
      summary += "\n";
    }
  }

  summary += `## 📊 Catalog Stats\n\n`;
  summary += `| Type | Count |\n`;
  summary += `|------|-------|\n`;
  summary += `| Manufacturers | ${result.stats.manufacturers} |\n`;
  summary += `| Software | ${result.stats.software} |\n`;
  summary += `| Content | ${result.stats.content} |\n`;
  summary += `| Hardware | ${result.stats.hardware} |\n`;
  summary += `| Accessories | ${result.stats.accessories} |\n`;
  summary += `| **Total** | **${total}** |\n`;

  fs.appendFileSync(summaryPath, summary);
}

function writeConsoleOutput(result: ValidationResult): void {
  console.log("\n📋 Catalog Validation Results\n");
  console.log("─".repeat(70));

  if (result.valid) {
    console.log("✅ All files validated successfully!\n");
  } else {
    console.log("❌ Validation failed!\n");
    for (const error of result.errors) {
      // Use enhanced output if details are available
      if (error.details && error.details.length > 0) {
        console.log(`\n📄 ${error.file}`);
        for (const detail of error.details) {
          const lineInfo = detail.line ? `:${detail.line}` : "";
          const codeStr = detail.code ? `${detail.code}` : "";
          console.log(`   ${codeStr}${lineInfo}: ${detail.message}`);
          console.log(`         Path: ${detail.path}`);
          if (detail.docsUrl) {
            console.log(`         Docs: ${detail.docsUrl}`);
          }
        }
      } else {
        // Fallback to simple output
        console.log(`\n📄 ${error.file}`);
        for (const msg of error.errors) {
          console.log(`   ⚠️  ${msg}`);
        }
      }
    }
    console.log();
  }

  // Display advisory warnings (non-blocking)
  if (result.warnings.length > 0) {
    const totalWarnings = result.warnings.reduce((sum, w) => sum + w.warnings.length, 0);
    console.log("─".repeat(70));
    console.log(
      `\n⚠️  Warnings (non-blocking): ${totalWarnings} warning(s) in ${result.warnings.length} file(s)\n`
    );
    for (const fileWarning of result.warnings) {
      console.log(`📄 ${fileWarning.file}`);
      for (const w of fileWarning.warnings) {
        const lineInfo = w.line ? `:${w.line}` : "";
        console.log(`   ${w.code}${lineInfo}: ${w.message}`);
      }
    }
    console.log();
  }

  console.log("─".repeat(70));
  console.log("📊 Stats:");
  console.log(`   Manufacturers: ${result.stats.manufacturers}`);
  console.log(`   Software:      ${result.stats.software}`);
  console.log(`   Content:       ${result.stats.content}`);
  console.log(`   Hardware:      ${result.stats.hardware}`);
  console.log(`   Accessories:   ${result.stats.accessories}`);
  console.log(
    `   Total:         ${result.stats.manufacturers + result.stats.software + result.stats.content + result.stats.hardware + result.stats.accessories}`
  );
  console.log();
}

// =============================================================================
// SCOPED VALIDATION (--files)
// =============================================================================

const COLLECTION_SCHEMAS: Record<string, z.ZodType> = {
  manufacturers: ManufacturerSchema,
  software: SoftwareSchema,
  content: ContentSchema,
  hardware: HardwareSchema,
  accessories: AccessorySchema,
};

/**
 * Validate only the named files, for the edit-fix loop during an import.
 *
 * This is a pre-flight, not a replacement for the full run. Per-file rules
 * (schema shape, enums, io, name hygiene) are identical, and manufacturer
 * references still resolve because manufacturer slugs come from filenames
 * rather than file contents. What it cannot see is anything cross-file:
 * duplicate IDs, supersedes targets, and supersedes cycles. The full
 * `pnpm validate` still runs in the pre-commit hook and in CI, so nothing
 * reaches main unchecked.
 */
function validateScoped(paths: string[]): number {
  const allManufacturers = new Set(
    getYamlFiles(path.join(DATA_DIR, "manufacturers")).map((file) =>
      path.basename(file, path.extname(file))
    )
  );

  const errors: ValidationError[] = [];
  let checked = 0;

  for (const given of paths) {
    const file = path.resolve(process.cwd(), given);
    if (!fs.existsSync(file)) {
      console.error(`❌ No such file: ${given}`);
      return 1;
    }
    // JSON is valid YAML, so without this a stray .json inside a collection
    // directory would parse, validate and exit 0 — reporting success for a
    // file the catalog never reads.
    if (!/\.ya?ml$/.test(file)) {
      console.error(`❌ Not YAML (this mode only validates .yaml/.yml): ${given}`);
      return 1;
    }
    const collection = path.basename(path.dirname(file));
    const schema = COLLECTION_SCHEMAS[collection];
    if (!schema) {
      console.error(
        `❌ ${given} is not inside a known collection ` +
          `(${Object.keys(COLLECTION_SCHEMAS).join(", ")}).`
      );
      return 1;
    }
    // No validSupersedesIds: the id set is a cross-file fact this mode
    // deliberately does not build, and validateFile skips the check.
    const error = validateFile(file, schema, allManufacturers);
    if (error) errors.push(error);
    checked += 1;
  }

  // Deliberately not writeConsoleOutput: its Stats block reports whole-catalog
  // counts, which would read as an empty catalog here.
  console.log(`\n📋 Scoped validation — ${checked} file(s)\n`);
  console.log("─".repeat(70));
  if (errors.length === 0) {
    console.log("✅ No errors in the checked files.\n");
  } else {
    console.log("❌ Validation failed!\n");
    for (const error of errors) {
      console.log(`\n📄 ${error.file}`);
      if (error.details && error.details.length > 0) {
        for (const detail of error.details) {
          const lineInfo = detail.line ? `:${detail.line}` : "";
          console.log(`   ${detail.code ?? ""}${lineInfo}: ${detail.message}`);
          console.log(`         Path: ${detail.path}`);
          if (detail.docsUrl) console.log(`         Docs: ${detail.docsUrl}`);
        }
      } else {
        for (const msg of error.errors) console.log(`   ⚠️  ${msg}`);
      }
    }
    console.log();
  }
  console.log("─".repeat(70));
  console.log(
    "Cross-file checks (duplicate IDs, supersedes targets and cycles) are skipped.\n" +
      "Run 'pnpm validate' before committing."
  );
  console.log();
  return errors.length === 0 ? 0 : 1;
}

// =============================================================================
// MAIN
// =============================================================================

const filesFlagIndex = process.argv.indexOf("--files");
if (filesFlagIndex !== -1) {
  const scopedPaths = process.argv.slice(filesFlagIndex + 1).filter((arg) => !arg.startsWith("-"));
  if (scopedPaths.length === 0) {
    console.error("❌ --files needs at least one path.");
    process.exit(1);
  }
  process.exit(validateScoped(scopedPaths));
}

const result = validate();
const idResult = validateIds();

writeConsoleOutput(result);

// Output ID validation results
console.log("─".repeat(50));
console.log("🔢 ID Validation:");
if (idResult.valid) {
  console.log("   ✅ No duplicate or invalid IDs");
} else {
  console.log("   ❌ ID validation errors:");
  for (const error of idResult.errors) {
    console.log(`      ⚠️  ${error}`);
  }
}
console.log(`   Entries with IDs:    ${idResult.stats.withIds}`);
console.log(`   Entries without IDs: ${idResult.stats.withoutIds}`);
if (idResult.stats.withoutIds > 0) {
  console.log(`   (Run 'pnpm assign-ids' to assign IDs to new entries)`);
}
console.log();

writeGitHubSummary(result);

const isValid = result.valid && idResult.valid;
process.exit(isValid ? 0 : 1);

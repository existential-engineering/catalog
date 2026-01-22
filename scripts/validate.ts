/**
 * YAML Validation Script
 *
 * Validates all YAML files in the data/ directory against schemas.
 * Run with: pnpm validate
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { marked } from "marked";

import type {
  CategoriesSchema,
  CategoryAliasesSchema,
  FormatsSchema,
  PlatformsSchema,
  ValidationError,
  ValidationResult,
} from "./lib/types.js";
import {
  DATA_DIR,
  SCHEMA_DIR,
  loadYamlFile,
  getYamlFiles,
  findClosestMatch,
  formatValidOptions,
} from "./lib/utils.js";
import type { Collection } from "./lib/types.js";

// =============================================================================
// LOAD CANONICAL SCHEMAS
// =============================================================================

const categoriesSchema = loadYamlFile<CategoriesSchema>(
  path.join(SCHEMA_DIR, "categories.yaml")
);
const categoryAliasesSchema = loadYamlFile<CategoryAliasesSchema>(
  path.join(SCHEMA_DIR, "category-aliases.yaml")
);
const formatsSchema = loadYamlFile<FormatsSchema>(
  path.join(SCHEMA_DIR, "formats.yaml")
);
const platformsSchema = loadYamlFile<PlatformsSchema>(
  path.join(SCHEMA_DIR, "platforms.yaml")
);

// Canonical categories
const VALID_CATEGORIES = new Set(categoriesSchema.categories);

// Map of alias -> canonical category
const CATEGORY_ALIASES = new Map<string, string>(
  Object.entries(categoryAliasesSchema.aliases)
);

// All valid category inputs (canonical + aliases)
const ALL_VALID_CATEGORY_INPUTS = new Set([
  ...categoriesSchema.categories,
  ...Object.keys(categoryAliasesSchema.aliases),
]);

const VALID_FORMATS = new Set(formatsSchema.formats);
const VALID_PLATFORMS = new Set(platformsSchema.platforms);

// Helper to check if a category is valid (canonical or alias)
function isValidCategory(cat: string): boolean {
  return ALL_VALID_CATEGORY_INPUTS.has(cat);
}

// Configure marked for validation
marked.setOptions({
  gfm: true,
  breaks: false,
});

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

// Zod schema for markdown content validation
const MarkdownSchema = z
  .string()
  .optional()
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
  currency: z.string(),
});

const LinkSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  url: z.string().url().optional(),
  videoId: z.string().optional(),
  provider: z.string().optional(),
  description: z.string().optional(),
});

const VersionSchema = z.object({
  name: z.string(),
  releaseDate: z.string().optional(),
  preRelease: z.boolean().optional(),
  unofficial: z.boolean().optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
  prices: z.array(PriceSchema).optional(),
  links: z.array(LinkSchema).optional(),
});

const IOSchema = z.object({
  name: z.string(),
  signalFlow: z.string(),
  category: z.string(),
  type: z.string(),
  connection: z.string(),
  maxConnections: z.number().optional(),
  position: z.string().optional(),
  columnPosition: z.number().optional(),
  rowPosition: z.number().optional(),
  description: z.string().optional(),
});

const RevisionSchema = z.object({
  name: z.string(),
  releaseDate: z.string().optional(),
  url: z.string().url().optional(),
  description: z.string().optional(),
  io: z.array(IOSchema).optional(),
  versions: z.array(VersionSchema).optional(),
  prices: z.array(PriceSchema).optional(),
  links: z.array(LinkSchema).optional(),
});

const ImageSchema = z.object({
  source: z.string().url(),
  alt: z.string().optional(),
});

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

// =============================================================================
// COLLECTION ZOD SCHEMAS
// =============================================================================

const ManufacturerSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  companyName: z.string().optional(),
  parentCompany: z.string().optional(),
  website: z.string().url().optional(),
  description: MarkdownSchema,
  searchTerms: z.array(z.string()).optional(),
  images: z.array(ImageSchema).optional(),
});

const SoftwareSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
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
  website: z.string().url().optional(),
  releaseDate: z.string().optional(),
  primaryCategory: createCategoryValidator().optional(),
  secondaryCategory: createCategoryValidator().optional(),
  searchTerms: z.array(z.string()).optional(),
  description: MarkdownSchema,
  details: MarkdownSchema,
  specs: MarkdownSchema,
  versions: z.array(VersionSchema).optional(),
  prices: z.array(PriceSchema).optional(),
  links: z.array(LinkSchema).optional(),
  images: z.array(ImageSchema).optional(),
});

const HardwareSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
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
  website: z.string().url().optional(),
  releaseDate: z.string().optional(),
  primaryCategory: createCategoryValidator().optional(),
  secondaryCategory: createCategoryValidator().optional(),
  searchTerms: z.array(z.string()).optional(),
  description: MarkdownSchema,
  details: MarkdownSchema,
  specs: MarkdownSchema,
  io: z.array(IOSchema).optional(),
  versions: z.array(VersionSchema).optional(),
  revisions: z.array(RevisionSchema).optional(),
  prices: z.array(PriceSchema).optional(),
  links: z.array(LinkSchema).optional(),
  images: z.array(ImageSchema).optional(),
});

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateFile(
  filePath: string,
  schema: z.ZodType,
  allManufacturers: Set<string>
): ValidationError | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = parseYaml(content);

    // Validate against Zod schema
    const result = schema.safeParse(data);

    if (!result.success) {
      return {
        file: path.relative(process.cwd(), filePath),
        errors: result.error.issues.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        ),
      };
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
        return {
          file: path.relative(process.cwd(), filePath),
          errors: [`manufacturer: ${message}`],
        };
      }
    }

    // Check slug matches filename
    const expectedSlug = path.basename(filePath, path.extname(filePath));
    if (data.slug !== expectedSlug) {
      return {
        file: path.relative(process.cwd(), filePath),
        errors: [
          `slug: Slug '${data.slug}' does not match filename. Expected '${expectedSlug}'`,
        ],
      };
    }

    // Check for duplicate categories
    if (Array.isArray(data.categories)) {
      const categoryErrors: string[] = [];

      // Check if primaryCategory is duplicated in categories array
      if (data.primaryCategory && data.categories.includes(data.primaryCategory)) {
        categoryErrors.push(
          `categories: primaryCategory '${data.primaryCategory}' should not be duplicated in categories array`
        );
      }

      // Check if secondaryCategory is duplicated in categories array
      if (data.secondaryCategory && data.categories.includes(data.secondaryCategory)) {
        categoryErrors.push(
          `categories: secondaryCategory '${data.secondaryCategory}' should not be duplicated in categories array`
        );
      }

      // Check for duplicates within the categories array itself
      const seen = new Set<string>();
      for (const cat of data.categories) {
        if (seen.has(cat)) {
          categoryErrors.push(`categories: duplicate category '${cat}' in array`);
        }
        seen.add(cat);
      }

      if (categoryErrors.length > 0) {
        return {
          file: path.relative(process.cwd(), filePath),
          errors: categoryErrors,
        };
      }
    }

    return null;
  } catch (error) {
    return {
      file: path.relative(process.cwd(), filePath),
      errors: [
        `Parse error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

function validate(): ValidationResult {
  const errors: ValidationError[] = [];
  const stats = { manufacturers: 0, software: 0, hardware: 0 };

  // First pass: collect all manufacturer slugs
  const manufacturerFiles = getYamlFiles(path.join(DATA_DIR, "manufacturers"));
  const allManufacturers = new Set<string>();

  for (const file of manufacturerFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = parseYaml(content) as { slug?: string };
      if (data.slug) {
        allManufacturers.add(data.slug);
      }
    } catch {
      // Will be caught in validation pass
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

  // Validate software
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  for (const file of softwareFiles) {
    const error = validateFile(file, SoftwareSchema, allManufacturers);
    if (error) {
      errors.push(error);
    } else {
      stats.software++;
    }
  }

  // Validate hardware
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  for (const file of hardwareFiles) {
    const error = validateFile(file, HardwareSchema, allManufacturers);
    if (error) {
      errors.push(error);
    } else {
      stats.hardware++;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
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

  const collections: Collection[] = ["manufacturers", "software", "hardware"];

  for (const collection of collections) {
    const files = getYamlFiles(path.join(DATA_DIR, collection));
    const seenIds = new Map<number, string>(); // id -> slug

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const data = parseYaml(content) as { id?: unknown; slug?: string };
        const slug = data.slug ?? path.basename(file, path.extname(file));

        if (data.id !== undefined) {
          // Validate ID is a positive integer
          if (typeof data.id !== "number" || !Number.isInteger(data.id) || data.id < 1) {
            errors.push(`${collection}/${slug}: id must be a positive integer, got ${JSON.stringify(data.id)}`);
            continue;
          }

          // Check for duplicates
          if (seenIds.has(data.id)) {
            errors.push(`${collection}: duplicate id ${data.id} in '${seenIds.get(data.id)}' and '${slug}'`);
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
    result.stats.hardware;

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

  summary += `## 📊 Catalog Stats\n\n`;
  summary += `| Type | Count |\n`;
  summary += `|------|-------|\n`;
  summary += `| Manufacturers | ${result.stats.manufacturers} |\n`;
  summary += `| Software | ${result.stats.software} |\n`;
  summary += `| Hardware | ${result.stats.hardware} |\n`;
  summary += `| **Total** | **${total}** |\n`;

  fs.appendFileSync(summaryPath, summary);
}

function writeConsoleOutput(result: ValidationResult): void {
  console.log("\n📋 Catalog Validation Results\n");
  console.log("─".repeat(50));

  if (result.valid) {
    console.log("✅ All files validated successfully!\n");
  } else {
    console.log("❌ Validation failed!\n");
    for (const error of result.errors) {
      console.log(`\n📄 ${error.file}`);
      for (const msg of error.errors) {
        console.log(`   ⚠️  ${msg}`);
      }
    }
    console.log();
  }

  console.log("─".repeat(50));
  console.log("📊 Stats:");
  console.log(`   Manufacturers: ${result.stats.manufacturers}`);
  console.log(`   Software:      ${result.stats.software}`);
  console.log(`   Hardware:      ${result.stats.hardware}`);
  console.log(
    `   Total:         ${result.stats.manufacturers + result.stats.software + result.stats.hardware}`
  );
  console.log();
}

// =============================================================================
// MAIN
// =============================================================================

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



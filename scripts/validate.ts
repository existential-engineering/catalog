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

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
const SCHEMA_DIR = path.join(import.meta.dirname, "..", "schema");

// =============================================================================
// LOAD CANONICAL SCHEMAS
// =============================================================================

function loadYamlFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseYaml(content) as T;
}

const categoriesSchema = loadYamlFile<{ categories: string[] }>(
  path.join(SCHEMA_DIR, "categories.yaml")
);
const formatsSchema = loadYamlFile<{ formats: string[] }>(
  path.join(SCHEMA_DIR, "formats.yaml")
);
const platformsSchema = loadYamlFile<{ platforms: string[] }>(
  path.join(SCHEMA_DIR, "platforms.yaml")
);
const typesSchema = loadYamlFile<{ types: string[] }>(
  path.join(SCHEMA_DIR, "software-types.yaml")
);

const VALID_CATEGORIES = new Set(categoriesSchema.categories);
const VALID_FORMATS = new Set(formatsSchema.formats);
const VALID_PLATFORMS = new Set(platformsSchema.platforms);
const VALID_TYPES = new Set(typesSchema.types);

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

const ManufacturerSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  website: z.string().url().optional(),
});

const SoftwareSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  manufacturer: z.string().min(1, "Manufacturer reference is required"),
  type: z.string().refine((t) => VALID_TYPES.has(t), {
    message: `Type must be one of: ${[...VALID_TYPES].join(", ")}`,
  }),
  categories: z
    .array(z.string())
    .min(1, "At least one category is required")
    .refine((cats) => cats.every((c) => VALID_CATEGORIES.has(c)), {
      message: `Categories must be from the canonical list`,
    }),
  formats: z
    .array(z.string())
    .optional()
    .refine((fmts) => !fmts || fmts.every((f) => VALID_FORMATS.has(f)), {
      message: `Formats must be from the canonical list`,
    }),
  platforms: z
    .array(z.string())
    .optional()
    .refine((plats) => !plats || plats.every((p) => VALID_PLATFORMS.has(p)), {
      message: `Platforms must be from the canonical list`,
    }),
  identifiers: z.record(z.string()).optional(),
  website: z.string().url().optional(),
  description: z.string().optional(),
});

const DawSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  manufacturer: z.string().min(1, "Manufacturer reference is required"),
  bundleIdentifier: z.string().optional(),
  platforms: z
    .array(z.string())
    .optional()
    .refine((plats) => !plats || plats.every((p) => VALID_PLATFORMS.has(p)), {
      message: `Platforms must be from the canonical list`,
    }),
  website: z.string().url().optional(),
});

const HardwareSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Name is required"),
  manufacturer: z.string().min(1, "Manufacturer reference is required"),
  type: z.string().optional(),
  website: z.string().url().optional(),
});

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

interface ValidationError {
  file: string;
  errors: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stats: {
    manufacturers: number;
    software: number;
    daws: number;
    hardware: number;
  };
}

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

function validateFile(
  filePath: string,
  schema: z.ZodSchema,
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
        errors: result.error.errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        ),
      };
    }

    // Check manufacturer reference exists
    if ("manufacturer" in data && typeof data.manufacturer === "string") {
      if (!allManufacturers.has(data.manufacturer)) {
        return {
          file: path.relative(process.cwd(), filePath),
          errors: [
            `manufacturer: Referenced manufacturer '${data.manufacturer}' does not exist`,
          ],
        };
      }
    }

    // Check slug matches filename
    const expectedSlug = path.basename(filePath, path.extname(filePath));
    if (data.slug !== expectedSlug) {
      return {
        file: path.relative(process.cwd(), filePath),
        errors: [
          `slug: Slug '${data.slug}' does not match filename '${expectedSlug}'`,
        ],
      };
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
  const stats = { manufacturers: 0, software: 0, daws: 0, hardware: 0 };

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

  // Validate DAWs
  const dawFiles = getYamlFiles(path.join(DATA_DIR, "daws"));
  for (const file of dawFiles) {
    const error = validateFile(file, DawSchema, allManufacturers);
    if (error) {
      errors.push(error);
    } else {
      stats.daws++;
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
// MAIN
// =============================================================================

const result = validate();

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
console.log(`   DAWs:          ${result.stats.daws}`);
console.log(`   Hardware:      ${result.stats.hardware}`);
console.log(
  `   Total:         ${result.stats.manufacturers + result.stats.software + result.stats.daws + result.stats.hardware}`
);
console.log();

process.exit(result.valid ? 0 : 1);


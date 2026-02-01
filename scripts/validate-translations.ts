/**
 * Translation Validation Script
 *
 * Validates all translations in YAML files against approved locales.
 * Run with: pnpm validate:translations
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type {
  ContentTranslation,
  Hardware,
  IOTranslation,
  LocalesSchema,
  Manufacturer,
  Software,
} from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, SCHEMA_DIR } from "./lib/utils.js";

// =============================================================================
// LOAD APPROVED LOCALES
// =============================================================================

const localesSchema = loadYamlFile<LocalesSchema>(path.join(SCHEMA_DIR, "locales.yaml"));
const APPROVED_LOCALES = new Set(localesSchema.locales.map((l) => l.code));

// =============================================================================
// TYPES
// =============================================================================

interface TranslationError {
  file: string;
  errors: string[];
}

interface TranslationValidationResult {
  valid: boolean;
  errors: TranslationError[];
  stats: {
    filesWithTranslations: number;
    totalTranslations: number;
    localesUsed: Set<string>;
  };
}

// Valid translation fields for each entity type
const VALID_MANUFACTURER_FIELDS = new Set(["description", "website"]);
const VALID_SOFTWARE_FIELDS = new Set(["description", "details", "specs", "website", "links"]);
const VALID_HARDWARE_FIELDS = new Set([
  "description",
  "details",
  "specs",
  "website",
  "links",
  "io",
]);

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateTranslationFields(
  trans: ContentTranslation,
  validFields: Set<string>,
  locale: string
): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(trans)) {
    if (!validFields.has(key)) {
      errors.push(
        `translations.${locale}: Invalid field '${key}'. Valid fields: ${[...validFields].join(", ")}`
      );
    }
  }
  return errors;
}

function validateIOTranslations(
  ioTranslations: IOTranslation[] | undefined,
  sourceIO: { name: string }[] | undefined,
  locale: string
): string[] {
  const errors: string[] = [];

  if (!ioTranslations) return errors;

  const sourceIONames = new Set(sourceIO?.map((io) => io.name) ?? []);

  for (const ioTrans of ioTranslations) {
    if (!ioTrans.originalName) {
      errors.push(`translations.${locale}.io: Missing 'originalName' field`);
      continue;
    }

    if (!sourceIONames.has(ioTrans.originalName)) {
      errors.push(
        `translations.${locale}.io: No I/O port found with name '${ioTrans.originalName}'. Available: ${[...sourceIONames].join(", ") || "(none)"}`
      );
    }
  }

  return errors;
}

function validateManufacturerTranslations(
  data: Manufacturer,
  filePath: string
): TranslationError | null {
  if (!data.translations) return null;

  const errors: string[] = [];

  for (const [locale, trans] of Object.entries(data.translations)) {
    if (!APPROVED_LOCALES.has(locale)) {
      errors.push(
        `translations.${locale}: Locale '${locale}' is not approved. Add it to schema/locales.yaml first. Approved: ${[...APPROVED_LOCALES].join(", ")}`
      );
      continue;
    }

    errors.push(...validateTranslationFields(trans, VALID_MANUFACTURER_FIELDS, locale));
  }

  return errors.length > 0 ? { file: path.relative(process.cwd(), filePath), errors } : null;
}

function validateSoftwareTranslations(data: Software, filePath: string): TranslationError | null {
  if (!data.translations) return null;

  const errors: string[] = [];

  for (const [locale, trans] of Object.entries(data.translations)) {
    if (!APPROVED_LOCALES.has(locale)) {
      errors.push(
        `translations.${locale}: Locale '${locale}' is not approved. Add it to schema/locales.yaml first. Approved: ${[...APPROVED_LOCALES].join(", ")}`
      );
      continue;
    }

    errors.push(...validateTranslationFields(trans, VALID_SOFTWARE_FIELDS, locale));
  }

  return errors.length > 0 ? { file: path.relative(process.cwd(), filePath), errors } : null;
}

function validateHardwareTranslations(data: Hardware, filePath: string): TranslationError | null {
  if (!data.translations) return null;

  const errors: string[] = [];

  for (const [locale, trans] of Object.entries(data.translations)) {
    if (!APPROVED_LOCALES.has(locale)) {
      errors.push(
        `translations.${locale}: Locale '${locale}' is not approved. Add it to schema/locales.yaml first. Approved: ${[...APPROVED_LOCALES].join(", ")}`
      );
      continue;
    }

    errors.push(...validateTranslationFields(trans, VALID_HARDWARE_FIELDS, locale));

    // Validate I/O translations reference existing I/O ports
    errors.push(...validateIOTranslations(trans.io, data.io, locale));
  }

  return errors.length > 0 ? { file: path.relative(process.cwd(), filePath), errors } : null;
}

function validateTranslations(): TranslationValidationResult {
  const errors: TranslationError[] = [];
  const stats = {
    filesWithTranslations: 0,
    totalTranslations: 0,
    localesUsed: new Set<string>(),
  };

  // Validate manufacturers
  const manufacturerFiles = getYamlFiles(path.join(DATA_DIR, "manufacturers"));
  for (const file of manufacturerFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = parseYaml(content) as Manufacturer;

      if (data.translations) {
        stats.filesWithTranslations++;
        for (const locale of Object.keys(data.translations)) {
          stats.totalTranslations++;
          stats.localesUsed.add(locale);
        }
      }

      const error = validateManufacturerTranslations(data, file);
      if (error) errors.push(error);
    } catch (err) {
      errors.push({
        file: path.relative(process.cwd(), file),
        errors: [`Parse error: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  // Validate software
  const softwareFiles = getYamlFiles(path.join(DATA_DIR, "software"));
  for (const file of softwareFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = parseYaml(content) as Software;

      if (data.translations) {
        stats.filesWithTranslations++;
        for (const locale of Object.keys(data.translations)) {
          stats.totalTranslations++;
          stats.localesUsed.add(locale);
        }
      }

      const error = validateSoftwareTranslations(data, file);
      if (error) errors.push(error);
    } catch (err) {
      errors.push({
        file: path.relative(process.cwd(), file),
        errors: [`Parse error: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  // Validate hardware
  const hardwareFiles = getYamlFiles(path.join(DATA_DIR, "hardware"));
  for (const file of hardwareFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const data = parseYaml(content) as Hardware;

      if (data.translations) {
        stats.filesWithTranslations++;
        for (const locale of Object.keys(data.translations)) {
          stats.totalTranslations++;
          stats.localesUsed.add(locale);
        }
      }

      const error = validateHardwareTranslations(data, file);
      if (error) errors.push(error);
    } catch (err) {
      errors.push({
        file: path.relative(process.cwd(), file),
        errors: [`Parse error: ${err instanceof Error ? err.message : String(err)}`],
      });
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

function writeGitHubSummary(result: TranslationValidationResult): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  let summary = "";

  if (result.valid) {
    summary += `## ✅ Translation Validation Passed\n\n`;
  } else {
    summary += `## ❌ Translation Validation Failed\n\n`;
    summary += `Found ${result.errors.length} file(s) with translation errors:\n\n`;

    for (const error of result.errors) {
      summary += `### \`${error.file}\`\n\n`;
      for (const msg of error.errors) {
        summary += `- ${msg}\n`;
      }
      summary += "\n";
    }
  }

  summary += `## 📊 Translation Stats\n\n`;
  summary += `| Metric | Value |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Files with translations | ${result.stats.filesWithTranslations} |\n`;
  summary += `| Total translations | ${result.stats.totalTranslations} |\n`;
  summary += `| Locales used | ${[...result.stats.localesUsed].join(", ") || "(none)"} |\n`;
  summary += `| Approved locales | ${[...APPROVED_LOCALES].join(", ")} |\n`;

  fs.appendFileSync(summaryPath, summary);
}

function writeConsoleOutput(result: TranslationValidationResult): void {
  console.log("\n🌐 Translation Validation Results\n");
  console.log("─".repeat(50));

  if (result.valid) {
    console.log("✅ All translations validated successfully!\n");
  } else {
    console.log("❌ Translation validation failed!\n");
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
  console.log(`   Files with translations: ${result.stats.filesWithTranslations}`);
  console.log(`   Total translations:      ${result.stats.totalTranslations}`);
  console.log(
    `   Locales used:            ${[...result.stats.localesUsed].join(", ") || "(none)"}`
  );
  console.log(`   Approved locales:        ${[...APPROVED_LOCALES].join(", ")}`);
  console.log();
}

// =============================================================================
// MAIN
// =============================================================================

const result = validateTranslations();

writeConsoleOutput(result);
writeGitHubSummary(result);

process.exit(result.valid ? 0 : 1);

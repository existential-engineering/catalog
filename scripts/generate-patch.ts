/**
 * Patch Generation Script
 *
 * Compares YAML changes since the last release and generates SQL patch files.
 * Run with: pnpm patch [from-version] [to-version]
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import type { Change, Hardware, Manufacturer, Software } from "./lib/types.js";
import { DATA_DIR, escapeSQL, OUTPUT_DIR } from "./lib/utils.js";

const PATCHES_DIR = path.join(OUTPUT_DIR, "patches");

// =============================================================================
// HELPERS
// =============================================================================

/** Build a map of manufacturer slug -> nanoid from all manufacturer YAML files */
function buildManufacturerIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  const dir = path.join(DATA_DIR, "manufacturers");
  if (!fs.existsSync(dir)) return map;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))) {
    const content = fs.readFileSync(path.join(dir, file), "utf-8");
    const data = parseYaml(content) as { id?: string };
    const slug = path.basename(file, path.extname(file));
    if (data.id) {
      map.set(slug, data.id);
    }
  }
  return map;
}

/** Get the nanoid of a deleted entry by reading it from git history */
function getDeletedEntryId(since: string, filePath: string): string | null {
  try {
    const content = execSync(`git show ${since}:${filePath}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const data = parseYaml(content) as { id?: string };
    return data.id ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// GIT HELPERS
// =============================================================================

function getLatestTag(): string | null {
  try {
    return execSync("git describe --tags --abbrev=0", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function getChangedFiles(since: string): Change[] {
  const changes: Change[] = [];

  try {
    // Get list of changed files
    const output = execSync(`git diff --name-status ${since} HEAD -- data/`, {
      encoding: "utf-8",
    });

    for (const line of output.split("\n").filter(Boolean)) {
      const [status, file] = line.split("\t");
      if (!file) continue;

      // Parse the category from path
      const parts = file.split("/");
      if (parts.length < 3) continue;

      const category = parts[1] as Change["category"];
      const filename = parts[2];
      const slug = filename.replace(/\.ya?ml$/, "");

      let type: Change["type"];
      switch (status) {
        case "A":
          type = "added";
          break;
        case "M":
          type = "modified";
          break;
        case "D":
          type = "deleted";
          break;
        default:
          continue;
      }

      changes.push({ type, category, file, slug });
    }
  } catch (error) {
    console.error("Failed to get git changes:", error);
  }

  return changes;
}

// =============================================================================
// SQL GENERATORS
// =============================================================================

function generateManufacturerSQL(
  change: Change,
  data: Manufacturer | null,
  deletedId: string | null
): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    if (!deletedId) {
      sql.push(`-- WARNING: Could not resolve ID for deleted manufacturer ${change.slug}`);
      return sql;
    }
    sql.push(`DELETE FROM manufacturers WHERE id = ${escapeSQL(deletedId)};`);
  } else if (change.type === "added" && data) {
    sql.push(
      `INSERT INTO manufacturers (id, name, company_name, parent_company, website, description, updated_at) VALUES (${escapeSQL(data.id)}, ${escapeSQL(data.name)}, ${escapeSQL(data.companyName)}, ${escapeSQL(data.parentCompany)}, ${escapeSQL(data.website)}, ${escapeSQL(data.description)}, datetime('now'));`
    );
  } else if (change.type === "modified" && data) {
    sql.push(
      `UPDATE manufacturers SET name = ${escapeSQL(data.name)}, company_name = ${escapeSQL(data.companyName)}, parent_company = ${escapeSQL(data.parentCompany)}, website = ${escapeSQL(data.website)}, description = ${escapeSQL(data.description)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.id)};`
    );
  }

  return sql;
}

function generateSoftwareSQL(
  change: Change,
  data: Software | null,
  deletedId: string | null,
  manufacturerIds: Map<string, string>
): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    if (!deletedId) {
      sql.push(`-- WARNING: Could not resolve ID for deleted software ${change.slug}`);
      return sql;
    }
    // Cascade deletes handle related tables
    sql.push(`DELETE FROM software_fts WHERE id = ${escapeSQL(deletedId)};`);
    sql.push(`DELETE FROM software WHERE id = ${escapeSQL(deletedId)};`);
  } else if (data) {
    const mfgId = manufacturerIds.get(data.manufacturer) ?? null;

    if (change.type === "modified") {
      // Delete existing related data first
      sql.push(`DELETE FROM software_categories WHERE software_id = ${escapeSQL(data.id)};`);
      sql.push(`DELETE FROM software_formats WHERE software_id = ${escapeSQL(data.id)};`);
      sql.push(`DELETE FROM software_platforms WHERE software_id = ${escapeSQL(data.id)};`);
      sql.push(`DELETE FROM software_fts WHERE id = ${escapeSQL(data.id)};`);
      sql.push(
        `UPDATE software SET name = ${escapeSQL(data.name)}, manufacturer_id = ${escapeSQL(mfgId)}, website = ${escapeSQL(data.website)}, description = ${escapeSQL(data.description)}, release_date = ${escapeSQL(data.releaseDate)}, primary_category = ${escapeSQL(data.primaryCategory)}, secondary_category = ${escapeSQL(data.secondaryCategory)}, details = ${escapeSQL(data.details)}, specs = ${escapeSQL(data.specs)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.id)};`
      );
    } else {
      sql.push(
        `INSERT INTO software (id, name, manufacturer_id, website, description, release_date, primary_category, secondary_category, details, specs, updated_at) VALUES (${escapeSQL(data.id)}, ${escapeSQL(data.name)}, ${escapeSQL(mfgId)}, ${escapeSQL(data.website)}, ${escapeSQL(data.description)}, ${escapeSQL(data.releaseDate)}, ${escapeSQL(data.primaryCategory)}, ${escapeSQL(data.secondaryCategory)}, ${escapeSQL(data.details)}, ${escapeSQL(data.specs)}, datetime('now'));`
      );
    }

    // Insert categories
    if (data.categories) {
      for (const category of data.categories) {
        sql.push(
          `INSERT INTO software_categories (software_id, category) VALUES (${escapeSQL(data.id)}, ${escapeSQL(category)});`
        );
      }
    }

    // Insert formats
    if (data.formats) {
      for (const format of data.formats) {
        const identifier = data.identifiers?.[format];
        sql.push(
          `INSERT INTO software_formats (software_id, format, identifier) VALUES (${escapeSQL(data.id)}, ${escapeSQL(format)}, ${escapeSQL(identifier)});`
        );
      }
    }

    // Insert platforms
    if (data.platforms) {
      for (const platform of data.platforms) {
        sql.push(
          `INSERT INTO software_platforms (software_id, platform) VALUES (${escapeSQL(data.id)}, ${escapeSQL(platform)});`
        );
      }
    }

    // Insert FTS
    sql.push(
      `INSERT INTO software_fts (id, name, manufacturer_name, categories) VALUES (${escapeSQL(data.id)}, ${escapeSQL(data.name)}, (SELECT name FROM manufacturers WHERE id = ${escapeSQL(mfgId)}), ${escapeSQL(data.categories?.join(" ") ?? "")});`
    );
  }

  return sql;
}

function generateHardwareSQL(
  change: Change,
  data: Hardware | null,
  deletedId: string | null,
  manufacturerIds: Map<string, string>
): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    if (!deletedId) {
      sql.push(`-- WARNING: Could not resolve ID for deleted hardware ${change.slug}`);
      return sql;
    }
    sql.push(`DELETE FROM hardware_fts WHERE id = ${escapeSQL(deletedId)};`);
    sql.push(`DELETE FROM hardware WHERE id = ${escapeSQL(deletedId)};`);
  } else if (data) {
    const mfgId = manufacturerIds.get(data.manufacturer) ?? null;

    if (change.type === "modified") {
      // Delete existing related data first
      sql.push(`DELETE FROM hardware_categories WHERE hardware_id = ${escapeSQL(data.id)};`);
      sql.push(`DELETE FROM hardware_fts WHERE id = ${escapeSQL(data.id)};`);
      sql.push(
        `UPDATE hardware SET name = ${escapeSQL(data.name)}, manufacturer_id = ${escapeSQL(mfgId)}, website = ${escapeSQL(data.website)}, description = ${escapeSQL(data.description)}, release_date = ${escapeSQL(data.releaseDate)}, primary_category = ${escapeSQL(data.primaryCategory)}, secondary_category = ${escapeSQL(data.secondaryCategory)}, details = ${escapeSQL(data.details)}, specs = ${escapeSQL(data.specs)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.id)};`
      );
    } else {
      sql.push(
        `INSERT INTO hardware (id, name, manufacturer_id, website, description, release_date, primary_category, secondary_category, details, specs, updated_at) VALUES (${escapeSQL(data.id)}, ${escapeSQL(data.name)}, ${escapeSQL(mfgId)}, ${escapeSQL(data.website)}, ${escapeSQL(data.description)}, ${escapeSQL(data.releaseDate)}, ${escapeSQL(data.primaryCategory)}, ${escapeSQL(data.secondaryCategory)}, ${escapeSQL(data.details)}, ${escapeSQL(data.specs)}, datetime('now'));`
      );
    }

    // Insert categories
    if (data.categories) {
      for (const category of data.categories) {
        sql.push(
          `INSERT INTO hardware_categories (hardware_id, category) VALUES (${escapeSQL(data.id)}, ${escapeSQL(category)});`
        );
      }
    }

    // Insert FTS
    const categories = data.categories?.join(" ") ?? "";
    sql.push(
      `INSERT INTO hardware_fts (id, name, manufacturer_name, description, categories) VALUES (${escapeSQL(data.id)}, ${escapeSQL(data.name)}, (SELECT name FROM manufacturers WHERE id = ${escapeSQL(mfgId)}), ${escapeSQL(data.description)}, ${escapeSQL(categories)});`
    );
  }

  return sql;
}

// =============================================================================
// MAIN
// =============================================================================

function generatePatch(fromTag: string, toVersion: string): void {
  const changes = getChangedFiles(fromTag);

  if (changes.length === 0) {
    console.log("No changes detected since last release.");
    return;
  }

  console.log(`\n📝 Generating patch ${fromTag} → ${toVersion}\n`);
  console.log(`   Found ${changes.length} changes\n`);

  // Build manufacturer slug -> nanoid map for FK resolution
  const manufacturerIds = buildManufacturerIdMap();

  const sql: string[] = [];

  // Add header
  sql.push(`-- Catalog patch: ${fromTag} → ${toVersion}`);
  sql.push(`-- Generated: ${new Date().toISOString()}`);
  sql.push(`-- Changes: ${changes.length}`);
  sql.push("");
  sql.push("BEGIN TRANSACTION;");
  sql.push("");

  // Process changes in order: manufacturers first (for foreign keys)
  const sortedChanges = [...changes].sort((a, b) => {
    const order = { manufacturers: 0, software: 1, hardware: 2 };
    return order[a.category] - order[b.category];
  });

  for (const change of sortedChanges) {
    sql.push(`-- ${change.type.toUpperCase()}: ${change.category}/${change.slug}`);

    // Load current data for non-deletions
    let data = null;
    if (change.type !== "deleted") {
      try {
        const filePath = path.join(DATA_DIR, change.category, `${change.slug}.yaml`);
        const content = fs.readFileSync(filePath, "utf-8");
        data = parseYaml(content);
      } catch {
        console.warn(`   ⚠️  Could not read file for ${change.slug}`);
        continue;
      }
    }

    // For deletions, resolve the nanoid from the base version
    const deletedId = change.type === "deleted" ? getDeletedEntryId(fromTag, change.file) : null;

    let statements: string[] = [];
    switch (change.category) {
      case "manufacturers":
        statements = generateManufacturerSQL(change, data as Manufacturer, deletedId);
        break;
      case "software":
        statements = generateSoftwareSQL(change, data as Software, deletedId, manufacturerIds);
        break;
      case "hardware":
        statements = generateHardwareSQL(change, data as Hardware, deletedId, manufacturerIds);
        break;
    }

    sql.push(...statements);
    sql.push("");
  }

  // Update version metadata
  sql.push("-- Update catalog version");
  sql.push(`UPDATE catalog_meta SET value = '${toVersion}' WHERE key = 'version';`);
  sql.push(`UPDATE catalog_meta SET value = datetime('now') WHERE key = 'updated_at';`);
  sql.push("");
  sql.push("COMMIT;");

  // Ensure output directory exists
  fs.mkdirSync(PATCHES_DIR, { recursive: true });

  // Write patch file
  const patchFile = path.join(PATCHES_DIR, `patch-${fromTag}-${toVersion}.sql`);
  fs.writeFileSync(patchFile, sql.join("\n"));

  const stats = fs.statSync(patchFile);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log(`✅ Patch generated!`);
  console.log(`   Output: ${patchFile}`);
  console.log(`   Size: ${sizeKB} KB`);
}

// Parse arguments
const fromArg = process.argv[2];
const toArg = process.argv[3];

if (fromArg && toArg) {
  // Explicit versions provided
  generatePatch(fromArg, toArg);
} else {
  // Auto-detect from latest tag
  const latestTag = getLatestTag();
  if (latestTag) {
    const toVersion = toArg ?? "next";
    generatePatch(latestTag, toVersion);
  } else {
    console.log("No previous release found. Build a baseline first with: pnpm build");
  }
}

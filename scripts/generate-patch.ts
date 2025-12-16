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

const DATA_DIR = path.join(import.meta.dirname, "..", "data");
const OUTPUT_DIR = path.join(import.meta.dirname, "..", "dist", "patches");

// =============================================================================
// TYPES
// =============================================================================

interface Change {
  type: "added" | "modified" | "deleted";
  category: "manufacturers" | "software" | "daws" | "hardware";
  file: string;
  slug: string;
}

interface Manufacturer {
  slug: string;
  name: string;
  website?: string;
}

interface Software {
  slug: string;
  name: string;
  manufacturer: string;
  type: string;
  categories: string[];
  formats?: string[];
  platforms?: string[];
  identifiers?: Record<string, string>;
  website?: string;
  description?: string;
}

interface Daw {
  slug: string;
  name: string;
  manufacturer: string;
  bundleIdentifier?: string;
  platforms?: string[];
  website?: string;
}

interface Hardware {
  slug: string;
  name: string;
  manufacturer: string;
  type?: string;
  website?: string;
}

// =============================================================================
// GIT HELPERS
// =============================================================================

function getLatestTag(): string | null {
  try {
    return execSync("git describe --tags --abbrev=0", {
      encoding: "utf-8",
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

function escapeSQL(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function generateManufacturerSQL(
  change: Change,
  data: Manufacturer | null
): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    sql.push(`DELETE FROM manufacturers WHERE id = ${escapeSQL(change.slug)};`);
  } else if (change.type === "added" && data) {
    sql.push(
      `INSERT INTO manufacturers (id, name, website, updated_at) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(data.name)}, ${escapeSQL(data.website)}, datetime('now'));`
    );
  } else if (change.type === "modified" && data) {
    sql.push(
      `UPDATE manufacturers SET name = ${escapeSQL(data.name)}, website = ${escapeSQL(data.website)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.slug)};`
    );
  }

  return sql;
}

function generateSoftwareSQL(change: Change, data: Software | null): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    // Cascade deletes handle related tables
    sql.push(`DELETE FROM software_fts WHERE id = ${escapeSQL(change.slug)};`);
    sql.push(`DELETE FROM software WHERE id = ${escapeSQL(change.slug)};`);
  } else if (data) {
    if (change.type === "modified") {
      // Delete existing related data first
      sql.push(
        `DELETE FROM software_categories WHERE software_id = ${escapeSQL(data.slug)};`
      );
      sql.push(
        `DELETE FROM software_formats WHERE software_id = ${escapeSQL(data.slug)};`
      );
      sql.push(
        `DELETE FROM software_platforms WHERE software_id = ${escapeSQL(data.slug)};`
      );
      sql.push(`DELETE FROM software_fts WHERE id = ${escapeSQL(data.slug)};`);
      sql.push(
        `UPDATE software SET name = ${escapeSQL(data.name)}, manufacturer_id = ${escapeSQL(data.manufacturer)}, type = ${escapeSQL(data.type)}, website = ${escapeSQL(data.website)}, description = ${escapeSQL(data.description)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.slug)};`
      );
    } else {
      sql.push(
        `INSERT INTO software (id, name, manufacturer_id, type, website, description, updated_at) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(data.name)}, ${escapeSQL(data.manufacturer)}, ${escapeSQL(data.type)}, ${escapeSQL(data.website)}, ${escapeSQL(data.description)}, datetime('now'));`
      );
    }

    // Insert categories
    for (const category of data.categories) {
      sql.push(
        `INSERT INTO software_categories (software_id, category) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(category)});`
      );
    }

    // Insert formats
    if (data.formats) {
      for (const format of data.formats) {
        const identifier = data.identifiers?.[format];
        sql.push(
          `INSERT INTO software_formats (software_id, format, identifier) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(format)}, ${escapeSQL(identifier)});`
        );
      }
    }

    // Insert platforms
    if (data.platforms) {
      for (const platform of data.platforms) {
        sql.push(
          `INSERT INTO software_platforms (software_id, platform) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(platform)});`
        );
      }
    }

    // Insert FTS
    sql.push(
      `INSERT INTO software_fts (id, name, manufacturer_name, categories) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(data.name)}, (SELECT name FROM manufacturers WHERE id = ${escapeSQL(data.manufacturer)}), ${escapeSQL(data.categories.join(" "))});`
    );
  }

  return sql;
}

function generateDawSQL(change: Change, data: Daw | null): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    sql.push(`DELETE FROM daws_fts WHERE id = ${escapeSQL(change.slug)};`);
    sql.push(`DELETE FROM daws WHERE id = ${escapeSQL(change.slug)};`);
  } else if (data) {
    if (change.type === "modified") {
      sql.push(
        `DELETE FROM daw_platforms WHERE daw_id = ${escapeSQL(data.slug)};`
      );
      sql.push(`DELETE FROM daws_fts WHERE id = ${escapeSQL(data.slug)};`);
      sql.push(
        `UPDATE daws SET name = ${escapeSQL(data.name)}, manufacturer_id = ${escapeSQL(data.manufacturer)}, bundle_identifier = ${escapeSQL(data.bundleIdentifier)}, website = ${escapeSQL(data.website)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.slug)};`
      );
    } else {
      sql.push(
        `INSERT INTO daws (id, name, manufacturer_id, bundle_identifier, website, updated_at) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(data.name)}, ${escapeSQL(data.manufacturer)}, ${escapeSQL(data.bundleIdentifier)}, ${escapeSQL(data.website)}, datetime('now'));`
      );
    }

    // Insert platforms
    if (data.platforms) {
      for (const platform of data.platforms) {
        sql.push(
          `INSERT INTO daw_platforms (daw_id, platform) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(platform)});`
        );
      }
    }

    // Insert FTS
    sql.push(
      `INSERT INTO daws_fts (id, name, manufacturer_name) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(data.name)}, (SELECT name FROM manufacturers WHERE id = ${escapeSQL(data.manufacturer)}));`
    );
  }

  return sql;
}

function generateHardwareSQL(change: Change, data: Hardware | null): string[] {
  const sql: string[] = [];

  if (change.type === "deleted") {
    sql.push(`DELETE FROM hardware WHERE id = ${escapeSQL(change.slug)};`);
  } else if (change.type === "added" && data) {
    sql.push(
      `INSERT INTO hardware (id, name, manufacturer_id, type, website, updated_at) VALUES (${escapeSQL(data.slug)}, ${escapeSQL(data.name)}, ${escapeSQL(data.manufacturer)}, ${escapeSQL(data.type)}, ${escapeSQL(data.website)}, datetime('now'));`
    );
  } else if (change.type === "modified" && data) {
    sql.push(
      `UPDATE hardware SET name = ${escapeSQL(data.name)}, manufacturer_id = ${escapeSQL(data.manufacturer)}, type = ${escapeSQL(data.type)}, website = ${escapeSQL(data.website)}, updated_at = datetime('now') WHERE id = ${escapeSQL(data.slug)};`
    );
  }

  return sql;
}

// =============================================================================
// MAIN
// =============================================================================

function generatePatch(fromVersion: number, toVersion: number): void {
  const tag = `v${fromVersion}`;
  const changes = getChangedFiles(tag);

  if (changes.length === 0) {
    console.log("No changes detected since last release.");
    return;
  }

  console.log(`\n📝 Generating patch v${fromVersion} → v${toVersion}\n`);
  console.log(`   Found ${changes.length} changes\n`);

  const sql: string[] = [];

  // Add header
  sql.push(`-- Catalog patch: v${fromVersion} → v${toVersion}`);
  sql.push(`-- Generated: ${new Date().toISOString()}`);
  sql.push(`-- Changes: ${changes.length}`);
  sql.push("");
  sql.push("BEGIN TRANSACTION;");
  sql.push("");

  // Process changes in order: manufacturers first (for foreign keys)
  const sortedChanges = [...changes].sort((a, b) => {
    const order = { manufacturers: 0, software: 1, daws: 2, hardware: 3 };
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

    let statements: string[] = [];
    switch (change.category) {
      case "manufacturers":
        statements = generateManufacturerSQL(change, data as Manufacturer);
        break;
      case "software":
        statements = generateSoftwareSQL(change, data as Software);
        break;
      case "daws":
        statements = generateDawSQL(change, data as Daw);
        break;
      case "hardware":
        statements = generateHardwareSQL(change, data as Hardware);
        break;
    }

    sql.push(...statements);
    sql.push("");
  }

  // Update version metadata
  sql.push("-- Update catalog version");
  sql.push(
    `UPDATE catalog_meta SET value = '${toVersion}' WHERE key = 'version';`
  );
  sql.push(
    `UPDATE catalog_meta SET value = datetime('now') WHERE key = 'updated_at';`
  );
  sql.push("");
  sql.push("COMMIT;");

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write patch file
  const patchFile = path.join(OUTPUT_DIR, `patch-${fromVersion}-${toVersion}.sql`);
  fs.writeFileSync(patchFile, sql.join("\n"));

  const stats = fs.statSync(patchFile);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log(`✅ Patch generated!`);
  console.log(`   Output: ${patchFile}`);
  console.log(`   Size: ${sizeKB} KB`);
}

// Parse arguments
const fromVersion = parseInt(process.argv[2] ?? "0", 10);
const toVersion = parseInt(process.argv[3] ?? String(fromVersion + 1), 10);

if (fromVersion === 0) {
  const latestTag = getLatestTag();
  if (latestTag) {
    const version = parseInt(latestTag.replace(/^v/, ""), 10);
    generatePatch(version, version + 1);
  } else {
    console.log("No previous release found. Build a baseline first.");
  }
} else {
  generatePatch(fromVersion, toVersion);
}


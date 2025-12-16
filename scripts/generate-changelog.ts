/**
 * Changelog Generation Script
 *
 * Generates release notes from YAML changes since the last release.
 * Run with: pnpm changelog [--since=tag] [--output=file] [--notes="..."]
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");

// =============================================================================
// TYPES
// =============================================================================

interface ChangelogEntry {
  type: "added" | "updated" | "removed";
  category: "manufacturers" | "software" | "daws" | "hardware";
  name: string;
  manufacturer?: string;
  details?: string;
}

interface YamlData {
  slug: string;
  name: string;
  manufacturer?: string;
  type?: string;
  categories?: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function parseArgs(): {
  since: string | null;
  output: string | null;
  notes: string | null;
} {
  const args: { since: string | null; output: string | null; notes: string | null } = {
    since: null,
    output: null,
    notes: null,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--since=")) {
      args.since = arg.replace("--since=", "");
    } else if (arg.startsWith("--output=")) {
      args.output = arg.replace("--output=", "");
    } else if (arg.startsWith("--notes=")) {
      args.notes = arg.replace("--notes=", "");
    }
  }

  return args;
}

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

function getFirstCommit(): string | null {
  try {
    return execSync("git rev-list --max-parents=0 HEAD", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

// Git's empty tree SHA - used to diff against "nothing" for initial releases
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function getGitChanges(since: string): {
  added: string[];
  modified: string[];
  deleted: string[];
} {
  const result = { added: [] as string[], modified: [] as string[], deleted: [] as string[] };

  try {
    const output = execSync(`git diff --name-status ${since} HEAD -- data/`, {
      encoding: "utf-8",
    });

    for (const line of output.split("\n").filter(Boolean)) {
      const [status, file] = line.split("\t");
      if (!file) continue;

      switch (status) {
        case "A":
          result.added.push(file);
          break;
        case "M":
          result.modified.push(file);
          break;
        case "D":
          result.deleted.push(file);
          break;
      }
    }
  } catch (error) {
    console.error("Failed to get git changes:", error);
  }

  return result;
}

function loadYamlData(file: string): YamlData | null {
  try {
    const fullPath = path.join(import.meta.dirname, "..", file);
    const content = fs.readFileSync(fullPath, "utf-8");
    return parseYaml(content) as YamlData;
  } catch {
    return null;
  }
}

function getManufacturerName(manufacturerSlug: string): string {
  try {
    const filePath = path.join(DATA_DIR, "manufacturers", `${manufacturerSlug}.yaml`);
    const content = fs.readFileSync(filePath, "utf-8");
    const data = parseYaml(content) as { name: string };
    return data.name;
  } catch {
    return manufacturerSlug;
  }
}

function parsePath(file: string): { category: string; slug: string } | null {
  const match = file.match(/^data\/(\w+)\/([^/]+)\.ya?ml$/);
  if (!match) return null;
  return { category: match[1], slug: match[2] };
}

// =============================================================================
// CHANGELOG GENERATION
// =============================================================================

function generateEntries(gitChanges: ReturnType<typeof getGitChanges>): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  // Process added files
  for (const file of gitChanges.added) {
    const parsed = parsePath(file);
    if (!parsed) continue;

    const data = loadYamlData(file);
    if (!data) continue;

    const entry: ChangelogEntry = {
      type: "added",
      category: parsed.category as ChangelogEntry["category"],
      name: data.name,
    };

    if (data.manufacturer) {
      entry.manufacturer = getManufacturerName(data.manufacturer);
    }

    if (data.categories && data.categories.length > 0) {
      entry.details = data.categories.slice(0, 3).join(", ");
    } else if (data.type) {
      entry.details = data.type;
    }

    entries.push(entry);
  }

  // Process modified files
  for (const file of gitChanges.modified) {
    const parsed = parsePath(file);
    if (!parsed) continue;

    const data = loadYamlData(file);
    if (!data) continue;

    const entry: ChangelogEntry = {
      type: "updated",
      category: parsed.category as ChangelogEntry["category"],
      name: data.name,
    };

    if (data.manufacturer) {
      entry.manufacturer = getManufacturerName(data.manufacturer);
    }

    entries.push(entry);
  }

  // Process deleted files (we can only get slug from filename)
  for (const file of gitChanges.deleted) {
    const parsed = parsePath(file);
    if (!parsed) continue;

    entries.push({
      type: "removed",
      category: parsed.category as ChangelogEntry["category"],
      name: parsed.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }

  return entries;
}

function formatChangelog(
  entries: ChangelogEntry[],
  title: string,
  manualNotes?: string
): string {
  const added = entries.filter((e) => e.type === "added");
  const updated = entries.filter((e) => e.type === "updated");
  const removed = entries.filter((e) => e.type === "removed");

  const lines: string[] = [];

  lines.push(`## ${title}`);
  lines.push("");

  // Added section
  if (added.length > 0) {
    lines.push(`### Added (${added.length})`);
    for (const entry of added) {
      let line = `- **${entry.name}**`;
      if (entry.manufacturer) {
        line += ` by ${entry.manufacturer}`;
      }
      if (entry.details) {
        line += ` — ${entry.details}`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  // Updated section
  if (updated.length > 0) {
    lines.push(`### Updated (${updated.length})`);
    for (const entry of updated) {
      let line = `- **${entry.name}**`;
      if (entry.manufacturer) {
        line += ` by ${entry.manufacturer}`;
      }
      if (entry.details) {
        line += ` — ${entry.details}`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  // Removed section
  if (removed.length > 0) {
    lines.push(`### Removed (${removed.length})`);
    for (const entry of removed) {
      lines.push(`- **${entry.name}**`);
    }
    lines.push("");
  }

  // Manual notes
  if (manualNotes) {
    lines.push("---");
    lines.push("");
    lines.push("**Release Notes:**");
    lines.push(manualNotes);
    lines.push("");
  }

  // Stats
  lines.push("---");
  lines.push("");
  lines.push(
    `**Stats:** ${added.length} added, ${updated.length} updated, ${removed.length} removed`
  );
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// MAIN
// =============================================================================

const args = parseArgs();

// Determine the reference point
let since = args.since;
let isInitialRelease = false;

if (!since) {
  since = getLatestTag();
  if (!since) {
    // No tags - use empty tree to show all files as "added" for initial release
    since = EMPTY_TREE;
    isInitialRelease = true;
  }
}

console.log(
  isInitialRelease
    ? `\n📝 Generating initial changelog...\n`
    : `\n📝 Generating changelog since ${since}...\n`
);

const gitChanges = getGitChanges(since);
const totalChanges = gitChanges.added.length + gitChanges.modified.length + gitChanges.deleted.length;

if (totalChanges === 0) {
  console.log("No changes found since last release.");
  process.exit(0);
}

const entries = generateEntries(gitChanges);

// For changelog display, just show what changed - version is determined by release workflow
const displayVersion = isInitialRelease ? "Initial Release" : `Changes since ${since}`;

const changelog = formatChangelog(entries, displayVersion, args.notes ?? undefined);

if (args.output) {
  fs.writeFileSync(args.output, changelog);
  console.log(`✅ Changelog written to ${args.output}`);
} else {
  console.log(changelog);
}


/**
 * Format YAML Script
 *
 * Moves `id` field to the top of each YAML file, then runs Prettier.
 * Replaces plain `prettier --write` for YAML formatting.
 *
 * Usage:
 *   tsx scripts/format-yaml.ts                      # whole catalog
 *   tsx scripts/format-yaml.ts data/hardware/a.yaml # just these files
 *
 * Formatting has no cross-file dependency, so scoping it to the files an
 * import touched turns a whole-catalog pass into an instant one.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");

const COLLECTIONS = ["manufacturers", "software", "content", "hardware", "accessories"];

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f));
}

function moveIdToTop(filePath: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const doc = parseDocument(content);
  const data = doc.toJSON() as Record<string, unknown>;

  // Skip files without an id field
  if (typeof data.id !== "string" || data.id.length === 0) {
    return false;
  }

  const items = doc.contents as { items?: { key: { value: string } }[] };
  if (!items?.items) {
    return false;
  }

  const idIndex = items.items.findIndex((item) => item.key?.value === "id");
  if (idIndex <= 0) {
    // Already first, or not found
    return false;
  }

  const [idItem] = items.items.splice(idIndex, 1);
  items.items.unshift(idItem);
  fs.writeFileSync(filePath, doc.toString());
  return true;
}

/**
 * Files to format: the paths given on the command line, or every
 * collection when none are. Formatting is per-file with no cross-file
 * dependency, so scoping it to the handful of files an import touched
 * turns a whole-catalog pass into an instant one.
 */
function filesToFormat(): { files: string[]; scoped: boolean } {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  if (args.length > 0) {
    const resolved = args.map((arg) => path.resolve(process.cwd(), arg));
    const missing = resolved.filter((file) => !fs.existsSync(file));
    if (missing.length > 0) {
      console.error(`No such file(s):\n${missing.map((f) => `  ${f}`).join("\n")}`);
      process.exit(1);
    }
    // Only YAML: moveIdToTop parses every file it is handed, so a stray
    // .md or .json argument would crash inside the YAML document parser
    // rather than report anything useful. The unscoped path cannot hit
    // this because getYamlFiles() already filters by extension.
    const notYaml = resolved.filter((file) => !/\.ya?ml$/.test(file));
    if (notYaml.length > 0) {
      console.error(
        `Not YAML (this script only formats .yaml/.yml):\n${notYaml.map((f) => `  ${f}`).join("\n")}`
      );
      process.exit(1);
    }
    return { files: resolved, scoped: true };
  }
  return {
    files: COLLECTIONS.flatMap((collection) => getYamlFiles(path.join(DATA_DIR, collection))),
    scoped: false,
  };
}

const { files, scoped } = filesToFormat();

let reordered = 0;
for (const file of files) {
  if (moveIdToTop(file)) {
    reordered++;
  }
}

if (reordered > 0) {
  console.log(`Moved id to top in ${reordered} files`);
}

console.log(scoped ? `Running Prettier on ${files.length} file(s)...` : "Running Prettier...");
// Prettier is given explicit paths when scoped so it never walks the
// whole data tree; the glob stays the default for a full run. These are
// passed as argv rather than interpolated into a command string: the
// scoped paths come from argv, and with no shell in between there is no
// quoting to get wrong. Prettier expands the glob itself.
const targets = scoped ? files.map((file) => path.relative(REPO_ROOT, file)) : ["data/**/*.yaml"];
execFileSync("prettier", ["--write", ...targets], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});

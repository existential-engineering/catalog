/**
 * Format YAML Script
 *
 * Moves `id` field to the top of each YAML file, then runs Prettier.
 * Replaces plain `prettier --write` for YAML formatting.
 *
 * Usage:
 *   tsx scripts/format-yaml.ts                      # whole catalog
 *   tsx scripts/format-yaml.ts data/hardware/a.yaml # just these files
 *   tsx scripts/format-yaml.ts --normalize          # whole catalog, shape rules too
 *
 * Formatting has no cross-file dependency, so scoping it to the files an
 * import touched turns a whole-catalog pass into an instant one.
 *
 * Scoped runs also normalise entry shape (lib/format-normalize.ts): alias
 * categories become canonical, a secondary category equal to the primary
 * is dropped, `details` and `specs` become `|-` block scalars, and io
 * fields take their documented order. The unscoped run does not, because
 * `assign-ids.yml` runs it on every PR sync and 708 entries on `main`
 * still carry aliases: a whole-catalog rewrite is a deliberate
 * `--normalize` pass in a PR of its own, never a side effect of a sync.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { normalizeDocument } from "./lib/format-normalize.js";
import type { CategoryAliasesSchema } from "./lib/types.js";
import { loadYamlFile } from "./lib/utils.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const SCHEMA_DIR = path.join(REPO_ROOT, "schema");

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

/** Hoist `id` to the first key. Returns true when the document changed. */
function moveIdToTop(doc: ReturnType<typeof parseDocument>): boolean {
  const data = doc.toJSON() as Record<string, unknown> | null;
  if (!data || typeof data.id !== "string" || data.id.length === 0) {
    return false;
  }
  const items = doc.contents as { items?: { key: { value: string } }[] };
  if (!items?.items) {
    return false;
  }
  const idIndex = items.items.findIndex((item) => item.key?.value === "id");
  if (idIndex <= 0) {
    return false;
  }
  const [idItem] = items.items.splice(idIndex, 1);
  items.items.unshift(idItem);
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
    // Only YAML: every file is parsed as a YAML document, so a stray .md
    // or .json argument would crash inside the parser rather than report
    // anything useful. The unscoped path cannot hit this because
    // getYamlFiles() already filters by extension.
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
const normalize = scoped || process.argv.includes("--normalize");
const aliases = normalize
  ? loadYamlFile<CategoryAliasesSchema>(path.join(SCHEMA_DIR, "category-aliases.yaml")).aliases
  : {};

let reordered = 0;
let normalized = 0;
for (const file of files) {
  const content = fs.readFileSync(file, "utf-8");
  const doc = parseDocument(content);
  const movedId = moveIdToTop(doc);
  // Manufacturer entries carry none of the normalised fields, and the
  // alias map is for product categories, so they are left to the id hoist.
  const changes =
    normalize && path.basename(path.dirname(file)) !== "manufacturers"
      ? normalizeDocument(doc, { aliases })
      : [];
  if (movedId) reordered++;
  if (changes.length > 0) {
    normalized++;
    console.log(`${path.relative(REPO_ROOT, file)}: ${changes.join("; ")}`);
  }
  // Written only on a change, so an untouched file stays byte for byte
  // alone. Default line width: Prettier then reproduces the committed
  // layout exactly (measured over 60 entries), where lineWidth 0 does not.
  if (movedId || changes.length > 0) fs.writeFileSync(file, doc.toString());
}

if (reordered > 0) {
  console.log(`Moved id to top in ${reordered} files`);
}
if (normalized > 0) {
  console.log(`Normalised shape in ${normalized} files`);
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

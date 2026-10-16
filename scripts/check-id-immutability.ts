/**
 * ID Immutability Check
 *
 * An entry's `id` is the key Studio stores in a user's setups and the key
 * product images are served under, so once assigned it never changes and
 * never disappears. This compares the pull request's tree with the base
 * branch and fails on three things:
 *
 * - a modified or renamed file whose `id` differs from the base;
 * - an `id` present on the base that no file on the head carries, which
 *   is what a deletion or a rename-with-new-id looks like;
 * - a hardware port whose stable `key` moved (see io-keys.ts).
 *
 * Until this read `--diff-filter=MRD` it listed modified files only and
 * `continue`d when either side was missing, so a rename that changed the
 * id and a plain deletion both passed. A retirement is the one legitimate
 * way an id leaves the catalog, and it is declared rather than inferred:
 * the pull request carries the `retirement` label, which validate.yml
 * passes in `PR_LABELS`.
 *
 * Run with: tsx scripts/check-id-immutability.ts <base-ref>
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { findIoKeyViolations } from "./lib/io-keys.js";
import type { IO } from "./lib/types.js";
import { readRegularFile } from "./lib/utils.js";

/** The label that lets an id leave the catalog on purpose. */
export const RETIREMENT_LABEL = "retirement";

interface Entry {
  id?: unknown;
  io?: IO[];
}

interface DataChange {
  status: "M" | "R" | "D" | "T";
  /** Path on the base branch. */
  basePath: string;
  /** Path on the head, absent for a deletion. */
  headPath?: string;
}

export interface CheckOptions {
  baseRef: string;
  /** The checkout to compare, the repository root. */
  cwd: string;
  /** The pull request's labels, as validate.yml hands them over. */
  labels?: readonly string[];
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

/**
 * The data files the head changed against the base: modified, renamed
 * (with `-M` so git pairs the old and new path), deleted, and type-changed
 * (a file replaced by a symlink is `T`, not `M`, and is the one case the
 * guarded read below exists for). A `--name-only` listing cannot say which
 * a path is, so this reads `--name-status`, where a rename row carries
 * both paths.
 */
function getChangedDataFiles(cwd: string, baseRef: string): DataChange[] {
  let output: string;
  try {
    output = git(cwd, [
      "diff",
      "--name-status",
      "-M",
      "--diff-filter=MRDT",
      baseRef,
      "--",
      "data/**/*.yaml",
    ]);
  } catch {
    return [];
  }
  const changes: DataChange[] = [];
  for (const row of output.split("\n")) {
    if (!row) continue;
    const [code, first, second] = row.split("\t");
    const status = code?.[0];
    if ((status === "M" || status === "T") && first)
      changes.push({ status, basePath: first, headPath: first });
    else if (status === "R" && first && second)
      changes.push({ status, basePath: first, headPath: second });
    else if (status === "D" && first) changes.push({ status, basePath: first });
  }
  return changes;
}

function readBaseEntry(cwd: string, baseRef: string, filePath: string): Entry | null {
  try {
    return parseYaml(git(cwd, ["show", `${baseRef}:${filePath}`])) as Entry;
  } catch {
    return null;
  }
}

function readHeadEntry(cwd: string, filePath: string): Entry {
  return parseYaml(readRegularFile(path.join(cwd, filePath))) as Entry;
}

/**
 * Every id the working tree carries, read off one `git grep` rather than
 * 21k file reads. The working tree and not HEAD, because the file check
 * above reads the working tree too and the two have to agree about what
 * "here" is.
 */
function idsInWorkingTree(cwd: string): Set<string> {
  const ids = new Set<string>();
  let output: string;
  try {
    output = git(cwd, ["grep", "-h", "-E", "^id: ", "--", "data/**/*.yaml"]);
  } catch {
    // git grep exits 1 when nothing matches, which an empty tree does.
    return ids;
  }
  for (const line of output.split("\n")) {
    const id = line.replace(/^id:\s*/, "").trim();
    if (id) ids.add(id.replace(/^["']|["']$/g, ""));
  }
  return ids;
}

/** The violations in `cwd` against `baseRef`, each a line for the log. */
export function findIdImmutabilityErrors(options: CheckOptions): {
  errors: string[];
  checked: number;
} {
  const { baseRef, cwd } = options;
  const changes = getChangedDataFiles(cwd, baseRef);
  const errors: string[] = [];
  /** Files whose id change is already reported, so a rename is not reported twice. */
  const reported = new Set<string>();

  for (const change of changes) {
    if (!change.headPath) continue;
    const baseData = readBaseEntry(cwd, baseRef, change.basePath);
    if (!baseData) continue;
    let currentData: Entry;
    try {
      currentData = readHeadEntry(cwd, change.headPath);
    } catch (err) {
      errors.push(`${change.headPath}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (baseData.id !== undefined && currentData.id !== baseData.id) {
      reported.add(change.basePath);
      errors.push(
        `${change.headPath}: ID was changed from '${baseData.id}' to '${currentData.id}'. IDs are immutable once assigned.`
      );
    }

    if (Array.isArray(baseData.io) && Array.isArray(currentData.io)) {
      for (const violation of findIoKeyViolations(baseData.io, currentData.io)) {
        errors.push(`${change.headPath}: ${violation}`);
      }
    }
  }

  // An id on the base that the head no longer carries anywhere. Checked
  // against the whole head tree rather than the changed file, because a
  // retired file's id could legitimately move to another file in the same
  // pull request (a merge of two entries keeps one id).
  const departures = changes.filter(
    (c) => (c.status === "R" || c.status === "D") && !reported.has(c.basePath)
  );
  if (departures.length > 0 && !(options.labels ?? []).includes(RETIREMENT_LABEL)) {
    const headIds = idsInWorkingTree(cwd);
    for (const change of departures) {
      const baseData = readBaseEntry(cwd, baseRef, change.basePath);
      const id = baseData?.id;
      if (typeof id !== "string" || headIds.has(id)) continue;
      errors.push(
        `${change.basePath}: id '${id}' is on ${baseRef} and on no file here. ` +
          `An id never leaves the catalog by accident; label the pull request '${RETIREMENT_LABEL}' to retire it.`
      );
    }
  }

  return { errors, checked: changes.length };
}

function main(): void {
  const baseRef = process.argv[2] ?? "origin/main";
  const labels = (process.env.PR_LABELS ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const { errors, checked } = findIdImmutabilityErrors({ baseRef, cwd: process.cwd(), labels });

  if (errors.length > 0) {
    console.error("❌ ID immutability check failed!\n");
    for (const error of errors) {
      console.error(`  ⚠️  ${error}`);
    }
    process.exit(1);
  }

  console.log(`✅ ID immutability check passed (${checked} files checked)`);
}

// Run only as a CLI, so the test suite can import the check.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

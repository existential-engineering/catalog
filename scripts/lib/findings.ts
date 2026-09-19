/**
 * What an audit learned, in the shape the submissions inbox reads.
 *
 * The corpus audits report to a person at a terminal, and that is the
 * only place their output has ever gone. `pnpm power-input-audit` finds
 * 305 entries missing a power input, against a rule CLAUDE.md calls "the
 * single most repeated finding" on import review. Nothing carries those
 * anywhere: the next run recomputes them, and whoever read the last one
 * is the only record that it was read.
 *
 * This is the durable half. A row appended here is picked up by the
 * racks repo's `file-findings.ts`, which opens one inbox issue per key,
 * ever, so a finding becomes a thread a person can close rather than a
 * line that scrolls past.
 *
 * Deliberately a separate implementation from the racks module of the
 * same name rather than a shared package: ADR-0012 puts the pipeline on
 * the other side of a repo boundary, and neither repo imports the
 * other's TypeScript. What the two share is the **row**, which is why
 * `FINDING_KINDS` below is pinned by a test rather than trusted.
 */
import fs from "node:fs";
import path from "node:path";

export const FINDINGS_FILE = "findings.jsonl";

/**
 * The kinds the catalog's own audits produce.
 *
 * A subset: the inbox also takes the kinds the racks import lanes record
 * and the review collector files. These four are the ones a whole-corpus
 * pass can see and a single PR cannot, which is the reason they exist as
 * kinds at all.
 *
 * **The spelling is the contract.** The reader is
 * `scripts/catalog-import/findings.ts` in racks, which drops a row whose
 * `kind` it does not know, silently and by design, so a typo here is a
 * run that reports findings and files none. `findings.test.ts` pins each
 * string literally for that reason, rather than deriving it from
 * anything that could change with it.
 */
export const FINDING_KINDS = [
  /** A powered entry with no `category: power` port. */
  "missing-power-input",
  /** A port whose `type` contradicts its own name. */
  "mistyped-port",
  /** An operation the prose names and `capabilities` omits. */
  "capability-gap",
  /** A modular entry with no panel width. */
  "missing-hp",
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export interface Finding {
  kind: FindingKind;
  /** Manufacturer slug, as the entry's own `manufacturer:` field spells it. */
  brand: string;
  /**
   * Stable identity, and the whole of the dedup. One issue per key ever,
   * so it carries no date, no run id and no count: a key that moves
   * between runs files the same finding again every night.
   */
  key: string;
  /** One line, used as the issue title. */
  title: string;
  /** The evidence, in prose. */
  detail: string;
  /** Repo-relative path the finding is about. */
  file?: string;
  /** The page that evidences it, when the entry carries one. */
  url?: string;
  recordedAt: string;
}

export type FindingInput = Omit<Finding, "recordedAt"> & { recordedAt?: string };

/**
 * Confirm `candidate` is a directory whose canonical path stays beneath
 * `root`, on the same contract as `checkContainedRegularFile`.
 *
 * The findings directory arrives as a `--findings` argument, so it is a
 * path this script did not choose. `lstat` rather than `stat`, so a
 * symlink is refused as one rather than followed: a `findings ->
 * /etc/cron.d` would otherwise turn an append into a write outside the
 * checkout. It must already exist, because creating it would mean
 * resolving a parent that is itself unchecked.
 */
export function checkContainedDirectory(
  candidate: string,
  root: string
): { path: string; reason?: undefined } | { path?: undefined; reason: string } {
  const resolved = path.resolve(candidate);
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(resolved);
  } catch {
    return { reason: "does not exist" };
  }
  if (stats.isSymbolicLink()) return { reason: "is a symlink" };
  if (!stats.isDirectory()) return { reason: "is not a directory" };

  let real: string;
  let realRoot: string;
  try {
    real = fs.realpathSync(resolved);
    realRoot = fs.realpathSync(root);
  } catch {
    return { reason: "cannot be resolved" };
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
    return { reason: `is outside ${root}` };
  }
  return { path: real };
}

/**
 * Append findings to `dir/findings.jsonl`.
 *
 * Fail-open and reported, never thrown: this is bookkeeping beside a
 * report that has already been produced, and an audit that found 305
 * entries must still print them when it cannot write them down.
 *
 * Returns the count written, so a caller can say so out loud. A run that
 * silently writes nothing is the failure this whole file exists to
 * remove.
 */
export function recordFindings(dir: string, findings: FindingInput[]): number {
  if (findings.length === 0) return 0;
  const at = new Date().toISOString();
  const rows = findings
    .map((f) => `${JSON.stringify({ ...f, recordedAt: f.recordedAt ?? at })}\n`)
    .join("");
  try {
    fs.appendFileSync(path.join(dir, FINDINGS_FILE), rows, "utf-8");
    return findings.length;
  } catch (err) {
    process.stderr.write(
      `findings: could not write to ${dir}: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return 0;
  }
}

/**
 * The value of `--findings <dir>`, guarded, or `undefined` when the flag
 * is absent.
 *
 * Exits non-zero on a bad path rather than carrying on without a sink:
 * the flag was passed because somebody wanted the rows, so writing them
 * nowhere and reporting success is the wrong failure.
 */
export function findingsDirArg(args: string[], root: string): string | undefined {
  const index = args.indexOf("--findings");
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    console.error("\n❌ --findings requires a directory.\n");
    process.exit(1);
  }
  const checked = checkContainedDirectory(value, root);
  if (checked.reason) {
    console.error(`\n❌ --findings ${value} ${checked.reason}.\n`);
    process.exit(1);
  }
  return checked.path;
}

/** Every row in `dir`, first occurrence per key kept. For tests and reports. */
export function readFindings(dir: string): Finding[] {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(dir, FINDINGS_FILE), "utf-8");
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim() === "") continue;
    let parsed: Finding;
    try {
      parsed = JSON.parse(line) as Finding;
    } catch {
      // A torn final line is skipped rather than thrown on: a run killed
      // mid-append must not make the whole ledger unreadable.
      continue;
    }
    if (!parsed?.key || seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    out.push(parsed);
  }
  return out;
}

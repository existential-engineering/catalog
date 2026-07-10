/**
 * Interactive IO Position Enrichment
 *
 * Assigns `columnPosition` / `rowPosition` to a hardware entry's IO ports so the
 * Studio setup graph can render the physical port layout. See issue #212.
 *
 * These values are visual/spatial information best read off product photos or the
 * manufacturer's rear-panel diagram, so this is a manual enrichment pass rather
 * than part of bulk import.
 *
 * Conventions (also documented in schema/CONTEXT.md):
 *   - columnPosition: 1-based left-to-right order of ports on a given `position`
 *     edge, viewing that face head-on. Column 1 = leftmost.
 *   - rowPosition: 1-based top-to-bottom order, viewing that face head-on.
 *     Row 1 = topmost. Single-row edges use rowPosition 1.
 *   - Numbering is independent per `position` edge.
 *
 * Usage:
 *   pnpm enrich-io <slug> [--dry-run] [--open]
 *
 *   <slug>      hardware filename without .yaml (e.g. eventide-audio-h90-harmonizer)
 *   --dry-run   print the changes without writing the file
 *   --open      open the product URL in a browser (macOS) to view port photos
 *
 * At each prompt: enter a positive integer, press Enter to keep the current
 * value, or type `-` to clear the value.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { isMap, isSeq, type Pair, parseDocument, type Scalar, type YAMLMap } from "yaml";
import { SLUG_PATTERN } from "./lib/schema-loader.js";
import { DATA_DIR } from "./lib/utils.js";

interface IOPortView {
  name?: string;
  signalFlow?: string;
  position?: string;
  columnPosition?: number;
  rowPosition?: number;
}

interface ChangeRecord {
  name: string;
  field: "columnPosition" | "rowPosition";
  from: number | undefined;
  to: number | undefined;
}

/** Resolve the string value of a Pair's key. */
function pairKey(pair: Pair): string | undefined {
  const key = pair.key as Scalar | string | null | undefined;
  if (key && typeof key === "object" && "value" in key) {
    return key.value == null ? undefined : String(key.value);
  }
  return key == null ? undefined : String(key);
}

/**
 * Set (or clear) a numeric field on a port map, keeping it in canonical order:
 * the field is moved to immediately after the first present key in `afterKeys`.
 * Returns true if the document was modified.
 */
function applyField(
  portNode: YAMLMap,
  key: string,
  newValue: number | undefined,
  afterKeys: string[]
): boolean {
  const items = portNode.items;
  const currentIdx = items.findIndex((it) => pairKey(it) === key);
  const existing = currentIdx >= 0 ? portNode.get(key) : undefined;

  if (newValue === undefined) {
    if (currentIdx >= 0) {
      portNode.delete(key);
      return true;
    }
    return false;
  }

  if (existing === newValue) return false;

  portNode.set(key, newValue);

  // Re-locate the (possibly newly-appended) key to just after its anchor.
  const idx = items.findIndex((it) => pairKey(it) === key);
  const [item] = items.splice(idx, 1);
  let insertAt = 0;
  for (const anchor of afterKeys) {
    const anchorIdx = items.findIndex((it) => pairKey(it) === anchor);
    if (anchorIdx >= 0) {
      insertAt = anchorIdx + 1;
      break;
    }
  }
  items.splice(insertAt, 0, item);
  return true;
}

/**
 * Prompt for a positive integer; Enter keeps current, `-` clears, EOF keeps.
 *
 * Reads via `nextLine` (backed by readline's async iterator) rather than
 * `rl.question()` so piped / non-TTY input is consumed line-by-line without
 * dropping lines.
 */
async function askNumber(
  nextLine: () => Promise<string | undefined>,
  label: string,
  current: number | undefined
): Promise<number | undefined> {
  output.write(`    ${label} [${current ?? "-"}]: `);
  const raw = await nextLine();
  if (raw === undefined) {
    output.write("\n");
    return current; // EOF — keep existing value
  }
  const answer = raw.trim();
  if (answer === "") return current;
  if (answer === "-" || answer.toLowerCase() === "none") return undefined;
  const n = Number.parseInt(answer, 10);
  if (!Number.isInteger(n) || n < 1 || String(n) !== answer) {
    console.log("    ! must be a positive integer — keeping current value");
    return current;
  }
  return n;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const openImages = args.includes("--open");
  const slugArg = args.find((a) => !a.startsWith("--"));

  if (!slugArg) {
    console.error("Usage: pnpm enrich-io <slug> [--dry-run] [--open]");
    process.exit(1);
  }

  const slug = slugArg.replace(/\.ya?ml$/, "");
  if (!SLUG_PATTERN.test(slug)) {
    console.error(
      `Invalid slug '${slug}'. Slugs are lowercase letters, numbers, and hyphens ` +
        "(no path separators)."
    );
    process.exit(1);
  }
  const file = path.join(DATA_DIR, "hardware", `${slug}.yaml`);
  if (!fs.existsSync(file)) {
    console.error(`No hardware entry found at data/hardware/${slug}.yaml`);
    process.exit(1);
  }

  const doc = parseDocument(fs.readFileSync(file, "utf-8"));
  const ioSeq = doc.get("io");
  if (!isSeq(ioSeq) || ioSeq.items.length === 0) {
    console.error(`${slug} has no 'io' entries to enrich.`);
    process.exit(1);
  }

  const data = doc.toJSON() as { name?: string; url?: string };
  console.log(`\n${data.name ?? slug}`);
  if (data.url) {
    console.log(`  ${data.url}`);
    if (openImages && process.platform === "darwin") {
      execFile("open", [data.url], () => {});
    }
  }
  console.log(
    "  Assign columnPosition (left→right) and rowPosition (top→bottom) per edge.\n" +
      "  Enter a number, press Enter to keep, or type '-' to clear.\n"
  );

  const rl = readline.createInterface({ input, output });
  const lineIterator = rl[Symbol.asyncIterator]();
  const nextLine = async (): Promise<string | undefined> => {
    const { value, done } = await lineIterator.next();
    return done ? undefined : (value as string);
  };
  const changes: ChangeRecord[] = [];

  for (let i = 0; i < ioSeq.items.length; i++) {
    const portNode = ioSeq.items[i];
    if (!isMap(portNode)) continue;
    const port = portNode.toJSON() as IOPortView;
    const name = port.name ?? `port ${i + 1}`;

    console.log(
      `[${i + 1}/${ioSeq.items.length}] ${name} — ${port.signalFlow ?? "?"}, ` +
        `position: ${port.position ?? "(none)"}`
    );

    const col = await askNumber(nextLine, "columnPosition", port.columnPosition);
    const row = await askNumber(nextLine, "rowPosition", port.rowPosition);

    if (applyField(portNode, "columnPosition", col, ["position"])) {
      changes.push({ name, field: "columnPosition", from: port.columnPosition, to: col });
    }
    if (applyField(portNode, "rowPosition", row, ["columnPosition", "position"])) {
      changes.push({ name, field: "rowPosition", from: port.rowPosition, to: row });
    }
  }

  rl.close();

  if (changes.length === 0) {
    console.log("\nNo changes.");
    return;
  }

  console.log(`\n${changes.length} change(s):`);
  for (const c of changes) {
    console.log(`  ${c.name}: ${c.field} ${c.from ?? "-"} → ${c.to ?? "-"}`);
  }

  if (dryRun) {
    console.log("\n(dry run — file not written)");
    return;
  }

  fs.writeFileSync(file, doc.toString());
  console.log(`\n✓ Wrote data/hardware/${slug}.yaml`);
  console.log("  Next: run 'pnpm format' then 'pnpm validate'.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

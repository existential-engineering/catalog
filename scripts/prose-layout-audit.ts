#!/usr/bin/env tsx
/**
 * Prose Layout Audit (AUREO-1192)
 *
 * Reports `details` and `specs` that will render badly in Studio: a wall
 * of text where the page had structure.
 *
 * CLAUDE.md fixes the shape of both fields: `details` is a `|-` block with
 * paragraphs separated by blank lines, `specs` a `|-` block of `- ` items.
 * Nothing checked either beyond "is a string", so an import that scraped a
 * page one block per line, kept its `•` glyphs, or indented a list four
 * spaces validated, built and shipped. The build renders both fields with
 * `marked`, which joins single-newline lines into one paragraph, turns a
 * four-space indent into a monospace code block and treats `•` as text:
 * every heading, paragraph and bullet of the page arrives as one block.
 *
 * WHAT THIS REPORTS AND WHAT IT FIXES
 *
 * Every check is one of `PROSE_CHECKS` in `lib/prose-layout.ts`, and each
 * row says whether it is `fixable`. A fixable row is settled by
 * `pnpm prose-layout:apply`, which only moves whitespace and swaps a glyph
 * for a list marker, and proves it lost no word before it writes. The
 * rest need a person who has read the text: where a 3,000-character
 * paragraph breaks, whether "A - B - C" is a list or three ranges, what a
 * mojibake `â` stood for. `--tsv` writes those as a review worklist; there
 * is no apply step for them, by design.
 *
 * Usage:
 *   pnpm prose-layout-audit                  # report
 *   pnpm prose-layout-audit --tsv            # review rows (judgement only)
 *   pnpm prose-layout-audit --findings <dir> # also append wall-of-text rows
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type FindingInput, findingsDirArg, recordFindings } from "./lib/findings.js";
import { auditProse, PROSE_CHECKS, type ProseCheck, proseLocations } from "./lib/prose-layout.js";
import { DATA_DIR, getYamlFiles, REPO_ROOT } from "./lib/utils.js";

const COLLECTIONS = ["software", "hardware", "content", "accessories"] as const;

export interface ProseRow {
  collection: string;
  slug: string;
  manufacturer: string;
  /** `details`, `specs`, or `translations.de.details`. */
  field: string;
  check: ProseCheck;
  fixable: boolean;
  detail: string;
  excerpt: string;
  url?: string;
}

/** Every layout issue in one file's source. */
export function auditSource(
  src: string,
  meta: { collection: string; slug: string; manufacturer: string; url?: string }
): ProseRow[] {
  const rows: ProseRow[] = [];
  for (const loc of proseLocations(src)) {
    for (const issue of auditProse(loc)) {
      rows.push({ ...meta, field: [...loc.scope, loc.field].join("."), ...issue });
    }
  }
  return rows;
}

export function auditCorpus(dataDir = DATA_DIR): ProseRow[] {
  const rows: ProseRow[] = [];
  for (const collection of COLLECTIONS) {
    for (const file of getYamlFiles(path.join(dataDir, collection))) {
      const src = fs.readFileSync(file, "utf-8");
      const head = src.match(/^manufacturer:\s*(\S+)/m)?.[1] ?? "";
      const url = src.match(/^url:\s*(\S+)/m)?.[1];
      rows.push(
        ...auditSource(src, {
          collection,
          slug: path.basename(file, ".yaml"),
          manufacturer: head.replace(/^["']|["']$/g, ""),
          url,
        })
      );
    }
  }
  return rows;
}

/**
 * The inbox rows: `wall` only, one per entry.
 *
 * A finding is filed only when the audit can settle it (CLAUDE.md,
 * "Findings"). A paragraph over the threshold is a fact about the text and
 * not a guess about language, and splitting it needs somebody to read it,
 * which is what makes it an issue rather than a report line. The other
 * review checks are probes (an inline "A - B - C" is as often three ranges
 * as a list), and the fixable ones are settled by the apply step, so
 * neither belongs in an inbox a person reads.
 *
 * Keyed by slug alone, not by field: an entry with a wall in `details` and
 * in a translation is one afternoon for whoever opens it.
 */
export function toFindings(rows: readonly ProseRow[]): FindingInput[] {
  const bySlug = new Map<string, ProseRow[]>();
  for (const r of rows) {
    if (r.check !== "wall") continue;
    const list = bySlug.get(r.slug) ?? [];
    list.push(r);
    bySlug.set(r.slug, list);
  }
  return [...bySlug.values()].map((walls) => {
    const first = walls[0]!;
    return {
      kind: "wall-of-text" as const,
      brand: first.manufacturer || "catalog",
      key: `wall-of-text:${first.slug}`,
      title: `${first.slug} renders its ${first.field} as a wall of text`,
      detail:
        walls.map((w) => `\`${w.field}\`: ${w.detail}.\n\n> ${w.excerpt}…`).join("\n\n") +
        "\n\nBreak it into paragraphs at the places the text changes subject, and move " +
        "any list it carries into `- ` items (into `specs` when they are specifications). " +
        "Never shorten or reword it to fit: the content is the maker's, only the layout is " +
        "wrong. A page that was scraped whole, navigation and all, is trimmed back to the " +
        "product's own text from its `url`.",
      file: `data/${first.collection}/${first.slug}.yaml`,
      ...(first.url ? { url: first.url } : {}),
    };
  });
}

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ");
}

function main(): void {
  const args = process.argv.slice(2);
  const rows = auditCorpus();

  const dir = findingsDirArg(args, REPO_ROOT);
  if (dir) {
    const findings = toFindings(rows);
    const written = recordFindings(dir, findings);
    process.stderr.write(`findings: wrote ${written} of ${findings.length} to ${dir}\n`);
  }

  if (args.includes("--tsv")) {
    console.log("# slug\tcollection\tfield\tcheck\tdetail\texcerpt");
    console.log("# Prose layout review list (AUREO-1192), from pnpm prose-layout-audit --tsv.");
    console.log("# Only rows that need judgement: the fixable ones are applied by");
    console.log("#   pnpm prose-layout:apply --write");
    console.log("# There is no apply step for these. Each is a worklist item: read the");
    console.log("# entry, re-break or re-list it by hand, never shorten or reword it.");
    console.log("# Delete a row once it is fixed or judged fine as it stands.");
    for (const r of rows.filter((r) => !r.fixable)) {
      console.log(
        [r.slug, r.collection, r.field, r.check, r.detail, r.excerpt].map(tsvCell).join("\t")
      );
    }
    return;
  }

  const entries = (pred: (r: ProseRow) => boolean) =>
    new Set(rows.filter(pred).map((r) => `${r.collection}/${r.slug}`)).size;

  console.log("\n🧱 Prose layout (details / specs)\n");
  console.log(
    `   ${entries(() => true)} entries with an issue — ` +
      `${entries((r) => r.fixable)} fixable, ${entries((r) => !r.fixable)} to review\n`
  );
  console.log(`   ${"check".padEnd(16)} ${"fixable".padStart(8)} ${"review".padStart(8)}`);
  for (const check of PROSE_CHECKS) {
    const fix = entries((r) => r.check === check && r.fixable);
    const review = entries((r) => r.check === check && !r.fixable);
    if (fix + review === 0) continue;
    console.log(`   ${check.padEnd(16)} ${String(fix).padStart(8)} ${String(review).padStart(8)}`);
  }
  console.log("\n   Apply the fixable ones with 'pnpm prose-layout:apply --write'.");
  console.log("   List the rest with --tsv; those need a person, never a guess.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

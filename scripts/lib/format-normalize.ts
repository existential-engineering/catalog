/**
 * Shape normalisation for one catalog entry, applied by `pnpm format` on
 * the files it is given explicitly.
 *
 * `pnpm format` used to hoist `id` and run Prettier and nothing else, so
 * every shape rule the reviewer checks by eye (alias categories, a
 * secondary category repeating the primary, `details` as a YAML array,
 * a multi-line `details` as a plain scalar, io fields out of order)
 * reached the PR and came back as a CodeRabbit finding. Those were 38 of
 * the 384 inline findings across 75 import PRs.
 *
 * Deliberately scoped. `assign-ids.yml` runs an unscoped `pnpm format` on
 * every PR sync, and 708 files on `main` carry alias categories, so an
 * unscoped normalisation would rewrite those on the first PR after it
 * landed. The unscoped run keeps its old behaviour, and the whole-catalog
 * pass is a separate, deliberate `--normalize` run recorded in its own PR.
 */

import { type Document, isMap, isScalar, isSeq, type Pair, Scalar, YAMLSeq } from "yaml";

export const IO_FIELD_ORDER = [
  "key",
  "name",
  "signalFlow",
  "category",
  "type",
  "connection",
  "connectorDetail",
  "maxConnections",
  "position",
  "columnPosition",
  "rowPosition",
  "description",
];

const CATEGORY_KEYS = ["primaryCategory", "secondaryCategory"] as const;

export interface NormalizeOptions {
  /** alias -> canonical category, from schema/category-aliases.yaml */
  aliases: Record<string, string>;
}

function scalarString(node: unknown): string | null {
  return isScalar(node) && typeof node.value === "string" ? node.value : null;
}

function blockScalar(value: string): Scalar {
  const scalar = new Scalar(value.replace(/\n+$/, ""));
  scalar.type = Scalar.BLOCK_LITERAL;
  return scalar;
}

function rewriteCategoryScalars(doc: Document, aliases: Record<string, string>): string[] {
  const changes: string[] = [];
  for (const key of CATEGORY_KEYS) {
    const node = doc.get(key, true);
    const value = scalarString(node);
    if (value === null || !(value in aliases)) continue;
    doc.set(key, aliases[value]);
    changes.push(`${key}: ${value} -> ${aliases[value]}`);
  }
  return changes;
}

function rewriteCategoryList(doc: Document, aliases: Record<string, string>): string[] {
  const changes: string[] = [];
  const node = doc.get("categories", true);
  if (!isSeq(node)) return changes;
  const primary = scalarString(doc.get("primaryCategory", true));
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const item of node.items) {
    const raw = scalarString(item);
    if (raw === null) return changes;
    const canonical = raw in aliases ? (aliases[raw] as string) : raw;
    if (canonical !== raw) changes.push(`categories: ${raw} -> ${canonical}`);
    if (canonical === primary) {
      changes.push(`categories: dropped ${raw}, equal to primaryCategory`);
      continue;
    }
    if (seen.has(canonical)) {
      changes.push(`categories: dropped duplicate ${raw}`);
      continue;
    }
    seen.add(canonical);
    kept.push(canonical);
  }
  if (changes.length === 0) return changes;
  if (kept.length === 0) doc.delete("categories");
  else {
    const seq = new YAMLSeq();
    for (const value of kept) seq.add(value);
    doc.set("categories", seq);
  }
  return changes;
}

/** `details` and `specs`: YAML arrays become one block scalar, and a multi-line plain scalar becomes `|-`. */
function normalizeProseField(doc: Document, key: "details" | "specs"): string[] {
  const node = doc.get(key, true);
  if (isSeq(node)) {
    const lines: string[] = [];
    for (const item of node.items) {
      const text = scalarString(item);
      if (text === null) return [];
      const trimmed = text.trim();
      if (!trimmed) continue;
      lines.push(key === "specs" && !trimmed.startsWith("- ") ? `- ${trimmed}` : trimmed);
    }
    if (lines.length === 0) {
      doc.delete(key);
      return [`${key}: removed empty list`];
    }
    doc.set(key, blockScalar(lines.join(key === "specs" ? "\n" : "\n\n")));
    return [`${key}: list -> block scalar`];
  }
  if (isScalar(node) && typeof node.value === "string") {
    const multiLine = node.value.includes("\n");
    const isBlock = node.type === Scalar.BLOCK_LITERAL || node.type === Scalar.BLOCK_FOLDED;
    if (multiLine && !isBlock) {
      doc.set(key, blockScalar(node.value));
      return [`${key}: plain scalar -> block scalar`];
    }
    if (isBlock && /\n$/.test(node.value)) {
      doc.set(key, blockScalar(node.value));
      return [`${key}: trailing newline stripped`];
    }
  }
  return [];
}

function orderIoFields(doc: Document): string[] {
  const node = doc.get("io", true);
  if (!isSeq(node)) return [];
  const keyOf = (pair: Pair): string => String((pair.key as Scalar).value);
  const rank = (pair: Pair): number => {
    const i = IO_FIELD_ORDER.indexOf(keyOf(pair));
    return i === -1 ? IO_FIELD_ORDER.length : i;
  };
  let reordered = 0;
  for (const port of node.items) {
    if (!isMap(port)) continue;
    const sorted = [...port.items].sort((a, b) => rank(a) - rank(b));
    if (sorted.every((pair, i) => pair === port.items[i])) continue;
    port.items = sorted;
    reordered += 1;
  }
  return reordered > 0 ? [`io: reordered fields on ${reordered} port(s)`] : [];
}

/**
 * Normalise one entry in place. Returns one line per change, empty when
 * the document was already in shape, so a caller can skip the write and
 * leave an untouched file byte for byte alone.
 */
export function normalizeDocument(doc: Document, options: NormalizeOptions): string[] {
  if (!isMap(doc.contents)) return [];
  return [
    ...rewriteCategoryScalars(doc, options.aliases),
    ...rewriteCategoryList(doc, options.aliases),
    ...normalizeProseField(doc, "details"),
    ...normalizeProseField(doc, "specs"),
    ...orderIoFields(doc),
  ];
}

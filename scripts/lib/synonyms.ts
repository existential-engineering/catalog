/**
 * Curated search-term expansion for typo / variant tolerance.
 *
 * Consumed by build-sqlite.ts when populating each *_search_terms table
 * and the corresponding FTS5 `search_terms` column. The Studio app's
 * fuzzy "did you mean" layer works without these (it runs client-side),
 * but populating common synonyms lets the strict FTS path return hits
 * directly, avoiding the slower fuzzy fallback.
 *
 * Pure module — no I/O. Add to the lists below and the snapshot test
 * will pin the output for visibility.
 */

/** Curated common misspellings: [typo, canonical]. */
const MISSPELLINGS: ReadonlyArray<readonly [string, string]> = [
  ["srum", "serum"],
  ["serm", "serum"],
  ["masive", "massive"],
  ["maasive", "massive"],
  ["piments", "pigments"],
  ["pigmnts", "pigments"],
  ["oporator", "operator"],
  ["compresor", "compressor"],
  ["reveerb", "reverb"],
  ["abelton", "ableton"],
  ["ableon", "ableton"],
  ["kontact", "kontakt"],
];

/** Common abbreviations: [full, short]. */
const SHORT_FORMS: ReadonlyArray<readonly [string, string]> = [
  ["compressor", "comp"],
  ["reverb", "verb"],
  ["equalizer", "eq"],
  ["equaliser", "eq"],
  ["delay", "dly"],
  ["synthesizer", "synth"],
  ["synthesiser", "synth"],
];

/**
 * Generate hyphen/space/digit-boundary variants of a product or brand name.
 * "MS-20"  → ["ms20", "ms 20"]
 * "OP 1"   → ["op1", "op-1"]
 * "ableton live" → [] (no transformable structure)
 */
export function brandVariants(name: string): string[] {
  const variants = new Set<string>();
  const lower = name.toLowerCase().trim();
  if (!lower) return [];

  const hasHyphen = lower.includes("-");
  const hasSpace = /\s/.test(lower);

  if (hasHyphen) {
    variants.add(lower.replace(/-/g, ""));
    variants.add(lower.replace(/-/g, " "));
  }
  if (hasSpace) variants.add(lower.replace(/\s+/g, ""));

  // Insert separator at letter→digit transitions. Run against the
  // single-token form so "OP 1" also generates "op-1" (and "MS 20" gets
  // "ms-20"), not just the bare space-stripped variant.
  const lowerNoSpace = hasSpace ? lower.replace(/\s+/g, "") : lower;
  if (/[a-z]\d/.test(lowerNoSpace)) {
    variants.add(lowerNoSpace.replace(/([a-z])(\d)/g, "$1 $2"));
    variants.add(lowerNoSpace.replace(/([a-z])(\d)/g, "$1-$2"));
  }

  variants.delete(lower);
  return [...variants];
}

/**
 * Expand the search-term set for a single product/manufacturer.
 *
 * @param name           Product display name
 * @param manufacturer   Manufacturer name (may be null for manufacturer rows)
 * @param categories     Category names
 * @param existingTerms  YAML-declared `searchTerms` (already inserted separately)
 * @returns Additional terms to insert. May be empty. Caller dedupes against
 *          the YAML set if needed.
 */
export function expandSearchTerms(
  name: string,
  manufacturer: string | null,
  categories: readonly string[],
  existingTerms: readonly string[] = []
): string[] {
  const out = new Set<string>();
  // Word-boundary tokens, not substrings — otherwise "compressor" triggers
  // on "composer", "ableton" on "ableon" expanding to unrelated products,
  // etc. Split on any non-letter run so we get whole-word atoms.
  const words = new Set(
    [name, manufacturer ?? "", ...categories, ...existingTerms]
      .join(" ")
      .toLowerCase()
      .split(/[^\p{L}\d]+/u)
      .filter(Boolean)
  );

  for (const [typo, canonical] of MISSPELLINGS) {
    if (words.has(canonical)) out.add(typo);
  }
  for (const [full, short] of SHORT_FORMS) {
    if (words.has(full)) out.add(short);
  }
  for (const v of brandVariants(name)) out.add(v);

  // Don't re-insert anything the caller already has
  const existingLower = new Set(existingTerms.map((t) => t.toLowerCase()));
  for (const t of [...out]) {
    if (existingLower.has(t)) out.delete(t);
  }

  return [...out];
}

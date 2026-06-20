/**
 * Curated search-term expansion for typo / variant tolerance.
 *
 * Consumed by build-sqlite.ts when populating each *_search_terms table
 * and the corresponding FTS5 `search_terms` column. The Studio app's
 * fuzzy "did you mean" layer works without these (it runs client-side),
 * but populating common synonyms lets the strict FTS path return hits
 * directly, avoiding the slower fuzzy fallback.
 *
 * Pure module — no I/O. Data lives in the sibling
 * `synonyms-misspellings.ts` and `synonyms-abbreviations.ts` files so
 * additions are reviewed as pure data changes; the snapshot test pins
 * representative output for visibility.
 */

import { SHORT_FORMS } from "./synonyms-abbreviations.js";
import { MISSPELLINGS } from "./synonyms-misspellings.js";

/**
 * Generate punctuation/space/digit-boundary variants of a product or brand name.
 * "MS-20"          → ["ms20", "ms 20"]
 * "OP 1"           → ["op1", "op-1"]
 * "A.O.M."         → ["aom", "a o m"]
 * "Mesa/Boogie"    → ["mesaboogie", "mesa boogie"]
 * "Bang & Olufsen" → ["bang and olufsen", "bang olufsen", "bangolufsen", …]
 * "D'Addario"      → ["daddario", "d addario"]
 * "ableton live"   → ["abletonlive"]
 *
 * Separators (hyphen, period, straight/curly apostrophe, ampersand, slash) each
 * yield a removed form ("a.o.m." → "aom") and a spaced form ("mesa/boogie" →
 * "mesa boogie"), so FTS prefix matching works whether the user types the
 * punctuation or omits it. Ampersands additionally seed an "and" rewrite.
 */
export function brandVariants(name: string): string[] {
  const variants = new Set<string>();
  const lower = name.toLowerCase().trim();
  if (!lower) return [];

  // hyphen, period, straight + curly apostrophe, ampersand, slash
  const SEP = /[.'’&/-]/;
  const SEP_G = /[.'’&/-]/g;

  // Seed with the raw name plus an ampersand→"and" rewrite, so "Bang & Olufsen"
  // also produces "bang and olufsen" alongside the stripped/spaced forms. The
  // rewrite is added as a variant directly (its spaced form is otherwise lost,
  // since seeds only contribute their transformations).
  const seeds = new Set<string>([lower]);
  if (lower.includes("&")) {
    const andForm = lower.replace(/&/g, " and ");
    seeds.add(andForm);
    variants.add(andForm);
  }

  for (const seed of seeds) {
    if (SEP.test(seed)) {
      variants.add(seed.replace(SEP_G, "")); // "a.o.m." → "aom"
      variants.add(seed.replace(SEP_G, " ")); // "mesa/boogie" → "mesa boogie"
    }
    if (/\s/.test(seed)) variants.add(seed.replace(/\s+/g, ""));

    // Insert separator at letter→digit transitions. Run against the
    // single-token form so "OP 1" also generates "op-1" (and "MS 20" gets
    // "ms-20"), not just the bare space-stripped variant.
    const noSpace = seed.replace(/\s+/g, "");
    if (/[a-z]\d/.test(noSpace)) {
      variants.add(noSpace.replace(/([a-z])(\d)/g, "$1 $2"));
      variants.add(noSpace.replace(/([a-z])(\d)/g, "$1-$2"));
    }
  }

  // Normalize whitespace and drop empties / the unchanged original.
  const cleaned = new Set<string>();
  for (const v of variants) {
    const c = v.replace(/\s+/g, " ").trim();
    if (c && c !== lower) cleaned.add(c);
  }
  return [...cleaned];
}

/**
 * Expand the search-term set for a single product/manufacturer.
 *
 * @param name                    Product display name
 * @param manufacturer            Manufacturer name (may be null for mfr rows)
 * @param categories              Category names (already normalized to canonical)
 * @param existingTerms           YAML-declared `searchTerms` (inserted separately)
 * @param inverseCategoryAliases  Optional canonical→aliases map. Lets us emit
 *                                every known alias of a product's categories as
 *                                a search term, so users typing any equivalent
 *                                form (`eq`, `graphic-equalizer`, `dynamic-eq`)
 *                                find an `equalizer` product. Build-sqlite owns
 *                                the alias data and inverts it once at startup.
 * @returns Additional terms to insert. May be empty. Caller dedupes against
 *          the YAML set if needed.
 */
export function expandSearchTerms(
  name: string,
  manufacturer: string | null,
  categories: readonly string[],
  existingTerms: readonly string[] = [],
  inverseCategoryAliases?: ReadonlyMap<string, readonly string[]>
): string[] {
  const out = new Set<string>();
  // Word-boundary tokens from the product's IDENTITY (name + manufacturer +
  // categories). Excludes existingTerms — author-supplied search terms are
  // for free-text matching ("compatible with ableton" on a non-Ableton
  // product) and shouldn't seed cross-product synonym expansion. Tokens
  // are split on any non-letter/digit run for clean whole-word atoms.
  const words = new Set(
    [name, manufacturer ?? "", ...categories]
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

  // Emit every known alias of each canonical category as a search term.
  // Categories at this point are the post-normalized canonical form (e.g.
  // YAML "saturator" was already mapped to "saturation" before getting
  // here), so we just look up the inverse to recover the alias forms.
  if (inverseCategoryAliases) {
    for (const category of categories) {
      const aliases = inverseCategoryAliases.get(category.toLowerCase());
      if (aliases) {
        for (const alias of aliases) out.add(alias);
      }
    }
  }

  // Don't re-insert anything the caller already has
  const existingLower = new Set(existingTerms.map((t) => t.toLowerCase()));
  for (const t of [...out]) {
    if (existingLower.has(t)) out.delete(t);
  }

  return [...out];
}

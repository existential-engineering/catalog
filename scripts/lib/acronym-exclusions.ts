/**
 * Heuristic for the W127_MISSING_SEARCH_TERMS validation warning.
 *
 * The warning fires on short all-caps entry names that look like true
 * acronyms (MPC, ADT, AGL) — those may have meaningful expansions worth
 * indexing that brandVariants() cannot derive from the name alone.
 *
 * Names that happen to be uppercase English words or stylized brand names
 * (REAPER, TONIC, IRON) are filtered out by length cap + an explicit
 * exclusion list below.
 *
 * Model-number / hyphenated names (DR-110, SM-7B) are deliberately not
 * checked here: brandVariants() in synonyms.ts already auto-generates
 * dash-stripped and space-separated variants at build time.
 */

/**
 * Lowercase names that match the acronym regex but are not real acronyms.
 *
 * Guidelines for adding entries:
 *   - Only add when the name is a real English word, proper noun, or
 *     clearly stylized brand name. True acronyms (MPC, ADT, AGL, MBC, VCA)
 *     should still get the warning so authors can consider adding an
 *     expansion as a searchTerm.
 *   - Keep lowercase. Matching is case-insensitive on the entry name.
 *   - Entries 6+ chars are already filtered by the length cap, so this
 *     list only needs entries of 2-5 chars.
 */
const ACRONYM_FALSE_POSITIVES: ReadonlySet<string> = new Set([
  // Common English words used as stylized product names
  "amp",
  "art",
  "map",
  "one",
  "ahead",
  "atone",
  "base",
  "bold",
  "fire",
  "hype",
  "iron",
  "lion",
  "mood",
  "peel",
  "silo",
  "tails",
  "tens",
  "tonic",
  "triad",
  // Personal names / stylized brand names
  "lisa",
  "miya",
]);

/**
 * True if an entry name should trigger the W127_MISSING_SEARCH_TERMS warning:
 * short (2-5 chars), entirely uppercase letters, and not on the false-positive list.
 */
export function looksLikeAcronymName(name: string): boolean {
  const trimmed = name.trim();
  if (!/^[A-Z]{2,5}$/.test(trimmed)) return false;
  if (ACRONYM_FALSE_POSITIVES.has(trimmed.toLowerCase())) return false;
  return true;
}

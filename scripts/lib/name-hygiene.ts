/**
 * Name Hygiene
 *
 * Product names imported from vendor pages often carry scraped artifacts:
 * page-title taglines ("nanobox | tangerine – Compact Streaming Sampler"),
 * trademark symbols, HTML entities, or the manufacturer's display name
 * duplicated into the product name ("dbx 286s"). These helpers back the
 * E118 validation error and the W129/W130 advisory warnings.
 */

/** Trademark/legal symbols never belong in a product name. */
const LEGAL_SYMBOLS = /[™®©℠]/;

/** Unescaped HTML entities (&#038;, &amp;, &#x27;) are scrape artifacts. */
const HTML_ENTITY = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/;

/**
 * Separator punctuation at either end means a tagline was half-stripped
 * ("SE-DJ5000 —") or the scrape broke mid-title.
 */
const LEADING_SEPARATOR = /^[\s\-–—|:,]/;
const TRAILING_SEPARATOR = /[\s\-–—|:,]$/;

/**
 * En/em dash or pipe with surrounding spaces — the signature of a marketing
 * tagline ("Toolbox – Sequencer and Function Generator") or a storefront
 * brand suffix ("Groth | Wavelet Audio"). Plain hyphens are excluded: they
 * are common in legitimate product names ("AmpHub - Mizar Dist Plus Model").
 */
const TAGLINE_SEPARATOR = /\s[|–—]\s/;

/**
 * Slugs excluded from the W130 tagline warning after human review — names
 * whose separator is part of the official product name, not a tagline.
 */
export const TAGLINE_EXCLUSIONS = new Set<string>([
  // Spitfire's artist series officially uses an em dash ("Alex Epton — Entropy")
  "spitfire-audio-alex-epton-entropy",
  // "USB Type A – B cable" — the dash reads "A to B", not a tagline
  "befaco-usb-type-a-type-b-cable",
  // The dash suffix is the adapter's distinguishing spec, not marketing
  "1010-music-midi-adapter",
]);

/**
 * Returns human-readable descriptions of mechanical junk in a name.
 * Any hit is an E118 hard error — there is no legitimate case for these.
 */
export function findNameArtifacts(name: string): string[] {
  const problems: string[] = [];
  if (LEGAL_SYMBOLS.test(name)) {
    problems.push("contains a trademark/legal symbol (™ ® © ℠) — strip it");
  }
  if (HTML_ENTITY.test(name)) {
    problems.push("contains an HTML entity (e.g. &#038; or &amp;) — decode it");
  }
  if (LEADING_SEPARATOR.test(name) || TRAILING_SEPARATOR.test(name)) {
    problems.push("starts or ends with separator punctuation or whitespace — trim it");
  }
  if (/\s{2,}/.test(name)) {
    problems.push("contains consecutive spaces — collapse them");
  }
  return problems;
}

/**
 * True when a product name begins with the manufacturer's display name.
 * The manufacturer is stored and indexed separately, so repeating it in
 * `name` duplicates data ("dbx 286s" → "286s").
 *
 * Carve-outs:
 * - Manufacturer names shorter than 3 characters match too easily.
 * - Self-titled host-compatibility names keep the brand, since stripping
 *   it leaves a fragment ("Ampl4 for Positive Grid Bias" → "for …").
 */
export function manufacturerNameIsPrefix(name: string, manufacturerName: string): boolean {
  if (!manufacturerName || manufacturerName.length < 3) return false;
  if (!name.toLowerCase().startsWith(manufacturerName.toLowerCase() + " ")) return false;
  const rest = name.slice(manufacturerName.length + 1).trim();
  if (rest.length === 0) return false;
  if (/^for\s/i.test(rest)) return false;
  return true;
}

/** True when a name contains a tagline-style separator (see TAGLINE_SEPARATOR). */
export function hasTaglineSeparator(name: string): boolean {
  return TAGLINE_SEPARATOR.test(name);
}

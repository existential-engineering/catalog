/**
 * Curated full-word → short-form abbreviations for synonym expansion.
 *
 * Consumed by `expandSearchTerms` in `synonyms.ts`. For each pair, if the
 * full word appears (whole-word match) in a product's name, manufacturer,
 * or categories, the short form is added as an extra search term so users
 * typing the shorthand find the product.
 *
 * Guidelines for adding entries:
 *   - The shorthand must be unambiguous in the music-production context
 *     ("comp" → compressor is fine; "sat" → saturation is fine since most
 *     "sat"-tagged products will be saturators).
 *   - Skip shorthands shorter than 2 chars (FTS5 prefix matching needs ≥2).
 *   - List UK and US spelling variants separately for the same shorthand.
 *   - Keep both members lowercase. Matching is case-insensitive.
 */
export const SHORT_FORMS: ReadonlyArray<readonly [string, string]> = [
  ["compressor", "comp"],
  ["reverb", "verb"],
  ["equalizer", "eq"],
  ["equaliser", "eq"],
  ["delay", "dly"],
  ["synthesizer", "synth"],
  ["synthesiser", "synth"],
  ["distortion", "dist"],
  ["saturation", "sat"],
  ["limiter", "lim"],
  ["amplifier", "amp"],
  ["preamplifier", "preamp"],
  ["oscillator", "osc"],
  ["modulation", "mod"],
  ["envelope", "env"],
  ["sequencer", "seq"],
];

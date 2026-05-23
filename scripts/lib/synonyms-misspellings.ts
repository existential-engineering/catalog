/**
 * Curated typo → canonical pairs for synonym expansion.
 *
 * Consumed by `expandSearchTerms` in `synonyms.ts`. For each pair, if the
 * canonical word appears (whole-word match) in a product's name,
 * manufacturer, or categories, the typo is added as an extra search term.
 *
 * Guidelines for adding entries:
 *   - Only add typos a real user might plausibly produce — adjacent-key
 *     slips, transpositions, dropped chars, common phonetic confusions.
 *   - Avoid mappings where the typo is itself a real English word
 *     (e.g. don't add "ban" → "band" — "ban" is a word).
 *   - Avoid mappings where the canonical is a generic word that appears
 *     in unrelated product contexts (use SHORT_FORMS for those — they
 *     already require word-boundary haystack matches).
 *   - Keep both members lowercase. Matching is case-insensitive.
 */
export const MISSPELLINGS: ReadonlyArray<readonly [string, string]> = [
  // Xfer Serum
  ["srum", "serum"],
  ["serm", "serum"],
  ["seurm", "serum"],
  // Native Instruments Massive
  ["masive", "massive"],
  ["maasive", "massive"],
  // Arturia Pigments
  ["piments", "pigments"],
  ["pigmnts", "pigments"],
  ["pigmants", "pigments"],
  // Ableton Operator
  ["oporator", "operator"],
  ["operater", "operator"],
  // Generic words
  ["compresor", "compressor"],
  ["reveerb", "reverb"],
  // Ableton
  ["abelton", "ableton"],
  ["ableon", "ableton"],
  ["abletton", "ableton"],
  // Native Instruments Kontakt
  ["kontact", "kontakt"],
  ["kontak", "kontakt"],
  // Valhalla DSP
  ["valhala", "valhalla"],
  // Spectrasonics Omnisphere
  ["omnisphre", "omnisphere"],
  ["omnishpere", "omnisphere"],
  // FabFilter
  ["fabilter", "fabfilter"],
  ["fabflter", "fabfilter"],
  // iZotope
  ["izotop", "izotope"],
  ["izotpe", "izotope"],
  // Behringer
  ["beringer", "behringer"],
  ["behrringer", "behringer"],
  // Yamaha
  ["yamha", "yamaha"],
  ["yahama", "yamaha"],
  // Korg
  ["korog", "korg"],
  // Roland
  ["rolnd", "roland"],
  ["roalnd", "roland"],
  // Steinberg Cubase
  ["cubse", "cubase"],
  // Soundtoys
  ["soundtoyz", "soundtoys"],
];

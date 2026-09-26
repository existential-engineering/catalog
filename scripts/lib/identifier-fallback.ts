/**
 * Identifier Fallback
 *
 * `identifiers` is keyed by plugin format, but most software entries that
 * carry the block hold their identifier under `default` or `bundle` and
 * nothing else (217 of 247 when this was written). Neither key is a format
 * name, so the build wrote no identifier for any of those entries' formats
 * and Studio's plugin matcher, which reads `software_formats.identifier`
 * alone, could reach about 30 entries out of 247.
 *
 * `default` is the honest key for most of them: a JUCE-built plugin ships
 * one macOS bundle id across its AU, VST3 and AAX bundles, and only a vendor
 * that suffixes per format (`com.xferrecords.Serum.vst3`) needs a per-format
 * key. So the build resolves each listed format through one precedence
 * rather than asking the data to repeat itself:
 *
 *   1. a key naming the format itself (`vst3:`), which always wins
 *   2. `default`, for every listed format
 *   3. `bundle`, for `au` and `standalone` only: it names a macOS app or
 *      component bundle, and a VST3 or AAX bundle can carry a different one
 *
 * `pnpm identifier-coverage` reads the same function, so what the report
 * counts as covered is what the database carries, and `pnpm validate`
 * checks every key's value against its pattern (E400) because a value here
 * now ships. Documented in CLAUDE.md ("Identifiers") and
 * docs/VALIDATION_ERRORS.md (E400, E401).
 */

/** Formats a bare `bundle` key stands in for. */
export const BUNDLE_FALLBACK_FORMATS: ReadonlySet<string> = new Set(["au", "standalone"]);

/**
 * The identifier `software_formats.identifier` carries for one listed
 * format, or null when the entry names none that applies.
 */
export function resolveFormatIdentifier(
  identifiers: Record<string, string> | undefined,
  format: string
): string | null {
  if (!identifiers) return null;
  if (identifiers[format]) return identifiers[format];
  if (identifiers.default) return identifiers.default;
  if (identifiers.bundle && BUNDLE_FALLBACK_FORMATS.has(format)) return identifiers.bundle;
  return null;
}

/**
 * The extra identifiers one listed format carries through
 * `componentIdentifiers`, under the same precedence as the primary.
 *
 * `identifiers` holds one value per key, which is right for a plugin that
 * ships one binary. A UAD collection ships one binary per member (the 1176
 * Classic Limiter Collection installs Rev A, LN Rev E and AE, each with its
 * own bundle id), and a product can ship more than one component (Manley
 * Massive Passive and its MST variant). Studio sees each binary separately,
 * so every one of them has to resolve to the entry or the scan leaves it
 * unmatched. The primary stays in `identifiers` because Studio builds that
 * predate `software_format_identifiers` read `software_formats.identifier`
 * alone.
 */
export function resolveFormatComponentIdentifiers(
  componentIdentifiers: Record<string, string[]> | undefined,
  format: string
): string[] {
  if (!componentIdentifiers) return [];
  if (componentIdentifiers[format]) return componentIdentifiers[format];
  if (componentIdentifiers.default) return componentIdentifiers.default;
  if (componentIdentifiers.bundle && BUNDLE_FALLBACK_FORMATS.has(format)) {
    return componentIdentifiers.bundle;
  }
  return [];
}

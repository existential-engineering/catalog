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
  "ahead",
  "aim",
  "amp",
  "arp", // musician shorthand for arpeggiator (Homegrown Sounds ARP)
  "art",
  "atom",
  "atone",
  "base",
  "basil",
  "bold",
  "crust",
  "fame",
  "fire",
  "hype",
  "iron",
  "lion",
  "lofi", // "lo-fi" (JST LOFI)
  "map",
  "mixer", // Dangerous Music MIXER, an 8x2 summing mixer
  "mood",
  "one",
  "or", // logic OR gate (Intellijel OR)
  "peel",
  "polar",
  "silo",
  "sine",
  "tails",
  "tens",
  "tom", // tom drum (Sequential TOM)
  "tonic",
  "triad",
  // Foreign / borrowed words used as product names
  "aum", // Sanskrit syllable (Kymatica AUM)
  "ciao", // Italian greeting (Bastl CIAO!)
  "mahi", // mahi-mahi fish (Manley Mahi)
  "urla", // Italian for "scream" (AC Noises URLA)
  "zhega", // Bulgarian for "scorching heat" (Antelope ZHEGA)
  // Personal names / stylized brand names
  "abc", // Bastl ABC — named for its A–F channel letters
  "bob", // Czech cartoon rabbit (Bastl's Bob a Bobek systems)
  "bobek", // sibling of Bastl's Bob, same cartoon pair
  "crom", // Conan the Barbarian's deity (Caroline CROM, with Sword/Mountain knobs)
  "lol", // Bastl styles it "Lol", not an initialism
  "crbn", // Audeze CRBN — vowel-less "carbon"
  "iroi", // Befaco IROI — tail of "Oneiroi"
  "ivgi", // Klanghelm coinage
  "lcast", // MeterPlugs L(oudness)+CAST portmanteau
  "lisa",
  "midiq", // WA Production MIDI+Q portmanteau, pronounced "midi-cue"
  "miya",
  "mjuc", // Klanghelm coinage
  "taip", // Baby Audio phonetic respelling of "tape"
  "xo", // XLN Audio brand styling
  "xs", // Future Retro pun on "excess"
]);

/**
 * True acronym / letter-name products that have been researched (manufacturer
 * pages, manuals, period reviews) with no documented expansion or alternate
 * form worth indexing — the name and manufacturer columns already cover them
 * in full-text search. Suppressed so W127 doesn't re-prompt the same dead-end
 * research. Remove an entry here if a real expansion or nickname surfaces.
 */
const RESEARCHED_NO_EXPANSION: ReadonlySet<string> = new Set([
  "adm", // Avantone Pro ADM snare mic
  "afeq", // Inferior Sound AFEQ
  "bclk", // Burl Audio clock daughter card, "B" series part number
  "bcg", // Code Audio BCG
  "djs", // Pioneer DJS software
  "dmx", // Oberheim DMX
  "dsr", // Black Salt Audio DSR
  "dsx", // Oberheim DSX
  "dx", // Oberheim DX
  "iieq", // DDMF IIEQ
  "mf", // Collings mandolin, M + F-style body; no expansion published
  "mfd", // ALM Busy Circuits MFD
  "mfx", // ALM Busy Circuits MFX
  "mq", // Dangerous Music MQ
  "mt", // Collings mandolin, sibling of the MF; no expansion published
  "nv", // Numark NV
  "sft", // Catalinbread SFT, Ampeg-inspired overdrive
  "src", // Antelope Audio SRC
  "stvc", // Waldorf STVC
  "vfx", // Ensoniq VFX
  "vma", // Brauner VM-family tube mic
  "vmx", // Brauner VM-family tube mic
  "vumt", // Klanghelm VUMT
]);

/**
 * True if an entry name should trigger the W127_MISSING_SEARCH_TERMS warning:
 * short (2-5 chars), entirely uppercase letters, and not on the false-positive
 * or researched-no-expansion lists.
 */
export function looksLikeAcronymName(name: string): boolean {
  const trimmed = name.trim();
  if (!/^[A-Z]{2,5}$/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (ACRONYM_FALSE_POSITIVES.has(lower)) return false;
  if (RESEARCHED_NO_EXPANSION.has(lower)) return false;
  return true;
}

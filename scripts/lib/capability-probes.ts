/**
 * Prose Probes For Capability Gaps
 *
 * `capabilities` is populated once and then goes stale: nothing in either
 * import shape writes the field, so an entry gains algorithms — the H90's
 * granular suite is the case that surfaced this — while its list stays at
 * whatever the original pass wrote. These probes read an entry's own
 * `description`/`details`/`specs` back and report operations the prose names
 * that the list does not carry.
 *
 * TIERS, AND WHY THE SPLIT IS THE WHOLE DESIGN
 *
 * A probe is a guess about language, and the field's governing rule is that a
 * guessed capability is indistinguishable from a verified one once written.
 * So the tier is a claim about how often the token means the operation:
 *
 *   - `auto` — the token is an operation's name and is not plausibly anything
 *     else in product prose. "vocoder", "harmonizer", "ring modulator". Safe
 *     to write unreviewed, the same standing `discontinued:apply` gives
 *     superseded entries.
 *   - `review` — the token is as likely to name a control, a spec, or a
 *     neighbouring product as an operation. "filter" is the worst of them: a
 *     tone control on a delay's repeats is not `filter` in the sense the
 *     vocabulary means (resonant/multimode filtering as a played effect), and
 *     117 of the corpus's hits are that. "compression driver" on a speaker
 *     and "low distortion" in a spec table are the same failure. These are
 *     reported and curated by hand, never applied in bulk.
 *
 * A probe that starts producing false positives moves down a tier; it does not
 * acquire a per-entry exception list. The NEGATIONS below are the one shared
 * guard, and they encode failure classes rather than individual entries.
 */

export type ProbeTier = "auto" | "review";

export interface Probe {
  capability: string;
  tier: ProbeTier;
  pattern: RegExp;
}

/**
 * The four ways prose names an operation the product does not perform. Each
 * was found in the corpus, not imagined, and each defeated a probe that looked
 * sound until it ran:
 *
 *   - denied in a spec table — the Korg DVP-1 lists "Arpeggiator/Sequencer:
 *     None", which is the strongest possible evidence AGAINST `sequencing`
 *   - measured rather than performed — "<0.001% THD", "total harmonic
 *     distortion below 0.001%", "low distortion", and a passive speaker's
 *     "compression driver", which is a transducer
 *   - named as something the unit works WITH — the Origin Effects DeLuxe55 is
 *     "compatible with amps, modellers, power amps and cabinet simulators"
 *   - named as an influence — the ALM MUM M8 filter is "inspired by the filter
 *     circuit of the Akai S950 12-bit sampler"
 *   - named as a simile — Source Audio's Gemini, Lunar and Mercury each say
 *     their envelope follower is "similar to auto-wah effects" or gives
 *     "auto-wah-style modulation control", which is a comparison, not a wah
 *
 * A fifth class has no guard and is why several probes sit in `review`: prose
 * that names a sibling product ("the Mini platform that also spawned DITTO
 * LOOPER"). Recognising that needs a product index, not a regex.
 */
const NEGATIONS_BEFORE =
  /\b(?:no|low|zero|minimal|without|free of|reduces?|avoids?|prevents?|less|instead of)\s+\S{0,24}$|\b(?:thd|signal[- ]to[- ]noise|dynamic range|cocked)\s*\S{0,12}$|\b(?:total )?harmonic\s+$|\b(?:similar to|reminiscent of|evoking|akin to|acts? as|in the vein of|think)\s+\S{0,20}$|\bquasi-?$|\b(?:compatible with|compatibility with|works? with|designed to work with|pairs? (?:well )?with|inspired by|based on|modell?ed (?:on|after)|in the style of|alongside|feeding|drives?|connected|external|outboard|insert (?:a|your|an)|into (?:your|an?))\b[^.]{0,90}$/i;

/** Denials that follow the token, as a spec table writes them. */
const NEGATIONS_AFTER =
  /^[\w/ -]{0,24}?\s*(?::|--|—)\s*(?:none|n\/a|not (?:included|available|supported))\b|^\s*(?:none|n\/a)\b|^\s+drivers?\b|^[- ]?(?:style|like|ish|esque|type)\b/i;

/** Characters of context tested on each side of a match. */
const NEGATION_WINDOW = 120;
const NEGATION_WINDOW_AFTER = 24;

/**
 * The probe table. Ordered by vocabulary section, not by tier, so a value
 * added to schema/capabilities.yaml has an obvious place to gain a probe.
 */
export const PROBES: Probe[] = [
  // Time & space
  { capability: "reverb", tier: "review", pattern: /\breverbs?\b/i },
  { capability: "delay", tier: "review", pattern: /\bdelays?\b|\btape echo\b/i },
  // "the Mini platform that also spawned DITTO LOOPER" names a sibling
  // product. No regex separates that from a looper the unit has.
  {
    capability: "looper",
    tier: "review",
    pattern: /\bloopers?\b|\bloop station\b|\bphrase looper\b/i,
  },
  // "near-infinite sustain at extreme settings" is a long reverb decay.
  {
    capability: "freeze",
    tier: "auto",
    pattern: /\bfreez(?:e|ing)\b|(?<!near-)\binfinite sustain\b/i,
  },
  {
    capability: "granular",
    tier: "auto",
    // "a smeared, granular texture" is an adjective describing a fuzz; the
    // noun it qualifies is what separates a description from an engine.
    pattern:
      /\bgranular (?:delay|reverb|sampler|engine|process\w*|synthes\w+|effects?|mode|algorithm|section)\b|\bgrain (?:cloud|delay|engine|size)\b/i,
  },
  {
    capability: "reverse",
    tier: "auto",
    pattern: /\breverse (?:delays?|reverbs?|playback|modes?|buffers?)\b|\breversed? playback\b/i,
  },

  // Modulation
  // Demoted from `auto` after four false positives in one corpus pass: a
  // sibling pedal (Caroline Arigato, JHS Artificial Blonde), a homonym (the
  // Roland VP-550's "Mixed Chorus" is a choir voice) and a flanger's own
  // "lush chorusing" (TC Thunderstorm). None is separable by pattern, which is
  // what the review tier is for.
  { capability: "chorus", tier: "review", pattern: /\bchorus(?:es|ing)?\b/i },
  { capability: "flanger", tier: "auto", pattern: /\bflanger\b|\bflanging\b/i },
  { capability: "phaser", tier: "auto", pattern: /\bphasers?\b|\bphase shifter\b/i },
  // "pair perfectly with the tremolo and reverb on his amps" is the amp\u2019s.
  { capability: "tremolo", tier: "review", pattern: /\btremolos?\b/i },
  { capability: "vibrato", tier: "auto", pattern: /\bvibratos?\b/i },
  // "the rotary speaker vibes of the \u201960s" is a simile a chorus pedal
  // uses about its own character, not a rotary emulation.
  {
    capability: "rotary",
    tier: "review",
    pattern: /\brotary speaker\b|\bleslie\b|\brotary cabinet\b/i,
  },
  // "pseudo ring-mod upper octave harmonics" describes a fuzz\u2019s character.
  {
    capability: "ring-modulation",
    tier: "review",
    pattern: /\bring[- ]?mod(?:ulator|ulation)?\b/i,
  },
  { capability: "frequency-shift", tier: "auto", pattern: /\bfrequency shift(?:er|ing)?\b/i },
  { capability: "auto-pan", tier: "auto", pattern: /\bauto[- ]?pan(?:ner|ning)?\b/i },

  // Pitch
  { capability: "pitch-shift", tier: "auto", pattern: /\bpitch[- ]shift(?:er|ing)?\b/i },
  { capability: "harmonizer", tier: "auto", pattern: /\bharmoni[sz](?:er|ation|ing)\b/i },
  // An "octave divider-based oscillator bank" is a synth voice, not an
  // octave effect.
  {
    capability: "octave",
    tier: "review",
    pattern: /\boctave[- ](?:up|down|divider|doubler)\b|\boctaver\b/i,
  },
  // A "CV pan/detune control" is a parameter on a voice.
  { capability: "detune", tier: "review", pattern: /\bdetun(?:e|ed|ing)\b/i },
  {
    capability: "pitch-correction",
    tier: "auto",
    pattern: /\bpitch correction\b|\bauto[- ]?tune\b|\bvocaltune\b/i,
  },

  // Gain & saturation
  { capability: "overdrive", tier: "review", pattern: /\boverdrive\b/i },
  { capability: "distortion", tier: "review", pattern: /\bdistortion\b/i },
  { capability: "fuzz", tier: "auto", pattern: /\bfuzz\b/i },
  { capability: "saturation", tier: "review", pattern: /\bsaturation\b|\btape colou?r\w*\b/i },
  { capability: "boost", tier: "review", pattern: /\bclean boost\b|\bboost pedal\b/i },
  {
    capability: "bit-crush",
    tier: "auto",
    pattern:
      /\bbit[- ]?crush(?:er|ing)?\b|\bsample[- ]rate reduction\b|\bbit[- ]depth reduction\b/i,
  },
  {
    capability: "amp-modeling",
    tier: "auto",
    pattern:
      /\bamp(?:lifier)? (?:model|sim)(?:ing|ulation|ulator|eling|elling)?\b|\bamp models?\b/i,
  },
  {
    capability: "cabinet-simulation",
    tier: "auto",
    pattern:
      /\bcab(?:inet)? (?:sim|simulation|simulator|model)\w*\b|\bimpulse responses?\b|\bIR loader\b/i,
  },

  // Dynamics
  { capability: "compression", tier: "review", pattern: /\bcompress(?:or|ion|ors)\b/i },
  { capability: "limiting", tier: "review", pattern: /\blimiters?\b|\blimiting\b/i },
  { capability: "gating", tier: "review", pattern: /\bnoise gate\b|\bgating\b/i },
  {
    capability: "expansion",
    tier: "auto",
    // A bare "expander" is more often an accessory module in this corpus
    // (Axon-2, CV Trinity Expander) than a dynamics stage, so the ratio or
    // the direction has to be present.
    pattern: /\bdownward expansion\b|\bexpander \(1:\d|\bexpander\/gate\b|\bgate\/expander\b/i,
  },
  { capability: "de-essing", tier: "auto", pattern: /\bde[- ]?ess(?:er|ing)\b/i },
  {
    capability: "transient-shaping",
    tier: "auto",
    // "snappy transient control" is a compressor's attack, not a shaper.
    pattern: /\btransient (?:shap|design)\w*\b|\btransient designer\b/i,
  },
  {
    capability: "auto-gain",
    tier: "auto",
    // `AGC` keeps its own case-sensitive alternative: lowercased, "agc" turns
    // up inside unrelated words far more often than it names the operation.
    pattern: /\bautomatic gain control\b|\bauto[- ]gain\b/i,
  },
  { capability: "auto-gain", tier: "auto", pattern: /\bAGC\b/ },

  // Spectral & filtering
  {
    capability: "equalization",
    tier: "review",
    pattern: /\bequali[sz](?:er|ation)\b|\b\d-band EQ\b/i,
  },
  { capability: "filter", tier: "review", pattern: /\bfilters?\b/i },
  { capability: "wah", tier: "auto", pattern: /\bwah\b/i },
  { capability: "vocoder", tier: "auto", pattern: /\bvocoder\b|\bvocoding\b/i },
  // A dual-effect pedal with "an adjustable crossover point between them" is
  // not splitting bands for separate amplification, which is what the
  // vocabulary means. The distinction is contextual, so a human reads it.
  { capability: "crossover", tier: "review", pattern: /\bcrossovers?\b/i },
  {
    capability: "feedback-suppression",
    tier: "auto",
    pattern: /\bfeedback (?:suppress|elimin)\w*\b/i,
  },
  {
    capability: "noise-reduction",
    tier: "review",
    pattern: /\bnoise reduction\b|\bde[- ]?nois\w+\b/i,
  },
  { capability: "subharmonic-synthesis", tier: "auto", pattern: /\bsub[- ]?harmonics?\b/i },
  {
    capability: "stereo-widening",
    tier: "auto",
    // Bare "mid-side processing" is a topology; a mastering limiter doing it
    // is not necessarily widening the field.
    pattern: /\bstereo widen(?:er|ing)\b|\bstereo width control\b|\bwiden(?:s|ing) the stereo\b/i,
  },
  {
    capability: "spatialization",
    tier: "auto",
    pattern: /\bbinaural\b|\bambisonic\w*\b|\bdolby atmos\b|\bsurround (?:panner|panning)\b/i,
  },
  {
    capability: "harmonic-enhancement",
    tier: "auto",
    // A bare "enhancer" is what every boost pedal calls itself; the added
    // harmonics have to be the claim.
    pattern: /\bexciters?\b|\bharmonic (?:enhance|excit)\w*\b|\badded harmonics\b/i,
  },

  // Sampling & rhythm
  {
    capability: "sampling",
    tier: "review",
    // Half the corpus hits name a sampler the unit is modelled on or feeds,
    // not one it contains.
    pattern: /\bsampler\b|\bsampling engine\b|\bsample playback\b/i,
  },
  {
    capability: "sequencing",
    tier: "auto",
    pattern: /\bstep sequencer\b|\bsequencer\b|\barpeggiator\b|\bpattern generator\b/i,
  },
  {
    capability: "beat-slicing",
    tier: "review",
    pattern: /\bstutter(?:ing)?\b|\bglitch\w*\b|\bbeat[- ]?slic\w+\b/i,
  },

  // Modeling & utility
  { capability: "mic-modeling", tier: "auto", pattern: /\b(?:microphone|mic) model\w*\b/i },
  {
    capability: "alignment-delay",
    tier: "auto",
    pattern: /\balignment delay\b|\bdriver alignment\b|\btime align\w*\b/i,
  },
];

/**
 * Every capability the prose names, with the tier of the probe that found it
 * and the sentence it was found in. The excerpt is what makes a report
 * reviewable: a bare capability name asks the reader to re-read the file, and
 * the review tier exists precisely because the reader has to judge the
 * sentence rather than the token.
 */
export interface ProbeHit {
  capability: string;
  tier: ProbeTier;
  excerpt: string;
}

/** Trim a match to a readable one-line excerpt centred on the token. */
function excerptAround(prose: string, index: number, length: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(prose.length, index + length + 60);
  const slice = prose.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < prose.length ? "…" : ""}`;
}

/**
 * Run every probe over one entry's prose and return the hits whose capability
 * is absent from `have`. A probe matching inside a negation window is dropped
 * rather than demoted: "low distortion" is not weak evidence of distortion, it
 * is evidence against.
 */
export function probeProse(prose: string, have: Set<string>): ProbeHit[] {
  const hits: ProbeHit[] = [];
  for (const probe of PROBES) {
    if (have.has(probe.capability)) continue;
    const pattern = new RegExp(probe.pattern.source, `${probe.pattern.flags.replace("g", "")}g`);
    let match: RegExpExecArray | null = pattern.exec(prose);
    while (match !== null) {
      const before = prose.slice(Math.max(0, match.index - NEGATION_WINDOW), match.index);
      const after = prose.slice(
        match.index + match[0].length,
        match.index + match[0].length + NEGATION_WINDOW_AFTER
      );
      if (!NEGATIONS_BEFORE.test(before) && !NEGATIONS_AFTER.test(after)) {
        hits.push({
          capability: probe.capability,
          tier: probe.tier,
          excerpt: excerptAround(prose, match.index, match[0].length),
        });
        break;
      }
      match = pattern.exec(prose);
    }
  }
  return hits;
}

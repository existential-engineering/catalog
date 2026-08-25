#!/usr/bin/env tsx
/**
 * Derive Capabilities From Declared Categories
 *
 * Bulk-populates `capabilities` for effects hardware by projecting the
 * functional subset out of `categories` and `primaryCategory`.
 *
 * WHAT THIS IS AND IS NOT
 *
 * This derives from data the entry already declares. It adds no information
 * that was not already in the file — its value is that it separates the
 * functional claims from the non-functional ones. `categories` mixes lifecycle
 * (`discontinued`), form factor (`rack-mount`), technology (`analog`) and era
 * (`vintage`) in with function, so nothing can read the functional subset back
 * out without a table saying which values are which. This is that table.
 *
 * The payoff is cross-category matching. A `reverb` pedal and a `multi-effect`
 * that happens to do reverb share no category and never will, because
 * `primaryCategory` is a single bucket; as capability sets they overlap
 * correctly.
 *
 * A derived list is therefore a floor, not a survey: it records what the entry
 * already claimed, and a unit that does more than its categories admit stays
 * under-described until someone reads its prose. The 51 `multi-effect` entries
 * were done that richer way by hand and are skipped here — never overwrite a
 * hand-authored list with a derived one.
 *
 * SCOPE
 *
 * Only entries whose `primaryCategory` is in the Effects group. A synthesizer
 * carrying `categories: [reverb]` genuinely does perform reverb, but the
 * vocabulary has no synthesis values yet, so it would be left claiming reverb
 * is all it does — worse than claiming nothing. Widen this when the vocabulary
 * covers synthesis.
 *
 * Usage:
 *   pnpm derive-capabilities            # dry run, prints what would change
 *   pnpm derive-capabilities --apply    # write the files
 *   pnpm derive-capabilities --unmapped # audit categories with no mapping
 */

import fs from "node:fs";
import path from "node:path";
import { getCapabilitiesSet } from "./lib/schema-loader.js";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, SCHEMA_DIR } from "./lib/utils.js";

/**
 * Category -> capabilities it definitionally implies.
 *
 * Every entry here must be true by definition, never by likelihood: a product
 * categorised `overdrive` performs overdrive, full stop.
 *
 * Deliberately absent, and each costs real information:
 *   - family names that do not pin an operation — `dynamics` (107 uses on
 *     effects entries) could be any of compression, limiting, gating or
 *     expansion; `modulation` (78) any of chorus, flanger, phaser, tremolo
 *   - topologies — `multiband` says how, not what
 *   - nothing specific — `effect`, `fx`, `emulation`
 *   - composites — `preamp`, `channel-strip`, `mastering`, `vocal-processor`
 *
 * Mapping any of them would be guessing, and once written a guessed capability
 * is indistinguishable from a verified one. Those entries stay unpopulated,
 * which `pnpm capability-coverage` reports honestly, until someone reads the
 * prose. Run `--unmapped` to audit this list against the data.
 */
const CATEGORY_CAPABILITIES: Record<string, string[]> = {
  // Dynamics
  compressor: ["compression"],
  limiter: ["limiting"],
  gate: ["gating"],
  "noise-gate": ["gating"],
  expander: ["expansion"],
  transient: ["transient-shaping"],
  "transient-shaper": ["transient-shaping"],
  "de-esser": ["de-essing"],

  // Restoration — the de-* family are all noise reduction of one kind or
  // another; the vocabulary does not split them because no entry needs it yet.
  restoration: ["noise-reduction"],
  "noise-reduction": ["noise-reduction"],
  "de-noiser": ["noise-reduction"],
  "de-click": ["noise-reduction"],
  "de-crackle": ["noise-reduction"],
  "de-hum": ["noise-reduction"],
  "de-reverb": ["noise-reduction"],
  "de-clipper": ["noise-reduction"],

  // Spectral
  eq: ["equalization"],
  equalizer: ["equalization"],
  filter: ["filter"],
  "envelope-filter": ["filter"],
  wah: ["wah"],
  vocoder: ["vocoder"],
  exciter: ["harmonic-enhancement"],
  enhancer: ["harmonic-enhancement"],

  // Gain and saturation
  saturation: ["saturation"],
  tape: ["saturation"],
  distortion: ["distortion"],
  overdrive: ["overdrive"],
  fuzz: ["fuzz"],
  boost: ["boost"],
  "bit-crusher": ["bit-crush"],
  "lo-fi": ["bit-crush"],
  vinyl: ["bit-crush"],
  "amp-sim": ["amp-modeling"],
  "cabinet-sim": ["cabinet-simulation"],

  // Time and space
  reverb: ["reverb"],
  plate: ["reverb"],
  spring: ["reverb"],
  hall: ["reverb"],
  room: ["reverb"],
  convolution: ["reverb"],
  delay: ["delay"],
  echo: ["delay"],
  looper: ["looper"],
  "loop-station": ["looper"],
  grain: ["granular"],
  granular: ["granular"],

  // Modulation
  chorus: ["chorus"],
  flanger: ["flanger"],
  phaser: ["phaser"],
  tremolo: ["tremolo"],
  vibrato: ["vibrato"],
  rotary: ["rotary"],
  "ring-modulator": ["ring-modulation"],

  // Pitch
  pitch: ["pitch-shift"],
  "pitch-shifter": ["pitch-shift"],
  octave: ["octave"],
  harmonizer: ["harmonizer"],
  autotune: ["pitch-correction"],

  // Stereo field
  stereo: ["stereo-widening"],
  "stereo-widener": ["stereo-widening"],
  "mid-side": ["stereo-widening"],
  panning: ["auto-pan"],
  "auto-pan": ["auto-pan"],
  spatial: ["spatialization"],
  surround: ["spatialization"],
  binaural: ["spatialization"],
  immersive: ["spatialization"],

  // Rhythm and sampling
  glitch: ["beat-slicing"],
  stutter: ["beat-slicing"],
  slice: ["beat-slicing"],
  sequencer: ["sequencing"],
  arpeggiator: ["sequencing"],
  sampler: ["sampling"],
};

const effectsGroup = new Set(
  loadYamlFile<{ groups: Record<string, string[]> }>(path.join(SCHEMA_DIR, "category-groups.yaml"))
    .groups.Effects ?? []
);

interface Change {
  file: string;
  slug: string;
  name: string;
  primaryCategory: string;
  capabilities: string[];
}

function derive(data: Hardware): string[] {
  const sources = [data.primaryCategory, ...(data.categories ?? [])].filter(
    (value): value is string => Boolean(value)
  );
  const out = new Set<string>();
  for (const source of sources) {
    for (const capability of CATEGORY_CAPABILITIES[source] ?? []) out.add(capability);
  }
  return [...out];
}

/**
 * Insert after the `categories` block when there is one, else after
 * `primaryCategory`. Text insertion rather than a YAML round-trip, which would
 * reflow every block scalar in the file and bury the real change.
 */
function insertCapabilities(source: string, capabilities: string[]): string {
  const lines = source.split("\n");
  const block = ["capabilities:", ...capabilities.map((c) => `  - ${c}`)];

  let index = -1;
  const categoriesAt = lines.indexOf("categories:");
  if (categoriesAt !== -1) {
    index = categoriesAt + 1;
    while (index < lines.length && lines[index].startsWith("  - ")) index += 1;
  } else {
    const primaryAt = lines.findIndex((l) => l.startsWith("primaryCategory:"));
    if (primaryAt !== -1) index = primaryAt + 1;
  }
  if (index === -1) throw new Error("no insertion point");

  lines.splice(index, 0, ...block);
  return lines.join("\n");
}

function reportUnmapped(): void {
  const counts = new Map<string, number>();
  for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
    const data = loadYamlFile<Hardware>(file);
    if (!data.primaryCategory || !effectsGroup.has(data.primaryCategory)) continue;
    for (const value of [data.primaryCategory, ...(data.categories ?? [])]) {
      if (!value || CATEGORY_CAPABILITIES[value]) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  console.log("\n🔍 Categories on effects entries with no capability mapping\n");
  console.log("   Expected for family names and non-functional axes. Review for");
  console.log("   genuine operations the vocabulary is missing.\n");
  for (const [value, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`   ${String(count).padStart(5)}  ${value}`);
  }
  console.log("");
}

function main(): void {
  const apply = process.argv.includes("--apply");
  if (process.argv.includes("--unmapped")) {
    reportUnmapped();
    return;
  }

  const vocabulary = getCapabilitiesSet();
  for (const [category, capabilities] of Object.entries(CATEGORY_CAPABILITIES)) {
    for (const capability of capabilities) {
      if (!vocabulary.has(capability)) {
        throw new Error(
          `Mapping for '${category}' produces '${capability}', which is not in schema/capabilities.yaml.`
        );
      }
    }
  }

  const changes: Change[] = [];
  let alreadySet = 0;
  let noDerivation = 0;

  for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
    const data = loadYamlFile<Hardware>(file);
    if (!data.primaryCategory || !effectsGroup.has(data.primaryCategory)) continue;
    // Never overwrite: a hand-authored list read the prose and is strictly
    // better than anything this table can produce.
    if (data.capabilities && data.capabilities.length > 0) {
      alreadySet += 1;
      continue;
    }
    const capabilities = derive(data);
    if (capabilities.length === 0) {
      noDerivation += 1;
      continue;
    }
    changes.push({
      file,
      slug: path.basename(file, path.extname(file)),
      name: data.name,
      primaryCategory: data.primaryCategory,
      capabilities,
    });
  }

  console.log(`\n📦 Capability derivation${apply ? "" : " (dry run)"}\n`);
  console.log(`   would populate:      ${changes.length}`);
  console.log(`   already populated:   ${alreadySet}`);
  console.log(`   no mapping applies:  ${noDerivation}\n`);

  const byCount = new Map<number, number>();
  for (const change of changes) {
    byCount.set(change.capabilities.length, (byCount.get(change.capabilities.length) ?? 0) + 1);
  }
  console.log("   capabilities per entry:");
  for (const [size, count] of [...byCount].sort((a, b) => a[0] - b[0])) {
    console.log(`     ${size}: ${count}`);
  }

  if (!apply) {
    console.log("\n   sample:");
    for (const change of changes.slice(0, 8)) {
      console.log(
        `     ${change.slug} (${change.primaryCategory}) -> ${change.capabilities.join(", ")}`
      );
    }
    console.log("\n   Re-run with --apply to write.\n");
    return;
  }

  for (const change of changes) {
    const source = fs.readFileSync(change.file, "utf-8");
    fs.writeFileSync(change.file, insertCapabilities(source, change.capabilities), "utf-8");
  }
  console.log(`\n   ✅ Wrote ${changes.length} files.\n`);
}

main();

#!/usr/bin/env tsx
/**
 * Power Input Audit
 *
 * Reports hardware entries whose own prose documents a power supply but
 * whose `io` list carries no `category: power` port.
 *
 * CLAUDE.md states the rule and names its own history: "Every powered
 * hardware entry has a power input. A DC barrel, an IEC inlet, a USB power
 * port or phantom power from a host each count. A unit with none of those
 * says so in `specs` (`battery-only`, `bus-powered via USB-C`)... A missing
 * power input was the single most repeated finding (Sonicware, Darkglass,
 * Empress, Benson, Joranalogue)."
 *
 * Nothing checked it. `pnpm validate` enforces `maxConnections` and
 * `position` on every io entry, and `io-quality` scores combine candidates,
 * collapsed pairs, uniform positions, missing-io and spatial gaps — but no
 * check asks whether a unit that plugs into the wall says where. So the
 * finding kept being made by hand, one import PR at a time, and only where
 * a reviewer happened to look. The focal refresh is the worked example:
 * seven entries were flagged inline and fixed, four more were filed as
 * "outside diff range" comments and missed, and three further entries with
 * the same defect were never flagged at all.
 *
 * That matters beyond tidiness. Studio draws the setup graph from `io`, so
 * an entry with no power port is a device that cannot be plugged in.
 *
 * WHY THIS IS A PROBE AND NOT A FIX
 *
 * Same contract as `capability-gaps` and `speaker-level-audit`: the
 * evidence is the entry's own language, so this reports and a human
 * accepts. It deliberately does not write, because the connector cannot be
 * derived from the fact that a supply exists — CLAUDE.md requires the
 * connector come from the maker, and choosing between `iec-c14`, `iec-c20`
 * and a DC barrel needs the manual or a rear-panel photo.
 *
 * Three classes are removed because they can be proved rather than judged:
 *
 *   PASSIVE_CATEGORIES — a guitar, a passive cabinet or a dynamic mic has
 *     no power connector, and its prose still says "phantom power" or
 *     "battery" often enough to trip a naive scan. These dominate the raw
 *     signal: of ~940 entries matching on prose alone, ~400 are guitars,
 *     basses and microphones.
 *   SELF_POWERED — prose that states the documented exception
 *     (`battery-only`, `bus-powered via USB-C`, "powered over USB"). This
 *     is the escape hatch CLAUDE.md names, so honouring it is the point.
 *   BUS_POWERED_PORT — prose says the unit draws power over a bus and the
 *     entry already carries that port (usb, usb-c, thunderbolt, ethernet).
 *     The power path is modelled; a second entry would double-count one
 *     physical jack.
 *
 * What is left is marked `review` unless the entry's `primaryCategory` is
 * gear that is mains-powered by definition. A `speaker` may be an active
 * monitor or a passive wedge; an `outboard` unit may be a passive DI. Those
 * need a person, which is what the `review` column is for.
 *
 * Usage:
 *   pnpm power-input-audit              # report
 *   pnpm power-input-audit --tsv        # slug<TAB>evidence rows for review
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { type FindingInput, findingsDirArg, recordFindings } from "./lib/findings.js";
import type { Hardware, IO } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, REPO_ROOT } from "./lib/utils.js";

/**
 * Prose that documents a mains or adapter supply.
 *
 * Every member was chosen against the corpus rather than imagined. The
 * voltage forms carry a word boundary because "115V" appears inside fuse
 * ratings too, which is fine — a fuse rating is itself evidence of a
 * supply. `DC ?\d` catches "DC 12 V" and "DC15V", both of which appear.
 *
 * `IEC` must be followed by an inlet word or a connector number. A bare
 * `\bIEC\b` looked right and was not: IEC is also the standards body whose
 * name appears in measured specs, so "Peak SPL per speaker at 1 m
 * (IEC-weighted noise): 116 dB SPL" reported the ADAM A8H as documenting a
 * mains inlet. That is the same class of error as `capability-probes`
 * matching a measured spec row, and it is guarded the same way.
 */
export const POWER_PROSE =
  /local supply|\bmains\b|AC adapter|power adapter|power supply|IEC\s*-?\s*(inlet|socket|plug|connector|c\d)|\bPSU\b|wall wart|100\s*-\s*240|\b115\s*V|\b230\s*V|\b220\s*-\s*240|power consumption|\bDC ?\d/i;

/**
 * Prose stating the documented exception: the unit carries no power
 * connector because it runs on batteries or draws power over a bus.
 *
 * CLAUDE.md names `battery-only` and `bus-powered via USB-C` as the two
 * forms an entry should use, but the corpus spells them many ways, so this
 * matches the meaning rather than the canonical string. "USB power supply"
 * is in because it is how a unit that takes a phone charger describes
 * itself — the 1010music Bento reads "Requires a 30-Watt USB power supply
 * providing at least 2000mA (2A) at 5V", which is a bus-powered device
 * documenting its brick, not a device with a mains inlet.
 */
export const SELF_POWERED =
  /battery[- ]?(only|powered|operation)|runs on .{0,12}batteries|bus[- ]?powered|powered (over|via|by|through) (the )?usb|usb[- ]?powered|usb power (supply|adapter|brick)|phantom[- ]?powered|requires .{0,24}phantom power/i;

/** Connections that can themselves carry power to the unit. */
export const BUS_POWERED_CONNECTIONS = new Set([
  "usb",
  "usb-a",
  "usb-b",
  "usb-c",
  "usb-micro",
  "usb-mini",
  "thunderbolt",
  "ethernet",
  "ethercon",
]);

/**
 * Categories with no power connector by construction.
 *
 * A passive instrument, a passive cabinet, a dynamic or condenser mic and a
 * pair of headphones all plug into something else rather than the wall.
 * Their prose still mentions phantom power, battery compartments and
 * impedance figures, so excluding them by category is more reliable than
 * excluding them by wording.
 */
export const PASSIVE_CATEGORIES = new Set([
  "electric-guitar",
  "acoustic-guitar",
  "bass-guitar",
  "electric-bass",
  "guitar",
  "bass",
  "ukulele",
  "banjo",
  "mandolin",
  "microphone",
  "condenser",
  "dynamic-microphone",
  "ribbon-microphone",
  "headphones",
  "earphones",
  "drum",
  "drums",
  "cymbal",
  "snare-drum",
  "percussion",
  "acoustic-treatment",
  "acoustic-panel",
  "cable",
  "mic-stand",
  "stand",
]);

/**
 * Categories that are mains- or adapter-powered by definition, so a missing
 * power port on one of these is a defect rather than a question.
 *
 * Anything outside this set still reports, marked `review`.
 */
export const MAINS_POWERED_CATEGORIES = new Set([
  "audio-interface",
  "preamp",
  "compressor",
  "equalizer",
  "studio-monitor",
  "monitor",
  "subwoofer",
  "power-amp",
  "amplifier",
  "mixer",
  "console",
  "outboard",
  "channel-strip",
  "synthesizer",
  "drum-machine",
  "sampler",
  "groovebox",
  "sequencer",
  "modular",
  "effects-processor",
  "multi-effect",
  "converter",
  "routing",
  "patch-bay",
  "controller",
  "tape",
]);

export interface Finding {
  slug: string;
  /**
   * The entry's own `manufacturer:` slug, never the filename prefix. A
   * `dean-markley-*` file is not a Dean Guitars product, and a finding
   * filed under the wrong brand is filed for the wrong person.
   */
  manufacturer: string;
  category: string;
  /** The prose fragment that evidences a supply, trimmed for the report. */
  evidence: string;
  /** Ports the entry does carry, so a reviewer can see what was modelled. */
  ports: number;
  /** True when the category is not definitionally mains-powered. */
  review: boolean;
}

/** description + details + specs, flattened to one searchable string. */
export function entryProse(data: {
  description?: string;
  details?: string | string[];
  specs?: string | string[];
}): string {
  return [data.description, data.details, data.specs]
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is string => typeof v === "string")
    .join(" ");
}

/** True when any io entry is a power port. */
export function hasPowerPort(io: IO[]): boolean {
  return io.some((entry) => entry.category === "power");
}

/** True when the entry already models a port that could carry bus power. */
export function hasBusPoweredPort(io: IO[]): boolean {
  return io.some((entry) => BUS_POWERED_CONNECTIONS.has((entry.connection ?? "").toLowerCase()));
}

/**
 * The prose fragment that evidenced a supply, for the report's evidence
 * column. Returns the match with a little surrounding context so a reviewer
 * can judge it without opening the file.
 */
export function powerEvidence(prose: string): string {
  const match = POWER_PROSE.exec(prose);
  if (!match) return "";
  const start = Math.max(0, match.index - 28);
  return prose
    .slice(start, match.index + match[0].length + 28)
    .replace(/\s+/g, " ")
    .trim();
}

/** Every entry that documents a supply and models no power port. */
export function findEntriesMissingPowerInput(dir: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of getYamlFiles(dir)) {
    const data = loadYamlFile<Hardware>(file);
    if (!data || !Array.isArray(data.io) || data.io.length === 0) continue;

    const category = data.primaryCategory ?? "";
    if (PASSIVE_CATEGORIES.has(category)) continue;
    if (hasPowerPort(data.io)) continue;

    const prose = entryProse(data);
    if (!POWER_PROSE.test(prose)) continue;

    // The documented exceptions: battery, or power over a bus the entry
    // already models.
    if (SELF_POWERED.test(prose)) {
      if (hasBusPoweredPort(data.io)) continue;
      // Battery-only with no bus port is a real exception too.
      if (/battery|phantom/i.test(prose)) continue;
    }

    findings.push({
      slug: path.basename(file, path.extname(file)),
      manufacturer: data.manufacturer ?? "",
      category: category || "(none)",
      evidence: powerEvidence(prose),
      ports: data.io.length,
      review: !MAINS_POWERED_CATEGORIES.has(category),
    });
  }
  return findings;
}

/**
 * The inbox rows for a run's findings.
 *
 * Only the definitional ones. A `review` row is on a category that holds
 * both a passive cabinet and an active monitor, and the tool cannot tell
 * them apart, so filing it would put a guess in front of a person as a
 * task. Those stay in the report, where the `review` column says what
 * they are. The terminal report is unchanged either way: this is an
 * additional sink, not a replacement.
 */
export function toFindings(findings: Finding[]): FindingInput[] {
  return findings
    .filter((f) => !f.review)
    .map((f) => ({
      kind: "missing-power-input" as const,
      brand: f.manufacturer || "catalog",
      key: `missing-power-input:${f.slug}`,
      title: `no power input on a ${f.category} entry`,
      detail:
        `\`${f.slug}\` is filed under \`${f.category}\`, carries ${f.ports} io ` +
        `entr${f.ports === 1 ? "y" : "ies"}, and none of them is \`category: power\`. ` +
        `Its own prose documents a supply:\n\n> ${f.evidence}\n\n` +
        "The connector has to come from the maker's manual or a rear-panel photo. " +
        "A voltage does not give it, and an inferred inlet is worse than a tracked absence.",
      file: `data/hardware/${f.slug}.yaml`,
    }));
}

function main(): void {
  const findings = findEntriesMissingPowerInput(path.join(DATA_DIR, "hardware"));
  const tsv = process.argv.includes("--tsv");

  const dir = findingsDirArg(process.argv.slice(2), REPO_ROOT);
  if (dir) {
    const rows = toFindings(findings);
    const written = recordFindings(dir, rows);
    process.stderr.write(`findings: wrote ${written} of ${rows.length} to ${dir}\n`);
  }

  if (tsv) {
    console.log("# slug\tcategory\tports\treview\tevidence");
    console.log("# Delete a row to reject it. Rows are a worklist for");
    console.log("#   pnpm enrich-io <slug>   /   /io-enrich");
    console.log("# There is no apply step: the connector has to come from the");
    console.log("# maker's manual or a rear-panel photo, never from this report.");
    console.log("# A row marked 'review' is on a category that is not");
    console.log("# definitionally mains-powered — a passive cabinet and an");
    console.log("# active monitor are both 'speaker'.");
    for (const f of findings) {
      console.log(
        `${f.slug}\t${f.category}\t${f.ports}\t${f.review ? "review" : ""}\t${f.evidence}`
      );
    }
    return;
  }

  const byCategory = new Map<string, number>();
  for (const f of findings) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  const confident = findings.filter((f) => !f.review);

  console.log(`\n🔌 Powered entries with no power input\n`);
  console.log(
    `   ${findings.length} entries — ${confident.length} definitional, ${findings.length - confident.length} to review\n`
  );
  for (const [category, count] of [...byCategory].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    const flag = MAINS_POWERED_CATEGORIES.has(category) ? "" : "  (review)";
    console.log(`   ${category.padEnd(20)} ${String(count).padStart(4)}${flag}`);
  }
  console.log(`\n   Review with --tsv, then enrich each entry with 'pnpm enrich-io <slug>'.`);
  console.log(`   This report never writes: the fact of a supply is in the entry,`);
  console.log(`   the connector is only ever in the maker's documentation.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

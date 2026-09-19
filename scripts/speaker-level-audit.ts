#!/usr/bin/env tsx
/**
 * Speaker-Level Typing Audit
 *
 * Reports hardware io entries whose port drives or receives a **passive
 * speaker** but is not typed `speaker-level`.
 *
 * CLAUDE.md states the rule twice: "Passive speakers use `speaker-level`,
 * not `line`" and "Speaker outputs on amplifiers are `type: speaker-level`".
 * Nothing enforced it, so 231 ports across 143 files still carry `line`.
 * That is not cosmetic: Studio colours and shapes a handle from its io
 * `type`, and `line` on an amp's speaker output tells a reader the jack
 * carries a low-voltage preamp signal when it carries an amplified one.
 *
 * WHY THIS IS A PROBE AND NOT A FIX
 *
 * Same contract as `capability-gaps`: this is a guess about language, so it
 * reports and `speaker-level:apply` writes only what a human accepted. Two
 * distinctions it cannot always make are real rather than tuning problems.
 * A **speaker-emulated** or cabinet-simulated output carries line level and
 * is correctly typed `line` — the name says "speaker" and the signal is not.
 * And a **monitor controller** names its balanced line feeds to a pair of
 * powered monitors "Speaker Output" too. `EMULATED`, `LINE_LEVEL_CONNECTIONS`
 * and `MONITOR_SURFACE` each remove a class that can be proved; what is left
 * is marked `review` and read by a person.
 *
 * Usage:
 *   pnpm speaker-level-audit              # report
 *   pnpm speaker-level-audit --tsv        # slug<TAB>port rows for review
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { type FindingInput, findingsDirArg, recordFindings } from "./lib/findings.js";
import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, REPO_ROOT } from "./lib/utils.js";

/**
 * A port whose name mentions a speaker or cabinet.
 *
 * `cab` is included because amp heads label the jack "Cabinet Output" as
 * often as "Speaker Output".
 */
export const SPEAKER_NAME = /\bspeakers?\b|\bcab(inet)?\b/i;

/**
 * Names that mention a speaker while carrying **line** level, so `line` is
 * the correct type and this audit must not flag them.
 *
 * Every member was observed on the corpus rather than imagined: a speaker
 * emulated / simulated output is a DI of the cabinet sim, a "Recording Out
 * (Speaker Emulated)" is the same thing named for its use, and a headphone
 * jack fed by a cabinet sim is neither. Dropping this list turns 231
 * findings into 242, and the extra 11 are all correct as they stand.
 */
export const EMULATED = /emulat|simulat|\bsim\b|\bdi\b|recording|line\s*out|headphone|phones/i;

/**
 * Connectors that carry **line** level whatever the port is called.
 *
 * A passive loudspeaker is driven through speakON, binding posts, banana,
 * euroblock, a barrier strip or a 1/4-inch jack. It is never fed down an XLR
 * or a DB25: those are the connectors a monitor controller uses to send a
 * line feed to powered monitors, and a "Speaker Output" on one of them is
 * that feed under a misleading name. Measured on the corpus, no entry
 * carries a genuine passive-speaker port on either connector.
 */
export const LINE_LEVEL_CONNECTIONS = new Set(["xlr", "db25"]);

/**
 * Entries whose whole job is routing line-level monitoring.
 *
 * A monitor controller or summing mixer names its outputs "Speaker 1", "Main
 * Speaker Output" or "Speaker A Output" because that is what they feed, and
 * every one of them is a balanced line output. Only these two phrases are
 * used: the obvious wider ones ("powered monitors", "active speakers",
 * "balanced ... line level") appear in the prose of seven genuine amplifiers
 * and cabinets on this corpus, where they describe something the unit is
 * being compared to or an output it also has, so they exclude real findings.
 * These two exclude nothing genuine.
 */
export const MONITOR_SURFACE =
  /monitor controller|control room monitor|monitor control\b|summing mixer/i;

/**
 * Categories that can carry a port driving or receiving a passive speaker.
 *
 * Used only to mark a row for review, never to drop one. `monitor` is why it
 * cannot be an exclusion: it holds both monitor controllers, whose speaker
 * outputs are line feeds, and passive stage wedges, whose speakON inputs are
 * the real thing.
 */
export const AMPLIFIED_CATEGORIES = new Set([
  "speaker",
  "power-amp",
  "guitar-amplifier",
  "bass-amplifier",
  "subwoofer",
  "amplifier",
  "studio-monitor",
  "pedal",
]);

/**
 * The connectors a passive loudspeaker is actually driven through.
 *
 * CLAUDE.md names them: "A passive loudspeaker is driven through
 * speakON, binding posts, banana, euroblock, a barrier strip or a
 * 1/4-inch jack, and never down an XLR or a DB25". `LINE_LEVEL_CONNECTIONS`
 * above is the other half of that sentence and rules out what a line
 * feed uses. This is the positive half, and it exists because ruling out
 * the known line connectors is not the same as recognising a speaker
 * one: `kef-coda-w` carries a port called "USB-C Inter-Speaker Link" on
 * `usb-c`, which is neither, and reads as a finding under a rule built
 * only from exclusions.
 *
 * Used for filing, not for reporting. The report is a worklist and a
 * near miss on it costs a glance; an inbox issue is a task and a near
 * miss on it costs somebody's afternoon.
 */
export const SPEAKER_CONNECTIONS = new Set([
  "speakon",
  "banana",
  "binding-post",
  "binding-posts",
  "euroblock",
  "barrier-strip",
  "spring-terminal",
  "1/4-inch",
]);

export interface Finding {
  slug: string;
  /**
   * The entry's own `manufacturer:` slug, never the filename prefix: a
   * `dean-markley-*` file is not a Dean Guitars product, and a finding
   * filed under the wrong brand is filed for the wrong person.
   */
  manufacturer: string;
  port: string;
  type: string;
  connection: string;
  /** True when the entry is not obviously amplified gear, so a human looks. */
  review: boolean;
}

/** True when this port's NAME reads as a speaker or cabinet jack. */
export function isSpeakerPort(name: string): boolean {
  return SPEAKER_NAME.test(name) && !EMULATED.test(name);
}

/**
 * True when this port drives or receives a **passive** speaker.
 *
 * The name is necessary and not sufficient. A monitor controller's line feed
 * to a pair of powered monitors is called a speaker output too, and retyping
 * one is a wrong claim about what the jack carries, so the connector and the
 * entry's own prose both get a say. What neither can settle is a port on a
 * 1/4-inch jack belonging to an interface that never describes its
 * monitoring: `review` marks those for a person.
 */
export function isPassiveSpeakerPort(
  port: { name?: string; connection?: string },
  prose = ""
): boolean {
  if (!port.name || !isSpeakerPort(port.name)) return false;
  if (port.connection && LINE_LEVEL_CONNECTIONS.has(port.connection)) return false;
  return !MONITOR_SURFACE.test(prose);
}

/**
 * The description, details and specs an entry states about itself.
 *
 * `details` and `specs` are block scalars in the YAML but the schema also
 * admits a list, so each is flattened rather than assumed to be a string.
 */
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

/** Every io entry that should be `speaker-level` and is not. */
export function findMistypedSpeakerPorts(dir: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of getYamlFiles(dir)) {
    const data = loadYamlFile<Hardware>(file);
    if (!data || !Array.isArray(data.io)) continue;
    const slug = path.basename(file, path.extname(file));
    const prose = entryProse(data);
    const review = !AMPLIFIED_CATEGORIES.has(data.primaryCategory ?? "");
    for (const io of data.io) {
      if (!isPassiveSpeakerPort(io, prose)) continue;
      if (io.type === "speaker-level") continue;
      findings.push({
        slug,
        manufacturer: data.manufacturer ?? "",
        port: io.name ?? "",
        type: io.type ?? "(none)",
        connection: io.connection ?? "(none)",
        review,
      });
    }
  }
  return findings;
}

/**
 * The inbox rows for a run's findings.
 *
 * Two narrowings the report does not make, because a report row costs a
 * glance and an inbox issue costs an afternoon. A row marked `review` is
 * on a category holding both a passive wedge and a monitor controller,
 * and the tool says so rather than guessing. A row whose connector is
 * not one a passive loudspeaker is driven through is not settled by its
 * name alone, whatever that name says.
 *
 * Keyed on the entry and the port NAME rather than an index, because an
 * index moves when a port list is reordered and the key would file the
 * same jack again under a new issue. Two jacks sharing a name on one
 * entry (a Marshall head carries two "Speaker Output") are one finding
 * for whoever has to open the manual.
 */
export function toFindings(findings: Finding[]): FindingInput[] {
  const seen = new Set<string>();
  const rows: FindingInput[] = [];
  for (const f of findings) {
    if (f.review) continue;
    if (!SPEAKER_CONNECTIONS.has(f.connection.toLowerCase())) continue;
    const key = `mistyped-port:${f.slug}:${f.port.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      kind: "mistyped-port",
      brand: f.manufacturer || "catalog",
      key,
      title: `\`${f.port}\` is typed \`${f.type}\` on a ${f.connection} jack`,
      detail:
        `\`${f.slug}\` carries a port named \`${f.port}\` on a \`${f.connection}\` ` +
        `connector, typed \`${f.type}\`. That connector drives a passive loudspeaker, ` +
        "so the jack carries an amplified signal and belongs to `speaker-level`. " +
        "`line` is for low-voltage preamp and mixer outputs, and Studio colours and " +
        "shapes a handle from its io `type`.\n\n" +
        "Confirm against the maker's rear panel, then apply with " +
        "`pnpm speaker-level:apply --rows <tsv> --apply`.",
      file: `data/hardware/${f.slug}.yaml`,
    });
  }
  return rows;
}

function main(): void {
  const findings = findMistypedSpeakerPorts(path.join(DATA_DIR, "hardware"));
  const tsv = process.argv.includes("--tsv");

  const dir = findingsDirArg(process.argv.slice(2), REPO_ROOT);
  if (dir) {
    const rows = toFindings(findings);
    const written = recordFindings(dir, rows);
    process.stderr.write(`findings: wrote ${written} of ${rows.length} to ${dir}\n`);
  }

  if (tsv) {
    console.log("# slug\tport\tcurrent type\tconnection\treview");
    console.log("# Delete a row to reject it, then:");
    console.log("#   pnpm speaker-level:apply --rows <file> --apply");
    console.log("# A row marked 'review' is on an entry that is not obviously");
    console.log("# amplified gear. Read the product page before keeping it.");
    for (const f of findings) {
      console.log(`${f.slug}\t${f.port}\t${f.type}\t${f.connection}\t${f.review ? "review" : ""}`);
    }
    return;
  }

  const byType = new Map<string, number>();
  for (const f of findings) byType.set(f.type, (byType.get(f.type) ?? 0) + 1);
  const files = new Set(findings.map((f) => f.slug));
  const needReview = findings.filter((f) => f.review).length;

  console.log(`\n🔊 Speaker ports not typed 'speaker-level'\n`);
  console.log(`   ${findings.length} ports in ${files.size} files\n`);
  for (const [type, count] of [...byType].sort((a, b) => b[1] - a[1])) {
    console.log(`   type: ${type.padEnd(14)} ${count}`);
  }
  if (needReview > 0) {
    console.log(`\n   ${needReview} are on entries that are not obviously amplified gear.`);
  }
  console.log(`\n   Review with --tsv, then apply with speaker-level:apply.`);
  console.log(`   A speaker-emulated output is line level and is excluded, as is`);
  console.log(`   a monitor controller's line feed to powered monitors.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

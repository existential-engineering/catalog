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
 * reports and `speaker-level:apply` writes only what a human accepted. The
 * distinction it cannot always make is real rather than a tuning problem.
 * A **speaker-emulated** or cabinet-simulated output carries line level and
 * is correctly typed `line` — the name says "speaker" and the signal is not.
 * Measured on the corpus, that class is the bulk of the naive match, which
 * is why `EMULATED` exists and why the residue below still needs eyes.
 *
 * Usage:
 *   pnpm speaker-level-audit              # report
 *   pnpm speaker-level-audit --tsv        # slug<TAB>port rows for review
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Hardware } from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./lib/utils.js";

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

export interface Finding {
  slug: string;
  port: string;
  type: string;
  connection: string;
}

/** True when this port drives or receives a passive speaker. */
export function isSpeakerPort(name: string): boolean {
  return SPEAKER_NAME.test(name) && !EMULATED.test(name);
}

/** Every io entry that should be `speaker-level` and is not. */
export function findMistypedSpeakerPorts(dir: string): Finding[] {
  const findings: Finding[] = [];
  for (const file of getYamlFiles(dir)) {
    const data = loadYamlFile<Hardware>(file);
    if (!data || !Array.isArray(data.io)) continue;
    const slug = path.basename(file, path.extname(file));
    for (const io of data.io) {
      if (!io?.name || !isSpeakerPort(io.name)) continue;
      if (io.type === "speaker-level") continue;
      findings.push({
        slug,
        port: io.name,
        type: io.type ?? "(none)",
        connection: io.connection ?? "(none)",
      });
    }
  }
  return findings;
}

function main(): void {
  const findings = findMistypedSpeakerPorts(path.join(DATA_DIR, "hardware"));
  const tsv = process.argv.includes("--tsv");

  if (tsv) {
    console.log("# slug\tport\tcurrent type\tconnection");
    console.log("# Delete a row to reject it, then:");
    console.log("#   pnpm speaker-level:apply --rows <file> --apply");
    for (const f of findings) {
      console.log(`${f.slug}\t${f.port}\t${f.type}\t${f.connection}`);
    }
    return;
  }

  const byType = new Map<string, number>();
  for (const f of findings) byType.set(f.type, (byType.get(f.type) ?? 0) + 1);
  const files = new Set(findings.map((f) => f.slug));

  console.log(`\n🔊 Speaker ports not typed 'speaker-level'\n`);
  console.log(`   ${findings.length} ports in ${files.size} files\n`);
  for (const [type, count] of [...byType].sort((a, b) => b[1] - a[1])) {
    console.log(`   type: ${type.padEnd(14)} ${count}`);
  }
  console.log(`\n   Review with --tsv, then apply with speaker-level:apply.`);
  console.log(`   A speaker-emulated output is line level and is excluded.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

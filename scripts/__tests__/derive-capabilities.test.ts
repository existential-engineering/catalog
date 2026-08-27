import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_CAPABILITIES } from "../derive-capabilities.js";
import { getAllValidCategoriesSet, getCapabilitiesSet } from "../lib/schema-loader.js";
import type { Hardware } from "../lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, SCHEMA_DIR } from "../lib/utils.js";

const groups = loadYamlFile<{ groups: Record<string, string[]> }>(
  path.join(SCHEMA_DIR, "category-groups.yaml")
).groups;

/** Same derivation the vocabulary guard uses — see capabilities.test.ts. */
/**
 * Groups whose values may legitimately appear on the functional axis. Stated
 * this way round, and subtracted from the file, so a group ADDED to
 * category-groups.yaml is covered from the day it lands rather than whenever
 * someone remembers to extend a hard-coded list.
 *
 * Effects is the obvious one. Synthesis & Instruments and Utility & Tools are
 * here because the vocabulary legitimately shares `granular`, `sampler`,
 * `looper`, `tape`, `sequencer` and friends with them: those name operations
 * even though the group they sit in mostly does not.
 */
const FUNCTIONAL_GROUPS = ["Effects", "Synthesis & Instruments", "Utility & Tools"];

const NON_FUNCTIONAL_GROUPS = Object.keys(groups).filter((g) => !FUNCTIONAL_GROUPS.includes(g));

describe("CATEGORY_CAPABILITIES", () => {
  it("produces only values in the capability vocabulary", () => {
    const vocabulary = getCapabilitiesSet();
    const bad: string[] = [];
    for (const [category, capabilities] of Object.entries(CATEGORY_CAPABILITIES)) {
      for (const capability of capabilities) {
        if (!vocabulary.has(capability)) bad.push(`${category} -> ${capability}`);
      }
    }
    expect(bad).toEqual([]);
  });

  // A key that is not a real category is a dead row: it never fires, so the
  // categories it was meant to cover silently go underived. That reads as
  // "nothing to map" rather than as the typo it is.
  it("keys are all real categories", () => {
    const categories = getAllValidCategoriesSet();
    const unknown = Object.keys(CATEGORY_CAPABILITIES).filter((c) => !categories.has(c));
    expect(unknown).toEqual([]);
  });

  // The mirror of the vocabulary guard, one level up. Mapping `rack-mount` or
  // `vintage` to anything would pipe a non-functional axis straight into the
  // functional one across every entry carrying it — the exact failure the
  // capabilities field exists to prevent, arriving through the back door.
  it("never maps from a non-functional category group", () => {
    const offenders: string[] = [];
    for (const group of FUNCTIONAL_GROUPS) {
      expect(groups[group], `category-groups.yaml is missing group '${group}'`).toBeDefined();
    }
    expect(NON_FUNCTIONAL_GROUPS.length).toBeGreaterThan(0);
    for (const group of NON_FUNCTIONAL_GROUPS) {
      for (const value of groups[group]) {
        if (CATEGORY_CAPABILITIES[value]) offenders.push(`${value} (${group})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Every entry's `capabilities` must contain everything its own categories
 * definitionally imply. Hand-authored lists may add to that floor (they read the
 * prose) but may never fall below it, because doing so means the two axes
 * disagree about the same product.
 *
 * This is the check that catches a bad mapping row on real data rather than in
 * the abstract. It found `stereo -> stereo-widening`: three entries were given a
 * widening capability they do not have, and two hand-authored entries whose
 * `stereo` means "stereo signal path" flagged the row as wrong. A row that is
 * wrong in this direction is invisible to every other test here, because
 * `stereo-widening` is a perfectly valid capability and `stereo` a perfectly
 * valid category — only the entries show the mismatch.
 */
describe("declared capabilities agree with declared categories", () => {
  // Loads and parses every hardware YAML file, so it scales with the corpus:
  // the sweep sat at ~4s against the 5s default when the corpus tipped it over.
  it("every populated entry covers its categories' implied capabilities", {
    timeout: 30_000,
  }, () => {
    const violations: string[] = [];
    for (const file of getYamlFiles(path.join(DATA_DIR, "hardware"))) {
      const data = loadYamlFile<Hardware>(file);
      if (!data.capabilities || data.capabilities.length === 0) continue;

      const implied = new Set<string>();
      for (const source of [data.primaryCategory, ...(data.categories ?? [])]) {
        if (!source) continue;
        for (const capability of CATEGORY_CAPABILITIES[source] ?? []) implied.add(capability);
      }
      const declared = new Set(data.capabilities);
      const missing = [...implied].filter((c) => !declared.has(c));
      if (missing.length > 0) {
        violations.push(`${path.basename(file)}: missing ${missing.sort().join(", ")}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

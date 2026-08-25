import path from "node:path";
import { describe, expect, it } from "vitest";
import { getCapabilitiesSet, isValidCapability } from "../lib/schema-loader.js";
import { loadYamlFile, SCHEMA_DIR } from "../lib/utils.js";

const groups = loadYamlFile<{ groups: Record<string, string[]> }>(
  path.join(SCHEMA_DIR, "category-groups.yaml")
).groups;

/**
 * The dimensions `capabilities` must never absorb. `categories` mixes all of
 * these in with function, which is precisely what makes a shared category
 * useless as evidence that two products overlap — two entries both tagged
 * `discontinued` or `rack-mount` have nothing in common functionally.
 */
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

describe("capabilities vocabulary", () => {
  it("is non-empty and free of duplicates", () => {
    const raw = loadYamlFile<{ capabilities: string[] }>(
      path.join(SCHEMA_DIR, "capabilities.yaml")
    ).capabilities;
    expect(raw.length).toBeGreaterThan(0);
    expect(new Set(raw).size).toBe(raw.length);
  });

  it("uses slug-cased values", () => {
    for (const capability of getCapabilitiesSet()) {
      expect(capability).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
    }
  });

  // The one-dimension rule, made mechanical. A capability describes an
  // operation the product performs on audio; anything describing what the
  // product IS belongs in categories.yaml. Without this, the field slowly
  // reacquires the mixing that made `categories` uncomparable — which is the
  // only reason this field exists.
  it("shares no value with a non-functional category group", () => {
    const capabilities = getCapabilitiesSet();
    // A renamed group would silently drop out of both lists, so assert the
    // functional names still resolve rather than letting the subtraction pass
    // vacuously.
    for (const group of FUNCTIONAL_GROUPS) {
      expect(groups[group], `category-groups.yaml is missing group '${group}'`).toBeDefined();
    }
    expect(NON_FUNCTIONAL_GROUPS.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const group of NON_FUNCTIONAL_GROUPS) {
      for (const value of groups[group]) {
        if (capabilities.has(value)) offenders.push(`${value} (${group})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("validates strictly, with no alias fallback", () => {
    expect(isValidCapability("reverb")).toBe(true);
    expect(isValidCapability("pitch-shift")).toBe(true);
    // Wrong dimension — a form factor, not an operation.
    expect(isValidCapability("rack-mount")).toBe(false);
    // Wrong dimension — lifecycle.
    expect(isValidCapability("discontinued")).toBe(false);
    // Not an operation: the point of the field is to say what it does instead.
    expect(isValidCapability("multi-effect")).toBe(false);
    // A category alias must not leak through; there are no capability aliases.
    expect(isValidCapability("eq")).toBe(false);
    expect(isValidCapability("equalization")).toBe(true);
  });
});

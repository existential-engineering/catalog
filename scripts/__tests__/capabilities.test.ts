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
 *
 * Effects, Synthesis & Instruments and Utility & Tools are deliberately absent
 * from this list: they hold the function words (`reverb`, `granular`,
 * `looper`) that legitimately appear on both axes.
 */
const NON_FUNCTIONAL_GROUPS = [
  "Hardware", // form factor: rack-mount, pedal, outboard, console
  "Genre & Style", // ambient, vintage, cinematic
  "Instruments", // what it is, not what it does
  "Accessories",
  "Content & Assets",
  "Software Types",
  "Other", // lifecycle: discontinued, legacy, beta
];

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
    const offenders: string[] = [];
    for (const group of NON_FUNCTIONAL_GROUPS) {
      const values = groups[group];
      expect(values, `category-groups.yaml is missing group '${group}'`).toBeDefined();
      for (const value of values ?? []) {
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

import { describe, expect, it } from "vitest";
import { looksLikeAcronymName } from "../lib/acronym-exclusions.js";

describe("looksLikeAcronymName", () => {
  it.each([
    "MPC",
    "ADT",
    "AGL",
    "DAW",
    "AGLP",
    "AGSC",
    "VCA",
    "CMI",
    "EPS",
    "SEM",
  ])("flags true acronym '%s'", (name) => {
    expect(looksLikeAcronymName(name)).toBe(true);
  });

  it.each([
    "REAPER",
    "TONIC",
    "VIRTUOSO",
    "EXOVERB",
    "ENRAGE",
    "AURORROR",
  ])("skips long stylized name '%s' (length cap)", (name) => {
    expect(looksLikeAcronymName(name)).toBe(false);
  });

  it.each([
    "IRON",
    "LION",
    "MOOD",
    "BASE",
    "AMP",
    "ART",
    "MAP",
    "ONE",
    "TAILS",
    "ATONE",
  ])("skips short English word '%s' (exclusion list)", (name) => {
    expect(looksLikeAcronymName(name)).toBe(false);
  });

  it.each([
    "DR-110",
    "SM-7B",
    "OB-Xa",
    "CS-80 V4",
    "Pro-Q 3",
  ])("skips model number '%s' (brandVariants handles these at build time)", (name) => {
    expect(looksLikeAcronymName(name)).toBe(false);
  });

  it.each([
    "Serum",
    "Pro-Q 3",
    "Massive X",
    "Ableton Live",
    "X",
  ])("skips ordinary product name '%s'", (name) => {
    expect(looksLikeAcronymName(name)).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(looksLikeAcronymName("  MPC  ")).toBe(true);
  });

  it("is case-sensitive on the regex but case-insensitive on the exclusion list", () => {
    // Lowercase / mixed-case names never match the regex
    expect(looksLikeAcronymName("mpc")).toBe(false);
    expect(looksLikeAcronymName("Mpc")).toBe(false);
  });
});

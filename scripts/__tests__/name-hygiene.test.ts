import { describe, expect, it } from "vitest";
import {
  findNameArtifacts,
  hasTaglineSeparator,
  manufacturerNameIsPrefix,
} from "../lib/name-hygiene.js";

describe("findNameArtifacts", () => {
  it.each(["5150® Iconic Series 80W Head", "ROGUE SIX™ Discrete Op Amp", "d:facto™ 4018V"])(
    "flags trademark symbols in %j",
    (name) => {
      expect(findNameArtifacts(name)).toHaveLength(1);
    }
  );

  it("flags HTML entities", () => {
    expect(findNameArtifacts("Automated Dynamics &#038; Balance Bundle")).toHaveLength(1);
    expect(findNameArtifacts("Drums &amp; Percussion")).toHaveLength(1);
  });

  it("does not flag a bare ampersand", () => {
    expect(findNameArtifacts("Vocal Tuner & Deesser")).toHaveLength(0);
  });

  it("flags trailing separators left by half-stripped taglines", () => {
    expect(findNameArtifacts("SE-DJ5000 —")).toHaveLength(1);
    expect(findNameArtifacts(" Toolbox")).toHaveLength(1);
  });

  it("flags consecutive spaces", () => {
    expect(findNameArtifacts("5150  Series Deluxe QM")).toHaveLength(1);
  });

  it.each(["286s", "I-O 82", "Pro-C 3", "CDi 4|600", "DriveRack PA+", "Mini A/B"])(
    "accepts clean name %j",
    (name) => {
      expect(findNameArtifacts(name)).toHaveLength(0);
    }
  );
});

describe("manufacturerNameIsPrefix", () => {
  it("flags the manufacturer display name duplicated at the start", () => {
    expect(manufacturerNameIsPrefix("dbx 286s", "dbx")).toBe(true);
    expect(manufacturerNameIsPrefix("KEF Bot", "KEF")).toBe(true);
    expect(manufacturerNameIsPrefix("Serato DJ Pro", "Serato")).toBe(true);
  });

  it("is case-insensitive on the prefix match", () => {
    expect(manufacturerNameIsPrefix("DBX 286s", "dbx")).toBe(true);
  });

  it("skips self-titled host-compatibility names", () => {
    expect(manufacturerNameIsPrefix("Ampl4 for Positive Grid Bias", "Ampl4")).toBe(false);
  });

  it("skips manufacturer names shorter than 3 characters", () => {
    expect(manufacturerNameIsPrefix("V8 Engine Kit", "V8")).toBe(false);
  });

  it("requires a word boundary, not a substring", () => {
    expect(manufacturerNameIsPrefix("Bitbox", "Bitwig")).toBe(false);
    expect(manufacturerNameIsPrefix("Nanobox Tangerine", "1010music")).toBe(false);
  });

  it("ignores a name that is exactly the manufacturer name", () => {
    expect(manufacturerNameIsPrefix("AutoTonic", "AutoTonic")).toBe(false);
  });
});

describe("hasTaglineSeparator", () => {
  it.each([
    "nanobox | tangerine – Compact Streaming Sampler",
    "Toolbox – Sequencer and Function Generator",
    "Groth | Wavelet Audio",
    "Alex Epton — Entropy",
  ])("flags tagline separator in %j", (name) => {
    expect(hasTaglineSeparator(name)).toBe(true);
  });

  it.each([
    // Plain hyphens are common in real product names
    "AmpHub - Mizar Dist Plus Model",
    // Pipes without spaces are real model numbers (Crown CDi 4|600)
    "CDi 4|600",
    "Pro-C 3",
  ])("accepts %j", (name) => {
    expect(hasTaglineSeparator(name)).toBe(false);
  });
});

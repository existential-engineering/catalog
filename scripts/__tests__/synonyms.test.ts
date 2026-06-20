import { describe, expect, it } from "vitest";
import { brandVariants, expandSearchTerms } from "../lib/synonyms.js";

describe("brandVariants", () => {
  it("returns no variants for a single all-lower token", () => {
    expect(brandVariants("ableton")).toEqual([]);
  });

  it("strips and replaces hyphens", () => {
    expect(brandVariants("MS-20")).toContain("ms20");
    expect(brandVariants("MS-20")).toContain("ms 20");
  });

  it("strips internal spaces and emits hyphenated digit variant", () => {
    expect(brandVariants("OP 1")).toContain("op1");
    expect(brandVariants("OP 1")).toContain("op-1");
  });

  it("inserts separators at letter→digit transitions", () => {
    const v = brandVariants("op1");
    expect(v).toContain("op 1");
    expect(v).toContain("op-1");
  });

  it("ignores leading/trailing whitespace", () => {
    expect(brandVariants("  ")).toEqual([]);
  });

  it("strips periods so dotted abbreviations are searchable", () => {
    expect(brandVariants("A.O.M.")).toContain("aom");
  });

  it("strips and spaces slashes", () => {
    const v = brandVariants("Mesa/Boogie");
    expect(v).toContain("mesaboogie");
    expect(v).toContain("mesa boogie");
  });

  it("expands ampersands to 'and' plus stripped/spaced forms", () => {
    const v = brandVariants("Bang & Olufsen");
    expect(v).toContain("bang and olufsen");
    expect(v).toContain("bang olufsen");
  });

  it("strips apostrophes (straight and curly)", () => {
    expect(brandVariants("D'Addario")).toContain("daddario");
    expect(brandVariants("D’Addario")).toContain("daddario");
  });
});

describe("expandSearchTerms", () => {
  it("adds curated misspellings when canonical appears in haystack", () => {
    const out = expandSearchTerms("Xfer Serum", "Xfer Records", [], []);
    expect(out).toContain("srum");
    expect(out).toContain("serm");
  });

  it("adds short forms for verbose category names", () => {
    const out = expandSearchTerms("Pro-C 2", "FabFilter", ["compressor"], []);
    expect(out).toContain("comp");
  });

  it("matches canonical from manufacturer name", () => {
    const out = expandSearchTerms("Live 12", "Ableton", [], []);
    expect(out).toContain("abelton");
  });

  it("adds brand variants from the product name", () => {
    const out = expandSearchTerms("MS-20", "Korg", [], []);
    expect(out).toContain("ms20");
  });

  it("skips terms already present in existingTerms", () => {
    const out = expandSearchTerms("Xfer Serum", "Xfer Records", [], ["srum"]);
    expect(out).not.toContain("srum");
  });

  it("returns only brand variants when no misspellings or short forms match", () => {
    // "Unique Widget" → "uniquewidget" (space-stripped) is a legitimate variant.
    expect(expandSearchTerms("Unique Widget", "Acme", [], [])).toEqual(["uniquewidget"]);
  });

  it("returns an empty array when name is a plain single token", () => {
    expect(expandSearchTerms("widget", "Acme", [], [])).toEqual([]);
  });

  it("does not fire substring-only matches (composer → comp)", () => {
    const out = expandSearchTerms("Composer Pro", "Acme", [], []);
    expect(out).not.toContain("comp");
  });

  it("does not fire ableton → ableon on non-Ableton products mentioning ableton", () => {
    const out = expandSearchTerms("Some Plugin", "Acme", [], ["compatible with ableton"]);
    // existingTerms are inserted verbatim but shouldn't seed cross-product
    // synonym expansion — "ableon" belongs to actual Ableton products only.
    expect(out).not.toContain("ableon");
  });

  it("emits every alias of a canonical category when an inverse map is supplied", () => {
    const inverse = new Map<string, readonly string[]>([
      ["equalizer", ["eq", "graphic-equalizer", "dynamic-eq"]],
    ]);
    const out = expandSearchTerms("Pro-Q", "FabFilter", ["equalizer"], [], inverse);
    expect(out).toContain("graphic-equalizer");
    expect(out).toContain("dynamic-eq");
    // "eq" comes via SHORT_FORMS too — present either way
    expect(out).toContain("eq");
  });

  it("does not emit category aliases when no inverse map is supplied (backwards compat)", () => {
    const out = expandSearchTerms("Pro-Q", "FabFilter", ["equalizer"], []);
    // Aliases like "graphic-equalizer" only come from the inverse map
    expect(out).not.toContain("graphic-equalizer");
    // SHORT_FORMS still fire — "eq" comes from the "equalizer" canonical
    expect(out).toContain("eq");
  });

  it("pins the expansion shape for a representative product", () => {
    expect(
      expandSearchTerms("OP-1", "Teenage Engineering", ["synthesizer"], []).sort()
    ).toMatchInlineSnapshot(`
      [
        "op 1",
        "op1",
        "synth",
      ]
    `);
  });
});

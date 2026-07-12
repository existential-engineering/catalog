import { describe, expect, it } from "vitest";
import { normalizeName } from "../dataset-audit.js";

describe("normalizeName", () => {
  it("strips spaces, case, and internal punctuation", () => {
    expect(normalizeName("Pro-Q 3")).toBe("proq3");
    expect(normalizeName("ProQ3")).toBe("proq3");
  });

  it("preserves a trailing + as a distinct 'plus' token", () => {
    expect(normalizeName("ProFX10v3")).toBe("profx10v3");
    expect(normalizeName("ProFX10v3+")).toBe("profx10v3plus");
    expect(normalizeName("ProFX10v3")).not.toBe(normalizeName("ProFX10v3+"));
  });

  it("treats a trailing + with a leading space as plus", () => {
    expect(normalizeName("Mixstream Pro +")).toBe("mixstreamproplus");
    expect(normalizeName("Mixstream Pro")).toBe("mixstreampro");
  });

  it("keeps an internal + that precedes more of the name distinct", () => {
    // "Vision+ Console" / "SPS-1UW+ MKII" must not collide with the base model.
    expect(normalizeName("Vision+ Console")).toBe("visionplusconsole");
    expect(normalizeName("Vision Console")).toBe("visionconsole");
    expect(normalizeName("Vision+ Console")).not.toBe(normalizeName("Vision Console"));
  });
});

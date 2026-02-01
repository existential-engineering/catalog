import { describe, expect, it } from "vitest";
import { generateSlug, isValidSlugFormat, SLUG_PATTERN } from "../lib/schema-loader.js";

describe("SLUG_PATTERN", () => {
  it("matches valid single character slug", () => {
    expect(SLUG_PATTERN.test("a")).toBe(true);
    expect(SLUG_PATTERN.test("1")).toBe(true);
  });

  it("matches valid multi-character slug", () => {
    expect(SLUG_PATTERN.test("serum")).toBe(true);
    expect(SLUG_PATTERN.test("massive-x")).toBe(true);
    expect(SLUG_PATTERN.test("pro-tools-12")).toBe(true);
  });

  it("rejects slugs starting with hyphen", () => {
    expect(SLUG_PATTERN.test("-invalid")).toBe(false);
  });

  it("rejects slugs ending with hyphen", () => {
    expect(SLUG_PATTERN.test("invalid-")).toBe(false);
  });

  it("rejects uppercase characters", () => {
    expect(SLUG_PATTERN.test("Serum")).toBe(false);
    expect(SLUG_PATTERN.test("MASSIVE")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(SLUG_PATTERN.test("pro_tools")).toBe(false);
    expect(SLUG_PATTERN.test("pro.tools")).toBe(false);
    expect(SLUG_PATTERN.test("pro tools")).toBe(false);
  });
});

describe("isValidSlugFormat", () => {
  it("returns true for valid slugs", () => {
    expect(isValidSlugFormat("serum")).toBe(true);
    expect(isValidSlugFormat("massive-x")).toBe(true);
    expect(isValidSlugFormat("pro-tools-12")).toBe(true);
    expect(isValidSlugFormat("a")).toBe(true);
  });

  it("returns false for invalid slugs", () => {
    expect(isValidSlugFormat("Serum")).toBe(false);
    expect(isValidSlugFormat("-invalid")).toBe(false);
    expect(isValidSlugFormat("invalid-")).toBe(false);
    expect(isValidSlugFormat("pro_tools")).toBe(false);
  });
});

describe("generateSlug", () => {
  it("converts to lowercase", () => {
    expect(generateSlug("Serum")).toBe("serum");
    expect(generateSlug("MASSIVE X")).toBe("massive-x");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("Pro Tools")).toBe("pro-tools");
    expect(generateSlug("Native Instruments Massive")).toBe("native-instruments-massive");
  });

  it("removes special characters", () => {
    expect(generateSlug("Serum (2025)")).toBe("serum-2025");
    expect(generateSlug("Pro Tools™")).toBe("pro-tools");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("Pro  Tools")).toBe("pro-tools");
    expect(generateSlug("Pro---Tools")).toBe("pro-tools");
  });

  it("removes leading and trailing hyphens", () => {
    expect(generateSlug("-Serum-")).toBe("serum");
    expect(generateSlug("  Serum  ")).toBe("serum");
  });

  it("handles complex names", () => {
    expect(generateSlug("Xfer Records - Serum")).toBe("xfer-records-serum");
    expect(generateSlug("u-he Diva")).toBe("u-he-diva");
  });
});

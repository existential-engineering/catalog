import { describe, expect, it } from "vitest";
import { escapeSQL, findClosestMatch, formatValidOptions, parseErrorPath } from "../lib/utils.js";

describe("findClosestMatch", () => {
  it("returns exact match when found", () => {
    const options = new Set(["synth", "effect", "sampler"]);
    expect(findClosestMatch("synth", options)).toBe("synth");
  });

  it("returns close match with typo", () => {
    const options = new Set(["synth", "effect", "sampler"]);
    expect(findClosestMatch("syntj", options)).toBe("synth");
    expect(findClosestMatch("efect", options)).toBe("effect");
  });

  it("returns null when no close match exists", () => {
    const options = new Set(["synth", "effect", "sampler"]);
    expect(findClosestMatch("completely-different", options)).toBeNull();
  });

  it("is case-insensitive", () => {
    const options = new Set(["synth", "effect"]);
    expect(findClosestMatch("SYNTH", options)).toBe("synth");
    expect(findClosestMatch("Effect", options)).toBe("effect");
  });
});

describe("parseErrorPath", () => {
  it("parses simple path", () => {
    expect(parseErrorPath("name")).toEqual(["name"]);
  });

  it("parses nested path", () => {
    expect(parseErrorPath("manufacturer.name")).toEqual(["manufacturer", "name"]);
  });

  it("parses path with array index", () => {
    expect(parseErrorPath("categories.0")).toEqual(["categories", 0]);
    expect(parseErrorPath("links.2.url")).toEqual(["links", 2, "url"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseErrorPath("")).toEqual([]);
  });
});

describe("formatValidOptions", () => {
  it("formats small list", () => {
    const options = new Set(["a", "b", "c"]);
    expect(formatValidOptions(options)).toBe("a, b, c");
  });

  it("truncates large list with count", () => {
    const options = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]);
    const result = formatValidOptions(options, 5);
    expect(result).toContain("... (12 total)");
  });

  it("sorts options alphabetically", () => {
    const options = new Set(["z", "a", "m"]);
    expect(formatValidOptions(options)).toBe("a, m, z");
  });
});

describe("escapeSQL", () => {
  it("escapes single quotes", () => {
    expect(escapeSQL("it's")).toBe("'it''s'");
  });

  it("handles null", () => {
    expect(escapeSQL(null)).toBe("NULL");
  });

  it("handles undefined", () => {
    expect(escapeSQL(undefined)).toBe("NULL");
  });

  it("wraps plain strings in quotes", () => {
    expect(escapeSQL("hello")).toBe("'hello'");
  });

  it("handles multiple single quotes", () => {
    expect(escapeSQL("it's Bob's")).toBe("'it''s Bob''s'");
  });
});

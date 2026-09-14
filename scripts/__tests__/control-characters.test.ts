import { describe, expect, it } from "vitest";
import { findControlCharacters, formatControlCharacterPath } from "../lib/control-characters.js";

/**
 * Built from code points rather than written literally, so the test file
 * itself stays free of the characters it is about (and so the payloads are
 * legible in a diff).
 */
const NUL = String.fromCharCode(0);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const TAB = String.fromCharCode(9);
const ESC = String.fromCharCode(27);
const LINE_SEPARATOR = String.fromCharCode(0x2028);

describe("findControlCharacters", () => {
  it("passes an ordinary entry", () => {
    expect(
      findControlCharacters({
        name: "SM7B",
        url: "https://www.shure.com/en-US/products/microphones/sm7b",
        description: "A dynamic microphone.",
        categories: ["microphone", "dynamic"],
        prices: [{ amount: 399, currency: "USD" }],
      })
    ).toEqual([]);
  });

  it("reports a newline smuggled into a url", () => {
    // The url-health workflow lays this value out as a Markdown table
    // row, where the newline would end the row early.
    const findings = findControlCharacters({
      url: `https://example.com/a${LF}| evil | row |`,
    });
    expect(findings).toHaveLength(1);
    expect(formatControlCharacterPath(findings[0])).toBe("url");
    expect(findings[0].codePoint).toBe("U+000A");
  });

  it.each([
    ["a NUL", NUL],
    ["a carriage return", CR],
    ["an escape", ESC],
    ["a line separator", LINE_SEPARATOR],
    ["a tab", TAB],
  ])("rejects %s in a single-line value", (_label, character) => {
    expect(findControlCharacters({ name: `Model${character}X` })).toHaveLength(1);
  });

  it("allows newlines in the prose fields", () => {
    expect(
      findControlCharacters({
        description: `First paragraph.${LF}${LF}Second paragraph.`,
        details: `First.${LF}${LF}Second.`,
        specs: `- One${LF}- Two`,
      })
    ).toEqual([]);
  });

  it("still rejects a NUL inside a prose field", () => {
    // Newlines are how those fields are written; a NUL is not prose.
    const findings = findControlCharacters({ specs: `- One${NUL}` });
    expect(findings).toHaveLength(1);
    expect(findings[0].codePoint).toBe("U+0000");
  });

  it("reaches into arrays and nested objects", () => {
    const findings = findControlCharacters({
      links: [{ url: "https://ok.example/" }, { title: `Manual${CR}` }],
    });
    expect(findings).toHaveLength(1);
    expect(formatControlCharacterPath(findings[0])).toBe("links[1].title");
  });

  it("treats a translated prose field as prose", () => {
    expect(
      findControlCharacters({ translations: { de: { details: `Erstens.${LF}${LF}Zweitens.` } } })
    ).toEqual([]);
  });

  it("reports every offending value, not just the first", () => {
    const findings = findControlCharacters({
      name: `A${LF}`,
      url: `https://example.com/${TAB}`,
    });
    expect(findings.map(formatControlCharacterPath).sort()).toEqual(["name", "url"]);
  });

  it("ignores non-string values", () => {
    expect(findControlCharacters({ hp: 12, discontinued: true, missing: null })).toEqual([]);
  });
});

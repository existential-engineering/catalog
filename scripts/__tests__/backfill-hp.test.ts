import { describe, expect, it } from "vitest";
import { extractProseHp, insertHp, parseReview } from "../backfill-hp.js";

describe("extractProseHp", () => {
  it("reads a width in any of the spellings the corpus uses", () => {
    expect(extractProseHp("A compact 12HP module")).toEqual([12]);
    expect(extractProseHp("- Width: 8 HP")).toEqual([8]);
    expect(extractProseHp("packed into 4hp")).toEqual([4]);
    expect(extractProseHp("occupies just 6 HP of rack space")).toEqual([6]);
  });

  it("returns every distinct width once, in order of first mention", () => {
    expect(extractProseHp("Width: 4HP. The 1U variant is 24HP. Still 4 HP wide.")).toEqual([4, 24]);
  });

  it("ignores mentions that describe capacity, a limit or an estimate", () => {
    expect(extractProseHp("NiftyCASE gives you 84hp of space")).toEqual([]);
    expect(extractProseHp("Recommended for cases up to 6U x 84hp")).toEqual([]);
    expect(extractProseHp("Fits comfortably in an 84HP 3U case")).toEqual([]);
    expect(extractProseHp("Requires ~8 HP of Eurorack case space")).toEqual([]);
    expect(extractProseHp("112hp of useable eurorack module space")).toEqual([]);
    expect(extractProseHp("- 107HP Eurorack module capacity")).toEqual([]);
  });

  it("keeps the module's own width when a capacity mention sits beside it", () => {
    expect(
      extractProseHp("KRAKONG is an 80HP module. Needs a case with at least 80 HP free.")
    ).toEqual([80]);
    expect(extractProseHp("This compact 16HP module gives you the unique sound")).toEqual([16]);
    expect(extractProseHp("made a bit wider (6 hp instead of 4 hp). Width: 6 hp")).toEqual([6, 4]);
  });

  it("does not read a high-pass filter or a horsepower as a width", () => {
    expect(extractProseHp("12 dB HP filter with 24 dB LP")).toEqual([]);
    expect(extractProseHp("HP: 20 mA")).toEqual([]);
  });
});

describe("parseReview", () => {
  it("parses widths and skips, ignoring comments and blank lines", () => {
    const review = parseReview(
      [
        "# slug\thp\tsource",
        "",
        "acme-vco\t12\thttps://acme.example/vco",
        "acme-case\tskip\tcase: 104HP is row capacity  # trailing note",
      ].join("\n")
    );
    expect(review.get("acme-vco")).toEqual({ hp: 12, source: "https://acme.example/vco" });
    expect(review.get("acme-case")).toEqual({ skip: true, reason: "case: 104HP is row capacity" });
    expect(review.size).toBe(2);
  });

  it("refuses a value that is not a positive integer, a missing source, or a duplicate", () => {
    expect(() => parseReview("acme-vco\t12HP\tpage")).toThrow(/positive integer/);
    expect(() => parseReview("acme-vco\t0\tpage")).toThrow(/positive integer/);
    expect(() => parseReview("acme-vco\t12")).toThrow(/expected/);
    expect(() => parseReview("acme-vco\t12\tpage\nacme-vco\t14\tother")).toThrow(/twice/);
  });
});

describe("insertHp", () => {
  it("places hp after the categories block", () => {
    const source =
      "name: VCO\nprimaryCategory: modular\ncategories:\n  - analog\n  - synthesizer\nurl: https://acme.example\n";
    expect(insertHp(source, 12)).toBe(
      "name: VCO\nprimaryCategory: modular\ncategories:\n  - analog\n  - synthesizer\nhp: 12\nurl: https://acme.example\n"
    );
  });

  it("falls back to after primaryCategory when there are no categories", () => {
    expect(insertHp("name: VCO\nprimaryCategory: modular\nurl: x\n", 4)).toBe(
      "name: VCO\nprimaryCategory: modular\nhp: 4\nurl: x\n"
    );
  });

  it("refuses an entry that already carries hp or a flow-style categories list", () => {
    expect(() => insertHp("name: VCO\nhp: 4\nprimaryCategory: modular\n", 4)).toThrow(/already/);
    expect(() => insertHp("name: VCO\ncategories: [modular]\n", 4)).toThrow(/block sequence/);
  });
});

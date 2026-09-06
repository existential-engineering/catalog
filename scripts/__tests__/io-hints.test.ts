import { describe, expect, it } from "vitest";
import {
  countHintCoverage,
  emptyHintCoverage,
  findHintFindings,
  hasCompleteHints,
  isPositiveInteger,
} from "../lib/io-hints.js";

const kinds = (findings: ReturnType<typeof findHintFindings>) => findings.map((f) => f.kind);

describe("isPositiveInteger", () => {
  it("accepts 1-based integers only", () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(48)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(-1)).toBe(false);
    expect(isPositiveInteger(1.5)).toBe(false);
    expect(isPositiveInteger("1")).toBe(false);
    expect(isPositiveInteger(Number.NaN)).toBe(false);
  });
});

describe("findHintFindings", () => {
  it("reports nothing for an unhinted io list", () => {
    expect(findHintFindings([{ position: "Top" }, { position: "Top" }])).toEqual([]);
  });

  it("reports nothing for a fully hinted edge beside an unhinted one", () => {
    expect(
      findHintFindings([
        { name: "In 1", position: "Top", columnPosition: 1, rowPosition: 1 },
        { name: "In 2", position: "Top", columnPosition: 1, rowPosition: 2 },
        { name: "MIDI In", position: "Left" },
      ])
    ).toEqual([]);
  });

  it("reports a hint that is not a positive integer, per field", () => {
    const findings = findHintFindings([
      { name: "In", position: "Top", columnPosition: 0, rowPosition: 1.5 },
    ]);
    expect(findings.map((f) => [f.kind, f.field])).toEqual([
      ["not-positive-integer", "columnPosition"],
      ["not-positive-integer", "rowPosition"],
    ]);
    expect(findings[0]?.message).toContain("'In'");
  });

  it("reports a string hint as not an integer", () => {
    expect(
      kinds(findHintFindings([{ position: "Top", columnPosition: "1", rowPosition: 1 }]))
    ).toEqual(["not-positive-integer"]);
  });

  it("reports one hint without the other, naming the missing field", () => {
    const findings = findHintFindings([
      { name: "Row only", position: "Top", rowPosition: 1 },
      { name: "Column only", position: "Top", columnPosition: 2 },
    ]);
    expect(findings.map((f) => [f.kind, f.index, f.field])).toEqual([
      ["unpaired", 0, "columnPosition"],
      ["unpaired", 1, "rowPosition"],
    ]);
  });

  it("reports a cell occupied twice on one edge, on the later port", () => {
    const findings = findHintFindings([
      { name: "A", position: "Top", columnPosition: 1, rowPosition: 1 },
      { name: "B", position: "Top", columnPosition: 1, rowPosition: 1 },
      { name: "C", position: "Top", columnPosition: 1, rowPosition: 1 },
    ]);
    expect(findings.map((f) => [f.kind, f.index])).toEqual([
      ["duplicate-cell", 1],
      ["duplicate-cell", 2],
    ]);
    expect(findings[0]?.message).toContain("'B' and 'A'");
  });

  it("lets two edges reuse the same cell", () => {
    expect(
      findHintFindings([
        { position: "Top", columnPosition: 1, rowPosition: 1 },
        { position: "Bottom", columnPosition: 1, rowPosition: 1 },
      ])
    ).toEqual([]);
  });

  it("reports every unhinted port on an edge that carries a hint", () => {
    const findings = findHintFindings([
      { name: "Hinted", position: "Top", columnPosition: 1, rowPosition: 1 },
      { name: "Bare 1", position: "Top" },
      { name: "Bare 2", position: "Top" },
      { name: "Other edge", position: "Right" },
    ]);
    expect(findings.map((f) => [f.kind, f.index])).toEqual([
      ["partial-edge", 1],
      ["partial-edge", 2],
    ]);
  });

  it("does not double-report an unpaired port as a partial edge", () => {
    expect(
      kinds(
        findHintFindings([
          { position: "Top", columnPosition: 1, rowPosition: 1 },
          { position: "Top", rowPosition: 2 },
        ])
      )
    ).toEqual(["unpaired"]);
  });

  it("skips the cell check for a port whose hint is invalid", () => {
    expect(
      kinds(
        findHintFindings([
          { position: "Top", columnPosition: 1, rowPosition: 1 },
          { position: "Top", columnPosition: 1, rowPosition: 0 },
        ])
      )
    ).toEqual(["not-positive-integer"]);
  });

  it("treats ports without a position as one edge of their own", () => {
    expect(
      kinds(findHintFindings([{ columnPosition: 1, rowPosition: 1 }, { name: "Bare" }]))
    ).toEqual(["partial-edge"]);
  });
});

describe("hasCompleteHints", () => {
  it("needs both fields as positive integers", () => {
    expect(hasCompleteHints({ columnPosition: 1, rowPosition: 2 })).toBe(true);
    expect(hasCompleteHints({ columnPosition: 1 })).toBe(false);
    expect(hasCompleteHints({ columnPosition: 1, rowPosition: 0 })).toBe(false);
  });
});

describe("countHintCoverage", () => {
  it("counts entries, entries with io, and entries with any hinted port", () => {
    const coverage = emptyHintCoverage();
    countHintCoverage(coverage, undefined);
    countHintCoverage(coverage, []);
    countHintCoverage(coverage, [{ position: "Top" }]);
    countHintCoverage(coverage, [{ position: "Top" }, { position: "Top", rowPosition: 1 }]);
    expect(coverage).toEqual({ entries: 4, withIo: 2, withHints: 1 });
  });
});

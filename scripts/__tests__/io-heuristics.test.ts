import { describe, expect, it } from "vitest";
import { isIoCombineCandidate } from "../lib/io-heuristics.js";

describe("isIoCombineCandidate", () => {
  it("flags several single jacks collapsed into one entry", () => {
    expect(
      isIoCombineCandidate({ name: "Line Output", connection: "1/4-inch", maxConnections: 4 })
    ).toBe(true);
  });

  it("ignores a single jack", () => {
    expect(
      isIoCombineCandidate({ name: "Line Output", connection: "1/4-inch", maxConnections: 1 })
    ).toBe(false);
  });

  it("ignores multi-link connectors that carry several channels by design", () => {
    expect(
      isIoCombineCandidate({ name: "Analog Out", connection: "db25", maxConnections: 8 })
    ).toBe(false);
  });

  it("ignores names that describe an intentional aggregate", () => {
    expect(
      isIoCombineCandidate({ name: "All Slot Outputs", connection: "1/4-inch", maxConnections: 8 })
    ).toBe(false);
  });

  it("ignores patchbay rows, which are aggregates by category", () => {
    const row = { name: 'TRS 1/4" front row', connection: "1/4-inch", maxConnections: 48 };
    expect(isIoCombineCandidate(row)).toBe(true);
    expect(isIoCombineCandidate(row, { primaryCategory: "patch-bay" })).toBe(false);
  });

  it("still flags collapsed jacks on non-patchbay categories", () => {
    expect(
      isIoCombineCandidate(
        { name: "Mic Input", connection: "xlr", maxConnections: 8 },
        { primaryCategory: "preamp" }
      )
    ).toBe(true);
  });
});

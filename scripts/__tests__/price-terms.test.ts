import { describe, expect, it } from "vitest";
import {
  collectPriceArrays,
  findUntermedGroups,
  formatPricePath,
  PRICE_TERMS,
} from "../lib/price-terms.js";

describe("collectPriceArrays", () => {
  it("returns the entry's own prices and every version and variant list with its path", () => {
    expect(
      collectPriceArrays({
        prices: [{ currency: "USD" }],
        versions: [{}, { prices: [{ currency: "EUR" }] }],
        variants: [{ prices: [{ currency: "GBP" }] }],
      })
    ).toEqual([
      { path: ["prices"], prices: [{ currency: "USD" }] },
      { path: ["versions", 1, "prices"], prices: [{ currency: "EUR" }] },
      { path: ["variants", 0, "prices"], prices: [{ currency: "GBP" }] },
    ]);
  });

  it("returns nothing for an entry without prices", () => {
    expect(collectPriceArrays({ versions: "not a list" })).toEqual([]);
  });
});

describe("formatPricePath", () => {
  it("renders the bracket-and-dot form the other warnings use", () => {
    expect(formatPricePath(["prices", 0])).toBe("prices[0]");
    expect(formatPricePath(["versions", 1, "prices", 2])).toBe("versions[1].prices[2]");
  });
});

describe("findUntermedGroups", () => {
  it("ignores one price per currency", () => {
    expect(findUntermedGroups([{ currency: "USD" }, { currency: "EUR" }])).toEqual([]);
  });

  it("reports two prices in one currency when either lacks a term", () => {
    expect(
      findUntermedGroups([
        { currency: "USD", term: "perpetual" },
        { currency: "USD" },
        { currency: "EUR" },
      ])
    ).toEqual([{ currency: "USD", untermed: [1], repeated: [] }]);
  });

  it("accepts several prices in one currency once every term is distinct", () => {
    expect(
      findUntermedGroups([
        { currency: "USD", term: "perpetual" },
        { currency: "USD", term: "monthly" },
        { currency: "USD", term: "yearly" },
      ])
    ).toEqual([]);
  });

  it("reports a term used twice in one currency", () => {
    expect(
      findUntermedGroups([
        { currency: "USD", term: "monthly" },
        { currency: "USD", term: "monthly" },
      ])
    ).toEqual([{ currency: "USD", untermed: [], repeated: [0, 1] }]);
  });

  it("skips prices with no currency rather than grouping them together", () => {
    expect(findUntermedGroups([{}, {}])).toEqual([]);
  });

  it("keeps the vocabulary closed to the four terms", () => {
    expect(PRICE_TERMS).toEqual(["perpetual", "monthly", "yearly", "rent-to-own"]);
  });
});

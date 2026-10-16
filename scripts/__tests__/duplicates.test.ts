import { describe, expect, it } from "vitest";
import {
  findDuplicateNameGroups,
  findDuplicateUrlGroups,
  normalizeName,
  normalizeUrl,
} from "../lib/duplicates.js";

describe("normalizeUrl", () => {
  it("drops scheme, www and trailing slashes and lowercases the rest", () => {
    expect(normalizeUrl("HTTPS://www.Example.com/Serum/")).toBe("example.com/serum");
    expect(normalizeUrl(" http://example.com ")).toBe("example.com");
  });
});

describe("findDuplicateNameGroups", () => {
  it("groups by collection, manufacturer and normalized name, once per group", () => {
    const groups = findDuplicateNameGroups([
      { collection: "software", file: "a.yaml", name: "Pro-Q 3", manufacturer: "fabfilter" },
      { collection: "software", file: "b.yaml", name: "ProQ3", manufacturer: "fabfilter" },
      { collection: "software", file: "c.yaml", name: "ProQ3", manufacturer: "other" },
      { collection: "hardware", file: "d.yaml", name: "ProQ3", manufacturer: "fabfilter" },
      { collection: "software", file: "e.yaml", name: "ProQ3+", manufacturer: "fabfilter" },
    ]);
    expect(groups).toEqual([
      {
        collection: "software",
        value: "Pro-Q 3",
        entries: [
          { collection: "software", file: "a.yaml", name: "Pro-Q 3", manufacturer: "fabfilter" },
          { collection: "software", file: "b.yaml", name: "ProQ3", manufacturer: "fabfilter" },
        ],
      },
    ]);
  });

  it("never groups an entry without a manufacturer or a name", () => {
    expect(
      findDuplicateNameGroups([
        { collection: "manufacturers", file: "a.yaml", name: "Acme" },
        { collection: "manufacturers", file: "b.yaml", name: "Acme" },
        { collection: "software", file: "c.yaml", manufacturer: "acme" },
        { collection: "software", file: "d.yaml", manufacturer: "acme" },
      ])
    ).toEqual([]);
    expect(normalizeName("")).toBe("");
  });
});

describe("findDuplicateUrlGroups", () => {
  it("groups by collection and normalized url", () => {
    const groups = findDuplicateUrlGroups([
      { collection: "software", file: "a.yaml", url: "https://x.example/serum" },
      { collection: "software", file: "b.yaml", url: "http://www.x.example/serum/" },
      { collection: "hardware", file: "c.yaml", url: "https://x.example/serum" },
      { collection: "software", file: "d.yaml" },
    ]);
    expect(groups.map((g) => [g.collection, g.value, g.entries.map((e) => e.file)])).toEqual([
      ["software", "https://x.example/serum", ["a.yaml", "b.yaml"]],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { collectUnknownKeys, formatUnknownKeyPath } from "../lib/unknown-keys.js";

// A cut-down copy of the collection schema shapes, including the wrappers
// the real ones use: optional arrays of objects, a refined object, a
// union-then-transform markdown field, and a default on a nested enum.
const Price = z.object({ amount: z.number(), currency: z.string(), term: z.string().optional() });
const Video = z.object({
  videoId: z.string(),
  provider: z.enum(["youtube", "vimeo"]).default("youtube"),
});
const Version = z
  .object({ name: z.string(), prices: z.array(Price).optional() })
  .refine(() => true);
const Markdown = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => v);
const Entry = z
  .object({
    name: z.string(),
    details: Markdown,
    prices: z.array(Price).optional(),
    versions: z.array(Version).optional(),
    videos: z.array(Video).optional(),
    identifiers: z.record(z.string(), z.string()).optional(),
  })
  .refine(() => true)
  .check(() => {});

describe("collectUnknownKeys", () => {
  it("reports nothing for a value the schema fully declares", () => {
    expect(
      collectUnknownKeys(Entry, {
        name: "Foo",
        details: "text",
        prices: [{ amount: 1, currency: "USD", term: "monthly" }],
        versions: [{ name: "1.0", prices: [{ amount: 1, currency: "USD" }] }],
        videos: [{ videoId: "abc" }],
        identifiers: { au: "com.example" },
      })
    ).toEqual([]);
  });

  it("reports a top-level key the schema does not declare", () => {
    expect(collectUnknownKeys(Entry, { name: "Foo", discontinued: true })).toEqual([
      { parent: [], key: "discontinued" },
    ]);
  });

  it("reports keys inside array items, with the index in the path", () => {
    const found = collectUnknownKeys(Entry, {
      name: "Foo",
      prices: [
        { amount: 1, currency: "USD" },
        { amount: 2, currency: "USD", type: "monthly", note: "per seat" },
      ],
    });
    expect(found.map(formatUnknownKeyPath)).toEqual(["prices[1].type", "prices[1].note"]);
  });

  it("descends through refinements and nested optional arrays", () => {
    const found = collectUnknownKeys(Entry, {
      name: "Foo",
      versions: [{ name: "1.0", notes: "x", prices: [{ amount: 1, currency: "USD", label: "y" }] }],
    });
    expect(found.map(formatUnknownKeyPath)).toEqual([
      "versions[0].notes",
      "versions[0].prices[0].label",
    ]);
  });

  it("descends through a default wrapper on a nested field", () => {
    const found = collectUnknownKeys(Entry, {
      name: "Foo",
      videos: [{ videoId: "abc", provider: "youtube", url: "https://x" }],
    });
    expect(found.map(formatUnknownKeyPath)).toEqual(["videos[0].url"]);
  });

  it("treats a union-then-transform markdown field as a leaf", () => {
    expect(collectUnknownKeys(Entry, { name: "Foo", details: ["a", "b"] })).toEqual([]);
  });

  it("accepts any key under a record", () => {
    expect(collectUnknownKeys(Entry, { name: "Foo", identifiers: { anything: "x" } })).toEqual([]);
  });

  it("skips id and translations, which other validators own", () => {
    expect(
      collectUnknownKeys(Entry, { id: "abc", name: "Foo", translations: { de: { foo: 1 } } })
    ).toEqual([]);
  });

  it("checks verification against its declared subkeys", () => {
    expect(
      collectUnknownKeys(Entry, {
        name: "Foo",
        verification: { lastVerified: "2026-01-01", checkedBy: "me" },
      })
    ).toEqual([{ parent: ["verification"], key: "checkedBy" }]);
  });

  it("reports nothing for a non-object value, which the schema parse rejects itself", () => {
    expect(collectUnknownKeys(Entry, "not an entry")).toEqual([]);
    expect(collectUnknownKeys(Entry, null)).toEqual([]);
  });
});

describe("formatUnknownKeyPath", () => {
  it("renders the root and nested forms", () => {
    expect(formatUnknownKeyPath({ parent: [], key: "note" })).toBe("note");
    expect(formatUnknownKeyPath({ parent: ["verification"], key: "x" })).toBe("verification.x");
    expect(formatUnknownKeyPath({ parent: ["versions", 2, "prices", 0], key: "x" })).toBe(
      "versions[2].prices[0].x"
    );
  });
});

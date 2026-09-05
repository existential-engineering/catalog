import { describe, expect, it } from "vitest";
import { computeHintCoverage, normalizeName } from "../dataset-audit.js";

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

type Product = Parameters<typeof computeHintCoverage>[0][number]["entry"];

describe("computeHintCoverage", () => {
  const hinted = [{ position: "Top", columnPosition: 1, rowPosition: 1 }];
  const bare = [{ position: "Top" }];
  const hw = (entry: Record<string, unknown>) => ({
    type: "hardware" as const,
    entry: { manufacturer: "m", ...entry } as Product,
  });

  it("counts hinted entries per collection and for modular on its own", () => {
    const result = computeHintCoverage([
      hw({ name: "Pedal", primaryCategory: "pedal", io: hinted }),
      hw({ name: "Module", primaryCategory: "modular", io: bare }),
      hw({ name: "Module 2", primaryCategory: "synthesizer", categories: ["modular"], io: hinted }),
      hw({ name: "No io", primaryCategory: "microphone" }),
      { type: "software", entry: { name: "Plugin", manufacturer: "m" } },
    ]);
    expect(result.byCollection.hardware).toEqual({ entries: 4, withIo: 3, withHints: 2 });
    expect(result.byCollection.software).toEqual({ entries: 1, withIo: 0, withHints: 0 });
    expect(result.byCollection.content).toEqual({ entries: 0, withIo: 0, withHints: 0 });
    expect(result.modular).toEqual({ entries: 2, withIo: 2, withHints: 1 });
  });
});

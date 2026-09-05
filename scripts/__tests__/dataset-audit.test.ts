import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkCvGateCategory,
  checkExpressionTypedCv,
  checkModularMissingHp,
  computeHintCoverage,
  computeHpCoverage,
  type LoadedProduct,
  normalizeName,
} from "../dataset-audit.js";
import type { Hardware } from "../lib/types.js";
import { DATA_DIR } from "../lib/utils.js";

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

type AuditPort = { name: string; type: string; category: string };

/** A hardware product as the audit loads it, with only the io fields the checks read. */
function hardware(slug: string, io: AuditPort[]): LoadedProduct {
  return {
    type: "hardware",
    slug,
    file: path.join(DATA_DIR, "hardware", `${slug}.yaml`),
    entry: {
      name: slug,
      manufacturer: "acme",
      primaryCategory: "modular",
      io,
    } as unknown as Hardware,
  };
}

describe("checkCvGateCategory", () => {
  it("flags cv/gate and clock jacks filed outside audio, once per product", () => {
    const findings = checkCvGateCategory([
      hardware("toolbox", [
        { name: "Clock In", type: "clock", category: "digital" },
        { name: "CV 1", type: "cv/gate", category: "midi" },
        { name: "Out", type: "line", category: "audio" },
      ]),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].check).toBe("cv-gate-category");
    expect(findings[0].needsLlmReview).toBe(false);
    expect(findings[0].files).toEqual(["hardware/toolbox.yaml"]);
    expect(findings[0].detail).toContain("2 cv/gate or clock port(s)");
    expect(findings[0].detail).toContain("digital, midi");
  });

  it("leaves audio cv/gate and digital word clock alone", () => {
    expect(
      checkCvGateCategory([
        hardware("maths", [
          { name: "CV In", type: "cv/gate", category: "audio" },
          { name: "Word Clock In", type: "word clock", category: "digital" },
        ]),
      ])
    ).toEqual([]);
  });
});

describe("checkExpressionTypedCv", () => {
  it("flags expression and pedal jacks typed cv/gate for review", () => {
    const findings = checkExpressionTypedCv([
      hardware("big-sky", [
        { name: "Expression Pedal", type: "cv/gate", category: "audio" },
        { name: "Sustain Pedal Input", type: "cv/gate", category: "audio" },
      ]),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].check).toBe("expression-typed-cv");
    expect(findings[0].needsLlmReview).toBe(true);
    expect(findings[0].detail).toContain("Expression Pedal, Sustain Pedal Input");
  });

  it("ignores jacks already typed expression and cv jacks named for something else", () => {
    expect(
      checkExpressionTypedCv([
        hardware("dark-world", [
          { name: "Expression", type: "expression", category: "audio" },
          { name: "CV In", type: "cv/gate", category: "audio" },
        ]),
      ])
    ).toEqual([]);
  });
});

/** A hardware product as the audit loads it, with only the fields the hp checks read. */
function modularEntry(slug: string, entry: Record<string, unknown>): LoadedProduct {
  return {
    type: "hardware",
    slug,
    file: path.join(DATA_DIR, "hardware", `${slug}.yaml`),
    entry: { name: slug, manufacturer: "acme", ...entry } as unknown as Hardware,
  };
}

describe("checkModularMissingHp", () => {
  it("flags a modular entry without hp, by primary or secondary category", () => {
    const findings = checkModularMissingHp([
      modularEntry("maths", { primaryCategory: "modular" }),
      modularEntry("plaits", { primaryCategory: "synthesizer", categories: ["modular"] }),
      modularEntry("veils", { primaryCategory: "modular", hp: 10 }),
      modularEntry("sm7b", { primaryCategory: "microphone" }),
      { ...modularEntry("plugin", { primaryCategory: "modular" }), type: "software" },
    ]);
    expect(findings.map((f) => f.files)).toEqual([
      ["hardware/maths.yaml"],
      ["hardware/plaits.yaml"],
    ]);
    expect(findings[0]).toMatchObject({
      check: "modular-missing-hp",
      severity: "info",
      needsLlmReview: false,
      collection: "hardware",
    });
    expect(findings[0].detail).toContain("never guess");
  });
});

describe("computeHpCoverage", () => {
  it("counts modular hardware entries and those carrying hp", () => {
    expect(
      computeHpCoverage([
        modularEntry("maths", { primaryCategory: "modular", hp: 20 }),
        modularEntry("plaits", { primaryCategory: "synthesizer", categories: ["modular"] }),
        modularEntry("sm7b", { primaryCategory: "microphone", hp: 4 }),
        { type: "software", entry: { name: "Plugin", manufacturer: "m" } },
      ])
    ).toEqual({ modular: 2, withHp: 1 });
  });
});

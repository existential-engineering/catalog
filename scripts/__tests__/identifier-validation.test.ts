import { describe, expect, it } from "vitest";
import {
  getFormatHint,
  getKnownFormats,
  hasValidationPattern,
  validateIdentifier,
  validateIdentifiers,
} from "../lib/identifier-validation.js";

describe("validateIdentifier", () => {
  describe("AU identifiers", () => {
    it("accepts valid bundle ID format", () => {
      expect(validateIdentifier("au", "com.xferrecords.Serum")).toEqual({
        valid: true,
      });
      expect(validateIdentifier("au", "com.native-instruments.Massive")).toEqual({ valid: true });
    });

    it("rejects invalid format", () => {
      const result = validateIdentifier("au", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid au identifier");
    });

    it("rejects empty value", () => {
      const result = validateIdentifier("au", "");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Empty au identifier");
    });
  });

  describe("AAX identifiers", () => {
    it("accepts valid 4-character PACE code", () => {
      expect(validateIdentifier("aax", "XfRc")).toEqual({ valid: true });
      expect(validateIdentifier("aax", "NIKS")).toEqual({ valid: true });
    });

    it("rejects invalid length", () => {
      const result = validateIdentifier("aax", "ABC");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid aax identifier");
    });

    it("rejects 5 characters", () => {
      const result = validateIdentifier("aax", "ABCDE");
      expect(result.valid).toBe(false);
    });
  });

  describe("LV2 identifiers", () => {
    it("accepts valid URI", () => {
      expect(validateIdentifier("lv2", "https://vendor.com/plugins/name")).toEqual({ valid: true });
      expect(validateIdentifier("lv2", "http://example.org/lv2/synth")).toEqual({
        valid: true,
      });
    });

    it("rejects non-URI", () => {
      const result = validateIdentifier("lv2", "not-a-uri");
      expect(result.valid).toBe(false);
    });
  });

  describe("unknown formats", () => {
    it("accepts any value for unknown format", () => {
      expect(validateIdentifier("unknown-format", "anything")).toEqual({
        valid: true,
      });
    });
  });
});

describe("validateIdentifiers", () => {
  it("validates multiple identifiers", () => {
    const identifiers = {
      au: "com.vendor.Plugin",
      aax: "VNDR",
      lv2: "https://vendor.com/plugin",
    };

    const results = validateIdentifiers(identifiers);

    expect(results.get("au")?.valid).toBe(true);
    expect(results.get("aax")?.valid).toBe(true);
    expect(results.get("lv2")?.valid).toBe(true);
  });

  it("returns errors for invalid identifiers", () => {
    const identifiers = {
      au: "invalid",
      aax: "toolong",
    };

    const results = validateIdentifiers(identifiers);

    expect(results.get("au")?.valid).toBe(false);
    expect(results.get("aax")?.valid).toBe(false);
  });
});

describe("getFormatHint", () => {
  it("returns hint for known format", () => {
    expect(getFormatHint("au")).toContain("Reverse domain notation");
    expect(getFormatHint("aax")).toContain("PACE code");
  });

  it("returns undefined for unknown format", () => {
    expect(getFormatHint("unknown")).toBeUndefined();
  });
});

describe("getKnownFormats", () => {
  it("returns array of known formats", () => {
    const formats = getKnownFormats();
    expect(formats).toContain("au");
    expect(formats).toContain("aax");
    expect(formats).toContain("vst3");
    expect(formats).toContain("lv2");
  });
});

describe("hasValidationPattern", () => {
  it("returns true for known formats", () => {
    expect(hasValidationPattern("au")).toBe(true);
    expect(hasValidationPattern("aax")).toBe(true);
  });

  it("returns false for unknown formats", () => {
    expect(hasValidationPattern("unknown")).toBe(false);
  });
});

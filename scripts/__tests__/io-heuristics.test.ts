import { describe, expect, it } from "vitest";
import { isIoCombineCandidate, STORAGE_MEDIA_SLOT } from "../lib/io-heuristics.js";

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

describe("STORAGE_MEDIA_SLOT", () => {
  const storage = [
    "SD Card Slot",
    "microSD Card Slot",
    "Micro SD Card - Flashed",
    "SD Card",
    "SDHC Card Slot",
    "CompactFlash Slot",
    "Memory Stick Slot",
  ];
  for (const name of storage) {
    it(`matches storage slot '${name}'`, () => {
      expect(STORAGE_MEDIA_SLOT.test(name)).toBe(true);
    });
  }

  // Option bays present real connectors, mic names contain "cardioid", and
  // "Soundcard"/"DSD" must not trip the sd stem.
  const legal = [
    "Option Card Slot",
    "64x64 I/O Option Card Slot",
    "Expansion Card Slot (DN32-USB/ADAT/MADI/DANTE)",
    "Thunderbolt 3 Option Card",
    "UAD-2 PCIe Accelerator Cards",
    "USB 2.0 (20 Channel 24-bit/96kHz Soundcard)",
    "4011 Cardioid Microphone",
    "Detachable Hypercardioid Boom Microphone Input",
    "DSD Card",
  ];
  for (const name of legal) {
    it(`leaves '${name}' alone`, () => {
      expect(STORAGE_MEDIA_SLOT.test(name)).toBe(false);
    });
  }
});

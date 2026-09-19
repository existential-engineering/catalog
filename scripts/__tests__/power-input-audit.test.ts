import { describe, expect, it } from "vitest";
import type { IO } from "../lib/types.js";
import {
  BUS_POWERED_CONNECTIONS,
  hasBusPoweredPort,
  hasPowerPort,
  MAINS_POWERED_CATEGORIES,
  PASSIVE_CATEGORIES,
  POWER_PROSE,
  powerEvidence,
  SELF_POWERED,
} from "../power-input-audit.js";

const port = (over: Partial<IO>): IO => ({
  name: "Port",
  signalFlow: "input",
  category: "audio",
  type: "line",
  connection: "xlr",
  ...over,
});

describe("POWER_PROSE", () => {
  it("matches the supply wordings the corpus actually uses", () => {
    for (const prose of [
      "- Local supply: ~100-120 V T2.5AL/250 V",
      "Power: DC15V (dedicated AC adapter included)",
      "- Power Supply: 120/230VAC, 23 watts",
      "Connection: IEC inlet and detachable power cord",
      "Universal power Detachable IEC socket",
      "- Power consumption: 60W (maximum)",
      "connects to the mains with the supplied cable",
    ]) {
      expect(POWER_PROSE.test(prose), prose).toBe(true);
    }
  });

  // Regression: a bare /\bIEC\b/ reported the ADAM A8H, whose specs cite IEC
  // as the standards body in a measured noise figure, not as an inlet. Same
  // failure class as a capability probe matching a measured spec row.
  it("does not match IEC as a measurement standard", () => {
    expect(POWER_PROSE.test("Peak SPL per speaker at 1 m (IEC-weighted noise): 116 dB SPL")).toBe(
      false
    );
    expect(POWER_PROSE.test("Frequency response measured to IEC 60268-5")).toBe(false);
  });

  it("still matches IEC when it names the connector", () => {
    expect(POWER_PROSE.test("IEC inlet and detachable power cord")).toBe(true);
    expect(POWER_PROSE.test("fitted with an IEC C14 socket")).toBe(true);
  });
});

describe("SELF_POWERED", () => {
  it("honours the exceptions CLAUDE.md names", () => {
    for (const prose of [
      "battery-only operation",
      "bus-powered via USB-C",
      "powered over the USB connection",
      "This unit is USB-powered and needs no adapter",
    ]) {
      expect(SELF_POWERED.test(prose), prose).toBe(true);
    }
  });

  // Regression: a unit that asks for a phone charger is bus-powered and
  // documents the brick, not a unit with a mains inlet.
  it("treats a USB power supply as bus power, not a mains inlet", () => {
    const bento = "Requires a 30-Watt USB power supply providing at least 2000mA (2A) at 5V";
    expect(POWER_PROSE.test(bento)).toBe(true);
    expect(SELF_POWERED.test(bento)).toBe(true);
  });
});

describe("hasPowerPort", () => {
  it("finds a power port by category, not by name", () => {
    expect(hasPowerPort([port({ name: "DC IN", category: "power" })])).toBe(true);
    // A port merely *called* power is not one; category is the contract.
    expect(hasPowerPort([port({ name: "Power Amp Out", category: "audio" })])).toBe(false);
    expect(hasPowerPort([])).toBe(false);
  });
});

describe("hasBusPoweredPort", () => {
  it("recognises the connections that can carry power", () => {
    expect(hasBusPoweredPort([port({ connection: "usb-c" })])).toBe(true);
    expect(hasBusPoweredPort([port({ connection: "thunderbolt" })])).toBe(true);
    expect(hasBusPoweredPort([port({ connection: "xlr" })])).toBe(false);
  });

  it("is case-insensitive about the connection value", () => {
    expect(hasBusPoweredPort([port({ connection: "USB-C" })])).toBe(true);
  });

  it("only lists connections that really carry power", () => {
    expect(BUS_POWERED_CONNECTIONS.has("1/4-inch")).toBe(false);
    expect(BUS_POWERED_CONNECTIONS.has("iec-c14")).toBe(false);
  });
});

describe("powerEvidence", () => {
  it("returns the matched fragment with surrounding context", () => {
    const evidence = powerEvidence("- Frequency response: 20Hz-40kHz - Power: DC15V (adapter)");
    expect(evidence).toContain("DC15V");
    expect(evidence.length).toBeLessThan(120);
  });

  it("returns an empty string when nothing matched", () => {
    expect(powerEvidence("a passive ribbon microphone")).toBe("");
  });
});

describe("category sets", () => {
  // The two sets answer different questions and must not overlap: passive
  // gear is never reported, mains gear is reported without a review mark.
  it("do not overlap", () => {
    for (const category of PASSIVE_CATEGORIES) {
      expect(MAINS_POWERED_CATEGORIES.has(category), category).toBe(false);
    }
  });

  it("keep passive instruments and mics out of the report", () => {
    for (const category of ["electric-guitar", "microphone", "headphones"]) {
      expect(PASSIVE_CATEGORIES.has(category), category).toBe(true);
    }
  });

  it("treat speaker as review rather than definitional", () => {
    // A 'speaker' may be an active monitor or a passive wedge, so it needs a
    // person rather than an assumption.
    expect(MAINS_POWERED_CATEGORIES.has("speaker")).toBe(false);
    expect(PASSIVE_CATEGORIES.has("speaker")).toBe(false);
  });
});

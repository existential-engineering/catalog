import { describe, expect, it } from "vitest";
import { selectTelemetryRows } from "../add-telemetry-identifiers.js";

describe("selectTelemetryRows", () => {
  const base = { software_id: "id-1", format: "vst3", identifier: "com.acme.Verb" };

  it("keeps rows enough devices agree on and lists the rest", () => {
    const { rows, underThreshold } = selectTelemetryRows(
      [
        { ...base, devices: 2 },
        { ...base, identifier: "com.acme.Verb.old", devices: 1 },
      ],
      2
    );
    expect(rows).toEqual([
      {
        target: "id-1",
        format: "vst3",
        identifier: "com.acme.Verb",
        source: "telemetry:2 devices",
      },
    ]);
    expect(underThreshold).toHaveLength(1);
  });

  it("offers every reported version beside the identifier", () => {
    const { rows } = selectTelemetryRows([{ ...base, devices: 3, versions: ["1.2", "1.3"] }], 2);
    expect(rows.map((r) => r.version)).toEqual(["1.2", "1.3"]);
    expect(rows.every((r) => r.identifier === "com.acme.Verb")).toBe(true);
  });

  it("treats anything but a positive integer device count as under threshold", () => {
    const { rows, underThreshold } = selectTelemetryRows(
      [
        { ...base, devices: Number.NaN },
        { ...base, devices: 1.5 },
        { ...base, devices: 0 },
      ],
      1
    );
    expect(rows).toHaveLength(0);
    expect(underThreshold).toHaveLength(3);
  });
});

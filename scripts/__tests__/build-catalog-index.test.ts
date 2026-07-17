import { describe, expect, it, vi } from "vitest";

// Stub the schema-loader so alias resolution is observable regardless of the
// (currently empty) aliases map in schema/io-connections.yaml.
vi.mock("../lib/schema-loader.js", () => ({
  getCanonicalIOConnection: (connection: string) =>
    ({ "quarter-inch": "1/4-inch" })[connection] ?? connection,
}));

import { summarizeIo } from "../build-catalog-index.js";
import type { IO } from "../lib/types.js";

function port(overrides: Partial<IO>): IO {
  return {
    name: "Port",
    signalFlow: "input",
    category: "audio",
    type: "line",
    connection: "1/4-inch",
    ...overrides,
  };
}

describe("summarizeIo", () => {
  it("returns undefined for undefined or empty input", () => {
    expect(summarizeIo(undefined)).toBeUndefined();
    expect(summarizeIo([])).toBeUndefined();
  });

  it("collapses identical ports into one group with an accumulated count", () => {
    const io = [
      port({ name: "Mic Input 1", type: "mic", connection: "combo jack" }),
      port({ name: "Mic Input 2", type: "mic", connection: "combo jack" }),
    ];
    expect(summarizeIo(io)).toEqual([
      { type: "mic", connection: "combo jack", flow: "input", count: 2 },
    ]);
  });

  it("keeps ports with differing type, connection, or flow in distinct groups", () => {
    const io = [
      port({ type: "line" }),
      port({ type: "line", connection: "xlr" }),
      port({ type: "line", signalFlow: "output" }),
    ];
    expect(summarizeIo(io)).toEqual([
      { type: "line", connection: "1/4-inch", flow: "input", count: 1 },
      { type: "line", connection: "xlr", flow: "input", count: 1 },
      { type: "line", connection: "1/4-inch", flow: "output", count: 1 },
    ]);
  });

  it("groups alias variants of the same connection under the canonical value", () => {
    const io = [port({ connection: "quarter-inch" }), port({ connection: "1/4-inch" })];
    expect(summarizeIo(io)).toEqual([
      { type: "line", connection: "1/4-inch", flow: "input", count: 2 },
    ]);
  });

  it("omits connection when it is missing and still groups those ports together", () => {
    const io = [port({ connection: "" }), port({ connection: "" })];
    const groups = summarizeIo(io);
    expect(groups).toEqual([{ type: "line", connection: undefined, flow: "input", count: 2 }]);
  });

  it("skips ports missing type or signalFlow, returning undefined when none remain", () => {
    const skippable = [port({ type: "" }), port({ signalFlow: "" })];
    expect(summarizeIo(skippable)).toBeUndefined();

    const mixed = [...skippable, port({ type: "midi", connection: "5-pin din" })];
    expect(summarizeIo(mixed)).toEqual([
      { type: "midi", connection: "5-pin din", flow: "input", count: 1 },
    ]);
  });
});

/**
 * Proves each layout hint code (E122 to E125) fires on a fixture through
 * the real `validateFile`, the same path `pnpm validate` and the import
 * lanes' `--files` mode take. One fixture per code lives under
 * `fixtures/io-hints/`; the pure rules behind them are covered in
 * `io-hints.test.ts`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ValidationErrorCode } from "../lib/error-codes.js";
import { COLLECTION_SCHEMAS, validateFile } from "../validate.js";

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/io-hints");
const MAKERS = new Set(["eventide-audio"]);

function validateFixture(name: string) {
  return validateFile(path.join(FIXTURES, name), COLLECTION_SCHEMAS.hardware, MAKERS);
}

const codes = (result: ReturnType<typeof validateFile>) =>
  [...new Set(result?.details?.map((d) => d.code))].sort();

describe("validateFile on the layout hint fixtures", () => {
  it("passes a fully hinted edge beside an unhinted one", () => {
    expect(validateFixture("hint-clean.yaml")).toBeNull();
  });

  it("fails E122 on a hint that is not a positive integer, per field", () => {
    const result = validateFixture("hint-not-integer.yaml");
    expect(codes(result)).toEqual([ValidationErrorCode.E122_IO_HINT_NOT_POSITIVE_INTEGER]);
    expect(result?.details?.map((d) => [d.path, d.line])).toEqual([
      ["io.0.rowPosition", 15],
      ["io.1.columnPosition", 23],
    ]);
    expect(result?.errors[0]).toContain("rowPosition must be a positive integer (1-based), got 0");
  });

  it("fails E123 on a hint without its partner, anchored on the port", () => {
    const result = validateFixture("hint-unpaired.yaml");
    expect(codes(result)).toEqual([ValidationErrorCode.E123_IO_HINT_UNPAIRED]);
    expect(result?.details?.map((d) => [d.path, d.line])).toEqual([
      ["io.0", 7],
      ["io.1", 15],
    ]);
    expect(result?.errors[0]).toContain("rowPosition without columnPosition");
  });

  it("fails E124 on a cell occupied twice on one edge, and only on that edge", () => {
    const result = validateFixture("hint-duplicate-cell.yaml");
    expect(codes(result)).toEqual([ValidationErrorCode.E124_IO_HINT_CELL_OCCUPIED_TWICE]);
    expect(result?.details).toHaveLength(1);
    expect(result?.details?.[0]).toMatchObject({ path: "io.1", line: 16 });
    expect(result?.errors[0]).toContain("'Input 2' and 'Input 1' both sit at row 1, column 1");
  });

  it("fails E125 on an edge that is only partly hinted", () => {
    const result = validateFixture("hint-partial-edge.yaml");
    expect(codes(result)).toEqual([ValidationErrorCode.E125_IO_HINT_EDGE_PARTIAL]);
    expect(result?.details?.[0]).toMatchObject({ path: "io.1", line: 16 });
    expect(result?.errors[0]).toContain("'Input 2' carries no rowPosition or columnPosition");
  });
});

/**
 * Proves each layout hint code (E122 to E125) fires on a fixture through
 * the real validator. `scripts/validate.ts` runs its main on import, so
 * the fixtures go through `pnpm validate --files`, the scoped mode the
 * import lanes use, in a child process. The fixtures live under
 * `fixtures/hardware/` because scoped mode reads the collection from the
 * directory name.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = path.join(ROOT, "scripts/__tests__/fixtures/hardware");

function validateFixture(name: string): { status: number | null; output: string } {
  const result = spawnSync(
    path.join(ROOT, "node_modules/.bin/tsx"),
    ["scripts/validate.ts", "--files", path.join(FIXTURES, name)],
    { cwd: ROOT, encoding: "utf-8" }
  );
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

const codes = (output: string) => [...new Set(output.match(/\bE1[0-9]{2}\b/g) ?? [])].sort();

describe("pnpm validate --files on the hint fixtures", { timeout: 120_000 }, () => {
  it("passes a fully hinted edge beside an unhinted one", () => {
    const { status, output } = validateFixture("hint-clean.yaml");
    expect(output).toContain("No errors in the checked files");
    expect(status).toBe(0);
  });

  it("fails E122 on a hint that is not a positive integer", () => {
    const { status, output } = validateFixture("hint-not-integer.yaml");
    expect(codes(output)).toEqual(["E122"]);
    expect(output).toContain("rowPosition must be a positive integer");
    expect(output).toContain("columnPosition must be a positive integer");
    expect(status).toBe(1);
  });

  it("fails E123 on a hint without its partner", () => {
    const { status, output } = validateFixture("hint-unpaired.yaml");
    expect(codes(output)).toEqual(["E123"]);
    expect(output).toContain("rowPosition without columnPosition");
    expect(status).toBe(1);
  });

  it("fails E124 on a cell occupied twice on one edge", () => {
    const { status, output } = validateFixture("hint-duplicate-cell.yaml");
    expect(codes(output)).toEqual(["E124"]);
    expect(output).toContain("'Input 2' and 'Input 1'");
    expect(status).toBe(1);
  });

  it("fails E125 on an edge that is only partly hinted", () => {
    const { status, output } = validateFixture("hint-partial-edge.yaml");
    expect(codes(output)).toEqual(["E125"]);
    expect(output).toContain("'Input 2' carries no rowPosition or columnPosition");
    expect(status).toBe(1);
  });
});

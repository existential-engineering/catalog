import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findIdImmutabilityErrors, RETIREMENT_LABEL } from "../check-id-immutability.js";

// The check is run against a throwaway git repository rather than a
// mocked diff, because what it escaped on (a rename git pairs with -M, a
// deletion `--diff-filter=M` never lists) is git's own behaviour.

const ENTRY_A = `id: AAAAAAAAAAAAAAAAAAAAA
name: Alpha
manufacturer: acme
primaryCategory: pedal
description: A pedal with enough prose for git to pair a rename.
io:
  - key: K1aaaaaa
    name: Input
    signalFlow: input
    category: audio
    type: instrument
    connection: 1/4-inch
    maxConnections: 1
    position: Right
`;

const ENTRY_B = ENTRY_A.replace("AAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBB")
  .replace("Alpha", "Beta")
  .replace("K1aaaaaa", "K2bbbbbb");

describe("findIdImmutabilityErrors", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

  /** A repository with two hardware entries committed; returns its path and the base sha. */
  function repo(): { cwd: string; base: string } {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-ids-"));
    dirs.push(cwd);
    git(cwd, "init", "-q");
    git(cwd, "config", "user.email", "t@example.com");
    git(cwd, "config", "user.name", "t");
    git(cwd, "config", "commit.gpgsign", "false");
    fs.mkdirSync(path.join(cwd, "data", "hardware"), { recursive: true });
    write(cwd, "a.yaml", ENTRY_A);
    write(cwd, "b.yaml", ENTRY_B);
    commit(cwd, "base");
    return { cwd, base: git(cwd, "rev-parse", "HEAD").trim() };
  }
  const write = (cwd: string, name: string, text: string) =>
    fs.writeFileSync(path.join(cwd, "data", "hardware", name), text);
  const commit = (cwd: string, message: string) => {
    git(cwd, "add", "-A");
    git(cwd, "-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", message);
  };

  it("passes an unchanged tree and a modified file that keeps its id", () => {
    const { cwd, base } = repo();
    expect(findIdImmutabilityErrors({ baseRef: base, cwd })).toEqual({ errors: [], checked: 0 });
    write(cwd, "a.yaml", ENTRY_A.replace("name: Alpha", "name: Alpha II"));
    commit(cwd, "rename product");
    expect(findIdImmutabilityErrors({ baseRef: base, cwd })).toEqual({ errors: [], checked: 1 });
  });

  it("fails a modified file whose id changed", () => {
    const { cwd, base } = repo();
    write(cwd, "a.yaml", ENTRY_A.replace("AAAAAAAAAAAAAAAAAAAAA", "CCCCCCCCCCCCCCCCCCCCC"));
    commit(cwd, "new id");
    const { errors } = findIdImmutabilityErrors({ baseRef: base, cwd });
    expect(errors).toEqual([
      "data/hardware/a.yaml: ID was changed from 'AAAAAAAAAAAAAAAAAAAAA' to 'CCCCCCCCCCCCCCCCCCCCC'. IDs are immutable once assigned.",
    ]);
  });

  it("passes a rename that keeps the id and fails one that changes it, once", () => {
    const { cwd, base } = repo();
    git(cwd, "mv", "data/hardware/b.yaml", "data/hardware/b-mk2.yaml");
    commit(cwd, "rename file");
    expect(findIdImmutabilityErrors({ baseRef: base, cwd }).errors).toEqual([]);

    write(cwd, "b-mk2.yaml", ENTRY_B.replace("BBBBBBBBBBBBBBBBBBBBB", "DDDDDDDDDDDDDDDDDDDDD"));
    commit(cwd, "rename with new id");
    const { errors } = findIdImmutabilityErrors({ baseRef: base, cwd });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^data\/hardware\/b-mk2\.yaml: ID was changed from 'BBBB/);
  });

  it("fails a deletion unless the pull request carries the retirement label", () => {
    const { cwd, base } = repo();
    fs.rmSync(path.join(cwd, "data", "hardware", "b.yaml"));
    commit(cwd, "delete");
    const { errors } = findIdImmutabilityErrors({ baseRef: base, cwd });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(
      /^data\/hardware\/b\.yaml: id 'BBBBBBBBBBBBBBBBBBBBB' is on [0-9a-f]+ and on no file here\./
    );
    expect(
      findIdImmutabilityErrors({ baseRef: base, cwd, labels: ["data", RETIREMENT_LABEL] }).errors
    ).toEqual([]);
  });

  it("passes a deletion whose id moved to another file in the same change", () => {
    // Two entries merged into one keep the surviving id; the other file goes.
    const { cwd, base } = repo();
    fs.rmSync(path.join(cwd, "data", "hardware", "b.yaml"));
    write(cwd, "beta.yaml", ENTRY_B);
    commit(cwd, "merge");
    expect(findIdImmutabilityErrors({ baseRef: base, cwd }).errors).toEqual([]);
  });

  it("reports a port whose key moved", () => {
    const { cwd, base } = repo();
    write(cwd, "a.yaml", ENTRY_A.replace("K1aaaaaa", "K9zzzzzz"));
    commit(cwd, "churn key");
    const { errors } = findIdImmutabilityErrors({ baseRef: base, cwd });
    expect(errors).toEqual([
      "data/hardware/a.yaml: io port 'Input' changed key from 'K1aaaaaa' to 'K9zzzzzz'. IO keys are immutable once assigned.",
    ]);
  });

  it("refuses a head file that is a symlink rather than reading through it", () => {
    const { cwd, base } = repo();
    fs.rmSync(path.join(cwd, "data", "hardware", "a.yaml"));
    fs.symlinkSync("/dev/null", path.join(cwd, "data", "hardware", "a.yaml"));
    commit(cwd, "symlink");
    const { errors } = findIdImmutabilityErrors({ baseRef: base, cwd });
    expect(errors.some((e) => /a\.yaml: .*symbolic link/.test(e))).toBe(true);
  });
});

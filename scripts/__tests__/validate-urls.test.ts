import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// The file-selection half of the script is what is under test, and nothing
// here names a URL. The guard is stubbed anyway, so that a regression that
// reached the network would fail here instead of making a request.
vi.mock("../lib/url-guard.js", () => ({
  fetchPublic: vi.fn(() => Promise.reject(new Error("network disabled in tests"))),
  isPrivateDestinationError: () => false,
}));

import { parseArgs, resolveListedFiles } from "../validate-urls.js";

describe("parseArgs", () => {
  it("reads --files and leaves the git lane off", () => {
    expect(parseArgs(["--files", "changed.txt"])).toMatchObject({
      changedOnly: false,
      filesList: "changed.txt",
    });
    expect(parseArgs(["--files", "-"]).filesList).toBe("-");
  });

  it("refuses --files together with --changed-only", () => {
    expect(() => parseArgs(["--changed-only", "--base", "abc1234", "--files", "x"])).toThrow(
      /mutually exclusive/
    );
  });

  it("still requires --base with --changed-only", () => {
    expect(() => parseArgs(["--changed-only"])).toThrow(/--base/);
  });
});

describe("resolveListedFiles", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
  const tmpRoot = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-validate-urls-"));
    dirs.push(dir);
    const root = path.join(dir, "data");
    fs.mkdirSync(path.join(root, "software"), { recursive: true });
    return root;
  };

  it("resolves only the listed files, skipping blank lines", () => {
    const root = tmpRoot();
    const listed = path.join(root, "software", "a.yaml");
    const unlisted = path.join(root, "software", "b.yaml");
    fs.writeFileSync(listed, "name: A\n");
    fs.writeFileSync(unlisted, "name: B\n");

    expect(resolveListedFiles(`${listed}\n\n`, root)).toEqual([fs.realpathSync(listed)]);
  });

  it("refuses a path that leaves the root and never reads it", () => {
    const root = tmpRoot();
    const outside = path.join(root, "..", "outside.yaml");
    fs.writeFileSync(outside, "url: https://example.com\n");
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      resolveListedFiles(`${path.join(root, "software", "..", "..", "outside.yaml")}\n`, root)
    ).toEqual([]);
    expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/outside\.yaml.*is outside/));
  });

  it("refuses a symlink inside the root", () => {
    const root = tmpRoot();
    const link = path.join(root, "software", "x.yaml");
    fs.symlinkSync("/dev/null", link);
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(resolveListedFiles(link, root)).toEqual([]);
    expect(stderr).toHaveBeenCalledWith(expect.stringMatching(/is a symlink/));
  });

  it("reports a listed file that does not exist unless told not to", () => {
    const root = tmpRoot();
    const missing = path.join(root, "software", "gone.yaml");
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(resolveListedFiles(missing, root)).toEqual([]);
    expect(stderr).toHaveBeenCalledTimes(1);
    expect(resolveListedFiles(missing, root, { ignoreMissing: true })).toEqual([]);
    expect(stderr).toHaveBeenCalledTimes(1);
  });
});

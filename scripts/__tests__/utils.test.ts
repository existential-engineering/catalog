import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  escapeSQL,
  findClosestMatch,
  formatValidOptions,
  getYamlFiles,
  loadYamlFile,
  parseErrorPath,
  readRegularFile,
} from "../lib/utils.js";

describe("readRegularFile", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });
  const tmp = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-utils-"));
    dirs.push(dir);
    return dir;
  };

  it("reads a regular file", () => {
    const dir = tmp();
    const file = path.join(dir, "a.yaml");
    fs.writeFileSync(file, "name: A\n");
    expect(readRegularFile(file)).toBe("name: A\n");
    expect(loadYamlFile<{ name: string }>(file)).toEqual({ name: "A" });
  });

  it("refuses a symlink rather than reading through it", () => {
    // A committed `data/software/x.yaml -> /dev/zero` was an unbounded
    // read in validate and build; the link is refused as a link.
    const dir = tmp();
    const target = path.join(dir, "real.yaml");
    fs.writeFileSync(target, "name: A\n");
    const link = path.join(dir, "link.yaml");
    fs.symlinkSync(target, link);
    expect(() => readRegularFile(link)).toThrow(/symbolic link/);
    expect(() => loadYamlFile(link)).toThrow(/symbolic link/);
  });

  it("refuses something that is not a regular file", () => {
    const dir = tmp();
    expect(() => readRegularFile(dir)).toThrow(/not a regular file/);
  });
});

describe("getYamlFiles", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("lists regular .yaml and .yml files, sorted, and nothing that is not a regular file", () => {
    // A listing is a list of names: a symlink named x.yaml is not a catalog
    // file, and neither is a directory named one.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-list-"));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, "b.yaml"), "name: B\n");
    fs.writeFileSync(path.join(dir, "a.yml"), "name: A\n");
    fs.writeFileSync(path.join(dir, "notes.md"), "");
    fs.symlinkSync("/dev/zero", path.join(dir, "link.yaml"));
    fs.mkdirSync(path.join(dir, "dir.yaml"));
    expect(getYamlFiles(dir)).toEqual([path.join(dir, "a.yml"), path.join(dir, "b.yaml")]);
    expect(getYamlFiles(path.join(dir, "missing"))).toEqual([]);
  });
});

describe("findClosestMatch", () => {
  it("returns exact match when found", () => {
    const options = new Set(["synth", "effect", "sampler"]);
    expect(findClosestMatch("synth", options)).toBe("synth");
  });

  it("returns close match with typo", () => {
    const options = new Set(["synth", "effect", "sampler"]);
    expect(findClosestMatch("syntj", options)).toBe("synth");
    expect(findClosestMatch("efect", options)).toBe("effect");
  });

  it("returns null when no close match exists", () => {
    const options = new Set(["synth", "effect", "sampler"]);
    expect(findClosestMatch("completely-different", options)).toBeNull();
  });

  it("is case-insensitive", () => {
    const options = new Set(["synth", "effect"]);
    expect(findClosestMatch("SYNTH", options)).toBe("synth");
    expect(findClosestMatch("Effect", options)).toBe("effect");
  });
});

describe("parseErrorPath", () => {
  it("parses simple path", () => {
    expect(parseErrorPath("name")).toEqual(["name"]);
  });

  it("parses nested path", () => {
    expect(parseErrorPath("manufacturer.name")).toEqual(["manufacturer", "name"]);
  });

  it("parses path with array index", () => {
    expect(parseErrorPath("categories.0")).toEqual(["categories", 0]);
    expect(parseErrorPath("links.2.url")).toEqual(["links", 2, "url"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseErrorPath("")).toEqual([]);
  });
});

describe("formatValidOptions", () => {
  it("formats small list", () => {
    const options = new Set(["a", "b", "c"]);
    expect(formatValidOptions(options)).toBe("a, b, c");
  });

  it("truncates large list with count", () => {
    const options = new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]);
    const result = formatValidOptions(options, 5);
    expect(result).toContain("... (12 total)");
  });

  it("sorts options alphabetically", () => {
    const options = new Set(["z", "a", "m"]);
    expect(formatValidOptions(options)).toBe("a, m, z");
  });
});

describe("escapeSQL", () => {
  it("escapes single quotes", () => {
    expect(escapeSQL("it's")).toBe("'it''s'");
  });

  it("handles null", () => {
    expect(escapeSQL(null)).toBe("NULL");
  });

  it("handles undefined", () => {
    expect(escapeSQL(undefined)).toBe("NULL");
  });

  it("wraps plain strings in quotes", () => {
    expect(escapeSQL("hello")).toBe("'hello'");
  });

  it("handles multiple single quotes", () => {
    expect(escapeSQL("it's Bob's")).toBe("'it''s Bob''s'");
  });
});

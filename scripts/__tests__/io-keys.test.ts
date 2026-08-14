import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import {
  assignIoKeys,
  findDuplicateIoKeys,
  findIoKeyViolations,
  generateUniqueIoKey,
  IO_KEY_PATTERN,
} from "../lib/io-keys.js";
import type { IO } from "../lib/types.js";
import { getYamlFiles } from "../lib/utils.js";

function port(overrides: Partial<IO>): IO {
  return {
    name: "Main Out L",
    signalFlow: "output",
    category: "audio",
    type: "line",
    connection: "ts",
    ...overrides,
  };
}

describe("generateUniqueIoKey", () => {
  it("produces 8-char alphanumeric keys and avoids collisions", () => {
    const existing = new Set<string>(["AAAAAAAA"]);
    const key = generateUniqueIoKey(existing);
    expect(key).toMatch(IO_KEY_PATTERN);
    expect(existing.has(key)).toBe(true);
    expect(existing.size).toBe(2);
  });
});

describe("findDuplicateIoKeys", () => {
  it("finds duplicates and ignores missing keys", () => {
    const io = [
      port({ key: "abc12345" }),
      port({ key: "abc12345" }),
      port({ key: "xyz67890" }),
      port({}),
      port({}),
    ];
    expect(findDuplicateIoKeys(io)).toEqual(["abc12345"]);
  });
});

describe("assignIoKeys", () => {
  it("assigns keys only to ports that lack one, key-first, preserving comments", () => {
    const doc = parseDocument(
      [
        "id: test-entry",
        "io:",
        "  # main output",
        "  - key: keepMe12",
        "    name: Out L",
        "    signalFlow: output",
        "  - name: Out R",
        "    signalFlow: output",
      ].join("\n")
    );

    const assigned = assignIoKeys(doc);
    expect(assigned).toBe(1);

    const data = doc.toJSON() as { io: { key?: string; name: string }[] };
    expect(data.io[0].key).toBe("keepMe12");
    expect(data.io[1].key).toMatch(IO_KEY_PATTERN);

    const text = doc.toString();
    expect(text).toContain("# main output");
    // New key is the first field of its io map
    expect(text).toMatch(/- key: [0-9a-zA-Z]{8}\n {4}name: Out R/);
  });

  it("is a no-op when all ports have keys or io is absent", () => {
    const withKeys = parseDocument("io:\n  - key: abc12345\n    name: Out\n");
    expect(assignIoKeys(withKeys)).toBe(0);

    const noIo = parseDocument("id: x\nname: y\n");
    expect(assignIoKeys(noIo)).toBe(0);
  });

  it("never collides with keys already present in the entry", () => {
    const doc = parseDocument("io:\n  - key: abc12345\n    name: A\n  - name: B\n");
    assignIoKeys(doc);
    const data = doc.toJSON() as { io: { key: string }[] };
    expect(data.io[1].key).not.toBe("abc12345");
  });
});

describe("findIoKeyViolations", () => {
  const base = [port({ key: "aaaa1111", name: "Out L" }), port({ key: "bbbb2222", name: "Out R" })];

  it("passes when keys are preserved", () => {
    expect(findIoKeyViolations(base, base)).toEqual([]);
  });

  it("passes when a port is renamed but keeps its key", () => {
    const current = [port({ key: "aaaa1111", name: "Main Output L" }), base[1]];
    expect(findIoKeyViolations(base, current)).toEqual([]);
  });

  it("passes when a port is deleted along with its key", () => {
    expect(findIoKeyViolations(base, [base[1]])).toEqual([]);
  });

  it("flags key churn on an unchanged port", () => {
    const current = [port({ key: "cccc3333", name: "Out L" }), base[1]];
    const violations = findIoKeyViolations(base, current);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("'Out L'");
    expect(violations[0]).toContain("aaaa1111");
    expect(violations[0]).toContain("cccc3333");
  });

  it("flags duplicate keys in the current io list", () => {
    const current = [base[0], port({ key: "aaaa1111", name: "Out R" })];
    const violations = findIoKeyViolations(base, current);
    expect(violations.some((v) => v.includes("duplicate io key"))).toBe(true);
  });
});

describe("getYamlFiles ordering", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "io-keys-test-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns files sorted by name regardless of creation order", () => {
    for (const name of ["zeta.yaml", "alpha.yaml", "midway.yml", "ignored.txt"]) {
      fs.writeFileSync(path.join(dir, name), "id: x\n");
    }
    const files = getYamlFiles(dir).map((f) => path.basename(f));
    expect(files).toEqual(["alpha.yaml", "midway.yml", "zeta.yaml"]);
  });
});

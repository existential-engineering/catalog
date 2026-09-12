import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildDatabase } from "../build-sqlite.js";
import { insertStatements, reflectCollection } from "../generate-patch.js";
import { resolveFormatIdentifier } from "../lib/identifier-fallback.js";
import { getYamlFiles } from "../lib/utils.js";
import { COLLECTION_SCHEMAS, validateFile } from "../validate.js";

// An entry holding its identifier under `default` or `bundle` used to build
// to a `software_formats` row per format with a NULL identifier, because the
// build looked the format name up and nothing else. Studio's matcher reads
// only that column, so 217 of the 247 entries with identifiers were
// unreachable. These pin the precedence lib/identifier-fallback.ts applies.

describe("resolveFormatIdentifier", () => {
  it("prefers the format's own key over default, and default over bundle", () => {
    const ids = { default: "com.acme.Verb", vst3: "com.acme.Verb.vst3", bundle: "com.acme.App" };
    expect(resolveFormatIdentifier(ids, "vst3")).toBe("com.acme.Verb.vst3");
    expect(resolveFormatIdentifier(ids, "au")).toBe("com.acme.Verb");
    expect(resolveFormatIdentifier(ids, "aax")).toBe("com.acme.Verb");
  });

  it("applies bundle to au and standalone only", () => {
    const ids = { bundle: "com.acme.App" };
    expect(resolveFormatIdentifier(ids, "au")).toBe("com.acme.App");
    expect(resolveFormatIdentifier(ids, "standalone")).toBe("com.acme.App");
    expect(resolveFormatIdentifier(ids, "vst3")).toBeNull();
    expect(resolveFormatIdentifier(ids, "aax")).toBeNull();
  });

  it("resolves nothing for an entry without identifiers or with none that apply", () => {
    expect(resolveFormatIdentifier(undefined, "au")).toBeNull();
    expect(resolveFormatIdentifier({}, "au")).toBeNull();
    expect(resolveFormatIdentifier({ productId: "106832" }, "vst3")).toBeNull();
  });
});

describe("buildDatabase with fallback identifiers", () => {
  const ids = {
    acme: "MFR00000000000000acme",
    shared: "SW0000000000000shared",
    app: "SW00000000000000000app",
    mixed: "SW00000000000000mixed",
  };

  let tmp: string;
  let db: Database.Database;

  const write = (rel: string, body: string) => {
    const file = path.join(tmp, "data", rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  };

  const rows = (softwareId: string) =>
    db
      .prepare(
        "SELECT format, identifier FROM software_formats WHERE software_id = ? ORDER BY format"
      )
      .all(softwareId) as { format: string; identifier: string | null }[];

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-fallback-"));
    write(
      "manufacturers/acme-audio.yaml",
      `id: ${ids.acme}\nname: Acme Audio\nurl: https://acme.example/\n`
    );
    // Only `default`: the shape 208 real entries take.
    write(
      "software/acme-shared.yaml",
      [
        `id: ${ids.shared}`,
        "name: Acme Shared",
        "manufacturer: acme-audio",
        "primaryCategory: reverb",
        "formats:",
        "  - au",
        "  - vst3",
        "  - aax",
        "platforms:",
        "  - mac",
        "identifiers:",
        "  default: com.acme.Shared",
        "description: One bundle id for every format.",
        "",
      ].join("\n")
    );
    // Only `bundle`: the DAW shape (ableton-live, bitwig-studio).
    write(
      "software/acme-app.yaml",
      [
        `id: ${ids.app}`,
        "name: Acme App",
        "manufacturer: acme-audio",
        "primaryCategory: daw",
        "formats:",
        "  - standalone",
        "  - vst3",
        "  - au",
        "platforms:",
        "  - mac",
        "identifiers:",
        "  bundle: com.acme.App",
        "description: A macOS app bundle.",
        "",
      ].join("\n")
    );
    // `default` plus a per-format override: the README's Serum example.
    write(
      "software/acme-mixed.yaml",
      [
        `id: ${ids.mixed}`,
        "name: Acme Mixed",
        "manufacturer: acme-audio",
        "primaryCategory: synthesizer",
        "formats:",
        "  - au",
        "  - vst3",
        "platforms:",
        "  - mac",
        "identifiers:",
        "  default: com.acme.Mixed",
        "  vst3: com.acme.Mixed.vst3",
        "description: One format overrides the default.",
        "",
      ].join("\n")
    );

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      buildDatabase({
        dataDir: path.join(tmp, "data"),
        outputFile: path.join(tmp, "catalog.sqlite"),
        version: "0.0.0-test",
      });
    } finally {
      log.mockRestore();
      warn.mockRestore();
    }
    db = new Database(path.join(tmp, "catalog.sqlite"), { readonly: true });
  });

  afterAll(() => {
    db?.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("uses entries pnpm validate accepts, so default and bundle stay legal keys", () => {
    const manufacturers = new Set(["acme-audio"]);
    for (const file of getYamlFiles(path.join(tmp, "data", "software"))) {
      expect(validateFile(file, COLLECTION_SCHEMAS.software, manufacturers), file).toBeNull();
    }
  });

  it("writes the default identifier on every listed format", () => {
    expect(rows(ids.shared)).toEqual([
      { format: "aax", identifier: "com.acme.Shared" },
      { format: "au", identifier: "com.acme.Shared" },
      { format: "vst3", identifier: "com.acme.Shared" },
    ]);
  });

  it("writes a bundle identifier on au and standalone and leaves the rest null", () => {
    expect(rows(ids.app)).toEqual([
      { format: "au", identifier: "com.acme.App" },
      { format: "standalone", identifier: "com.acme.App" },
      { format: "vst3", identifier: null },
    ]);
  });

  it("lets a per-format key override the default", () => {
    expect(rows(ids.mixed)).toEqual([
      { format: "au", identifier: "com.acme.Mixed" },
      { format: "vst3", identifier: "com.acme.Mixed.vst3" },
    ]);
  });

  it("reaches the incremental patch through reflection, with no hand-written block", () => {
    // generate-patch reads rows back out of the built database, so the
    // resolved identifier rides the existing software_formats reflection.
    const schema = reflectCollection(db, "software");
    const statements = insertStatements(db, schema, ids.shared) ?? [];
    const formats = statements.filter((s) => s.includes('INSERT INTO "software_formats"'));
    expect(formats).toHaveLength(3);
    for (const statement of formats) {
      expect(statement).toContain("'com.acme.Shared'");
    }
  });
});

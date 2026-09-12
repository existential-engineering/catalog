import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyIdentifierRows,
  isLocalIdentifier,
  parseIdentifierRows,
  vendorSegmentMatches,
} from "../lib/identifier-writer.js";

// The writer is the one path every identifier producer goes through, so
// these pin its refusals: a local fallback, an invalid value, a format that
// already resolves elsewhere, and a vendor segment naming another maker.

let dataDir: string;

function writeEntry(slug: string, body: string): void {
  fs.writeFileSync(path.join(dataDir, "software", `${slug}.yaml`), body);
}

function readEntry(slug: string): string {
  return fs.readFileSync(path.join(dataDir, "software", `${slug}.yaml`), "utf-8");
}

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "identifier-writer-"));
  fs.mkdirSync(path.join(dataDir, "software"));
  fs.mkdirSync(path.join(dataDir, "manufacturers"));
  fs.writeFileSync(
    path.join(dataDir, "manufacturers", "fabfilter.yaml"),
    "name: FabFilter\nurl: https://www.fabfilter.com/\n"
  );
  writeEntry(
    "fabfilter-pro-q-3",
    [
      "id: 7QMeWge0fOrmQz_oVLCKk",
      "name: Pro-Q 3",
      "manufacturer: fabfilter",
      "primaryCategory: equalizer",
      "formats:",
      "  - au",
      "  - vst3",
      "platforms:",
      "  - mac",
      "versions:",
      '  - name: "3.20"',
      "",
    ].join("\n")
  );
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("isLocalIdentifier", () => {
  it("names the scanner fallbacks", () => {
    expect(isLocalIdentifier("local.Pro-Q 3")).toBe(true);
    expect(isLocalIdentifier("")).toBe(true);
    expect(isLocalIdentifier("com.fabfilter.Pro-Q-3")).toBe(false);
  });
});

describe("vendorSegmentMatches", () => {
  it("accepts the middle segments against slug or display name", () => {
    expect(vendorSegmentMatches("com.fabfilter.Pro-Q-3", "fabfilter", "FabFilter")).toBe(true);
    expect(vendorSegmentMatches("de.u-he.Diva", "u-he", "u-he")).toBe(true);
    expect(
      vendorSegmentMatches(
        "com.native-instruments.Massive",
        "native-instruments",
        "Native Instruments"
      )
    ).toBe(true);
    expect(vendorSegmentMatches("uk.co.acme.Verb", "acme-audio", "Acme Audio")).toBe(true);
    expect(vendorSegmentMatches("xferrecords.Serum", "xfer-records", "Xfer Records")).toBe(true);
  });

  it("refuses a vendor segment that names nobody like the manufacturer", () => {
    expect(vendorSegmentMatches("com.waves.Renaissance", "softube", "Softube")).toBe(false);
    expect(vendorSegmentMatches("com.izotope.Ozone", "fabfilter", "FabFilter")).toBe(false);
  });
});

describe("applyIdentifierRows", () => {
  it("writes a per-format identifier and reports it, without touching the file on a dry run", () => {
    const rows = [
      { target: "fabfilter-pro-q-3", format: "vst3", identifier: "com.fabfilter.Pro-Q-3" },
    ];
    const dry = applyIdentifierRows(rows, { write: false, dataDir });
    expect(dry.outcomes[0].kind).toBe("written");
    expect(dry.filesChanged).toBe(1);
    expect(readEntry("fabfilter-pro-q-3")).not.toContain("identifiers");

    applyIdentifierRows(rows, { write: true, dataDir });
    expect(readEntry("fabfilter-pro-q-3")).toContain("identifiers:\n  vst3: com.fabfilter.Pro-Q-3");
  });

  it("resolves a target by id as well as by slug", () => {
    const summary = applyIdentifierRows(
      [{ target: "7QMeWge0fOrmQz_oVLCKk", format: "au", identifier: "com.fabfilter.Pro-Q-3" }],
      { write: false, dataDir }
    );
    expect(summary.outcomes[0].kind).toBe("written");
    expect(summary.outcomes[0].file).toBe(path.join("software", "fabfilter-pro-q-3.yaml"));
  });

  it("reports same when the format already resolves to the value, through default too", () => {
    writeEntry(
      "fabfilter-pro-q-3",
      "name: Pro-Q 3\nmanufacturer: fabfilter\nformats:\n  - au\nidentifiers:\n  default: com.fabfilter.Pro-Q-3\n"
    );
    const summary = applyIdentifierRows(
      [{ target: "fabfilter-pro-q-3", format: "au", identifier: "com.fabfilter.Pro-Q-3" }],
      { write: true, dataDir }
    );
    expect(summary.outcomes[0].kind).toBe("same");
    expect(summary.filesChanged).toBe(0);
  });

  it("refuses a format that already resolves to a different identifier", () => {
    writeEntry(
      "fabfilter-pro-q-3",
      "name: Pro-Q 3\nmanufacturer: fabfilter\nformats:\n  - vst3\nidentifiers:\n  vst3: com.fabfilter.Pro-Q-3.vst3\n"
    );
    const summary = applyIdentifierRows(
      [{ target: "fabfilter-pro-q-3", format: "vst3", identifier: "com.fabfilter.Pro-Q-3" }],
      { write: true, dataDir }
    );
    expect(summary.outcomes[0].kind).toBe("conflict");
    expect(summary.outcomes[0].detail).toContain("already resolves to com.fabfilter.Pro-Q-3.vst3");
    expect(readEntry("fabfilter-pro-q-3")).toContain("vst3: com.fabfilter.Pro-Q-3.vst3");
  });

  it("refuses a vendor segment naming another maker, which is the mis-match signal", () => {
    const summary = applyIdentifierRows(
      [{ target: "fabfilter-pro-q-3", format: "vst3", identifier: "com.waves.Renaissance-EQ" }],
      { write: true, dataDir }
    );
    expect(summary.outcomes[0].kind).toBe("conflict");
    expect(summary.outcomes[0].detail).toContain("vendor segment");
    expect(readEntry("fabfilter-pro-q-3")).not.toContain("identifiers");
  });

  it("skips local fallbacks, invalid values and formats that carry no identifier", () => {
    const summary = applyIdentifierRows(
      [
        { target: "fabfilter-pro-q-3", format: "vst3", identifier: "local.Pro-Q 3" },
        { target: "fabfilter-pro-q-3", format: "au", identifier: "not an id" },
        { target: "fabfilter-pro-q-3", format: "au_tsm", identifier: "aufx:FPQ3:FabF" },
        { target: "fabfilter-pro-q-3", format: "standalone", identifier: "com.fabfilter.App" },
        { target: "nobody", format: "vst3", identifier: "com.acme.X" },
      ],
      { write: true, dataDir }
    );
    expect(summary.outcomes.map((o) => o.kind)).toEqual([
      "skipped",
      "skipped",
      "unsupported-format",
      "unsupported-format",
      "not-found",
    ]);
    expect(summary.filesChanged).toBe(0);
  });

  it("adds an unlisted format beside its identifier and a new version newest-first", () => {
    const summary = applyIdentifierRows(
      [
        {
          target: "fabfilter-pro-q-3",
          format: "aax",
          identifier: "com.fabfilter.Pro-Q-3",
          version: "3.24",
        },
        {
          target: "fabfilter-pro-q-3",
          format: "aax",
          identifier: "com.fabfilter.Pro-Q-3",
          version: "3.20.0",
        },
      ],
      { write: true, dataDir }
    );
    expect(summary.outcomes[0].kind).toBe("written");
    expect(summary.outcomes[0].formatAdded).toBe(true);
    expect(summary.outcomes[0].versionAdded).toBe(true);
    // The second row is the same identifier and a version already present.
    expect(summary.outcomes[1].kind).toBe("same");
    const text = readEntry("fabfilter-pro-q-3");
    expect(text).toContain("  - vst3\n  - aax\n");
    expect(text).toContain('versions:\n  - name: "3.24"\n  - name: "3.20"');
    expect(summary.filesChanged).toBe(1);
  });

  it("adds a format and version alone when the source knows no identifier", () => {
    const summary = applyIdentifierRows(
      [{ target: "fabfilter-pro-q-3", format: "clap", version: "3.24", source: "registry" }],
      { write: true, dataDir }
    );
    expect(summary.outcomes[0]).toMatchObject({
      kind: "written",
      formatAdded: true,
      versionAdded: true,
    });
    const text = readEntry("fabfilter-pro-q-3");
    expect(text).toContain("  - clap\n");
    expect(text).not.toContain("identifiers");
  });

  it("accepts a VST3 class id without a vendor check", () => {
    const summary = applyIdentifierRows(
      [
        {
          target: "fabfilter-pro-q-3",
          format: "vst3",
          identifier: "ABCDEF019182FAEB53634D7353633346",
        },
      ],
      { write: false, dataDir }
    );
    expect(summary.outcomes[0].kind).toBe("written");
  });
});

describe("parseIdentifierRows", () => {
  it("reads tab-separated rows and ignores comments and blanks", () => {
    const rows = parseIdentifierRows(
      "# reviewed\n\nfabfilter-pro-q-3\tvst3\tcom.fabfilter.Pro-Q-3\t3.24\tinstaller\nacme-verb\tau\tcom.acme.Verb\n"
    );
    expect(rows).toEqual([
      {
        target: "fabfilter-pro-q-3",
        format: "vst3",
        identifier: "com.fabfilter.Pro-Q-3",
        version: "3.24",
        source: "installer",
      },
      { target: "acme-verb", format: "au", identifier: "com.acme.Verb" },
    ]);
    expect(parseIdentifierRows("acme-verb\tclap\t-\t1.2\n")).toEqual([
      { target: "acme-verb", format: "clap", version: "1.2" },
    ]);
  });

  it("fails on a short row rather than dropping it", () => {
    expect(() => parseIdentifierRows("acme-verb\tau\n")).toThrow(/line 1/);
  });
});

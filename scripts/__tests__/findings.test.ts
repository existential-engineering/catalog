import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { toFindings as gapFindings } from "../capability-gaps.js";
import { toFindings as hpFindings } from "../dataset-audit.js";
import {
  checkContainedDirectory,
  FINDING_KINDS,
  type FindingInput,
  readFindings,
  recordFindings,
} from "../lib/findings.js";
import { toFindings as powerFindings } from "../power-input-audit.js";
import { toFindings as portFindings } from "../speaker-level-audit.js";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "findings-"));
});

const row: FindingInput = {
  kind: "missing-power-input",
  brand: "focal",
  key: "missing-power-input:focal-utopia-main-112",
  title: "no power input on a studio-monitor entry",
  detail: "The entry documents a mains supply and carries no power port.",
};

describe("the kind strings are the cross-repo contract", () => {
  it("spells each one exactly as the reader expects", () => {
    // The reader is scripts/catalog-import/findings.ts in the racks repo,
    // which DROPS a row whose kind it does not know, silently and by
    // design. A typo here is a run that reports findings and files none,
    // and nothing anywhere would say so. Pinned literally rather than
    // derived, so a rename has to be made in both repos deliberately.
    expect([...FINDING_KINDS]).toEqual([
      "missing-power-input",
      "mistyped-port",
      "capability-gap",
      "missing-hp",
    ]);
  });
});

describe("recordFindings", () => {
  it("round-trips a row and stamps recordedAt", () => {
    expect(recordFindings(dir, [row])).toBe(1);
    const [found] = readFindings(dir);
    expect(found).toMatchObject(row);
    expect(Date.parse(found!.recordedAt)).not.toBeNaN();
  });

  it("keeps the first row per key, so a re-run does not double-file", () => {
    recordFindings(dir, [{ ...row, detail: "first" }]);
    recordFindings(dir, [{ ...row, detail: "second" }]);
    const all = readFindings(dir);
    expect(all).toHaveLength(1);
    expect(all[0]!.detail).toBe("first");
  });

  it("does not let a malformed row claim a key a good row needs", () => {
    // JSON.parse enforces nothing. A garbage row carrying a `key` used to
    // be added to `seen` before it was checked, so the real finding that
    // followed read as a duplicate: the bad row kept and the good one
    // dropped. The guard has to run before the dedup, not after.
    fs.writeFileSync(
      path.join(dir, "findings.jsonl"),
      `${JSON.stringify({ key: row.key, kind: "invented-kind" })}\n`
    );
    recordFindings(dir, [row]);
    const all = readFindings(dir);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject(row);
  });

  it("drops a row whose kind nothing downstream routes", () => {
    fs.writeFileSync(
      path.join(dir, "findings.jsonl"),
      `${JSON.stringify({ ...row, kind: "invented-kind", recordedAt: "2026-09-19T00:00:00Z" })}\n`
    );
    expect(readFindings(dir)).toEqual([]);
  });

  it("drops a row missing a field the issue body needs", () => {
    const { detail: _drop, ...noDetail } = row;
    fs.writeFileSync(
      path.join(dir, "findings.jsonl"),
      `${JSON.stringify({ ...noDetail, recordedAt: "2026-09-19T00:00:00Z" })}\n`
    );
    expect(readFindings(dir)).toEqual([]);
  });

  it("skips a torn final line rather than losing the ledger", () => {
    recordFindings(dir, [row]);
    fs.appendFileSync(path.join(dir, "findings.jsonl"), '{"kind":"missing-pow');
    expect(readFindings(dir)).toHaveLength(1);
  });

  it("refuses to write through a symlinked findings.jsonl", () => {
    // findingsDirArg refuses a symlinked DIRECTORY, and that is only half
    // the door: a findings.jsonl that is itself a link to /etc/cron.d/x
    // passes every check on the directory and then takes the append.
    // O_NOFOLLOW makes the open fail instead.
    const target = path.join(dir, "elsewhere.txt");
    fs.writeFileSync(target, "");
    fs.symlinkSync(target, path.join(dir, "findings.jsonl"));
    expect(recordFindings(dir, [row])).toBe(0);
    expect(fs.readFileSync(target, "utf-8")).toBe("");
  });

  it("returns 0 rather than throwing when the directory is gone", () => {
    // The audit has already produced its report by this point. A
    // bookkeeping failure must not take the 305-entry report with it.
    expect(recordFindings(path.join(dir, "absent"), [row])).toBe(0);
  });

  it("writes nothing and says so when there is nothing to write", () => {
    expect(recordFindings(dir, [])).toBe(0);
    expect(fs.existsSync(path.join(dir, "findings.jsonl"))).toBe(false);
  });
});

describe("checkContainedDirectory", () => {
  it("accepts a real directory inside the root", () => {
    const inner = path.join(dir, "state");
    fs.mkdirSync(inner);
    expect(checkContainedDirectory(inner, dir).path).toBe(fs.realpathSync(inner));
  });

  it("refuses a symlink rather than following it", () => {
    // A `findings -> /etc/cron.d` turns an append into a write outside
    // the checkout, and lstat is what sees the link as a link.
    const link = path.join(dir, "link");
    fs.symlinkSync(os.tmpdir(), link);
    expect(checkContainedDirectory(link, dir).reason).toBe("is a symlink");
  });

  it("refuses a regular file", () => {
    const file = path.join(dir, "notadir");
    fs.writeFileSync(file, "");
    expect(checkContainedDirectory(file, dir).reason).toBe("is not a directory");
  });

  it("refuses a path that climbs out of the root", () => {
    const root = path.join(dir, "root");
    const outside = path.join(dir, "outside");
    fs.mkdirSync(root);
    fs.mkdirSync(outside);
    expect(checkContainedDirectory(outside, root).reason).toMatch(/^is outside /);
  });

  it("refuses a path that is not there at all", () => {
    expect(checkContainedDirectory(path.join(dir, "nope"), dir).reason).toBe("does not exist");
  });
});

describe("what each audit files, and what it holds back", () => {
  it("files a definitional power gap and holds back a review row", () => {
    // A `review` row is on a category holding both a passive cabinet and
    // an active monitor. Filing it puts a guess in front of a person.
    const rows = powerFindings([
      {
        slug: "a-designs-nail",
        manufacturer: "a-designs",
        category: "compressor",
        evidence: "Power Supply: 120/230VAC",
        ports: 4,
        review: false,
      },
      {
        slug: "somebody-speaker",
        manufacturer: "somebody",
        category: "speaker",
        evidence: "mains",
        ports: 2,
        review: true,
      },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["missing-power-input:a-designs-nail"]);
    expect(rows[0]!.brand).toBe("a-designs");
    expect(rows[0]!.file).toBe("data/hardware/a-designs-nail.yaml");
  });

  it("files a mistyped port only when the connector settles it", () => {
    // kef-coda-w really carries a port called "USB-C Inter-Speaker Link"
    // on usb-c. The name says speaker and the jack is a data link.
    const rows = portFindings([
      {
        slug: "marshall-jcm800",
        manufacturer: "marshall",
        port: "Speaker Output",
        type: "line",
        connection: "1/4-inch",
        review: false,
      },
      {
        slug: "kef-coda-w",
        manufacturer: "kef",
        port: "USB-C Inter-Speaker Link",
        type: "usb",
        connection: "usb-c",
        review: false,
      },
      {
        slug: "some-controller",
        manufacturer: "x",
        port: "Speaker Output",
        type: "line",
        connection: "1/4-inch",
        review: true,
      },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["mistyped-port:marshall-jcm800:speaker-output"]);
  });

  it("collapses two jacks sharing a name into one finding", () => {
    // A Marshall head carries two ports both called "Speaker Output".
    // They are one thing for whoever has to open the manual, and a key
    // built on an index would move when the port list is reordered.
    const jack = {
      slug: "marshall-jcm800",
      manufacturer: "marshall",
      port: "Speaker Output",
      type: "line",
      connection: "1/4-inch",
      review: false,
    };
    expect(portFindings([jack, { ...jack }])).toHaveLength(1);
  });

  it("files a capability gap per pair, tier 1 only", () => {
    // The pair is the reviewed unit because an entry commonly has one
    // accepted finding and one rejected, and an issue per entry cannot
    // be closed by half. Tier 2 stays out: its false positives are
    // sibling products and homonyms, which a regex cannot separate.
    const rows = gapFindings([
      {
        slug: "eventide-h90",
        manufacturer: "eventide",
        name: "H90",
        primaryCategory: "multi-effect",
        capabilities: ["reverb", "delay"],
        hits: [
          { capability: "granular", tier: "auto", excerpt: "four granular algorithms" },
          { capability: "chorus", tier: "review", excerpt: "Mixed Chorus" },
        ],
      },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["capability-gap:eventide-h90:granular"]);
  });

  it("files only the hp check out of the dataset audit's eleven", () => {
    // The others name several files at once, so there is no single entry
    // to close an issue against, or they already have a tool in-repo.
    const rows = hpFindings([
      {
        check: "modular-missing-hp",
        severity: "info",
        needsLlmReview: false,
        collection: "hardware",
        name: "Maths",
        manufacturer: "make-noise",
        files: ["data/hardware/make-noise-maths.yaml"],
        detail: "modular entry carries no hp.",
      },
      {
        check: "duplicate-name",
        severity: "warning",
        needsLlmReview: true,
        collection: "hardware",
        name: "Thing",
        files: ["data/hardware/a.yaml", "data/hardware/b.yaml"],
        detail: "two files",
      },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["missing-hp:make-noise-maths"]);
    expect(rows[0]!.brand).toBe("make-noise");
  });

  it("gives every key a stable identity, with no date, run or count in it", () => {
    // findings.ts: one issue per key ever. A key that moves between runs
    // files the same finding again every night into an inbox a person
    // reads.
    const all = [
      ...powerFindings([
        { slug: "s", manufacturer: "m", category: "mixer", evidence: "e", ports: 1, review: false },
      ]),
      ...portFindings([
        {
          slug: "s",
          manufacturer: "m",
          port: "Speaker Output",
          type: "line",
          connection: "speakon",
          review: false,
        },
      ]),
      ...gapFindings([
        {
          slug: "s",
          manufacturer: "m",
          name: "S",
          primaryCategory: "multi-effect",
          capabilities: ["reverb"],
          hits: [{ capability: "looper", tier: "auto", excerpt: "x" }],
        },
      ]),
      ...hpFindings([
        {
          check: "modular-missing-hp",
          severity: "info",
          needsLlmReview: false,
          collection: "hardware",
          name: "S",
          manufacturer: "m",
          files: ["data/hardware/s.yaml"],
          detail: "d",
        },
      ]),
    ];
    expect(all).toHaveLength(4);
    for (const r of all) {
      expect(r.key, r.key).not.toMatch(/\d{4}-\d{2}-\d{2}|\b20\d\d\b/);
      expect(FINDING_KINDS).toContain(r.kind);
      expect(r.key.startsWith(`${r.kind}:`), r.key).toBe(true);
    }
  });
});

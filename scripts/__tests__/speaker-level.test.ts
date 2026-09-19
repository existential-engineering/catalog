import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { applyRows, parseRows } from "../apply-speaker-level.js";
import {
  findMistypedSpeakerPorts,
  isPassiveSpeakerPort,
  isSpeakerPort,
} from "../speaker-level-audit.js";

describe("isSpeakerPort", () => {
  it("matches a jack that drives or receives a passive speaker", () => {
    expect(isSpeakerPort("Speaker Output")).toBe(true);
    expect(isSpeakerPort("Speaker Output 8 ohm")).toBe(true);
    expect(isSpeakerPort("Extension Speaker Output")).toBe(true);
    expect(isSpeakerPort("Speaker Input")).toBe(true);
    expect(isSpeakerPort("Cabinet Output")).toBe(true);
  });

  it("leaves a speaker-emulated output alone, which really is line level", () => {
    // The name says speaker and the signal does not. These are the class the
    // naive match over-reports, and every one of them is correctly `line`.
    expect(isSpeakerPort("Speaker Emulated Output")).toBe(false);
    expect(isSpeakerPort("Recording Out (Speaker Emulated)")).toBe(false);
    expect(isSpeakerPort("Cabinet Simulator Output")).toBe(false);
    expect(isSpeakerPort("Headphone / Speaker Emulated Output")).toBe(false);
  });

  it("ignores a name that mentions neither", () => {
    expect(isSpeakerPort("Line Output")).toBe(false);
    expect(isSpeakerPort("MIDI In")).toBe(false);
  });
});

describe("isPassiveSpeakerPort", () => {
  it("accepts a passive-speaker jack on a speaker connector", () => {
    expect(isPassiveSpeakerPort({ name: "Speaker Output", connection: "1/4-inch" })).toBe(true);
    expect(isPassiveSpeakerPort({ name: "Speaker Input", connection: "speakon" })).toBe(true);
  });

  it("refuses a speaker-named port on a line-level connector", () => {
    // A passive loudspeaker is never fed down an XLR or a DB25. Sixteen
    // ports on XLR and four on DB25 shipped as `speaker-level` on the first
    // cut of this pass, every one of them a monitor controller's line feed.
    expect(isPassiveSpeakerPort({ name: "Speaker Output A L", connection: "xlr" })).toBe(false);
    expect(isPassiveSpeakerPort({ name: "Speaker 1 Output", connection: "db25" })).toBe(false);
  });

  it("refuses a speaker-named port on a monitor controller", () => {
    const port = { name: "Main Speaker Output L", connection: "1/4-inch" };
    expect(isPassiveSpeakerPort(port, "A 100W guitar amp in a pedal.")).toBe(true);
    expect(isPassiveSpeakerPort(port, "A transparent monitor controller.")).toBe(false);
    expect(isPassiveSpeakerPort(port, "An award-winning summing mixer.")).toBe(false);
    expect(isPassiveSpeakerPort(port, "Control room monitor daughter card.")).toBe(false);
  });

  it("keeps a passive stage wedge, which shares the monitor category", () => {
    // `monitor` holds both controllers and passive wedges, which is why the
    // category is not the discriminator and the connector and prose are.
    expect(
      isPassiveSpeakerPort(
        { name: "Speaker Input (SpeakON)", connection: "speakon" },
        "Two-way passive stage monitor loudspeaker."
      )
    ).toBe(true);
  });
});

describe("parseRows", () => {
  it("reads slug and port, ignoring comments, blanks and extra columns", () => {
    const rows = parseRows(
      ["# a comment", "", "amp-head\tSpeaker Output\tline\t1/4-inch", "cab\tSpeaker Input"].join(
        "\n"
      )
    );
    expect(rows).toEqual([
      { slug: "amp-head", port: "Speaker Output" },
      { slug: "cab", port: "Speaker Input" },
    ]);
  });
});

describe("applyRows", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "speaker-level-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (slug: string, io: string) =>
    fs.writeFileSync(path.join(dir, `${slug}.yaml`), `name: Test\nio:\n${io}`);

  const port = (name: string, type = "line") =>
    `  - name: ${name}\n    signalFlow: output\n    category: audio\n    type: ${type}\n    connection: 1/4-inch\n    maxConnections: 1\n    position: Right\n`;

  it("retypes each of several jacks that share one name", () => {
    // CLAUDE.md requires one io entry per physical jack, so a Marshall head
    // with two speaker jacks holds two ports called "Speaker Output" and the
    // reviewed list holds two rows. The first cut matched the first port
    // twice: it reported 227 ports applied across the corpus while changing
    // 217, retyping ten ports twice and leaving their siblings as they were.
    write("amp-head", port("Speaker Output") + port("Speaker Output"));
    const rows = parseRows("amp-head\tSpeaker Output\namp-head\tSpeaker Output");

    const outcome = applyRows(rows, dir, true);

    expect(outcome.applied).toBe(2);
    expect(outcome.skipped).toEqual([]);
    const data = parse(fs.readFileSync(path.join(dir, "amp-head.yaml"), "utf8")) as {
      io: { type: string }[];
    };
    expect(data.io.map((p) => p.type)).toEqual(["speaker-level", "speaker-level"]);
  });

  it("leaves the file alone on a dry run", () => {
    write("amp-head", port("Speaker Output"));
    const before = fs.readFileSync(path.join(dir, "amp-head.yaml"), "utf8");

    const outcome = applyRows(parseRows("amp-head\tSpeaker Output"), dir, false);

    expect(outcome.applied).toBe(1);
    expect(fs.readFileSync(path.join(dir, "amp-head.yaml"), "utf8")).toBe(before);
  });

  it("refuses a row whose name is not a passive-speaker port", () => {
    // The reviewed list cannot be widened after review by editing a name.
    write("amp-head", port("Speaker Emulated Output"));

    const outcome = applyRows(parseRows("amp-head\tSpeaker Emulated Output"), dir, true);

    expect(outcome.applied).toBe(0);
    expect(outcome.skipped[0]?.reason).toBe("not a passive-speaker port");
  });

  it("refuses an entry or port it cannot find, and one already retyped", () => {
    write("amp-head", port("Speaker Output", "speaker-level"));

    const outcome = applyRows(
      parseRows(
        ["missing\tSpeaker Output", "amp-head\tNo Such Port", "amp-head\tSpeaker Output"].join("\n")
      ),
      dir,
      true
    );

    expect(outcome.applied).toBe(0);
    expect(outcome.skipped.map((s) => s.reason)).toEqual([
      "does not exist",
      "entry has no such port",
      "already speaker-level",
    ]);
  });

  it("keeps the rest of the entry byte for byte", () => {
    // Asserting on substrings passes even if unrelated YAML moved, so the
    // whole file is compared against the fixture with only the one value
    // substituted. That is the contract the docblock claims.
    const file = path.join(dir, "amp-head.yaml");
    fs.writeFileSync(
      file,
      `name: Test\n# a comment that must survive\nio:\n${port("Speaker Output")}`
    );
    const before = fs.readFileSync(file, "utf8");

    applyRows(parseRows("amp-head\tSpeaker Output"), dir, true);

    expect(fs.readFileSync(file, "utf8")).toBe(before.replace("type: line", "type: speaker-level"));
  });

  it("retypes the mistyped jack when a correct sibling shares its name", () => {
    // A half-corrected entry: one jack retyped by hand, its sibling missed.
    // Claiming the first match would consume the correct jack and report
    // "already speaker-level" while the mistyped one stayed `line`.
    write("amp-head", port("Speaker Output", "speaker-level") + port("Speaker Output"));

    const outcome = applyRows(parseRows("amp-head\tSpeaker Output"), dir, true);

    expect(outcome.applied).toBe(1);
    expect(outcome.skipped).toEqual([]);
    const data = parse(fs.readFileSync(path.join(dir, "amp-head.yaml"), "utf8")) as {
      io: { type: string }[];
    };
    expect(data.io.map((p) => p.type)).toEqual(["speaker-level", "speaker-level"]);
  });

  it("refuses a monitor controller's line feed even when a row names it", () => {
    // The reviewed list carried 34 of these and a human approved every one.
    fs.writeFileSync(
      path.join(dir, "controller.yaml"),
      `name: Test\ndescription: An audiophile-grade monitor controller.\nio:\n${port("Speaker Output L")}`
    );

    const outcome = applyRows(parseRows("controller\tSpeaker Output L"), dir, true);

    expect(outcome.applied).toBe(0);
    expect(outcome.skipped[0]?.reason).toBe("not a passive-speaker port");
  });
});

describe("findMistypedSpeakerPorts", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "speaker-audit-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports a mistyped port and skips one already correct", () => {
    const port = (name: string, type: string) =>
      `  - name: ${name}\n    signalFlow: output\n    category: audio\n    type: ${type}\n    connection: 1/4-inch\n    maxConnections: 1\n    position: Right\n`;
    fs.writeFileSync(
      path.join(dir, "amp.yaml"),
      `name: Amp\nmanufacturer: marshall\nio:\n${port("Speaker Output", "line")}${port("Speaker Output 8 ohm", "speaker-level")}${port("Speaker Emulated Output", "line")}`
    );

    const findings = findMistypedSpeakerPorts(dir);

    // `manufacturer` is read from the entry's own field and never from
    // the filename prefix, because a `dean-markley-*` file is not a Dean
    // Guitars product and a finding filed under the wrong brand is filed
    // for the wrong person.
    expect(findings).toEqual([
      {
        slug: "amp",
        manufacturer: "marshall",
        port: "Speaker Output",
        type: "line",
        connection: "1/4-inch",
        review: true,
      },
    ]);
  });
});

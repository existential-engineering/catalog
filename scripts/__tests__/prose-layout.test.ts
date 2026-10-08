import { describe, expect, it } from "vitest";
import {
  assertLossless,
  auditProse,
  classifySoftBreaks,
  fixProse,
  fixSource,
  type ProseCheck,
  proseLocations,
  renderBlockLiteral,
  WALL_CHARS,
} from "../lib/prose-layout.js";
import { auditSource } from "../prose-layout-audit.js";

const details = (value: unknown, header: string | undefined = "|-") => ({
  field: "details" as const,
  value,
  header,
});
const specs = (value: unknown, header: string | undefined = "|-") => ({
  field: "specs" as const,
  value,
  header,
});
const checks = (issues: { check: ProseCheck; fixable: boolean }[]) =>
  issues.map((i) => `${i.check}${i.fixable ? "" : "?"}`);

describe("soft breaks: what markdown joins into one paragraph", () => {
  it("fixes one block per line, the Joey Sturgis Tones scrape", () => {
    // Every line is its own heading or paragraph on the maker page, and
    // marked renders all of them as one run-on paragraph.
    const text = [
      "JST Bus Glue Guitars - Defined, Clear Guitar Bus Processing",
      "Introducing Bus Glue: a dedicated bus processor engineered to bring cohesion, clarity, and impact to your entire guitar section.",
      "Hear It In Action",
      "Hear how Bus Glue brings articulate clarity and cohesion to any guitar arrangement.",
    ].join("\n");
    expect(checks(auditProse(details(text)))).toEqual(["soft-breaks"]);
    expect(fixProse(details(text))).toBe(text.replace(/\n/g, "\n\n"));
  });

  it("leaves hard-wrapped prose alone, even when a wrap lands between sentences", () => {
    const text = [
      "SketchCassette II is a lo-fi tape emulation plugin inspired by four-track ones.",
      "It offers the flexibility and control to push your sounds from subtle warble",
      "to total lofi weirdness.",
    ].join("\n");
    expect(classifySoftBreaks(text)).toBe("none");
    expect(auditProse(details(text))).toEqual([]);
  });

  it("leaves a wrap that continues in lowercase alone", () => {
    expect(classifySoftBreaks("A short line\nthat carries on")).toBe("none");
  });

  it("sends a table one cell per line to a person rather than splitting it", () => {
    // neunaber's preset bank: number, name, type, size, description. Five
    // one-line paragraphs is not obviously better than the run-on.
    const text = "0\nUniversal Reverb\nReverb\nMed-Small\nA basic reverb for almost any sound";
    expect(classifySoftBreaks(text)).toBe("review");
    expect(fixProse(details(text))).toBeUndefined();
  });

  it("sends a paragraph mixing block breaks and wraps to review when the lines are long", () => {
    const text = `${"A long scraped line that runs well past any wrap width and keeps on going, ".repeat(2)}\nand then continues in lowercase\nAnother Block`;
    expect(classifySoftBreaks(text)).toBe("review");
  });
});

describe("walls", () => {
  it("flags a paragraph over the threshold, and never fixes it", () => {
    const wall = "word ".repeat(Math.ceil(WALL_CHARS / 5) + 10).trim();
    const issues = auditProse(details(wall));
    expect(checks(issues)).toEqual(["wall?"]);
    expect(fixProse(details(wall))).toBeUndefined();
  });

  it("does not flag a long field made of reasonable paragraphs", () => {
    const para = "A sentence of moderate length about the product. ".repeat(10).trim();
    expect(auditProse(details([para, para, para, para].join("\n\n")))).toEqual([]);
  });
});

describe("bullets", () => {
  it("turns glyph lines into list items and opens the list on its own block", () => {
    const text = "The Grand is a pickup.\n• Silent hum bucker design\n• Maple wood housing";
    expect(checks(auditProse(details(text)))).toContain("glyph-bullets");
    expect(fixProse(details(text))).toBe(
      "The Grand is a pickup.\n\n- Silent hum bucker design\n- Maple wood housing"
    );
  });

  it("reports glyphs inside a line for review", () => {
    const text = "Features: • 30% smaller enclosure • True bypass • Battery or adapter";
    expect(checks(auditProse(details(text)))).toEqual(["glyph-bullets?"]);
  });

  it("does not read a product name or a guillemet as a list", () => {
    // TAPE•C and M•Caster are names; «Combinator» is a French quotation.
    expect(auditProse(details("The TAPE•C and the M•Caster Live, a «Combinator» design."))).toEqual(
      []
    );
  });

  it("reports a flattened dash list but never rewrites it", () => {
    // "Amazing Tone - Effortless Feel - High Output" is a list; "55 Hz -
    // 20 kHz" is a range. The probe skips digits and still only reports.
    const text = "- Amazing Tone - Effortless Feel - High Output - Great Sustain";
    expect(checks(auditProse(details(`Strings. ${text}`)))).toEqual(["inline-list?"]);
    expect(auditProse(details("Response 55 Hz - 20 kHz, max - 126 dB"))).toEqual([]);
  });

  it("reports an inline numbered list", () => {
    const text = "Steps: 1. Plug it in 2. Turn it on 3. Play";
    expect(checks(auditProse(details(text)))).toEqual(["inline-list?"]);
  });
});

describe("code blocks", () => {
  it("brings a four-space-indented list back to the margin", () => {
    // Pioneer DJ entries: an indented list that marked renders as <pre>.
    const text = "Key features:\n\n    - Single dynamic driver\n\n    - Detachable cable";
    expect(checks(auditProse(details(text)))).toEqual(["code-block"]);
    expect(fixProse(details(text))).toBe(
      "Key features:\n\n- Single dynamic driver\n\n- Detachable cable"
    );
  });

  it("runs to a fixed point when a dedent exposes one item per line", () => {
    const text = "Overview:\n\n    Auto mixing\n    BPM synchronisation and beat sync";
    const fixed = fixProse(details(text))!;
    expect(fixed).toBe("Overview:\n\nAuto mixing\n\nBPM synchronisation and beat sync");
    expect(fixProse(details(fixed))).toBeUndefined();
  });
});

describe("specs", () => {
  it("makes each line of a list-less specs an item", () => {
    expect(fixProse(specs("Requires VCV Rack."))).toBe("- Requires VCV Rack.");
    expect(fixProse(specs("Width: 4 HP\nDepth: 22 mm"))).toBe("- Width: 4 HP\n- Depth: 22 mm");
  });

  it("leaves a specs of prose paragraphs to a person", () => {
    const prose = "This unit is built for the stage and ".repeat(8);
    expect(checks(auditProse(specs(prose)))).toEqual(["specs-not-list?"]);
    expect(fixProse(specs(prose))).toBeUndefined();
  });

  it("accepts a specs that is already a list", () => {
    expect(auditProse(specs("- One\n- Two\n\n- Three"))).toEqual([]);
  });
});

describe("markup", () => {
  it("decodes entities that are plain text", () => {
    expect(fixProse(details("Rock &amp; roll at 90&deg; with &#8217;quotes&rsquo;"))).toBe(
      "Rock & roll at 90° with ’quotes’"
    );
  });

  it("keeps an encoded angle bracket and reports it, since decoding one makes markup", () => {
    const issues = auditProse(details("FLAIL channel -&gt; CROOK channel"));
    expect(checks(issues)).toEqual(["markup?"]);
    expect(fixProse(details("FLAIL channel -&gt; CROOK channel"))).toBeUndefined();
  });

  it("reports HTML, escaped newlines and mojibake for review", () => {
    expect(checks(auditProse(details("A <br> break")))).toEqual(["markup?"]);
    expect(checks(auditProse(details("one\\ntwo")))).toEqual(["markup?"]);
    expect(checks(auditProse(details("Grandâ has the same sound")))).toEqual(["markup?"]);
    expect(checks(auditProse(details("Itâ€™s great")))).toEqual(["markup?"]);
  });

  it("does not read a French word as mojibake", () => {
    expect(auditProse(details("Une pâte sonore, âme du son."))).toEqual([]);
  });
});

describe("how the value is written", () => {
  it("rewrites a folded, plain or quoted scalar as |- without changing its text", () => {
    expect(checks(auditProse(details("Fine prose.", ">-")))).toEqual(["scalar-style"]);
    expect(checks(auditProse({ field: "specs", value: "- Fine" }))).toEqual(["scalar-style"]);
  });

  it("joins an array the way the build does", () => {
    const array = { field: "details" as const, value: ["One.", "Two."] };
    expect(checks(auditProse(array))).toEqual(["array"]);
    expect(fixProse(array)).toBe("One.\n\nTwo.");
  });

  it("refuses a value a literal block cannot hold", () => {
    expect(renderBlockLiteral("  starts indented", 0)).toBeUndefined();
    expect(renderBlockLiteral("a\n\nb", 4)).toBe("|-\n      a\n\n      b");
  });
});

describe("the lossless guard", () => {
  it("accepts layout-only changes", () => {
    expect(() => assertLossless("a\nb • c", "a\n\nb\n\n- c")).not.toThrow();
  });

  it("throws when a word goes missing", () => {
    expect(() => assertLossless("a b c", "a c")).toThrow(/changed the text/);
  });
});

describe("fixSource", () => {
  const src = [
    "name: Thing",
    "manufacturer: acme",
    "details: >-",
    "  First paragraph",
    "  wrapped by the folder.",
    "",
    "",
    "  Second paragraph.",
    "specs: Requires VCV Rack.",
    "translations:",
    "  de:",
    "    details: |-",
    "      Erste Zeile steht für sich.",
    "      Zweite Zeile ist ein anderer Block.",
    "url: https://example.com",
    "",
  ].join("\n");

  it("rewrites each fixable value in place and leaves every other field alone", () => {
    const { text, changed } = fixSource(src);
    expect(changed).toEqual([
      "details: scalar-style",
      "specs: scalar-style, specs-not-list",
      "translations.de.details: soft-breaks",
    ]);
    expect(text).toBe(
      [
        "name: Thing",
        "manufacturer: acme",
        "details: |-",
        "  First paragraph wrapped by the folder.",
        "",
        "  Second paragraph.",
        "specs: |-",
        "  - Requires VCV Rack.",
        "translations:",
        "  de:",
        "    details: |-",
        "      Erste Zeile steht für sich.",
        "",
        "      Zweite Zeile ist ein anderer Block.",
        "url: https://example.com",
        "",
      ].join("\n")
    );
  });

  it("is idempotent", () => {
    const once = fixSource(src).text;
    expect(fixSource(once)).toEqual({ text: once, changed: [] });
  });

  it("reads the header the way it is written", () => {
    expect(proseLocations(src).map((l) => l.header)).toEqual([">-", undefined, "|-"]);
  });
});

describe("auditSource", () => {
  it("labels a translation's field by its path", () => {
    const rows = auditSource("name: X\ntranslations:\n  ja:\n    details: |-\n      a &amp; b\n", {
      collection: "software",
      slug: "x",
      manufacturer: "acme",
    });
    expect(rows.map((r) => `${r.field}:${r.check}`)).toEqual(["translations.ja.details:markup"]);
  });
});

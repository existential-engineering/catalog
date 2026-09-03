import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { normalizeDocument } from "../lib/format-normalize.js";

const aliases = { acoustic: "acoustic-guitar", fx: "effect", eq: "equalizer" };

function run(yaml: string): { changes: string[]; out: string } {
  const doc = parseDocument(yaml);
  const changes = normalizeDocument(doc, { aliases });
  return { changes, out: doc.toString() };
}

describe("normalizeDocument", () => {
  it("leaves an entry already in shape untouched", () => {
    const yaml = [
      "name: Foo",
      "primaryCategory: pedal",
      "categories:",
      "  - effect",
      "details: |-",
      "  One paragraph.",
      "",
      "  Two.",
      "specs: |-",
      "  - A",
      "io:",
      "  - name: In",
      "    signalFlow: input",
      "    category: audio",
      "    type: line",
      "    connection: 1/4-inch",
      "    maxConnections: 1",
      "    position: Right",
      "",
    ].join("\n");
    const { changes, out } = run(yaml);
    expect(changes).toEqual([]);
    expect(out).toBe(yaml);
  });

  it("rewrites alias categories to their canonical slug", () => {
    const { changes, out } = run("name: Foo\nprimaryCategory: acoustic\ncategories:\n  - fx\n");
    expect(changes).toEqual([
      "primaryCategory: acoustic -> acoustic-guitar",
      "categories: fx -> effect",
    ]);
    expect(out).toBe("name: Foo\nprimaryCategory: acoustic-guitar\ncategories:\n  - effect\n");
  });

  it("drops a category equal to primaryCategory, also after alias rewriting", () => {
    const { changes, out } = run(
      "name: Foo\nprimaryCategory: equalizer\ncategories:\n  - eq\n  - effect\n"
    );
    expect(changes).toEqual([
      "categories: eq -> equalizer",
      "categories: dropped eq, equal to primaryCategory",
    ]);
    expect(out).toBe("name: Foo\nprimaryCategory: equalizer\ncategories:\n  - effect\n");
  });

  it("drops a secondaryCategory equal to primaryCategory, also after alias rewriting", () => {
    const { changes, out } = run("primaryCategory: effect\nsecondaryCategory: fx\n");
    expect(changes).toEqual([
      "secondaryCategory: fx -> effect",
      "secondaryCategory: dropped, equal to primaryCategory",
    ]);
    expect(out).toBe("primaryCategory: effect\n");
  });

  it("reports no change when a categories list holds something other than scalars", () => {
    const yaml = "primaryCategory: pedal\ncategories:\n  - fx\n  - [ nested ]\n";
    const { changes, out } = run(yaml);
    expect(changes).toEqual([]);
    expect(out).toBe(yaml);
  });

  it("removes the categories list when nothing survives", () => {
    const { out } = run("name: Foo\nprimaryCategory: pedal\ncategories:\n  - pedal\n");
    expect(out).toBe("name: Foo\nprimaryCategory: pedal\n");
  });

  it("drops duplicate categories, keeping the first", () => {
    const { changes, out } = run("name: Foo\ncategories:\n  - effect\n  - fx\n  - delay\n");
    expect(changes).toContain("categories: dropped duplicate fx");
    expect(out).toBe("name: Foo\ncategories:\n  - effect\n  - delay\n");
  });

  it("turns a details array into one block scalar with paragraph breaks", () => {
    const { changes, out } = run("name: Foo\ndetails:\n  - First.\n  - Second.\n");
    expect(changes).toEqual(["details: list -> block scalar"]);
    expect(out).toBe("name: Foo\ndetails: |-\n  First.\n\n  Second.\n");
  });

  it("turns a specs array into a dash list, without doubling existing dashes", () => {
    const { out } = run("name: Foo\nspecs:\n  - 20 Hz to 20 kHz\n  - '- Already dashed'\n");
    expect(out).toBe("name: Foo\nspecs: |-\n  - 20 Hz to 20 kHz\n  - Already dashed\n");
  });

  it("promotes a multi-line plain details scalar to a block literal", () => {
    const { changes, out } = run('name: Foo\ndetails: "First.\\n\\nSecond."\n');
    expect(changes).toEqual(["details: plain scalar -> block scalar"]);
    expect(out).toBe("name: Foo\ndetails: |-\n  First.\n\n  Second.\n");
  });

  it("strips the kept newline of a `|` block so it serialises as `|-`", () => {
    const { changes, out } = run("name: Foo\ndetails: |\n  Text.\n");
    expect(changes).toEqual(["details: trailing newline stripped"]);
    expect(out).toBe("name: Foo\ndetails: |-\n  Text.\n");
  });

  it("leaves a single-line details flow scalar alone", () => {
    const { changes } = run("name: Foo\ndetails: One line only.\n");
    expect(changes).toEqual([]);
  });

  it("orders io fields and appends unknown ones after the known set", () => {
    const { changes, out } = run(
      [
        "name: Foo",
        "io:",
        "  - position: Right",
        "    name: In",
        "    connection: xlr",
        "    custom: x",
        "    key: abcd1234",
        "    type: mic",
        "    category: audio",
        "    signalFlow: input",
        "    maxConnections: 1",
        "",
      ].join("\n")
    );
    expect(changes).toEqual(["io: reordered fields on 1 port(s)"]);
    expect(out).toBe(
      [
        "name: Foo",
        "io:",
        "  - key: abcd1234",
        "    name: In",
        "    signalFlow: input",
        "    category: audio",
        "    type: mic",
        "    connection: xlr",
        "    maxConnections: 1",
        "    position: Right",
        "    custom: x",
        "",
      ].join("\n")
    );
  });

  it("does nothing on a document that is not a map", () => {
    const doc = parseDocument("- a\n- b\n");
    expect(normalizeDocument(doc, { aliases })).toEqual([]);
  });
});

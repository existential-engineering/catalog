import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ValidationErrorCode } from "../lib/error-codes.js";
import { loadYamlFileWithPositions } from "../lib/utils.js";
import {
  COLLECTION_SCHEMAS,
  collectWarnings,
  detectSupersedeCycle,
  getErrorCodeFromZodIssue,
  isValidCategory,
  normalizeToMarkdownString,
  validateFile,
  validateMarkdown,
  type WarningContext,
} from "../validate.js";

// Characterization tests (catalog#645): these pin what validate.ts does
// today, including behaviour that may later be judged a defect. A test
// here that starts failing is a behaviour change, and the change has to be
// argued for on its own, not slipped in under a refactor. The file gates
// every contributor's commit through .husky/pre-commit and CI.

describe("isValidCategory", () => {
  it("accepts a canonical category", () => {
    expect(isValidCategory("synthesizer")).toBe(true);
  });

  it("accepts an alias, which the build later normalizes", () => {
    // schema/category-aliases.yaml: eq -> equalizer
    expect(isValidCategory("eq")).toBe(true);
  });

  it("rejects an unknown value and is case-sensitive", () => {
    expect(isValidCategory("Synthesizer")).toBe(false);
    expect(isValidCategory("not-a-category")).toBe(false);
    expect(isValidCategory("")).toBe(false);
  });
});

describe("getErrorCodeFromZodIssue", () => {
  const issue = (over: {
    message: string;
    path?: (string | number)[];
    code?: string;
    received?: unknown;
  }) => ({ code: "custom", path: [], ...over });

  it("classifies a name artifact before anything else", () => {
    expect(getErrorCodeFromZodIssue(issue({ message: "Name artifact: name contains ..." }))).toBe(
      ValidationErrorCode.E118_NAME_ARTIFACT
    );
  });

  it("classifies url errors, with the youtube variant first", () => {
    expect(getErrorCodeFromZodIssue(issue({ message: "Invalid URL" }))).toBe(
      ValidationErrorCode.E103_INVALID_URL_FORMAT
    );
    expect(getErrorCodeFromZodIssue(issue({ message: "Invalid YouTube URL" }))).toBe(
      ValidationErrorCode.E301_YOUTUBE_URL_FORMAT
    );
  });

  it("classifies capability errors by path", () => {
    expect(
      getErrorCodeFromZodIssue(
        issue({ message: "Invalid capability 'x'", path: ["capabilities", 0] })
      )
    ).toBe(ValidationErrorCode.E119_INVALID_CAPABILITY);
    expect(
      getErrorCodeFromZodIssue(
        issue({ message: "capabilities must not be empty", path: ["capabilities"] })
      )
    ).toBe(ValidationErrorCode.E119_INVALID_CAPABILITY);
    expect(
      getErrorCodeFromZodIssue(
        issue({ message: "Duplicate capability 'reverb'", path: ["capabilities"] })
      )
    ).toBe(ValidationErrorCode.E205_DUPLICATE_CAPABILITY);
  });

  it("classifies category errors by path", () => {
    expect(
      getErrorCodeFromZodIssue(issue({ message: "Invalid category 'x'", path: ["categories", 1] }))
    ).toBe(ValidationErrorCode.E104_INVALID_CATEGORY);
    expect(
      getErrorCodeFromZodIssue(
        issue({ message: "Invalid category 'x'", path: ["primaryCategory"] })
      )
    ).toBe(ValidationErrorCode.E104_INVALID_CATEGORY);
    expect(
      getErrorCodeFromZodIssue(issue({ message: "duplicate category", path: ["categories"] }))
    ).toBe(ValidationErrorCode.E202_DUPLICATE_CATEGORY);
  });

  it("falls through to E199 for an invalid category message off the category path", () => {
    expect(getErrorCodeFromZodIssue(issue({ message: "Invalid category 'x'", path: ["io"] }))).toBe(
      ValidationErrorCode.E199_VALIDATION_ERROR
    );
  });

  it("keys E120 to an io name path only", () => {
    expect(
      getErrorCodeFromZodIssue(
        issue({ message: "Storage media slot 'SD Card' is not ...", path: ["io", 0, "name"] })
      )
    ).toBe(ValidationErrorCode.E120_STORAGE_MEDIA_SLOT);
    // The same phrase in a connectorDetail value is a connector-detail error.
    expect(
      getErrorCodeFromZodIssue(
        issue({
          message: "Invalid connectorDetail value(s) 'storage media slot'",
          path: ["io", 0, "connectorDetail"],
        })
      )
    ).toBe(ValidationErrorCode.E115_INVALID_CONNECTOR_DETAIL);
  });

  it("classifies each io vocabulary error by message", () => {
    const cases: Array<[string, ValidationErrorCode]> = [
      ["Invalid IO signal flow 'x'", ValidationErrorCode.E111_INVALID_IO_SIGNAL_FLOW],
      ["Invalid IO category 'x'", ValidationErrorCode.E112_INVALID_IO_CATEGORY],
      ["Invalid IO position 'x'", ValidationErrorCode.E113_INVALID_IO_POSITION],
      ["Invalid IO type 'x'", ValidationErrorCode.E117_INVALID_IO_TYPE],
      ["Invalid currency 'XYZ'", ValidationErrorCode.E114_INVALID_CURRENCY],
      ["Invalid link type 'x'", ValidationErrorCode.E116_INVALID_LINK_TYPE],
    ];
    for (const [message, code] of cases) {
      expect(getErrorCodeFromZodIssue(issue({ message })), message).toBe(code);
    }
  });

  it("classifies platform and format errors only on their own paths", () => {
    expect(
      getErrorCodeFromZodIssue(issue({ message: "Invalid platform 'x'", path: ["platforms", 0] }))
    ).toBe(ValidationErrorCode.E105_INVALID_PLATFORM);
    expect(
      getErrorCodeFromZodIssue(issue({ message: "Invalid format 'x'", path: ["formats", 0] }))
    ).toBe(ValidationErrorCode.E106_INVALID_FORMAT);
    expect(getErrorCodeFromZodIssue(issue({ message: "Invalid format 'x'", path: [] }))).toBe(
      ValidationErrorCode.E199_VALIDATION_ERROR
    );
  });

  it("splits markdown errors into fence, inline-code and generic codes", () => {
    expect(
      getErrorCodeFromZodIssue(issue({ message: "Invalid markdown: unclosed code block" }))
    ).toBe(ValidationErrorCode.E302_UNCLOSED_CODE_BLOCK);
    expect(
      getErrorCodeFromZodIssue(
        issue({ message: "Invalid markdown: unclosed inline code on line 2" })
      )
    ).toBe(ValidationErrorCode.E303_UNBALANCED_BACKTICKS);
    expect(getErrorCodeFromZodIssue(issue({ message: "Invalid markdown: something" }))).toBe(
      ValidationErrorCode.E300_INVALID_MARKDOWN
    );
  });

  it("reads an invalid_type issue as missing or wrong-typed", () => {
    expect(
      getErrorCodeFromZodIssue(
        issue({ code: "invalid_type", message: "Invalid input", received: "undefined" })
      )
    ).toBe(ValidationErrorCode.E100_MISSING_REQUIRED_FIELD);
    expect(getErrorCodeFromZodIssue(issue({ code: "invalid_type", message: "Required" }))).toBe(
      ValidationErrorCode.E100_MISSING_REQUIRED_FIELD
    );
    expect(
      getErrorCodeFromZodIssue(
        issue({ code: "invalid_type", message: "Invalid input: expected string" })
      )
    ).toBe(ValidationErrorCode.E101_INVALID_FIELD_TYPE);
  });

  it("defaults to E199", () => {
    expect(getErrorCodeFromZodIssue(issue({ message: "something else" }))).toBe(
      ValidationErrorCode.E199_VALIDATION_ERROR
    );
  });
});

describe("validateMarkdown", () => {
  it("accepts plain prose and balanced code", () => {
    expect(validateMarkdown("Plain prose.")).toEqual({ valid: true });
    expect(validateMarkdown("Use `pnpm validate` here.")).toEqual({ valid: true });
    expect(validateMarkdown("```\ncode\n```")).toEqual({ valid: true });
  });

  it("reports an unclosed fence", () => {
    const result = validateMarkdown("```yaml\nname: x");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("unclosed code block");
  });

  it("reports an odd backtick count on a prose line with its line number", () => {
    const result = validateMarkdown("fine\nUse the ` key\nfine");
    expect(result).toEqual({ valid: false, error: "unclosed inline code on line 2" });
  });

  it("joins several findings with a semicolon", () => {
    const result = validateMarkdown("```\nopen fence\n\nback `tick");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("unclosed code block (``` without closing ```)");
    // The backtick line sits inside the still-open fence, so it is skipped.
  });

  it("does not count backticks inside a fenced block", () => {
    expect(validateMarkdown("```\n` odd\n```")).toEqual({ valid: true });
  });

  it("counts six consecutive backticks as two fences (pinned, not endorsed)", () => {
    // `content.match(/```/g)` sees two fences in "``````", so a line of six
    // backticks reads as an opened and closed block. Whether that is the
    // intended reading is undecided; this test records what happens today.
    expect(validateMarkdown("``````")).toEqual({ valid: true });
  });

  it("reports a single prose backtick as unclosed inline code (pinned, not endorsed)", () => {
    // A literal backtick in prose ("press the ` key") cannot be written
    // without tripping this check. Recorded so a change is deliberate.
    expect(validateMarkdown("press the ` key")).toEqual({
      valid: false,
      error: "unclosed inline code on line 1",
    });
  });

  it("treats a language-tagged fence line as a fence", () => {
    expect(validateMarkdown("```js\n` inside\n```")).toEqual({ valid: true });
  });
});

describe("normalizeToMarkdownString", () => {
  it("returns a string unchanged", () => {
    expect(normalizeToMarkdownString("one\ntwo")).toBe("one\ntwo");
  });

  it("joins an array with blank lines as paragraph breaks", () => {
    expect(normalizeToMarkdownString(["one", "two"])).toBe("one\n\ntwo");
    expect(normalizeToMarkdownString([])).toBe("");
  });
});

describe("detectSupersedeCycle", () => {
  const slugs = new Map([
    ["a", "alpha"],
    ["b", "beta"],
    ["c", "gamma"],
  ]);

  it("returns null for a chain that terminates", () => {
    const map = new Map([
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(detectSupersedeCycle("a", map, slugs)).toBeNull();
    expect(detectSupersedeCycle("c", map, slugs)).toBeNull();
  });

  it("returns null when the start id has no supersedes at all", () => {
    expect(detectSupersedeCycle("z", new Map(), slugs)).toBeNull();
  });

  it("reports a self-supersede as a one-node cycle", () => {
    expect(detectSupersedeCycle("a", new Map([["a", "a"]]), slugs)).toEqual(["alpha", "alpha"]);
  });

  it("reports a two-node cycle closed on the start slug", () => {
    const map = new Map([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(detectSupersedeCycle("a", map, slugs)).toEqual(["alpha", "beta", "alpha"]);
  });

  it("reports only the cycle when the start id leads into it", () => {
    // a -> b -> c -> b: the path from a is a tail, not part of the cycle.
    const map = new Map([
      ["a", "b"],
      ["b", "c"],
      ["c", "b"],
    ]);
    expect(detectSupersedeCycle("a", map, slugs)).toEqual(["beta", "gamma", "beta"]);
  });

  it("falls back to the raw id when no slug is known", () => {
    expect(detectSupersedeCycle("x", new Map([["x", "x"]]), slugs)).toEqual(["x", "x"]);
  });

  it("does not follow a dangling reference", () => {
    // b is never a key, so the walk ends there without a cycle.
    expect(detectSupersedeCycle("a", new Map([["a", "missing"]]), slugs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// File-backed units. validateFile and collectWarnings read YAML with position
// tracking, so each case writes a real file into a temp collection directory.
// ---------------------------------------------------------------------------

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function writeEntry(collection: string, yaml: string, name = "entry.yaml"): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-validate-"));
  tmpDirs.push(root);
  const dir = path.join(root, collection);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, yaml);
  return file;
}

const MAKERS = new Set(["acme", "acme-labs"]);

const HARDWARE_OK = `id: aaaaaaaaaaaaaaaaaaaaa
name: Widget
manufacturer: acme
primaryCategory: pedal
categories:
  - reverb
description: A pedal.
io:
  - name: Input
    signalFlow: input
    category: audio
    type: instrument
    connection: 1/4-inch
    maxConnections: 1
    position: Right
`;

describe("validateFile", () => {
  it("returns null for a valid hardware entry", () => {
    const file = writeEntry("hardware", HARDWARE_OK);
    expect(validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS)).toBeNull();
  });

  it("reports YAML syntax errors as E110 with a line", () => {
    const file = writeEntry("hardware", "name: Widget\n  bad: [indent\n");
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS);
    expect(result?.details?.[0].code).toBe(ValidationErrorCode.E110_YAML_SYNTAX_ERROR);
    expect(result?.details?.[0].path).toBe("(yaml)");
  });

  it("rejects a top-level images block before any schema runs", () => {
    const file = writeEntry("hardware", `${HARDWARE_OK}images:\n  - x.png\n`);
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS);
    expect(result?.details).toHaveLength(1);
    expect(result?.details?.[0]).toMatchObject({
      code: ValidationErrorCode.E199_VALIDATION_ERROR,
      path: "images",
    });
  });

  it("rejects an unknown key at any depth as E121 (catalog#689)", () => {
    const file = writeEntry(
      "hardware",
      `${HARDWARE_OK}discontinued: true\nprices:\n  - amount: 1\n    currency: USD\n    type: msrp\n`
    );
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS);
    expect(result?.details?.map((d) => [d.code, d.path])).toEqual([
      [ValidationErrorCode.E121_UNKNOWN_KEY, "discontinued"],
      [ValidationErrorCode.E121_UNKNOWN_KEY, "prices[0].type"],
    ]);
  });

  it("maps a Zod issue to an error code, a path and a line", () => {
    const file = writeEntry("hardware", HARDWARE_OK.replace("type: instrument", "type: 1/4-inch"));
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS);
    expect(result?.details).toHaveLength(1);
    expect(result?.details?.[0]).toMatchObject({
      code: ValidationErrorCode.E117_INVALID_IO_TYPE,
      path: "io.0.type",
      line: 12,
    });
    expect(result?.errors[0]).toMatch(/^io\.0\.type:12: Invalid IO type '1\/4-inch'/);
  });

  it("requires position on io except for played instruments", () => {
    const missing = HARDWARE_OK.replace("    position: Right\n", "");
    const pedal = writeEntry("hardware", missing);
    expect(validateFile(pedal, COLLECTION_SCHEMAS.hardware, MAKERS)?.details?.[0].path).toBe(
      "io.0.position"
    );

    const guitar = writeEntry(
      "hardware",
      missing.replace("primaryCategory: pedal", "primaryCategory: electric-guitar")
    );
    expect(validateFile(guitar, COLLECTION_SCHEMAS.hardware, MAKERS)).toBeNull();
  });

  it("reports an unknown manufacturer as E200 with a suggestion", () => {
    const file = writeEntry(
      "hardware",
      HARDWARE_OK.replace("manufacturer: acme", "manufacturer: acme-lab")
    );
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS);
    expect(result?.details?.[0]).toMatchObject({
      code: ValidationErrorCode.E200_MANUFACTURER_NOT_FOUND,
      path: "manufacturer",
      line: 3,
    });
    expect(result?.details?.[0].message).toContain("Did you mean 'acme-labs'?");
  });

  it("checks supersedes only when handed the collection's id set", () => {
    const file = writeEntry("hardware", `${HARDWARE_OK}supersedes: bbbbbbbbbbbbbbbbbbbbb\n`);
    expect(validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS)).toBeNull();
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS, new Set(["other"]));
    expect(result?.details?.[0]).toMatchObject({
      code: ValidationErrorCode.E199_VALIDATION_ERROR,
      path: "supersedes",
    });
    expect(
      validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS, new Set(["bbbbbbbbbbbbbbbbbbbbb"]))
    ).toBeNull();
  });

  it("rejects the primary category repeated in categories, and in-array duplicates", () => {
    const repeated = writeEntry("hardware", HARDWARE_OK.replace("  - reverb", "  - pedal"));
    expect(
      validateFile(repeated, COLLECTION_SCHEMAS.hardware, MAKERS)?.details?.map((d) => d.code)
    ).toEqual([ValidationErrorCode.E202_DUPLICATE_CATEGORY]);

    const dup = writeEntry("hardware", HARDWARE_OK.replace("  - reverb", "  - reverb\n  - reverb"));
    expect(validateFile(dup, COLLECTION_SCHEMAS.hardware, MAKERS)?.details?.[0]).toMatchObject({
      code: ValidationErrorCode.E202_DUPLICATE_CATEGORY,
      path: "categories[1]",
    });
  });

  it("rejects a truncated description but allows a trailing 'and more...'", () => {
    const cut = writeEntry("hardware", HARDWARE_OK.replace("A pedal.", "A pedal with featur..."));
    expect(validateFile(cut, COLLECTION_SCHEMAS.hardware, MAKERS)?.details?.[0].code).toBe(
      ValidationErrorCode.E304_TRUNCATED_CONTENT
    );
    const more = writeEntry(
      "hardware",
      HARDWARE_OK.replace("A pedal.", "Reverb, delay and more...")
    );
    expect(validateFile(more, COLLECTION_SCHEMAS.hardware, MAKERS)).toBeNull();
  });

  it("validates a manufacturer entry against its own schema", () => {
    const file = writeEntry("manufacturers", "name: Acme\nurl: not-a-url\n", "acme.yaml");
    const result = validateFile(file, COLLECTION_SCHEMAS.manufacturers, MAKERS);
    expect(result?.details?.[0]).toMatchObject({
      code: ValidationErrorCode.E103_INVALID_URL_FORMAT,
      path: "url",
    });
  });

  it("hard-fails a name artifact as E118", () => {
    const file = writeEntry(
      "software",
      `name: Widget™
manufacturer: acme
primaryCategory: plugin
platforms:
  - mac
`
    );
    expect(validateFile(file, COLLECTION_SCHEMAS.software, MAKERS)?.details?.[0].code).toBe(
      ValidationErrorCode.E118_NAME_ARTIFACT
    );
  });

  it("reports the relative path of the file", () => {
    const file = writeEntry("hardware", "name: [\n");
    const result = validateFile(file, COLLECTION_SCHEMAS.hardware, MAKERS);
    expect(result?.file).toBe(path.relative(process.cwd(), file));
  });
});

describe("collectWarnings", () => {
  function warn(
    yaml: string,
    ctx: {
      software?: Set<string>;
      hardware?: Set<string>;
      mfrUrls?: Map<string, string>;
      mfrNames?: Map<string, string>;
    } = {},
    collection = "hardware"
  ) {
    const file = writeEntry(collection, yaml);
    const { data, document, lineCounter } = loadYamlFileWithPositions(file);
    const result = collectWarnings(
      file,
      data as WarningContext,
      document,
      lineCounter,
      ctx.software,
      ctx.hardware,
      ctx.mfrUrls,
      ctx.mfrNames
    );
    return result?.warnings.map((w) => ({ code: w.code, path: w.path, line: w.line })) ?? [];
  }

  it("returns null when nothing fires", () => {
    const file = writeEntry("hardware", HARDWARE_OK);
    const { data, document, lineCounter } = loadYamlFileWithPositions(file);
    expect(collectWarnings(file, data as WarningContext, document, lineCounter)).toBeNull();
  });

  it("W121: unknown io connection, keyed to the connection line", () => {
    expect(warn(HARDWARE_OK.replace("connection: 1/4-inch", "connection: trs"))).toEqual([
      { code: "W121", path: "io[0].connection", line: 13 },
    ]);
  });

  it("W128: several jacks collapsed into one entry, unless the entry is a patchbay", () => {
    const collapsed = HARDWARE_OK.replace("maxConnections: 1", "maxConnections: 2");
    expect(warn(collapsed)).toEqual([{ code: "W128", path: "io[0].maxConnections", line: 14 }]);
    expect(warn(collapsed.replace("primaryCategory: pedal", "primaryCategory: patch-bay"))).toEqual(
      []
    );
  });

  it("W123: compatibleWith resolves against software or hardware slugs, when either set is given", () => {
    const yaml = `name: Pack
manufacturer: acme
primaryCategory: preset-pack
compatibleWith:
  - serum
  - some-synth
`;
    expect(warn(yaml, {}, "content")).toEqual([]);
    expect(
      warn(yaml, { software: new Set(["serum"]), hardware: new Set(["some-synth"]) }, "content")
    ).toEqual([]);
    expect(warn(yaml, { software: new Set(["serum"]) }, "content")).toEqual([
      { code: "W123", path: "compatibleWith[1]", line: 6 },
    ]);
  });

  it("W124: a link repeating url or an earlier link", () => {
    const yaml = `${HARDWARE_OK}url: https://acme.example/widget
links:
  - url: https://acme.example/widget
    type: product
  - url: https://acme.example/manual
    type: resource
  - url: https://acme.example/manual
    type: resource
`;
    expect(warn(yaml)).toEqual([
      { code: "W124", path: "links[0].url", line: 18 },
      { code: "W124", path: "links[2].url", line: 22 },
    ]);
  });

  it("W125: url or a link equal to the manufacturer homepage, ignoring scheme, www and slashes", () => {
    const mfrUrls = new Map([["acme", "https://www.acme.example/"]]);
    const yaml = `${HARDWARE_OK}url: http://acme.example
links:
  - url: https://ACME.example//
    type: product
`;
    expect(warn(yaml, { mfrUrls })).toEqual([
      { code: "W125", path: "url", line: 16 },
      { code: "W125", path: "links[0].url", line: 18 },
    ]);
  });

  it("W126: a specs bullet that only restates declared formats and platforms", () => {
    const yaml = `name: Plug
manufacturer: acme
primaryCategory: plugin
formats:
  - vst3
  - au
platforms:
  - mac
  - windows
specs: |-
  - VST3, AU (macOS/Windows)
  - VST3 and AAX
  - 64-bit
`;
    // Line 1 restates only declared values. Line 2 names AAX, which the entry
    // does not declare. Line 3 is nothing but filler, so it is skipped.
    expect(warn(yaml, {}, "software")).toEqual([{ code: "W126", path: "specs", line: 10 }]);
  });

  it("W127: a short all-caps name with no searchTerms, unless it is an excluded word", () => {
    const acronym = HARDWARE_OK.replace("name: Widget", "name: MPC");
    expect(warn(acronym)).toEqual([{ code: "W127", path: "searchTerms", line: 2 }]);
    expect(warn(`${acronym}searchTerms:\n  - Music Production Center\n`)).toEqual([]);
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: AIM"))).toEqual([]);
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: Mpc"))).toEqual([]);
  });

  it("W129: the manufacturer display name as a prefix of the product name", () => {
    const mfrNames = new Map([["acme", "Acme"]]);
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: Acme Widget"), { mfrNames })).toEqual([
      { code: "W129", path: "name", line: 2 },
    ]);
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: Acmeter"), { mfrNames })).toEqual([]);
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: Acme Widget"))).toEqual([]);
  });

  it("W130: a tagline separator in the name", () => {
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: Widget – Compact Reverb"))).toEqual([
      { code: "W130", path: "name", line: 2 },
    ]);
    expect(warn(HARDWARE_OK.replace("name: Widget", "name: Widget | Acme"))).toEqual([
      { code: "W130", path: "name", line: 2 },
    ]);
  });

  it("W131: several prices in one currency with no term, at the first such price", () => {
    const yaml = `${HARDWARE_OK}prices:
  - amount: 10
    currency: USD
  - amount: 20
    currency: USD
  - amount: 15
    currency: EUR
`;
    expect(warn(yaml)).toEqual([{ code: "W131", path: "prices[0]", line: 17 }]);
    const termed = yaml
      .replace(
        "amount: 10\n    currency: USD",
        "amount: 10\n    currency: USD\n    term: perpetual"
      )
      .replace("amount: 20\n    currency: USD", "amount: 20\n    currency: USD\n    term: monthly");
    expect(warn(termed)).toEqual([]);
  });

  it("accumulates every warning the file earns", () => {
    const yaml = HARDWARE_OK.replace("name: Widget", "name: ADT | Acme").replace(
      "connection: 1/4-inch",
      "connection: trs"
    );
    expect(warn(yaml).map((w) => w.code)).toEqual(["W121", "W130"]);
  });
});

/**
 * How `details` and `specs` will render, read the way the build reads them.
 *
 * The build passes both fields through `marked` (`markdownToHtml` in
 * `build-sqlite.ts`) and Studio shows the HTML it gets. Markdown joins
 * lines that are separated by a single newline into one paragraph, so an
 * import that scraped a page one block per line ships every heading,
 * paragraph and bullet of that page as one run-on paragraph: the wall of
 * text AUREO-1192 was filed against. The YAML is fine and validates; it is
 * the rendering that breaks, which is why this module tokenizes with the
 * same `marked` the build uses rather than guessing from line counts.
 *
 * Two halves, kept apart on purpose:
 *
 *   - `auditProse` reports every layout defect it can see, each marked
 *     `fixable` or not.
 *   - `fixProse` applies only the fixable ones, and every one of those is
 *     lossless: it moves whitespace and swaps a bullet glyph for a list
 *     marker, and never adds, drops or reorders a word. `assertLossless`
 *     checks that on every value it rewrites, so a fix that would lose text
 *     throws rather than writes.
 *
 * Anything else needs a person: where to break a 3,000-character paragraph,
 * whether "Mode A - Mode B - Mode C" is a flattened list or three ranges,
 * what a mojibake `â` used to be. Those go to the review list, never to a
 * guess.
 */
import { marked, type Token, type Tokens } from "marked";
import { isMap, isScalar, isSeq, parse, parseDocument, type YAMLMap } from "yaml";

export const PROSE_FIELDS = ["details", "specs"] as const;
export type ProseField = (typeof PROSE_FIELDS)[number];

export const PROSE_CHECKS = [
  /** `details`/`specs` written as a YAML array rather than a block scalar. */
  "array",
  /** Not a `|-` block scalar (folded `>`, plain, quoted, or `|` keeping its newline). */
  "scalar-style",
  /** Lines separated by single newlines that markdown joins into one paragraph. */
  "soft-breaks",
  /** One rendered paragraph longer than WALL_CHARS. */
  "wall",
  /** Bullet glyphs (•, ●, ▪, », ✓) standing in for a markdown list. */
  "glyph-bullets",
  /** A list flattened into prose: "- a - b - c" or "1. a 2. b 3. c". */
  "inline-list",
  /** Lines indented four spaces, which markdown renders as a code block. */
  "code-block",
  /** Leftover HTML, entities, escaped newlines or mojibake. */
  "markup",
  /** `specs` that carries no list at all. */
  "specs-not-list",
] as const;
export type ProseCheck = (typeof PROSE_CHECKS)[number];

export interface ProseIssue {
  check: ProseCheck;
  /** True when `fixProse` settles it without judgement. */
  fixable: boolean;
  detail: string;
  /** A short piece of the offending text, for a review row. */
  excerpt: string;
}

/**
 * A rendered paragraph longer than this is a wall.
 *
 * Measured against the corpus rather than chosen: the longest paragraph of
 * a `details` field runs a median of 377 characters, 812 at the 90th
 * percentile and 2,667 at the 99th. 1,500 is about 250 words, four times
 * the median, and past it a paragraph on a detail page reads as a block
 * nobody parses. Lower thresholds start catching well-formed long
 * paragraphs, which is a style question and not a broken entry.
 */
export const WALL_CHARS = 1500;

/** Above prettier's `printWidth` nobody was hard-wrapping. */
const WRAP_WIDTH = 100;
/** A hard-wrapped line fills most of the width before it breaks. */
const WRAP_MIN = 60;
/** A `specs` line longer than this is prose, not an item, and needs a person. */
const SPEC_ITEM_MAX = 200;

const BULLET_GLYPH = "[•●▪◦■►➤➢✓✔»]";
const LINE_START_GLYPH = new RegExp(`^([ \\t]*)${BULLET_GLYPH}[ \\t]*`, "gmu");
/**
 * A glyph mid-line, with space before it so a name like `TAPE•C` or
 * `M•Caster` is not a list. `»` is left out here: mid-line it is a
 * guillemet closing a French quotation, and only at a line start a bullet.
 */
const INLINE_GLYPH = /\S[ \t]+[•●▪◦■►➤➢✓✔][ \t]*\S/gu;

/**
 * Entities that decode to plain text. `&lt;` and `&gt;` are left out on
 * purpose: decoding them can turn text into a tag or, at the start of a
 * line, a blockquote, which is a rendering change rather than a cleanup.
 */
const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  deg: "°",
  trade: "™",
  reg: "®",
  copy: "©",
  times: "×",
  plusmn: "±",
  micro: "µ",
  ohm: "Ω",
};
const ENTITY = /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]+);/gi;

function decodeEntity(match: string, body: string): string {
  if (body.startsWith("#")) {
    const code =
      body[1] === "x" || body[1] === "X"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
    // `<`, `>` and control characters stay encoded for the reason above.
    if (!Number.isFinite(code) || code < 0x20 || code === 0x3c || code === 0x3e || code > 0x10ffff)
      return match;
    return String.fromCodePoint(code);
  }
  return ENTITIES[body.toLowerCase()] ?? match;
}

/**
 * Text a scraper left behind: a tag, `\n` written out as two characters, or
 * UTF-8 read as Latin-1. The mojibake forms are the ones the corpus
 * carries, `Grandâ` for `Grand®` among them, and none of them can be
 * decoded back with certainty once a byte has been lost.
 */
const MARKUP_PROBES: { re: RegExp; label: string }[] = [
  { re: /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/i, label: "HTML tag" },
  { re: /\\[nrt]/, label: "escaped newline" },
  { re: /Ã[\u0080-¿]|â€|Â[ -¿]|\p{L}â(?=[\s.,;:!?)]|$)|�/u, label: "mojibake" },
  { re: /&(lt|gt|#0*6[02]|#x0*3[ce]);/i, label: "encoded angle bracket" },
];

/** A lowercase function word a hard wrap commonly leaves at a line end. */
const TRAILING_JOINER =
  /(?:[,;&/(\-–—]|\b(?:the|a|an|and|or|of|to|with|in|into|for|by|on|at|from|as|is|are|your|our|its|their|that|which|this|these|than|via|per|each|any|all|up|over))$/i;

function excerpt(text: string, at = 0, width = 80): string {
  return text
    .slice(Math.max(0, at), Math.max(0, at) + width)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when every break in `lines` sits between two blocks rather than in
 * the middle of a sentence: the next line does not continue in lowercase,
 * and the line before does not end on a comma, hyphen or a word like "the".
 */
function breaksAreBlockBreaks(lines: string[]): boolean {
  for (let i = 0; i + 1 < lines.length; i++) {
    const prev = lines[i]!.trim();
    const next = lines[i + 1]!.trim();
    if (prev === "" || next === "") return false;
    if (/^[\p{Ll},;:.)\]]/u.test(next)) return false;
    if (TRAILING_JOINER.test(prev)) return false;
  }
  return true;
}

/**
 * The shape of a paragraph somebody hard-wrapped: every line but the last
 * fills most of the width. Such a paragraph renders correctly even when
 * each of its breaks happens to fall between sentences.
 */
function looksHardWrapped(lines: string[]): boolean {
  return lines.slice(0, -1).every((l) => l.length >= WRAP_MIN && l.length <= WRAP_WIDTH);
}

type SoftBreaks = "none" | "fixable" | "review";

/** How a paragraph's internal line breaks will render. */
export function classifySoftBreaks(paragraphRaw: string): SoftBreaks {
  const lines = paragraphRaw.replace(/\n+$/, "").split("\n");
  if (lines.length < 2) return "none";
  if (looksHardWrapped(lines)) return "none";
  if (breaksAreBlockBreaks(lines)) {
    // A line of one word is a table cell or a label ("Gap Height" over
    // "0.31\"", a preset table one column per line). Whether that becomes
    // "Gap Height: 0.31\"", a list or a table is a call about the content,
    // so it goes to a person once there is enough of it to matter.
    if (lines.every((l) => /\S\s+\S/.test(l.trim()))) return "fixable";
    return lines.length >= 4 ? "review" : "none";
  }
  // A mix of wraps and block breaks. Only worth a person when the lines
  // are clearly not wrapping at a width, or it is ordinary wrapped prose.
  return lines.some((l) => l.length > WRAP_WIDTH) ? "review" : "none";
}

function paragraphs(tokens: Token[]): Tokens.Paragraph[] {
  return tokens.filter((t): t is Tokens.Paragraph => t.type === "paragraph");
}

/** The inline-list probes, each a guess about prose and so never fixed. */
function inlineListHit(text: string): string | undefined {
  const dashes = [...text.matchAll(/(?:^|[\s.:;!?])[-–][ \t]?(?=\p{Lu}\p{Ll})/gmu)];
  if (dashes.length >= 3) return excerpt(text, dashes[0]!.index);
  const numbers = [...text.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+(?=\p{Lu})/gu)].map((m) => ({
    n: Number(m[1]),
    at: m.index,
  }));
  for (let i = 0; i + 2 < numbers.length; i++) {
    const [a, b, c] = numbers.slice(i, i + 3);
    if (a!.n === 1 && b!.n === 2 && c!.n === 3) return excerpt(text, a!.at);
  }
  return undefined;
}

export interface ProseSource {
  field: ProseField;
  /** The parsed value: a string, or an array when the YAML holds a sequence. */
  value: unknown;
  /**
   * The block-scalar header as written (`|-`, `>-`, `|`), or undefined for
   * a plain or quoted scalar or a sequence.
   */
  header?: string;
}

/** The text the build hands to `marked`, joined the way `normalizeMarkdown` joins it. */
export function proseText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value.join("\n\n");
  return undefined;
}

/** Every layout defect in one `details` or `specs` value. */
export function auditProse(source: ProseSource): ProseIssue[] {
  const text = proseText(source.value);
  if (text === undefined || text.trim() === "") return [];
  const issues: ProseIssue[] = [];

  if (Array.isArray(source.value)) {
    issues.push({
      check: "array",
      fixable: true,
      detail: `${source.field} is a YAML array; it is a |- block scalar`,
      excerpt: excerpt(text),
    });
  } else if (source.header !== "|-") {
    issues.push({
      check: "scalar-style",
      fixable: firstLineIndent(text) === 0,
      detail: `${source.field} is written ${source.header ? `as ${source.header}` : "as a plain or quoted scalar"}; it is a |- block scalar`,
      excerpt: excerpt(text),
    });
  }

  const tokens = marked.lexer(text);

  for (const code of tokens.filter((t): t is Tokens.Code => t.type === "code")) {
    const indented = code.codeBlockStyle === "indented";
    issues.push({
      check: "code-block",
      fixable: indented,
      detail: indented
        ? "lines indented four spaces render as a monospace code block"
        : "a fenced code block in prose",
      excerpt: excerpt(code.text),
    });
  }

  const glyphLines = text.match(LINE_START_GLYPH);
  if (glyphLines) {
    issues.push({
      check: "glyph-bullets",
      fixable: true,
      detail: `${glyphLines.length} line(s) start with a bullet glyph instead of "- ", so markdown joins them into the paragraph above`,
      excerpt: excerpt(text, text.search(new RegExp(BULLET_GLYPH, "u"))),
    });
  }

  for (const p of paragraphs(tokens)) {
    const inline = p.raw.match(INLINE_GLYPH);
    if (inline && inline.length >= 2) {
      issues.push({
        check: "glyph-bullets",
        fixable: false,
        detail: "bullet glyphs inside a line: a list flattened into prose",
        excerpt: excerpt(p.raw, p.raw.search(new RegExp(BULLET_GLYPH, "u")) - 30),
      });
      break;
    }
  }

  // `specs` with no list at all is reported once as such, and the soft
  // breaks inside it are part of that finding rather than a second one.
  const specsWithoutList =
    source.field === "specs" && !tokens.some((t) => t.type === "list") && glyphLines === null;
  if (specsWithoutList) {
    const lines = nonEmptyLines(text);
    issues.push({
      check: "specs-not-list",
      fixable: lines.every((l) => l.length <= SPEC_ITEM_MAX),
      detail: `specs carries no "- " list (${lines.length} line(s))`,
      excerpt: excerpt(text),
    });
  }

  let softFixable = 0;
  let softReview: Tokens.Paragraph | undefined;
  let wall: Tokens.Paragraph | undefined;
  let inlineList: string | undefined;
  for (const p of paragraphs(tokens)) {
    const kind = classifySoftBreaks(p.raw);
    if (kind === "fixable") softFixable++;
    if (kind === "review") softReview ??= p;
    if (p.raw.trim().length > WALL_CHARS && (!wall || p.raw.length > wall.raw.length)) wall = p;
    inlineList ??= inlineListHit(p.raw);
  }
  if (!specsWithoutList && softFixable > 0) {
    issues.push({
      check: "soft-breaks",
      fixable: true,
      detail: `${softFixable} paragraph(s) carry one block per line, which markdown joins into one`,
      excerpt: excerpt(text),
    });
  }
  if (!specsWithoutList && softReview) {
    issues.push({
      check: "soft-breaks",
      fixable: false,
      detail: "single-newline breaks mixing block breaks and mid-sentence wraps",
      excerpt: excerpt(softReview.raw),
    });
  }
  if (wall) {
    issues.push({
      check: "wall",
      fixable: false,
      detail: `a rendered paragraph runs ${wall.raw.trim().length} characters (over ${WALL_CHARS})`,
      excerpt: excerpt(wall.raw),
    });
  }
  if (inlineList) {
    issues.push({
      check: "inline-list",
      fixable: false,
      detail: "a list flattened into a paragraph",
      excerpt: inlineList,
    });
  }

  const entities = [...text.matchAll(ENTITY)].filter((m) => decodeEntity(m[0], m[1]!) !== m[0]);
  if (entities.length > 0) {
    issues.push({
      check: "markup",
      fixable: true,
      detail: `HTML entities (${[...new Set(entities.map((m) => m[0]))].join(", ")})`,
      excerpt: excerpt(text, entities[0]!.index - 30),
    });
  }
  for (const probe of MARKUP_PROBES) {
    const m = probe.re.exec(text);
    if (!m) continue;
    issues.push({
      check: "markup",
      fixable: false,
      detail: probe.label,
      excerpt: excerpt(text, m.index - 30),
    });
  }

  return issues;
}

function nonEmptyLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

function firstLineIndent(text: string): number {
  const first = text.split("\n").find((l) => l.trim() !== "") ?? "";
  return first.length - first.trimStart().length;
}

/** Split each paragraph whose breaks are all block breaks into one paragraph per line. */
function splitSoftBreaks(text: string): string {
  return marked
    .lexer(text)
    .map((t) => {
      if (t.type !== "paragraph" || classifySoftBreaks(t.raw) !== "fixable") return t.raw;
      const trailing = t.raw.match(/\n*$/)![0];
      return t.raw.slice(0, t.raw.length - trailing.length).replace(/\n/g, "\n\n") + trailing;
    })
    .join("");
}

/** Bring indented code blocks back to the margin, so their lines render as what they are. */
function dedentCodeBlocks(text: string): string {
  return marked
    .lexer(text)
    .map((t) => {
      if (t.type !== "code" || (t as Tokens.Code).codeBlockStyle !== "indented") return t.raw;
      return t.raw.replace(/^(?: {4}|\t)/gm, "");
    })
    .join("");
}

/**
 * Bullet-glyph lines become `- ` items. A glyph line directly under a
 * paragraph line gets a blank line first, so the list starts a block of
 * its own rather than depending on how a renderer treats an interruption.
 */
function glyphsToItems(text: string): string {
  const lines = text.replace(LINE_START_GLYPH, "$1- ").split("\n");
  const out: string[] = [];
  for (const [i, line] of lines.entries()) {
    const prev = out[out.length - 1];
    const isItem = /^\s*- /.test(line);
    if (i > 0 && isItem && prev !== undefined && prev.trim() !== "" && !/^\s*- /.test(prev)) {
      out.push("");
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Every non-empty line of a list-less `specs` becomes one item. */
function specsToItems(text: string): string {
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => `- ${l.trim()}`)
    .join("\n");
}

/**
 * Apply every fixable issue in `source` and return the new text, or
 * undefined when there is nothing a fix may touch. The caller still writes
 * a `scalar-style` or `array` fix when the text comes back unchanged,
 * because those are about how the value is written, not what it says.
 */
export function fixProse(source: ProseSource, depth = 0): string | undefined {
  const original = proseText(source.value);
  if (original === undefined || original.trim() === "") return undefined;
  const fixable = new Set(
    auditProse(source)
      .filter((i) => i.fixable)
      .map((i) => i.check)
  );
  if (fixable.size === 0) return undefined;

  let text = original;
  if (fixable.has("markup")) text = text.replace(ENTITY, decodeEntity);
  if (fixable.has("code-block")) text = dedentCodeBlocks(text);
  if (fixable.has("glyph-bullets")) text = glyphsToItems(text);
  if (fixable.has("specs-not-list")) text = specsToItems(text);
  else if (fixable.has("soft-breaks")) text = splitSoftBreaks(text);
  text = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n");
  text = text.trim();
  // A trimmed value must not start indented, or `|-` cannot hold it.
  if (firstLineIndent(text) !== 0) return undefined;

  assertLossless(original, text);
  // One fix can expose another: a dedented code block is a paragraph of
  // one item per line, which the next pass splits. Run to a fixed point,
  // so `apply` twice is `apply` once.
  if (text !== original && depth < 3) {
    const again = fixProse({ field: source.field, value: text, header: "|-" }, depth + 1);
    if (again !== undefined) {
      assertLossless(original, again);
      return again;
    }
  }
  return text;
}

/**
 * Every word that went in comes out, in order. Whitespace, list markers
 * and bullet glyphs may move; entities may decode. Anything else is a bug
 * in a fix, and it throws rather than writing a shorter entry.
 */
export function assertLossless(before: string, after: string): void {
  const skeleton = (s: string) =>
    s
      .replace(ENTITY, decodeEntity)
      .replace(new RegExp(BULLET_GLYPH, "gu"), "")
      .replace(/^[ \t]*- /gm, "")
      .replace(/\s+/g, "");
  if (skeleton(before) !== skeleton(after)) {
    throw new Error(`prose-layout: a fix changed the text, not only its layout:\n${before}`);
  }
}

/**
 * The value as a `|-` block scalar indented under a key at `keyIndent`.
 * Undefined when a literal block cannot hold it (a first line that starts
 * with a space would need an indentation indicator).
 */
export function renderBlockLiteral(text: string, keyIndent: number): string | undefined {
  if (firstLineIndent(text) !== 0 || text.trim() === "") return undefined;
  const pad = " ".repeat(keyIndent + 2);
  const body = text
    .split("\n")
    .map((l) => (l.trim() === "" ? "" : `${pad}${l}`))
    .join("\n");
  return `|-\n${body}`;
}

/** One `details` or `specs` value as it sits in a file. */
export interface ProseLocation extends ProseSource {
  /** `[]` for the entry's own field, `["translations", "de"]` for a translation's. */
  scope: string[];
  /** Offset of the `:` after the key; the value is rewritten from here on. */
  colon: number;
  /** Offset where the value's text ends (a block scalar's includes its newline). */
  end: number;
  /** Column of the key, which a rewritten block is indented under. */
  keyIndent: number;
}

function proseIn(map: YAMLMap, src: string, scope: string[]): ProseLocation[] {
  const out: ProseLocation[] = [];
  for (const pair of map.items) {
    if (!isScalar(pair.key) || !pair.key.range) continue;
    const key = String(pair.key.value);
    if (!(PROSE_FIELDS as readonly string[]).includes(key)) continue;
    const node = pair.value;
    if (!(isScalar(node) || isSeq(node)) || !node.range) continue;
    const colon = src.indexOf(":", pair.key.range[1]);
    const lineStart = src.lastIndexOf("\n", pair.key.range[0]) + 1;
    const head = src.slice(node.range[0], node.range[0] + 3);
    out.push({
      field: key as ProseField,
      value: node.toJSON(),
      header: isScalar(node) && /^[|>]/.test(head) ? head.match(/^[|>][-+]?/)![0] : undefined,
      scope,
      colon,
      end: node.range[1],
      keyIndent: pair.key.range[0] - lineStart,
    });
  }
  return out;
}

function withoutProse(entry: unknown): unknown {
  if (typeof entry !== "object" || entry === null) return entry;
  const copy: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
  for (const f of PROSE_FIELDS) delete copy[f];
  if (typeof copy.translations === "object" && copy.translations !== null) {
    copy.translations = Object.fromEntries(
      Object.entries(copy.translations as Record<string, unknown>).map(([k, v]) => [
        k,
        withoutProse(v),
      ])
    );
  }
  return copy;
}

/** Every `details` and `specs` in a YAML source, the entry's own and each translation's. */
export function proseLocations(src: string): ProseLocation[] {
  const doc = parseDocument(src);
  if (!isMap(doc.contents)) return [];
  const out = proseIn(doc.contents, src, []);
  const translations = doc.contents.get("translations", true);
  if (isMap(translations)) {
    for (const pair of translations.items) {
      if (isScalar(pair.key) && isMap(pair.value)) {
        out.push(...proseIn(pair.value, src, ["translations", String(pair.key.value)]));
      }
    }
  }
  return out;
}

/**
 * `src` with every fixable `details`/`specs` rewritten as a `|-` block,
 * and the labels of what changed. Rewrites run back to front so earlier
 * offsets stay valid. Each rewritten value is parsed back and compared to
 * the text intended, so a rendering this module got wrong throws rather
 * than reaching a file.
 */
export function fixSource(src: string): { text: string; changed: string[] } {
  const changed: string[] = [];
  let text = src;
  const locations = proseLocations(src).sort((a, b) => b.colon - a.colon);
  for (const loc of locations) {
    const original = proseText(loc.value);
    if (original === undefined) continue;
    const issues = auditProse(loc).filter((i) => i.fixable);
    if (issues.length === 0) continue;
    const intended = fixProse(loc) ?? original.replace(/[ \t]+$/gm, "").trim();
    const block = renderBlockLiteral(intended, loc.keyIndent);
    if (block === undefined) continue;
    const trailing = text.slice(loc.colon + 1, loc.end).endsWith("\n") ? "\n" : "";
    text = `${text.slice(0, loc.colon + 1)} ${block}${trailing}${text.slice(loc.end)}`;
    const label = [...loc.scope, loc.field].join(".");
    changed.push(`${label}: ${[...new Set(issues.map((i) => i.check))].join(", ")}`);
  }
  if (changed.length === 0) return { text: src, changed };

  // Parse back: every value that was rewritten now reads as the text intended.
  const after = proseLocations(text);
  for (const loc of proseLocations(src)) {
    const original = proseText(loc.value);
    const now = after.find(
      (a) => a.field === loc.field && a.scope.join(".") === loc.scope.join(".")
    );
    if (original === undefined || !now || typeof now.value !== "string") {
      throw new Error(`prose-layout: lost ${[...loc.scope, loc.field].join(".")} on rewrite`);
    }
    assertLossless(original, now.value);
  }
  // And nothing outside those values moved.
  if (JSON.stringify(withoutProse(parse(src))) !== JSON.stringify(withoutProse(parse(text)))) {
    throw new Error("prose-layout: a rewrite changed a field other than details or specs");
  }
  return { text, changed: changed.reverse() };
}

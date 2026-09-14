/**
 * Control characters in catalog string values (E126).
 *
 * Every string field in the catalog is a single-line value or a document
 * whose paragraphs are separated by ordinary newlines. None of them has a
 * use for a C0/C1 control character, a line separator, or a NUL — but
 * nothing rejected them, and `z.url()` in particular accepts
 * `https://example.com/a\nb`, a NUL, a pipe and a backtick without
 * complaint (measured against zod 4.4).
 *
 * That matters because the values leave the repository as text in places
 * that are line-oriented. `url-health.yml` interpolates a URL into a
 * Markdown table row, and a newline inside it ends the row: a merged URL
 * could restructure a bot-generated report or change whose name appeared
 * to have written it. The workflows encode each cell now, which is the
 * fix at the sink; this is the other half, keeping the value single-line
 * where it is authored so every other consumer inherits the guarantee.
 *
 * Tab and newline are allowed inside the prose fields (`description`,
 * `details`, `specs` and their translations) because that is how those are
 * written. Everywhere else a newline is a defect: `url`, `name`, a link
 * title and a version number are single-line values, and those are what
 * the workflows lay out in table rows.
 */

/**
 * Fields whose value is prose spanning several lines, so newlines are
 * data. `description` is documented as a flow scalar (CLAUDE.md) and
 * usually is, but 172 entries carry it as a `|-` block with real
 * paragraphs, so it is prose here rather than a backfill this change
 * would have to drag along.
 */
const MULTILINE_FIELDS = new Set(["description", "details", "specs"]);

/**
 * C0 controls, DEL, the C1 range, and the Unicode line/paragraph
 * separators. Tab (09), LF (0A) and CR (0D) are handled per-field below
 * rather than here, so the class stays the definition of "never legal".
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is what this module is for
const ALWAYS_ILLEGAL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/;
const LINE_BREAK = /[\n\r]/;
const TAB = /\t/;

export interface ControlCharacterFinding {
  /** Path segments to the offending value. */
  path: (string | number)[];
  /** The character's code point, as `U+0009`. */
  codePoint: string;
}

/** A character as its code point, `U+000A`, so a report names it legibly. */
function describe(character: string): string {
  return `U+${character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Every control character in `value`, at any depth, as one finding per
 * offending string. Keys are not checked: an unknown key is E121's job and
 * a control character in one cannot survive a YAML round trip as a key the
 * schema declares.
 */
export function findControlCharacters(value: unknown): ControlCharacterFinding[] {
  const findings: ControlCharacterFinding[] = [];

  /**
   * Descend one value, carrying the path to it and whether an enclosing key
   * made it prose. `multiline` only ever turns on: a `description` nested
   * under `translations.de` is prose for the same reason the top-level one
   * is.
   */
  const walk = (node: unknown, path: (string | number)[], multiline: boolean): void => {
    if (typeof node === "string") {
      const offender =
        ALWAYS_ILLEGAL.exec(node) ?? (multiline ? null : (LINE_BREAK.exec(node) ?? TAB.exec(node)));
      if (offender) {
        findings.push({ path, codePoint: describe(offender[0]) });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        walk(item, [...path, index], multiline);
      });
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const [key, child] of Object.entries(node)) {
        walk(child, [...path, key], multiline || MULTILINE_FIELDS.has(key));
      }
    }
  };

  walk(value, [], false);
  return findings;
}

/** `links[0].url` from `["links", 0, "url"]`. */
export function formatControlCharacterPath(finding: ControlCharacterFinding): string {
  return finding.path.reduce<string>(
    (accumulated, segment) =>
      typeof segment === "number"
        ? `${accumulated}[${segment}]`
        : accumulated === ""
          ? segment
          : `${accumulated}.${segment}`,
    ""
  );
}

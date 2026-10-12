/**
 * What a prose field may carry besides Markdown, and what a `url` may
 * point at.
 *
 * The build renders `description`, `details` and `specs` with marked and
 * Studio shows the HTML. marked passes raw HTML through by design, so an
 * entry carrying `<script>` or `<img onerror>` in its prose shipped it
 * verbatim in the signed database, and `z.url()` accepted `javascript:`
 * and `data:` for every `url` field because the URL parser does. Nothing
 * rejected either, which is the finding this module closes at both ends:
 * `pnpm validate` refuses them (E305, E128) and the build escapes whatever
 * reaches it anyway (`markdownToHtml` in `build-sqlite.ts`), because one
 * sink is not a guarantee about the data.
 */

import { marked, type Token } from "marked";

/** The schemes a `url` field or a prose link may carry. */
const PAGE_SCHEMES = new Set(["http:", "https:"]);
const LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * The scheme of `value` with its trailing colon, or null when the string
 * is not an absolute URL. A relative reference has no scheme and is not a
 * verdict either way; a caller deciding on it treats null as "nothing to
 * refuse".
 */
export function urlScheme(value: string): string | null {
  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

/** True for an absolute http or https URL. */
export function isHttpUrl(value: string): boolean {
  const scheme = urlScheme(value);
  return scheme !== null && PAGE_SCHEMES.has(scheme);
}

/**
 * True for an href the renderer may emit: http, https, mailto, or a
 * relative reference. `javascript:`, `data:`, `vbscript:` and the rest
 * are payloads rather than destinations.
 */
export function isSafeHref(href: string): boolean {
  const scheme = urlScheme(href);
  return scheme === null || LINK_SCHEMES.has(scheme);
}

export interface ProseMarkup {
  /** Each raw HTML run the lexer found, as written. */
  html: string[];
  /** Each link or image destination outside `isSafeHref`. */
  unsafeLinks: string[];
}

/**
 * Raw HTML and unsafe link destinations in a Markdown string, read off
 * marked's own token stream so the verdict matches what the build would
 * render. A regex for `<script` would miss `<img onerror>` and flag a
 * `<The Lord's Funeral>` the lexer reads as text, which is in the corpus.
 */
export function findProseMarkup(markdown: string): ProseMarkup {
  const found: ProseMarkup = { html: [], unsafeLinks: [] };
  const walk = (tokens: Token[]): void => {
    for (const token of tokens) {
      if (token.type === "html") {
        found.html.push(token.raw.trim());
      } else if ((token.type === "link" || token.type === "image") && !isSafeHref(token.href)) {
        found.unsafeLinks.push(token.href);
      }
      if ("tokens" in token && Array.isArray(token.tokens)) walk(token.tokens);
      if ("items" in token && Array.isArray(token.items)) walk(token.items);
      // A table keeps its cells under `header` and `rows`, not `tokens`,
      // so a walk over `tokens` alone never reaches a cell's inline HTML
      // or link.
      if (token.type === "table") {
        for (const cell of token.header) walk(cell.tokens);
        for (const row of token.rows) for (const cell of row) walk(cell.tokens);
      }
    }
  };
  walk(marked.lexer(markdown));
  return found;
}

/** Escape text for an HTML text node or a double-quoted attribute value. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

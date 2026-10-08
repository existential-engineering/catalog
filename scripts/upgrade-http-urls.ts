#!/usr/bin/env tsx
/**
 * Upgrade http:// URLs to https:// where the site serves it (AUREO-1191)
 *
 * Studio marks every `http://` destination as insecure, and most of the
 * catalog's are only http because the entry was written before the site
 * moved. Rewriting them blindly would be a claim about a site nobody
 * checked, so this probes the `https://` form of each one first and
 * upgrades only what answered.
 *
 * WHAT COUNTS AS AN UPGRADE
 *
 * The https form, fetched through `fetchPublic` (every redirect hop
 * checked against the destination guard), must end in a 2xx on an
 * https URL whose registrable domain is the original's, and the page
 * must not read as a parked or for-sale domain. A redirect back to
 * http, a certificate or connection failure, a 4xx/5xx, a different
 * site after redirects or a parked page all keep the URL as it is.
 *
 * Only the scheme changes. The path, query and host are left exactly as
 * written: following the redirect to a canonical URL is `fix-urls`'s job
 * and a different kind of review.
 *
 * WHAT IS SKIPPED, NOT KEPT
 *
 * A refusal (401, 403, 429) says nothing about whether https works, so
 * it is reported as `skip` rather than as a failed upgrade: a refusal
 * read as "https is broken" would rewrite nothing while looking like it
 * checked. The same goes for a URL with an explicit port, whose https
 * form would be a guess at a different service, and for a destination
 * the guard refuses.
 *
 * Usage:
 *   pnpm https-upgrade --out docs/reviews/<date>-https-upgrade.tsv   # probe, write review list
 *   pnpm https-upgrade --rows <tsv>                                  # dry run of a reviewed list
 *   pnpm https-upgrade --rows <tsv> --apply                          # write the `upgrade` rows
 *
 * The apply step reads the TSV rather than probing again, so what is
 * written is exactly what was reviewed. Run `pnpm format` and
 * `pnpm validate` after.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { checkContainedDirectory } from "./lib/findings.js";
import {
  closeGuardedDispatchers,
  fetchPublic,
  isPrivateDestinationError,
} from "./lib/url-guard.js";
import { checkContainedRegularFile, DATA_DIR, getYamlFiles, REPO_ROOT } from "./lib/utils.js";

const COLLECTIONS = ["manufacturers", "software", "content", "hardware", "accessories"];
const USER_AGENT = "Aureo-Catalog-Validator/1.0";
const REQUEST_TIMEOUT_MS = 15_000;
/** Hosts probed at once. URLs on one host are probed one after another. */
const MAX_CONCURRENT_HOSTS = 6;
/** Pause between two requests to the same host. */
const SAME_HOST_DELAY_MS = 500;
/** Wait before the one retry a transient result gets. */
const RETRY_DELAY_MS = 5_000;
/** How much of a page is read to look for parking markers. */
const BODY_SNIFF_BYTES = 64 * 1024;

const HTTP_URL = /http:\/\/[^\s"'<>()[\]{}|\\^`]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const KEY_LINE = /^\s*(?:-\s+)?([A-Za-z][\w-]*):\s/;

const PROSE_KEYS = new Set(["description", "details", "specs"]);

const PARKED_MARKERS = [
  /domain (?:name )?(?:is|may be) for sale/i,
  /buy this domain/i,
  /this domain (?:is|has been) parked/i,
  /domain has expired/i,
  /parked (?:free|domain)/i,
  /sedoparking|parkingcrew|bodis\.com|above\.com\/marketing|hugedomains\.com|afternic\.com|dan\.com\/buy/i,
];

/** Second-level labels under a two-letter TLD that are public suffixes in practice (co.uk, com.au). */
const SECOND_LEVEL_SUFFIXES = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "go",
  "gov",
  "ne",
  "net",
  "or",
  "org",
]);

/**
 * Hosting platforms that give each tenant its own subdomain. Under these
 * the tenant label is the site, so `a.github.io` and `b.github.io` are two
 * sites and a redirect between them is not an upgrade.
 */
const SHARED_HOST_SUFFIXES = [
  "github.io",
  "gitlab.io",
  "herokuapp.com",
  "myshopify.com",
  "netlify.app",
  "pages.dev",
  "storenvy.com",
  "tumblr.com",
  "vercel.app",
  "weebly.com",
  "wixsite.com",
  "wordpress.com",
];

export type Verdict = "upgrade" | "keep" | "skip";

export interface Occurrence {
  /** Repo-relative path of the YAML file. */
  file: string;
  line: number;
  /** The YAML key on that line (`url`), or `prose` for a URL inside text. */
  field: string;
  url: string;
}

export interface Probe {
  verdict: Verdict;
  reason: string;
  /** A rate limit, a 5xx or a timeout: worth one more try before it is reported. */
  transient?: boolean;
}

export interface ReviewRow extends Occurrence, Probe {}

/**
 * Every http:// URL in `text`, with its line and the key it sits under.
 * Trailing sentence punctuation is not part of a URL in prose.
 */
export function extractHttpUrls(text: string, file: string): Occurrence[] {
  const found: Occurrence[] = [];
  text.split("\n").forEach((content, index) => {
    const key = KEY_LINE.exec(content)?.[1];
    for (const match of content.matchAll(HTTP_URL)) {
      const url = match[0].replace(TRAILING_PUNCTUATION, "");
      const field = key === undefined || PROSE_KEYS.has(key) ? "prose" : key;
      found.push({ file, line: index + 1, field, url });
    }
  });
  return found;
}

/**
 * The registrable part of a hostname, without a public-suffix list:
 * the last two labels, or three under a `co.uk`-shaped suffix. Good
 * enough to tell "same site" from "different site", which is all an
 * upgrade needs; it never decides anything on its own.
 */
export function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
  // Blogspot serves every tenant under a country domain too (blogspot.com.ar,
  // blogspot.de), so it is matched on the label rather than listed per country.
  const blogspot = /(?:^|\.)([^.]+)\.(blogspot(?:\.[a-z]{2,3}){1,2})$/.exec(host);
  if (blogspot) return `${blogspot[1]}.${blogspot[2]}`;
  const shared = SHARED_HOST_SUFFIXES.find((suffix) => host.endsWith(`.${suffix}`));
  if (shared) {
    const tenant = host
      .slice(0, -shared.length - 1)
      .split(".")
      .at(-1);
    return `${tenant}.${shared}`;
  }
  const labels = host.split(".");
  const tld = labels.at(-1) ?? "";
  const second = labels.at(-2) ?? "";
  const take = labels.length >= 3 && tld.length === 2 && SECOND_LEVEL_SUFFIXES.has(second) ? 3 : 2;
  return labels.slice(-take).join(".");
}

/** The https form of an http URL: the scheme and nothing else changes. */
export function toHttps(url: string): string {
  return `https://${url.slice("http://".length)}`;
}

export interface ResponseFacts {
  status: number;
  /** URL the final response came from, after redirects. */
  finalUrl: string;
  /** The start of the body, when it was read. */
  body?: string;
}

/** Decide an upgrade from what the https request returned. */
export function judgeResponse(original: string, facts: ResponseFacts): Probe {
  const { status, finalUrl, body } = facts;
  if (status === 401 || status === 403 || status === 429) {
    return {
      verdict: "skip",
      reason: `https refused (${status}); not evidence either way`,
      transient: status === 429,
    };
  }
  if (status < 200 || status >= 300) {
    // A short plain-text body on a 5xx is usually a proxy or load balancer
    // saying why, which is the difference between "down" and "no TLS".
    const said =
      status >= 500 && body && body.length < 300
        ? `: ${body.trim().split(/[.\n]/)[0].slice(0, 80)}`
        : "";
    return { verdict: "keep", reason: `https returned ${status}${said}`, transient: status >= 500 };
  }
  const final = new URL(finalUrl);
  if (final.protocol !== "https:") {
    return { verdict: "keep", reason: `https redirects back to ${final.protocol}// (${finalUrl})` };
  }
  const from = registrableDomain(new URL(original).hostname);
  const to = registrableDomain(final.hostname);
  if (from !== to) {
    return { verdict: "keep", reason: `https lands on a different site (${final.hostname})` };
  }
  // A deep link answered by the home page is a soft 404, not the page the
  // entry names: Storenvy sends a dead store's product to its own front page.
  const originalPath = new URL(original).pathname;
  if ((originalPath !== "/" && final.pathname === "/") || /404/.test(final.search)) {
    return { verdict: "keep", reason: `https sends a deep link to the home page (${finalUrl})` };
  }
  if (body && PARKED_MARKERS.some((marker) => marker.test(body))) {
    return { verdict: "keep", reason: "https serves a parked or for-sale page" };
  }
  return {
    verdict: "upgrade",
    reason:
      finalUrl === new URL(toHttps(original)).toString()
        ? "https 2xx"
        : `https 2xx via ${finalUrl}`,
  };
}

/** Why a request failed, in a word a reviewer can act on. */
function describeError(error: unknown): string {
  const parts: string[] = [];
  for (let current = error, depth = 0; current instanceof Error && depth < 6; depth++) {
    const code = (current as { code?: unknown }).code;
    if (current.name === "TimeoutError" || current.name === "AbortError") return "https timed out";
    parts.push(typeof code === "string" ? code : current.message);
    current = current.cause;
  }
  const detail = parts.filter((part) => part !== "fetch failed").at(-1) ?? "unknown error";
  return `https failed: ${detail.replace(/\s+/g, " ").slice(0, 120)}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStart(response: Response): Promise<string> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.body || !/html|text/i.test(type)) {
    await response.body?.cancel();
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < BODY_SNIFF_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Probe one http URL's https form. */
export async function probeUrl(url: string): Promise<Probe> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { verdict: "skip", reason: "not a parseable URL" };
  }
  if (parsed.port !== "") {
    return {
      verdict: "skip",
      reason: `explicit port ${parsed.port}; https would be a different service`,
    };
  }
  try {
    const { response, url: finalUrl } = await fetchPublic(toHttps(url), {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
    const body = await readStart(response);
    return judgeResponse(url, { status: response.status, finalUrl, body });
  } catch (error) {
    if (isPrivateDestinationError(error)) {
      return { verdict: "skip", reason: "destination refused by url-guard" };
    }
    const reason = describeError(error);
    return { verdict: "keep", reason, transient: reason === "https timed out" };
  }
}

/** Every http:// URL in the catalog's YAML, each file checked before it is read. */
export function collectOccurrences(dataDir: string = DATA_DIR): Occurrence[] {
  const occurrences: Occurrence[] = [];
  for (const collection of COLLECTIONS) {
    for (const file of getYamlFiles(path.join(dataDir, collection))) {
      const check = checkContainedRegularFile(file, dataDir);
      if (check.path === undefined) {
        console.warn(`⚠️  ${path.relative(REPO_ROOT, file)} skipped: ${check.reason}`);
        continue;
      }
      const text = fs.readFileSync(check.path, "utf8");
      if (!text.includes("http://")) continue;
      occurrences.push(...extractHttpUrls(text, path.relative(REPO_ROOT, file)));
    }
  }
  return occurrences;
}

/** Probe each distinct URL once: hosts in parallel, one request at a time per host. */
async function probeAll(urls: string[]): Promise<Map<string, Probe>> {
  const byHost = new Map<string, string[]>();
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      host = url;
    }
    byHost.set(host, [...(byHost.get(host) ?? []), url]);
  }
  const hosts = [...byHost.values()];
  const results = new Map<string, Probe>();
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < hosts.length) {
      const group = hosts[next++];
      for (const [index, url] of group.entries()) {
        if (index > 0) await sleep(SAME_HOST_DELAY_MS);
        let probe = await probeUrl(url);
        if (probe.transient) {
          await sleep(RETRY_DELAY_MS);
          probe = await probeUrl(url);
        }
        results.set(url, probe);
        done++;
        if (done % 25 === 0) console.error(`   probed ${done}/${urls.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_HOSTS, hosts.length) }, worker));
  return results;
}

const TSV_COLUMNS = ["file", "line", "field", "url", "verdict", "reason"] as const;

export function formatRows(rows: ReviewRow[]): string {
  const header = [
    "# http:// URLs probed over https (AUREO-1191). Read by `pnpm https-upgrade --rows`.",
    "#",
    "# verdict  upgrade  https answered 2xx on the same site; the scheme is rewritten",
    "#          keep     https failed, landed elsewhere or served a parked page (reason says which)",
    "#          skip     not evidence either way: a refusal, an explicit port, a guarded destination",
    "#",
    "# Only `upgrade` rows are written. Delete or re-mark a row to decline it.",
    TSV_COLUMNS.join("\t"),
  ];
  const clean = (value: string | number) => String(value).replace(/[\t\r\n]+/g, " ");
  return `${[...header, ...rows.map((row) => TSV_COLUMNS.map((column) => clean(row[column])).join("\t"))].join("\n")}\n`;
}

export function parseRows(text: string): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#") || line.startsWith("file\t")) continue;
    const [file, lineNo, field, url, verdict, reason = ""] = line.split("\t");
    if (verdict !== "upgrade" && verdict !== "keep" && verdict !== "skip") continue;
    rows.push({ file, line: Number(lineNo), field, url, verdict, reason });
  }
  return rows;
}

export interface ApplyOutcome {
  applied: number;
  files: string[];
  skipped: { row: ReviewRow; reason: string }[];
}

/**
 * Rewrite the `upgrade` rows' URLs in place. A row is located by file and
 * line and must still carry the reviewed URL there, as a whole URL rather
 * than a prefix of a longer one, or it is refused as stale.
 */
export function applyRows(
  rows: ReviewRow[],
  write: boolean,
  root: string = REPO_ROOT
): ApplyOutcome {
  const outcome: ApplyOutcome = { applied: 0, files: [], skipped: [] };
  const byFile = new Map<string, ReviewRow[]>();
  for (const row of rows.filter((candidate) => candidate.verdict === "upgrade")) {
    byFile.set(row.file, [...(byFile.get(row.file) ?? []), row]);
  }
  const dataDir = path.join(root, "data");
  for (const [file, fileRows] of byFile) {
    const target = path.resolve(root, file);
    const check = checkContainedRegularFile(target, dataDir);
    if (check.path === undefined) {
      for (const row of fileRows) outcome.skipped.push({ row, reason: `file ${check.reason}` });
      continue;
    }
    const lines = fs.readFileSync(check.path, "utf8").split("\n");
    let matched = 0;
    for (const row of fileRows) {
      const content = lines[row.line - 1];
      if (!row.url.startsWith("http://") || content === undefined) {
        outcome.skipped.push({ row, reason: "row is malformed or the line no longer exists" });
        continue;
      }
      const escaped = row.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const whole = new RegExp(`${escaped}(?![^\\s"'<>()[\\]{}|\\\\^\`.,;:!?])`);
      if (!whole.test(content)) {
        outcome.skipped.push({ row, reason: "URL is no longer on that line" });
        continue;
      }
      // A replacer function, so a `$&` or `$'` in a URL is inserted literally.
      const replacement = toHttps(row.url);
      lines[row.line - 1] = content.replace(whole, () => replacement);
      matched++;
    }
    if (matched > 0 && write) {
      // Re-check immediately before the write: the read above is not a statement about now.
      const recheck = checkContainedRegularFile(target, dataDir);
      if (recheck.path === undefined) {
        for (const row of fileRows) outcome.skipped.push({ row, reason: `file ${recheck.reason}` });
        continue;
      }
      fs.writeFileSync(recheck.path, lines.join("\n"));
    }
    if (matched > 0) {
      outcome.applied += matched;
      outcome.files.push(file);
    }
  }
  return outcome;
}

function argValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const rowsPath = argValue(args, "--rows");

  if (rowsPath) {
    const check = checkContainedRegularFile(rowsPath, REPO_ROOT);
    if (check.path === undefined) {
      console.error(`❌ --rows ${rowsPath} ${check.reason}`);
      process.exit(1);
    }
    const write = args.includes("--apply");
    const outcome = applyRows(parseRows(fs.readFileSync(check.path, "utf8")), write);
    console.log(
      `\n🔒 ${write ? "Upgraded" : "Would upgrade"}: ${outcome.applied} URL(s) in ${outcome.files.length} file(s)`
    );
    for (const { row, reason } of outcome.skipped) {
      console.log(`   skipped ${row.file}:${row.line} ${row.url}: ${reason}`);
    }
    if (!write) console.log("\n   Re-run with --apply to write.\n");
    else console.log("\n   Run 'pnpm format' and 'pnpm validate' next.\n");
    return;
  }

  const outPath = argValue(args, "--out");
  if (outPath) {
    const dir = checkContainedDirectory(path.dirname(path.resolve(outPath)), REPO_ROOT);
    if (dir.path === undefined) {
      console.error(`❌ --out directory ${dir.reason}`);
      process.exit(1);
    }
    if (fs.existsSync(outPath)) {
      const file = checkContainedRegularFile(outPath, REPO_ROOT);
      if (file.path === undefined) {
        console.error(`❌ --out ${outPath} ${file.reason}`);
        process.exit(1);
      }
    }
  }

  const occurrences = collectOccurrences();
  const urls = [...new Set(occurrences.map((occurrence) => occurrence.url))];
  console.error(`🔎 ${occurrences.length} http:// URL(s), ${urls.length} distinct; probing https`);
  const probes = await probeAll(urls);
  await closeGuardedDispatchers();

  const rows: ReviewRow[] = occurrences.map((occurrence) => ({
    ...occurrence,
    ...(probes.get(occurrence.url) as Probe),
  }));
  const tsv = formatRows(rows);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), tsv);
    console.error(`📝 wrote ${outPath}`);
  } else {
    process.stdout.write(tsv);
  }
  const count = (verdict: Verdict) => rows.filter((row) => row.verdict === verdict).length;
  console.error(`   upgrade ${count("upgrade")}  keep ${count("keep")}  skip ${count("skip")}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

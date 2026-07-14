/**
 * Promote Canonical URLs Script
 *
 * Finds product entries whose top-level `url` points at an aggregator
 * (KVR, ModularGrid, Plugin Boutique, ...) while their `links` array
 * already carries an official product page, and promotes that link to
 * be the canonical `url`. The promoted entry is removed from `links`
 * to avoid duplication; the aggregator URL is dropped.
 *
 * A link is only promoted when its title matches the entry name, so
 * dependency links ("Ableton Drum Racks for EZdrummer" -> toontrack.com)
 * are never mistaken for the product's own page. Candidate URLs are
 * checked live before anything is written.
 *
 * Entries that stay on an aggregator URL are written to a research-pool
 * report for manual/web follow-up.
 *
 * Usage:
 *   pnpm tsx scripts/promote-canonical-urls.ts            # dry run
 *   pnpm tsx scripts/promote-canonical-urls.ts --apply    # write changes
 *   pnpm tsx scripts/promote-canonical-urls.ts --no-check # skip live URL checks
 *   pnpm tsx scripts/promote-canonical-urls.ts --report <path>
 *
 * Researched replacements (e.g. from a web-research pass over the report)
 * can be fed back through the same live-check + edit pipeline:
 *   pnpm tsx scripts/promote-canonical-urls.ts --from-mapping urls.json --apply
 * where urls.json is [{ "file": "software/foo.yaml", "url": "https://..." }].
 */

import dns from "node:dns";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { isAggregatorUrl, isManufacturerOwnDomain, urlHost } from "./lib/aggregator-domains.js";
import { DATA_DIR } from "./lib/utils.js";

const PRODUCT_KINDS = ["software", "hardware", "content"] as const;

interface CatalogLink {
  type?: string;
  url?: string;
  title?: string;
}

interface Promotion {
  file: string;
  name: string;
  oldUrl: string;
  newUrl: string;
  /** URL as it appears in the promoted `links` entry (pre-cleanup). */
  rawLinkUrl: string;
  /**
   * True when the candidate was discovered in this file's links array, so
   * removing that entry must succeed. Mapping-mode URLs come from external
   * research and usually have no links entry to remove.
   */
  linkRemovalExpected: boolean;
}

interface ResearchItem {
  file: string;
  name: string;
  manufacturer: string;
  manufacturerDomain?: string;
  url: string;
  reason: string;
}

// =============================================================================
// MATCHING
// =============================================================================

function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function titleMatchesName(name: string, title: string | undefined): boolean {
  if (!title) return false;
  const a = squash(name);
  // Vendor decoration after a delimiter doesn't disqualify a title
  // ("Big FrEQ - Empirical Labs"): try each delimited segment too.
  const candidates = [title, ...title.split(/\s+[-–—|·»]\s+/)];
  return candidates.some((candidate) => {
    const b = squash(candidate);
    if (a.length < 4 || b.length < 4) return a === b;
    if (a === b) return true;
    // Containment counts only with near-complete overlap; otherwise a
    // dependency title like "EZdrummer" matches every "... for EZdrummer
    // ..." pack name, and vice versa.
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    return long.includes(short) && short.length >= long.length * 0.6;
  });
}

/** Strip tracking artifacts (utm queries, KVR referral path segments). */
function cleanUrl(raw: string): string {
  let url = raw;
  const queryStart = url.indexOf("?");
  if (queryStart !== -1 && url.includes("utm_")) url = url.slice(0, queryStart);
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length > 0 && /^src_/.test(segments[segments.length - 1])) {
      segments.pop();
      parsed.pathname = `/${segments.join("/")}/`;
      url = parsed.toString();
    }
  } catch {
    return raw;
  }
  return url;
}

function loadManufacturerDomains(): Map<string, string> {
  const domains = new Map<string, string>();
  const dir = path.join(DATA_DIR, "manufacturers");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const doc = parseYaml(fs.readFileSync(path.join(dir, file), "utf-8"));
    if (doc?.url && !isAggregatorUrl(doc.url)) {
      domains.set(file.replace(/\.yaml$/, ""), urlHost(doc.url));
    }
  }
  return domains;
}

function pickCandidate(
  name: string,
  links: CatalogLink[],
  manufacturerDomain: string | undefined
): CatalogLink | undefined {
  const matches = links.filter(
    (link) =>
      link.type === "product" &&
      link.url &&
      !isAggregatorUrl(link.url) &&
      titleMatchesName(name, link.title)
  );
  const score = (link: CatalogLink): number => {
    let value = 0;
    if (squash(link.title ?? "") === squash(name)) value += 4;
    if (manufacturerDomain && urlHost(link.url!) === manufacturerDomain) value += 2;
    try {
      if (new URL(link.url!).pathname.length > 1) value += 1;
    } catch {
      return -1;
    }
    return value;
  };
  return matches.sort((a, b) => score(b) - score(a))[0];
}

// =============================================================================
// LIVE CHECK
// =============================================================================

const MAX_CONCURRENT = 10;
const MAX_REDIRECTS = 5;
const ACCEPTABLE_ERROR_STATUSES = new Set([401, 403, 405, 429]);

/**
 * Resolve via public DNS (1.1.1.1 / 8.8.8.8) rather than the system
 * resolver: local ad-block DNS setups blackhole some legitimate vendor
 * domains to 0.0.0.0, which would falsely mark them dead.
 */
const publicResolver = new dns.promises.Resolver();
publicResolver.setServers(["1.1.1.1", "8.8.8.8"]);
const dnsCache = new Map<string, Promise<string[]>>();

function resolve4Cached(hostname: string): Promise<string[]> {
  let pending = dnsCache.get(hostname);
  if (!pending) {
    pending = publicResolver
      .resolve4(hostname)
      .then((addresses) => addresses.filter((a) => a !== "0.0.0.0" && !a.startsWith("127.")));
    dnsCache.set(hostname, pending);
  }
  return pending;
}

const publicLookup: LookupFunction = (hostname, options, callback) => {
  resolve4Cached(hostname)
    .then((addresses) => {
      if (addresses.length === 0) {
        callback(
          Object.assign(new Error(`no A records for ${hostname}`), { code: "ENOTFOUND" }),
          []
        );
      } else if (options.all) {
        callback(
          null,
          addresses.map((address) => ({ address, family: 4 }))
        );
      } else {
        (callback as (err: null, address: string, family: number) => void)(null, addresses[0], 4);
      }
    })
    .catch((error) => callback(error, []));
};

/**
 * Single GET without redirect following. Uses node:http(s) directly with
 * IPv4 — several catalog vendors publish broken AAAA records that make
 * undici's fetch fail with ECONNREFUSED where IPv4 works fine.
 */
function requestOnce(
  url: string
): Promise<{ status: number; location?: string; bodySample: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "http:" ? http : https;
    const request = lib.get(
      {
        host: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        lookup: publicLookup,
        timeout: 15000,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; AureoCatalog/1.0)",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
      },
      (response) => {
        let bodySample = "";
        response.on("data", (chunk: Buffer) => {
          if (bodySample.length < 4096) bodySample += chunk.toString("utf-8");
          else response.resume();
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location,
            bodySample,
          })
        );
        response.on("error", reject);
      }
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

/**
 * Parked/for-sale domains often serve HTTP 200 with a JS bounce to a
 * parking lander, invisible to status-code checks (wnpsounds-eng.net).
 */
const PARKING_SIGNATURES =
  /window\.location\.href="\/lander"|sedoparking\.com|parkingcrew\.net|hugedomains\.com|domain (is )?for sale|buy this domain|dan\.com\/buy-domain|sav\.com\/domain/i;

interface CheckResult {
  ok: boolean;
  detail: string;
  /** Post-redirect URL — the one to write when the check passes. */
  finalUrl: string;
}

/**
 * A redirect cannot be trusted blindly: vendors redirect discontinued
 * products to successors (ambi-head -> ambi-head-hd), parked domains dump
 * on homepages, expired domains resurface elsewhere. Accepted:
 *   1. Path unchanged (modulo trailing slash/case) — covers pure domain
 *      renames like drumdrops.com -> drum-drops.com.
 *   2. Same host, same final path slug — covers restructures like
 *      /ambi-head-hd -> /product/ambi-head-hd/.
 *   3. Same host, new slug whose tokens all come from the product name and
 *      cover at least half of it — covers slug renames like softube's
 *      /af -> /plug-ins/acoustic-feedback. A successor slug introduces a
 *      token ("hd", "amplitube5") that the name doesn't contain.
 */
function redirectStillThisProduct(original: string, final: string, name: string): boolean {
  const normPath = (u: string): string => new URL(u).pathname.replace(/\/+$/, "").toLowerCase();
  if (normPath(final) === normPath(original)) return true;
  if (urlHost(final) !== urlHost(original)) return false;
  const lastSlug = (u: string): string => normPath(u).split("/").filter(Boolean).pop() ?? "";
  const finalSlug = lastSlug(final);
  if (finalSlug && finalSlug === lastSlug(original)) return true;
  const tokenize = (text: string): string[] =>
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  const nameTokens = new Set(tokenize(name));
  const slugTokens = tokenize(finalSlug);
  return (
    slugTokens.length > 0 &&
    slugTokens.every((token) => nameTokens.has(token)) &&
    slugTokens.length >= nameTokens.size / 2
  );
}

async function checkUrl(url: string, name: string): Promise<CheckResult> {
  let current = url;
  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    let response: { status: number; location?: string; bodySample: string };
    try {
      response = await requestOnce(current);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? (error as Error).message;
      return { ok: false, detail: `fetch failed (${code})`, finalUrl: current };
    }
    if (response.status >= 300 && response.status < 400 && response.location) {
      current = new URL(response.location, current).toString();
      continue;
    }
    if (response.status >= 400 && !ACCEPTABLE_ERROR_STATUSES.has(response.status)) {
      return { ok: false, detail: `HTTP ${response.status}`, finalUrl: current };
    }
    if (isAggregatorUrl(current) && urlHost(current) !== urlHost(url)) {
      return {
        ok: false,
        detail: `redirected to aggregator ${urlHost(current)}`,
        finalUrl: current,
      };
    }
    if (!redirectStillThisProduct(url, current, name)) {
      return { ok: false, detail: `redirected to different path ${current}`, finalUrl: current };
    }
    if (PARKING_SIGNATURES.test(response.bodySample)) {
      return { ok: false, detail: "parked-domain lander page", finalUrl: current };
    }
    return { ok: true, detail: `HTTP ${response.status}`, finalUrl: current };
  }
  return { ok: false, detail: "too many redirects", finalUrl: current };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check URLs with hosts serialized (one in-flight request per host, small
 * delay between) so rate limiters aren't tripped, retrying once on
 * transient failures. Different hosts run concurrently.
 */
async function checkUrls(items: Array<{ url: string; name: string }>): Promise<CheckResult[]> {
  const results: CheckResult[] = new Array(items.length);
  const byHost = new Map<string, number[]>();
  items.forEach(({ url }, i) => {
    const host = urlHost(url);
    byHost.set(host, [...(byHost.get(host) ?? []), i]);
  });
  const hostGroups = [...byHost.values()];
  let groupIndex = 0;
  async function worker(): Promise<void> {
    while (groupIndex < hostGroups.length) {
      const group = hostGroups[groupIndex++];
      for (const i of group) {
        let result = await checkUrl(items[i].url, items[i].name);
        const transient = /\((ECONNRESET|ETIMEDOUT|EAI_AGAIN)\)|timeout|HTTP (429|5\d\d)/;
        if (!result.ok && transient.test(result.detail)) {
          await sleep(2000);
          result = await checkUrl(items[i].url, items[i].name);
        }
        results[i] = result;
        // Politeness delay only when we actually reached a server.
        if (!result.detail.includes("ENOTFOUND")) await sleep(150);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, hostGroups.length) }, () => worker())
  );
  return results;
}

// =============================================================================
// TEXT EDITS (formatting-preserving, same approach as fix-urls.ts)
// =============================================================================

function removeLinkEntry(content: string, url: string): string {
  const lines = content.split("\n");
  // Exact-match the link's own url line (indented), never the top-level
  // `url:` line and never a longer URL that merely starts with `url`.
  const urlLineIndex = lines.findIndex((line) => {
    if (!/^\s/.test(line)) return false;
    const trimmed = line.trim();
    return trimmed === `url: ${url}` || trimmed === `- url: ${url}`;
  });
  if (urlLineIndex === -1) return content;

  let entryStart = urlLineIndex;
  const urlIndent = lines[urlLineIndex].search(/\S/);
  for (let i = urlLineIndex; i >= 0; i--) {
    if (lines[i].trimStart().startsWith("- ") && lines[i].search(/\S/) < urlIndent) {
      entryStart = i;
      break;
    }
  }

  const entryIndent = lines[entryStart].search(/\S/);
  let entryEnd = entryStart;
  for (let i = entryStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    if (lines[i].search(/\S/) <= entryIndent) break;
    entryEnd = i;
  }

  lines.splice(entryStart, entryEnd - entryStart + 1);
  return lines.join("\n");
}

function applyPromotion(content: string, promotion: Promotion): string {
  let result = removeLinkEntry(content, promotion.rawLinkUrl);
  if (promotion.linkRemovalExpected && result === content) {
    // The candidate came from this file's links array, so failing to find
    // it means the YAML layout defeated the text edit — bail rather than
    // leave a duplicate of the new canonical url behind.
    throw new Error(`promoted link entry not found in ${promotion.file}`);
  }
  result = result.replace(/^url: .*$/m, () => `url: ${promotion.newUrl}`);
  const parsed = parseYaml(result);
  if (parsed.url !== promotion.newUrl) {
    throw new Error(`unexpected url layout while editing ${promotion.file}`);
  }
  if (parsed.links === null) result = result.replace(/^links:\n?/m, "");
  return result;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const skipCheck = args.includes("--no-check");
  const reportIndex = args.indexOf("--report");
  const reportPath =
    reportIndex !== -1
      ? args[reportIndex + 1]
      : path.join(DATA_DIR, "..", "dist", "aggregator-research-pool.json");

  const mappingIndex = args.indexOf("--from-mapping");
  const manufacturerDomains = loadManufacturerDomains();
  const promotions: Array<Promotion & { filePath: string }> = [];
  const researchPool: ResearchItem[] = [];

  if (mappingIndex !== -1) {
    const mapping: Array<{ file: string; url: string }> = JSON.parse(
      fs.readFileSync(args[mappingIndex + 1], "utf-8")
    );
    for (const item of mapping) {
      const filePath = path.join(DATA_DIR, item.file);
      const doc = parseYaml(fs.readFileSync(filePath, "utf-8"));
      if (!doc?.url || !isAggregatorUrl(doc.url) || isAggregatorUrl(item.url)) continue;
      promotions.push({
        file: item.file,
        filePath,
        name: doc.name ?? "",
        oldUrl: doc.url,
        newUrl: cleanUrl(item.url),
        rawLinkUrl: item.url,
        linkRemovalExpected: false,
      });
    }
  } else {
    for (const kind of PRODUCT_KINDS) {
      const dir = path.join(DATA_DIR, kind);
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
        const filePath = path.join(dir, file);
        const doc = parseYaml(fs.readFileSync(filePath, "utf-8"));
        if (!doc?.url || !isAggregatorUrl(doc.url)) continue;
        const manufacturer: string = doc.manufacturer ?? "";
        if (isManufacturerOwnDomain(manufacturer, doc.url)) continue;

        const links: CatalogLink[] = Array.isArray(doc.links) ? doc.links : [];
        const candidate = pickCandidate(
          doc.name ?? "",
          links,
          manufacturerDomains.get(manufacturer)
        );
        if (candidate?.url) {
          promotions.push({
            file: `${kind}/${file}`,
            filePath,
            name: doc.name ?? "",
            oldUrl: doc.url,
            newUrl: cleanUrl(candidate.url),
            rawLinkUrl: candidate.url,
            linkRemovalExpected: true,
          });
        } else {
          researchPool.push({
            file: `${kind}/${file}`,
            name: doc.name ?? "",
            manufacturer,
            manufacturerDomain: manufacturerDomains.get(manufacturer),
            url: doc.url,
            reason: links.some((l) => l.type === "product" && l.url && !isAggregatorUrl(l.url))
              ? "product links present but none title-matched"
              : "no non-aggregator product link",
          });
        }
      }
    }
  }

  console.log(`Promotion candidates: ${promotions.length}`);

  let verified = promotions;
  if (!skipCheck) {
    console.log(`Checking ${promotions.length} candidate URLs live...\n`);
    const checks = await checkUrls(promotions.map((p) => ({ url: p.newUrl, name: p.name })));
    verified = [];
    promotions.forEach((promotion, i) => {
      if (checks[i].ok) {
        verified.push({ ...promotion, newUrl: checks[i].finalUrl });
      } else {
        console.log(`  [!] ${promotion.file}: ${promotion.newUrl} (${checks[i].detail})`);
        researchPool.push({
          file: promotion.file,
          name: promotion.name,
          manufacturer: "",
          url: promotion.oldUrl,
          reason: `candidate failed live check: ${checks[i].detail}`,
        });
      }
    });
    console.log(`\nLive check passed: ${verified.length}/${promotions.length}`);
  }

  for (const promotion of verified) {
    console.log(`${promotion.file}:\n  ${promotion.oldUrl}\n  -> ${promotion.newUrl}`);
    if (apply) {
      const content = fs.readFileSync(promotion.filePath, "utf-8");
      fs.writeFileSync(promotion.filePath, applyPromotion(content, promotion));
    }
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(researchPool, null, 2));
  console.log(
    `\n${apply ? "Applied" : "Would apply (dry run)"}: ${verified.length} promotions.` +
      ` Research pool: ${researchPool.length} entries -> ${reportPath}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

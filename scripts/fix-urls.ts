/**
 * Fix URLs Script
 *
 * Cleans up broken, redirected, and non-HTTPS URLs in YAML data files.
 * - Broken URLs (errors, 4xx, 5xx): removed from the file
 * - Redirected URLs: updated to the final destination
 * - Non-HTTPS URLs (with no redirect): removed
 *
 * Uses the URL cache from validate-urls for fast lookups.
 * Run `pnpm validate-urls --update-cache` first to populate the cache.
 *
 * Usage:
 *   pnpm tsx scripts/fix-urls.ts                # Dry run (show what would change)
 *   pnpm tsx scripts/fix-urls.ts --apply        # Apply changes
 *   pnpm tsx scripts/fix-urls.ts --apply --live # Check URLs live (ignore cache)
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { getCachedUrl, loadUrlCache, type UrlCache } from "./lib/url-cache.js";
import { DATA_DIR, getYamlFiles } from "./lib/utils.js";

// =============================================================================
// TYPES
// =============================================================================

interface UrlAction {
  field: string; // e.g. "website", "links[0].url", "versions[2].url"
  url: string;
  action: "remove" | "update";
  newUrl?: string;
  reason: string;
}

// =============================================================================
// URL CHECKING
// =============================================================================

const MAX_CONCURRENT = 10;

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function checkUrlLive(url: string): Promise<{
  broken: boolean;
  redirected: boolean;
  finalUrl?: string;
  reason: string;
  httpStatus?: number | "error";
}> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Racks-Catalog-Validator/1.0" },
    });

    if (response.status >= 400) {
      return {
        broken: true,
        redirected: false,
        reason: `HTTP ${response.status}`,
        httpStatus: response.status,
      };
    }
    if (response.url !== url) {
      return {
        broken: false,
        redirected: true,
        finalUrl: response.url,
        reason: "redirect",
        httpStatus: response.status,
      };
    }
    return { broken: false, redirected: false, reason: "ok", httpStatus: response.status };
  } catch {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Racks-Catalog-Validator/1.0" },
      });

      if (response.status >= 400) {
        return {
          broken: true,
          redirected: false,
          reason: `HTTP ${response.status}`,
          httpStatus: response.status,
        };
      }
      if (response.url !== url) {
        return {
          broken: false,
          redirected: true,
          finalUrl: response.url,
          reason: "redirect",
          httpStatus: response.status,
        };
      }
      return { broken: false, redirected: false, reason: "ok", httpStatus: response.status };
    } catch (error) {
      return {
        broken: true,
        redirected: false,
        reason: error instanceof Error ? error.message : "connection error",
        httpStatus: "error",
      };
    }
  }
}

// Only HTTP status codes that definitively indicate the resource is gone.
// Excludes: "error" (timeouts/DNS - unreliable), 403/405 (bot-blocking),
// 429 (rate-limiting), 5xx (server issues)
const GENUINELY_BROKEN_STATUSES = new Set([404, 410]);

function isGenuinelyBroken(status: number | "error"): boolean {
  if (typeof status === "number" && GENUINELY_BROKEN_STATUSES.has(status)) return true;
  return false;
}

/**
 * Clean up a redirect target URL:
 * - Strip tracking parameters (?v=...)
 * - Return null if redirect target is non-HTTPS (suspicious)
 * - Return null if redirect just adds a locale path to the same host
 */
function cleanRedirectTarget(originalUrl: string, redirectUrl: string): string | null {
  // Don't follow redirects to non-HTTPS
  if (redirectUrl.startsWith("http://")) return null;

  let cleaned = redirectUrl;

  // Clean up the redirect target
  try {
    const url = new URL(cleaned);
    // Strip tracking/noise params
    for (const param of ["v", "utm_source", "utm_medium", "utm_campaign", "lang", "R"]) {
      url.searchParams.delete(param);
    }
    cleaned = url.toString();
  } catch {
    // Invalid URL, skip
  }

  // If the cleaned URL is identical to the original (or differs only by trailing slash), skip
  const normalize = (u: string) => u.replace(/\/+$/, "");
  if (normalize(cleaned) === normalize(originalUrl)) return null;

  // Filter out trivial same-host redirects
  try {
    const orig = new URL(originalUrl);
    const target = new URL(cleaned);
    if (orig.hostname === target.hostname) {
      const origPath = orig.pathname.replace(/\/$/, "");
      const targetPath = target.pathname.replace(/\/$/, "");

      // Skip if redirect only adds a locale path segment
      const localeSuffixes = ["/en", "/en-US", "/en-us", "/de", "/ja", "/fr", "/es", "/it"];
      for (const suffix of localeSuffixes) {
        if (targetPath === `${origPath}${suffix}`) return null;
        if (origPath === "" && targetPath === suffix) return null;
      }

      // Skip if redirect just adds index.html or home
      if (targetPath === `${origPath}/index.html`) return null;
      if (targetPath === `${origPath}/home`) return null;
    }
  } catch {
    // URL parse error, proceed with cleaned URL
  }

  return cleaned;
}

function getUrlAction(url: string, field: string, cache: UrlCache | null): UrlAction | null {
  // Non-HTTPS URLs are removed unless they redirect to HTTPS
  const isHttp = url.startsWith("http://");

  if (cache) {
    const cached = getCachedUrl(cache, url);
    if (cached) {
      // Genuinely broken (404, 410)
      // Skip 403/405/429/5xx as these are usually bot-blocking or transient
      if (isGenuinelyBroken(cached.status)) {
        return {
          field,
          url,
          action: "remove",
          reason: `broken (${cached.status}${cached.errorMessage ? `: ${cached.errorMessage}` : ""})`,
        };
      }

      // Redirected
      if (cached.redirectsTo) {
        const cleanedTarget = cleanRedirectTarget(url, cached.redirectsTo);
        if (cleanedTarget) {
          return {
            field,
            url,
            action: "update",
            newUrl: cleanedTarget,
            reason: `redirects to ${cleanedTarget}`,
          };
        }
        // Redirect was filtered out (non-https, locale-only, tracking params)
        return null;
      }

      // Non-HTTPS with no redirect (working but insecure)
      if (isHttp) {
        return { field, url, action: "remove", reason: "non-https" };
      }

      // OK
      return null;
    }

    // Not in cache - if non-https, remove; otherwise skip (unknown state)
    if (isHttp) {
      return { field, url, action: "remove", reason: "non-https (not in cache)" };
    }
    return null;
  }

  // No cache available - only flag non-https
  if (isHttp) {
    return { field, url, action: "remove", reason: "non-https" };
  }
  return null;
}

// =============================================================================
// URL EXTRACTION
// =============================================================================

interface UrlLocation {
  field: string;
  url: string;
}

function extractUrlsWithPaths(data: Record<string, unknown>, prefix = ""): UrlLocation[] {
  const urls: UrlLocation[] = [];

  for (const [key, value] of Object.entries(data)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      if (
        (key === "url" || key === "website" || key === "source") &&
        (value.startsWith("http://") || value.startsWith("https://"))
      ) {
        urls.push({ field: fieldPath, url: value });
      }
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "object" && item !== null) {
          urls.push(...extractUrlsWithPaths(item as Record<string, unknown>, `${fieldPath}[${i}]`));
        }
      }
    } else if (typeof value === "object" && value !== null) {
      // Skip translations to avoid modifying localized content
      if (key === "translations") continue;
      urls.push(...extractUrlsWithPaths(value as Record<string, unknown>, fieldPath));
    }
  }

  return urls;
}

// =============================================================================
// FILE MODIFICATION
// =============================================================================

function applyActionsToContent(content: string, actions: UrlAction[]): string {
  let result = content;

  for (const action of actions) {
    if (action.action === "update" && action.newUrl) {
      // Simple string replacement of the URL
      result = result.replace(action.url, action.newUrl);
    } else if (action.action === "remove") {
      if (action.field === "website" || action.field === "source") {
        // Remove the entire line for top-level fields
        const regex = new RegExp(`^${action.field}:[ ]*${escapeRegex(action.url)}\\n?`, "m");
        result = result.replace(regex, "");
      } else if (action.field.match(/^links\[\d+\]\.url$/)) {
        // For link entries, remove the entire link object from the array
        // Find the link entry containing this URL and remove it
        result = removeLinkEntry(result, action.url);
      } else if (action.field.match(/\.url$/)) {
        // For nested url fields (like in versions), just remove the url line
        const regex = new RegExp(`^[ ]*url:[ ]*${escapeRegex(action.url)}\\n?`, "m");
        result = result.replace(regex, "");
      }
    }
  }

  return result;
}

function removeLinkEntry(content: string, url: string): string {
  const lines = content.split("\n");
  const urlLineIndex = lines.findIndex((line) => line.includes(url));

  if (urlLineIndex === -1) return content;

  // Find the start of this link entry (the line with "- " prefix at proper indent)
  let entryStart = urlLineIndex;
  const urlIndent = lines[urlLineIndex].search(/\S/);

  // Walk backwards to find the "- " marker for this array entry
  for (let i = urlLineIndex; i >= 0; i--) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("- ") && line.search(/\S/) < urlIndent) {
      entryStart = i;
      break;
    }
  }

  // Find the end of this link entry (next "- " at same indent or parent key)
  const entryIndent = lines[entryStart].search(/\S/);
  let entryEnd = entryStart;

  for (let i = entryStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const lineIndent = line.search(/\S/);
    if (lineIndent <= entryIndent) {
      break;
    }
    entryEnd = i;
  }

  // Remove the entry lines
  lines.splice(entryStart, entryEnd - entryStart + 1);

  // If the links array is now empty, remove the "links:" key too
  const result = lines.join("\n");
  // Check if links array has no entries left
  const linksMatch = result.match(/^links:\s*\n(?=\S|\n*$)/m);
  if (linksMatch) {
    return result.replace(/^links:\s*\n/m, "");
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// =============================================================================
// MAIN
// =============================================================================

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const useLive = args.includes("--live");

console.log(apply ? "Applying URL fixes..." : "Dry run (use --apply to write changes)");

// Load cache
const cache = useLive ? null : loadUrlCache();
if (cache) {
  const total = Object.keys(cache.entries).length;
  console.log(`Loaded URL cache with ${total} entries`);
}

// Get all YAML files
const files = [
  ...getYamlFiles(path.join(DATA_DIR, "manufacturers")),
  ...getYamlFiles(path.join(DATA_DIR, "software")),
  ...getYamlFiles(path.join(DATA_DIR, "hardware")),
];

console.log(`Processing ${files.length} files...\n`);

let totalRemoved = 0;
let totalUpdated = 0;
let filesModified = 0;

// Collect URLs that need live checking
const urlsToCheck: { url: string; field: string; file: string }[] = [];

for (const filePath of files) {
  const relativePath = path.relative(process.cwd(), filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    continue;
  }

  let data: Record<string, unknown>;
  try {
    data = parseYaml(content) as Record<string, unknown>;
  } catch {
    continue;
  }

  const urlLocations = extractUrlsWithPaths(data);
  if (urlLocations.length === 0) continue;

  const actions: UrlAction[] = [];

  for (const { field, url } of urlLocations) {
    if (useLive) {
      urlsToCheck.push({ url, field, file: filePath });
    } else {
      const action = getUrlAction(url, field, cache);
      if (action) actions.push(action);
    }
  }

  if (!useLive && actions.length > 0) {
    const removed = actions.filter((a) => a.action === "remove").length;
    const updated = actions.filter((a) => a.action === "update").length;
    totalRemoved += removed;
    totalUpdated += updated;
    filesModified++;

    console.log(`${relativePath}:`);
    for (const action of actions) {
      const icon = action.action === "remove" ? "  [-]" : "  [~]";
      const detail =
        action.action === "update"
          ? `${action.url} -> ${action.newUrl}`
          : `${action.url} (${action.reason})`;
      console.log(`${icon} ${action.field}: ${detail}`);
    }

    if (apply) {
      const newContent = applyActionsToContent(content, actions);
      fs.writeFileSync(filePath, newContent);
    }
  }
}

// Handle live checking mode
if (useLive && urlsToCheck.length > 0) {
  console.log(`Checking ${urlsToCheck.length} URLs live...\n`);

  const fileActionsMap = new Map<string, { actions: UrlAction[]; content: string }>();

  await runWithConcurrency(urlsToCheck, MAX_CONCURRENT, async (item) => {
    const result = await checkUrlLive(item.url);
    let action: UrlAction | null = null;

    if (result.broken && isGenuinelyBroken(result.httpStatus ?? "error")) {
      action = { field: item.field, url: item.url, action: "remove", reason: result.reason };
    } else if (result.redirected && result.finalUrl) {
      action = {
        field: item.field,
        url: item.url,
        action: "update",
        newUrl: result.finalUrl,
        reason: result.reason,
      };
    } else if (item.url.startsWith("http://")) {
      action = { field: item.field, url: item.url, action: "remove", reason: "non-https" };
    }

    if (action) {
      if (!fileActionsMap.has(item.file)) {
        const content = fs.readFileSync(item.file, "utf-8");
        fileActionsMap.set(item.file, { actions: [], content });
      }
      fileActionsMap.get(item.file)?.actions.push(action);
    }
  });

  for (const [filePath, { actions, content }] of fileActionsMap) {
    const relativePath = path.relative(process.cwd(), filePath);
    const removed = actions.filter((a) => a.action === "remove").length;
    const updated = actions.filter((a) => a.action === "update").length;
    totalRemoved += removed;
    totalUpdated += updated;
    filesModified++;

    console.log(`${relativePath}:`);
    for (const action of actions) {
      const icon = action.action === "remove" ? "  [-]" : "  [~]";
      const detail =
        action.action === "update"
          ? `${action.url} -> ${action.newUrl}`
          : `${action.url} (${action.reason})`;
      console.log(`${icon} ${action.field}: ${detail}`);
    }

    if (apply) {
      const newContent = applyActionsToContent(content, actions);
      fs.writeFileSync(filePath, newContent);
    }
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`Summary:`);
console.log(`  Files modified: ${filesModified}`);
console.log(`  URLs removed:   ${totalRemoved}`);
console.log(`  URLs updated:   ${totalUpdated}`);
if (!apply) {
  console.log(`\nRun with --apply to write changes.`);
}

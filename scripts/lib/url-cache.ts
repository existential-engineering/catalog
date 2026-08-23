/**
 * URL Cache Module
 *
 * Provides caching for URL validation results to avoid
 * repeated checks and rate limiting issues.
 */

import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./utils.js";

// =============================================================================
// TYPES
// =============================================================================

export interface UrlCacheEntry {
  /** The URL that was checked */
  url: string;
  /** ISO timestamp of when the check was performed */
  lastChecked: string;
  /** HTTP status code or "error" for network failures */
  status: number | "error";
  /** Error message if status is "error" */
  errorMessage?: string;
  /** Redirect destination if status is 3xx */
  redirectsTo?: string;
  /** TTL in days for this entry */
  ttlDays: number;
}

export interface UrlCache {
  /** Cache format version */
  version: 1;
  /** Cache entries keyed by URL */
  entries: Record<string, UrlCacheEntry>;
  /** ISO timestamp of last cache update */
  lastUpdated: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_FILE = path.join(REPO_ROOT, ".github", "url-cache.json");

/** TTL in days based on response status */
export const TTL_BY_STATUS = {
  /** Successful responses - cache for 7 days */
  success: 7,
  /** Redirects - cache for 3 days (may update) */
  redirect: 3,
  /** Client errors (4xx) - cache for 1 day */
  clientError: 1,
  /** Server errors (5xx) - cache for 1 day */
  serverError: 1,
  /** Network errors - cache for 6 hours (0.25 days) */
  networkError: 0.25,
};

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Load the URL cache from disk
 */
export function loadUrlCache(): UrlCache {
  if (!fs.existsSync(CACHE_FILE)) {
    return createEmptyCache();
  }

  try {
    const content = fs.readFileSync(CACHE_FILE, "utf-8");
    const parsed: unknown = JSON.parse(content);

    // Validate cache version
    if (!isPlainObject(parsed) || parsed.version !== 1) {
      console.warn("URL cache version mismatch, creating new cache");
      return createEmptyCache();
    }

    // A correct version is not proof of a correct shape: a truncated or
    // hand-edited file can carry `version: 1` with no `entries`, which
    // used to reach every consumer as a TypeError on first lookup.
    if (!isPlainObject(parsed.entries)) {
      console.warn("URL cache is missing its entries map, creating new cache");
      return createEmptyCache();
    }

    // Drop only the malformed entries. Discarding the whole file over one
    // bad row would re-check every URL in the dataset, which is the cost
    // this cache exists to avoid.
    //
    // Null-prototype, because the keys come from a file: assigning a
    // "__proto__" key onto a normal object swaps that object's prototype
    // instead of storing a row, so the entry vanishes and the map
    // silently inherits whatever the file supplied.
    const entries: Record<string, UrlCacheEntry> = Object.create(null);
    let dropped = 0;
    for (const [url, entry] of Object.entries(parsed.entries)) {
      // The key is the lookup identity and `entry.url` is what consumers
      // report, so a row filed under a different URL than it names would
      // report the wrong URL as broken.
      if (isUrlCacheEntry(entry) && entry.url === url) {
        entries[url] = entry;
      } else {
        dropped++;
      }
    }
    if (dropped > 0) {
      console.warn(
        `URL cache: dropped ${dropped} malformed ${dropped === 1 ? "entry" : "entries"}`
      );
    }

    return {
      version: 1,
      entries,
      lastUpdated:
        typeof parsed.lastUpdated === "string" ? parsed.lastUpdated : new Date().toISOString(),
    };
  } catch {
    console.warn("Failed to load URL cache, creating new cache");
    return createEmptyCache();
  }
}

/**
 * Save the URL cache to disk
 */
export function saveUrlCache(cache: UrlCache): void {
  // Ensure .github directory exists
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  cache.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

/**
 * Create an empty cache
 */
function createEmptyCache(): UrlCache {
  return {
    version: 1,
    entries: Object.create(null),
    lastUpdated: new Date().toISOString(),
  };
}

// =============================================================================
// EXPIRY
// =============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Age of an entry in days, or `Infinity` when its timestamp cannot be
 * trusted.
 *
 * Both untrustworthy cases resolve to "expired" deliberately. An
 * unparsable `lastChecked` yields `NaN`, and every comparison against
 * `NaN` is false, so the entry read as permanently fresh: never served
 * from a recheck, never pruned, and immortal in the stats. A timestamp
 * in the future (a skewed clock on whichever machine last wrote the
 * shared cache file) is immortal the same way, just more slowly.
 *
 * Expiring is the safe direction for a cache. The only cost is one
 * redundant HTTP check, which rewrites `lastChecked` with a local clock
 * and heals the entry; the alternative is pinning a wrong result with
 * nothing able to clear it.
 */
export function entryAgeDays(lastChecked: string, now: Date = new Date()): number {
  const checked = new Date(lastChecked).getTime();
  if (!Number.isFinite(checked)) return Number.POSITIVE_INFINITY;

  const days = (now.getTime() - checked) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(days) || days < 0) return Number.POSITIVE_INFINITY;

  return days;
}

/**
 * True when an entry has outlived its TTL, or carries a timestamp or TTL
 * we cannot trust.
 *
 * The TTL needs the same guard the timestamp got, for the same reason:
 * `age > undefined` is false, so an entry carrying no `ttlDays` read as
 * permanently fresh exactly the way a NaN age did.
 */
export function isExpired(entry: UrlCacheEntry, now: Date = new Date()): boolean {
  if (!isPlainObject(entry)) return true;
  const { ttlDays } = entry;
  if (typeof ttlDays !== "number" || !Number.isFinite(ttlDays)) return true;
  return entryAgeDays(entry.lastChecked, now) > ttlDays;
}

/**
 * A cache file is hand-editable and outlives any single run, so an entry
 * can be any shape by the time it is read back. Anything that would
 * reach the expiry maths as `undefined` or `null` is rejected at the
 * boundary, rather than defended against at each of the four consumers.
 */
export function isUrlCacheEntry(value: unknown): value is UrlCacheEntry {
  return (
    isPlainObject(value) &&
    typeof value.url === "string" &&
    typeof value.lastChecked === "string" &&
    (typeof value.status === "number" || value.status === "error") &&
    typeof value.ttlDays === "number" &&
    Number.isFinite(value.ttlDays)
  );
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Get a cached URL entry if it exists and is not expired
 */
export function getCachedUrl(cache: UrlCache, url: string): UrlCacheEntry | null {
  // `entries` comes from JSON.parse, so a plain member lookup walks
  // Object.prototype: a url of "constructor" or "toString" would resolve
  // to a prototype member and be handed back as a cache entry.
  const entry = Object.hasOwn(cache.entries, url) ? cache.entries[url] : undefined;
  if (!entry) {
    return null;
  }

  if (isExpired(entry)) {
    return null; // Expired
  }

  return entry;
}

/**
 * Set a cached URL entry
 */
export function setCachedUrl(
  cache: UrlCache,
  url: string,
  status: number | "error",
  options?: {
    errorMessage?: string;
    redirectsTo?: string;
  }
): void {
  const ttlDays = getTtlForStatus(status);

  cache.entries[url] = {
    url,
    lastChecked: new Date().toISOString(),
    status,
    ttlDays,
    errorMessage: options?.errorMessage,
    redirectsTo: options?.redirectsTo,
  };
}

/**
 * Get TTL in days for a given status
 */
function getTtlForStatus(status: number | "error"): number {
  if (status === "error") {
    return TTL_BY_STATUS.networkError;
  }

  if (status >= 200 && status < 300) {
    return TTL_BY_STATUS.success;
  }

  if (status >= 300 && status < 400) {
    return TTL_BY_STATUS.redirect;
  }

  if (status >= 400 && status < 500) {
    return TTL_BY_STATUS.clientError;
  }

  return TTL_BY_STATUS.serverError;
}

/**
 * Remove expired entries from the cache
 */
export function pruneExpiredEntries(cache: UrlCache): number {
  const now = new Date();
  let removed = 0;

  for (const [url, entry] of Object.entries(cache.entries)) {
    if (isExpired(entry, now)) {
      delete cache.entries[url];
      removed++;
    }
  }

  return removed;
}

/**
 * Get cache statistics
 */
export function getCacheStats(cache: UrlCache): {
  totalEntries: number;
  successCount: number;
  errorCount: number;
  redirectCount: number;
  expiredCount: number;
} {
  const now = new Date();
  let successCount = 0;
  let errorCount = 0;
  let redirectCount = 0;
  let expiredCount = 0;

  for (const entry of Object.values(cache.entries)) {
    if (isExpired(entry, now)) {
      expiredCount++;
      continue;
    }

    if (entry.status === "error") {
      errorCount++;
    } else if (entry.status >= 200 && entry.status < 300) {
      successCount++;
    } else if (entry.status >= 300 && entry.status < 400) {
      redirectCount++;
    } else {
      errorCount++;
    }
  }

  return {
    totalEntries: Object.keys(cache.entries).length,
    successCount,
    errorCount,
    redirectCount,
    expiredCount,
  };
}

/**
 * Check if a URL should be rechecked (not in cache or expired)
 */
export function shouldRecheck(cache: UrlCache, url: string): boolean {
  return getCachedUrl(cache, url) === null;
}

/**
 * Get all broken URLs from the cache (non-expired entries with error status)
 */
export function getBrokenUrls(cache: UrlCache): UrlCacheEntry[] {
  const now = new Date();
  const broken: UrlCacheEntry[] = [];

  for (const entry of Object.values(cache.entries)) {
    // Skip expired entries
    if (isExpired(entry, now)) {
      continue;
    }

    // Include errors and 4xx/5xx status codes
    if (entry.status === "error" || (typeof entry.status === "number" && entry.status >= 400)) {
      broken.push(entry);
    }
  }

  return broken;
}

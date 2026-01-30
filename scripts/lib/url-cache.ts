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
    const cache = JSON.parse(content) as UrlCache;

    // Validate cache version
    if (cache.version !== 1) {
      console.warn("URL cache version mismatch, creating new cache");
      return createEmptyCache();
    }

    return cache;
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
    entries: {},
    lastUpdated: new Date().toISOString(),
  };
}

// =============================================================================
// CACHE OPERATIONS
// =============================================================================

/**
 * Get a cached URL entry if it exists and is not expired
 */
export function getCachedUrl(cache: UrlCache, url: string): UrlCacheEntry | null {
  const entry = cache.entries[url];
  if (!entry) {
    return null;
  }

  // Check if entry has expired
  const lastChecked = new Date(entry.lastChecked);
  const now = new Date();
  const daysSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCheck > entry.ttlDays) {
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
    const lastChecked = new Date(entry.lastChecked);
    const daysSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCheck > entry.ttlDays) {
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
    const lastChecked = new Date(entry.lastChecked);
    const daysSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCheck > entry.ttlDays) {
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
    const lastChecked = new Date(entry.lastChecked);
    const daysSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

    // Skip expired entries
    if (daysSinceCheck > entry.ttlDays) {
      continue;
    }

    // Include errors and 4xx/5xx status codes
    if (entry.status === "error" || (typeof entry.status === "number" && entry.status >= 400)) {
      broken.push(entry);
    }
  }

  return broken;
}

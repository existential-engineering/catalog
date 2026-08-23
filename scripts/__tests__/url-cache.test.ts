import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  entryAgeDays,
  getBrokenUrls,
  getCachedUrl,
  getCacheStats,
  isExpired,
  isUrlCacheEntry,
  pruneExpiredEntries,
  setCachedUrl,
  shouldRecheck,
  TTL_BY_STATUS,
  type UrlCache,
  type UrlCacheEntry,
} from "../lib/url-cache.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

// The expiry helpers default to the system clock, so every "fresh entry"
// assertion below is relative to a pinned NOW rather than the wall clock.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

/** `daysAgo` days before NOW, as an ISO string. */
function ago(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function entry(overrides: Partial<UrlCacheEntry> = {}): UrlCacheEntry {
  return {
    url: "https://example.test/product",
    lastChecked: ago(0),
    status: 200,
    ttlDays: TTL_BY_STATUS.success,
    ...overrides,
  };
}

function cacheOf(...entries: UrlCacheEntry[]): UrlCache {
  return {
    version: 1,
    entries: Object.fromEntries(entries.map((e) => [e.url, e])),
    lastUpdated: NOW.toISOString(),
  };
}

describe("entryAgeDays", () => {
  it("measures age in days against the supplied clock", () => {
    expect(entryAgeDays(ago(3), NOW)).toBeCloseTo(3, 10);
    expect(entryAgeDays(ago(0), NOW)).toBeCloseTo(0, 10);
  });

  it("reports an unparsable timestamp as infinitely old", () => {
    // NaN arithmetic made every comparison false, so an entry with a
    // corrupt timestamp read as permanently fresh.
    expect(entryAgeDays("not-a-date", NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(entryAgeDays("", NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it("reports a future timestamp as infinitely old", () => {
    // A skewed clock on whichever machine wrote the shared cache file
    // must not mint an entry that can never age out.
    expect(entryAgeDays(ago(-5), NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isExpired", () => {
  it("keeps an entry inside its TTL", () => {
    expect(isExpired(entry({ lastChecked: ago(6), ttlDays: 7 }), NOW)).toBe(false);
  });

  it("expires an entry past its TTL", () => {
    expect(isExpired(entry({ lastChecked: ago(8), ttlDays: 7 }), NOW)).toBe(true);
  });

  it("expires entries whose timestamp cannot be trusted", () => {
    expect(isExpired(entry({ lastChecked: "not-a-date" }), NOW)).toBe(true);
    expect(isExpired(entry({ lastChecked: ago(-5) }), NOW)).toBe(true);
  });

  it("honours the short network-error TTL", () => {
    const netErr = {
      lastChecked: ago(0.5),
      status: "error" as const,
      ttlDays: TTL_BY_STATUS.networkError,
    };
    expect(isExpired(entry(netErr), NOW)).toBe(true);
    expect(isExpired(entry({ ...netErr, lastChecked: ago(0.1) }), NOW)).toBe(false);
  });
});

describe("getCachedUrl", () => {
  it("returns a fresh entry", () => {
    const cache = cacheOf(entry());
    expect(getCachedUrl(cache, "https://example.test/product")?.status).toBe(200);
  });

  it("returns null for an unknown url", () => {
    expect(getCachedUrl(cacheOf(), "https://nope.test")).toBeNull();
  });

  it("returns null rather than an entry with a corrupt timestamp", () => {
    const cache = cacheOf(entry({ lastChecked: "not-a-date" }));
    expect(getCachedUrl(cache, "https://example.test/product")).toBeNull();
  });

  it("does not treat a url as a prototype lookup", () => {
    // Entries are keyed by raw url, so a url colliding with an
    // Object.prototype member must not resolve to the prototype's value.
    expect(getCachedUrl(cacheOf(), "constructor")).toBeNull();
    expect(getCachedUrl(cacheOf(), "toString")).toBeNull();
  });
});

describe("shouldRecheck", () => {
  it("is false only while a trustworthy entry is fresh", () => {
    expect(shouldRecheck(cacheOf(entry()), "https://example.test/product")).toBe(false);
    expect(shouldRecheck(cacheOf(), "https://example.test/product")).toBe(true);
    expect(
      shouldRecheck(cacheOf(entry({ lastChecked: "not-a-date" })), "https://example.test/product")
    ).toBe(true);
  });
});

describe("setCachedUrl", () => {
  it.each([
    [200, TTL_BY_STATUS.success],
    [204, TTL_BY_STATUS.success],
    [301, TTL_BY_STATUS.redirect],
    [404, TTL_BY_STATUS.clientError],
    [500, TTL_BY_STATUS.serverError],
    ["error" as const, TTL_BY_STATUS.networkError],
  ])("derives the TTL for %s", (status, ttl) => {
    const cache = cacheOf();
    setCachedUrl(cache, "https://example.test/a", status);
    expect(cache.entries["https://example.test/a"]?.ttlDays).toBe(ttl);
  });

  it("records redirect destinations and error messages", () => {
    const cache = cacheOf();
    setCachedUrl(cache, "https://example.test/a", 301, { redirectsTo: "https://example.test/b" });
    setCachedUrl(cache, "https://example.test/c", "error", { errorMessage: "ENOTFOUND" });
    expect(cache.entries["https://example.test/a"]?.redirectsTo).toBe("https://example.test/b");
    expect(cache.entries["https://example.test/c"]?.errorMessage).toBe("ENOTFOUND");
  });

  it("overwrites an existing entry rather than accumulating", () => {
    const cache = cacheOf(entry({ status: 500 }));
    setCachedUrl(cache, "https://example.test/product", 200);
    expect(Object.keys(cache.entries)).toHaveLength(1);
    expect(cache.entries["https://example.test/product"]?.status).toBe(200);
  });
});

describe("pruneExpiredEntries", () => {
  it("removes expired entries and reports the count", () => {
    const cache = cacheOf(
      entry({ url: "https://a.test", lastChecked: ago(30), ttlDays: 7 }),
      entry({ url: "https://b.test", lastChecked: ago(1), ttlDays: 7 })
    );
    expect(pruneExpiredEntries(cache)).toBe(1);
    expect(Object.keys(cache.entries)).toEqual(["https://b.test"]);
  });

  it("prunes entries with untrustworthy timestamps", () => {
    // These previously survived every prune, growing the committed
    // cache file with entries nothing could ever clear.
    const cache = cacheOf(
      entry({ url: "https://a.test", lastChecked: "not-a-date" }),
      entry({ url: "https://b.test", lastChecked: ago(-5) })
    );
    expect(pruneExpiredEntries(cache)).toBe(2);
    expect(Object.keys(cache.entries)).toEqual([]);
  });
});

describe("getCacheStats", () => {
  it("classifies entries by status and counts expired separately", () => {
    const cache = cacheOf(
      entry({ url: "https://ok.test", status: 200 }),
      entry({ url: "https://redir.test", status: 302, ttlDays: TTL_BY_STATUS.redirect }),
      entry({ url: "https://missing.test", status: 404, ttlDays: TTL_BY_STATUS.clientError }),
      entry({ url: "https://net.test", status: "error", ttlDays: TTL_BY_STATUS.networkError }),
      entry({ url: "https://stale.test", lastChecked: ago(90), ttlDays: 7 })
    );
    expect(getCacheStats(cache)).toEqual({
      totalEntries: 5,
      successCount: 1,
      redirectCount: 1,
      errorCount: 2,
      expiredCount: 1,
    });
  });

  it("counts an untrustworthy timestamp as expired, not as fresh", () => {
    const cache = cacheOf(entry({ lastChecked: "not-a-date", status: 200 }));
    expect(getCacheStats(cache)).toMatchObject({ successCount: 0, expiredCount: 1 });
  });
});

describe("getBrokenUrls", () => {
  it("returns 4xx, 5xx and network errors, but not successes", () => {
    const cache = cacheOf(
      entry({ url: "https://ok.test", status: 200 }),
      entry({ url: "https://redir.test", status: 302, ttlDays: TTL_BY_STATUS.redirect }),
      entry({ url: "https://missing.test", status: 404, ttlDays: TTL_BY_STATUS.clientError }),
      entry({ url: "https://boom.test", status: 503, ttlDays: TTL_BY_STATUS.serverError }),
      entry({ url: "https://net.test", status: "error", ttlDays: TTL_BY_STATUS.networkError })
    );
    expect(
      getBrokenUrls(cache)
        .map((e) => e.url)
        .sort()
    ).toEqual(["https://boom.test", "https://missing.test", "https://net.test"]);
  });

  it("skips expired entries so a stale 404 is not reported as broken", () => {
    const cache = cacheOf(entry({ status: 404, lastChecked: ago(90), ttlDays: 1 }));
    expect(getBrokenUrls(cache)).toEqual([]);
  });

  it("skips entries with untrustworthy timestamps", () => {
    const cache = cacheOf(entry({ status: 404, lastChecked: "not-a-date" }));
    expect(getBrokenUrls(cache)).toEqual([]);
  });
});

describe("malformed entries", () => {
  it("treats a missing ttlDays as expired, not as permanently fresh", () => {
    // Same immortality bug as a NaN age, reached through the other
    // operand: `age > undefined` is false for every age.
    const noTtl = { url: "u", lastChecked: ago(0), status: 404 } as unknown as UrlCacheEntry;
    expect(isExpired(noTtl, NOW)).toBe(true);
    expect(isExpired({ ...noTtl, lastChecked: ago(9999) } as UrlCacheEntry, NOW)).toBe(true);
  });

  it("treats a non-numeric or non-finite ttlDays as expired", () => {
    const base = { url: "u", lastChecked: ago(0), status: 404 };
    expect(isExpired({ ...base, ttlDays: "7" } as unknown as UrlCacheEntry, NOW)).toBe(true);
    expect(isExpired({ ...base, ttlDays: Number.NaN } as UrlCacheEntry, NOW)).toBe(true);
  });

  it("treats a null entry as expired instead of throwing", () => {
    expect(isExpired(null as unknown as UrlCacheEntry, NOW)).toBe(true);
  });

  it("does not throw when maintenance walks a null entry", () => {
    const cache = {
      version: 1,
      entries: { "https://a.test": null as unknown as UrlCacheEntry },
      lastUpdated: NOW.toISOString(),
    } as UrlCache;
    expect(() => pruneExpiredEntries(cache)).not.toThrow();
    expect(() => getCacheStats(cache)).not.toThrow();
    expect(() => getBrokenUrls(cache)).not.toThrow();
  });
});

describe("isUrlCacheEntry", () => {
  it("accepts a well-formed entry with either status shape", () => {
    expect(isUrlCacheEntry(entry())).toBe(true);
    expect(isUrlCacheEntry(entry({ status: "error", ttlDays: 0.25 }))).toBe(true);
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "nope"],
    ["a missing url", { lastChecked: ago(0), status: 200, ttlDays: 7 }],
    ["a missing lastChecked", { url: "u", status: 200, ttlDays: 7 }],
    ["a missing ttlDays", { url: "u", lastChecked: ago(0), status: 200 }],
    ["a non-finite ttlDays", { url: "u", lastChecked: ago(0), status: 200, ttlDays: Number.NaN }],
    ["an unknown status", { url: "u", lastChecked: ago(0), status: "weird", ttlDays: 7 }],
  ])("rejects %s", (_label, value) => {
    expect(isUrlCacheEntry(value)).toBe(false);
  });
});

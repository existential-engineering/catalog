/**
 * URL Validation Script
 *
 * Validates all URLs in YAML catalog files.
 * Can validate all files or only changed files (for PR reviews).
 *
 * Usage:
 *   pnpm validate-urls                              # Validate all files
 *   pnpm validate-urls --changed-only --base <sha>  # Validate only changed files
 *   pnpm validate-urls --use-cache                  # Use cached results
 *   pnpm validate-urls --update-cache               # Update cache with results
 *   pnpm validate-urls --ignore-cache               # Force recheck all URLs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { DATA_DIR, getYamlFiles } from "./lib/utils.js";
import {
  loadUrlCache,
  saveUrlCache,
  getCachedUrl,
  setCachedUrl,
  getCacheStats,
  pruneExpiredEntries,
  type UrlCache,
} from "./lib/url-cache.js";

const MAX_CONCURRENT_REQUESTS = 10;
const MAX_CONCURRENT_FILES = 5;

// Run async tasks with a concurrency limit
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

interface UrlCheckResult {
  url: string;
  status: number | "error" | "format_error";
  redirected: boolean;
  finalUrl?: string;
  error?: string;
}

// =============================================================================
// YOUTUBE URL FORMAT VALIDATION
// =============================================================================

// Canonical YouTube URL format: https://www.youtube.com/watch?v={videoId}
const YOUTUBE_CANONICAL_PATTERN = /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]+$/;

// Pre-flight check for YouTube URL format (no network request needed)
function validateYouTubeUrlFormat(url: string): { valid: boolean; error?: string } {
  // Parse the URL to check the hostname
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // If the URL cannot be parsed, treat it as not a YouTube URL for this format check
    return { valid: true };
  }

  const hostname = parsed.hostname.toLowerCase();
  const youtubeHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
  ]);

  if (!youtubeHosts.has(hostname)) {
    return { valid: true }; // Not a YouTube URL, skip
  }

  // Check for non-www YouTube URLs (youtube.com or m.youtube.com)
  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    return {
      valid: false,
      error: `YouTube URL should use 'www.youtube.com' instead of '${hostname}'`,
    };
  }

  // Check for embed URLs
  if (parsed.pathname.startsWith("/embed/")) {
    return {
      valid: false,
      error: `YouTube URL should use '/watch?v=' format instead of '/embed/'`,
    };
  }

  // Check for youtu.be short URLs
  if (hostname === "youtu.be") {
    return {
      valid: false,
      error: `YouTube URL should use 'www.youtube.com/watch?v=' format instead of 'youtu.be'`,
    };
  }

  // Verify it matches the canonical pattern
  if (!YOUTUBE_CANONICAL_PATTERN.test(url)) {
    return {
      valid: false,
      error: `YouTube URL should match format 'https://www.youtube.com/watch?v={videoId}'`,
    };
  }

  return { valid: true };
}

interface FileResult {
  file: string;
  urls: UrlCheckResult[];
}

interface ValidationResult {
  valid: boolean;
  results: FileResult[];
  stats: {
    filesChecked: number;
    urlsChecked: number;
    broken: number;
    redirected: number;
  };
}

// Parse command line arguments
interface ParsedArgs {
  changedOnly: boolean;
  baseSha?: string;
  useCache: boolean;
  updateCache: boolean;
  ignoreCache: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const changedOnly = args.includes("--changed-only");
  const baseIndex = args.indexOf("--base");
  const baseSha = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
  const useCache = args.includes("--use-cache");
  const updateCache = args.includes("--update-cache");
  const ignoreCache = args.includes("--ignore-cache");

  return { changedOnly, baseSha, useCache, updateCache, ignoreCache };
}

// Get list of changed YAML files in data/
function getChangedFiles(baseSha: string): string[] {
  // Validate SHA format to prevent command injection
  if (!/^[a-f0-9]{7,40}$/i.test(baseSha)) {
    console.error(`Invalid git SHA format: ${baseSha}`);
    return [];
  }

  try {
    const output = execSync(`git diff --name-only ${baseSha} HEAD`, {
      encoding: "utf-8",
    });

    return output
      .split("\n")
      .filter((f) => f.match(/^data\/(software|hardware|manufacturers)\/.*\.yaml$/))
      .map((f) => path.join(process.cwd(), f))
      .filter((f) => fs.existsSync(f));
  } catch (error) {
    console.error("Failed to get changed files:", error);
    return [];
  }
}

// Extract all URLs from a parsed YAML object
function extractUrls(data: Record<string, unknown>): string[] {
  const urls: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      // Check if this is a URL field
      if (key === "url" || key === "website" || key === "source") {
        if (value.startsWith("http://") || value.startsWith("https://")) {
          urls.push(value);
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          urls.push(...extractUrls(item as Record<string, unknown>));
        }
      }
    } else if (typeof value === "object" && value !== null) {
      urls.push(...extractUrls(value as Record<string, unknown>));
    }
  }

  return urls;
}

// Check a single URL (with optional cache support)
async function checkUrl(
  url: string,
  options?: {
    cache?: UrlCache;
    useCache?: boolean;
    updateCache?: boolean;
  }
): Promise<UrlCheckResult> {
  // Pre-flight check for YouTube URL format (no network request needed)
  const formatCheck = validateYouTubeUrlFormat(url);
  if (!formatCheck.valid) {
    return {
      url,
      status: "format_error",
      redirected: false,
      error: formatCheck.error,
    };
  }

  // Check cache if enabled
  if (options?.useCache && options.cache) {
    const cached = getCachedUrl(options.cache, url);
    if (cached) {
      return {
        url,
        status: cached.status === "error" ? "error" : cached.status,
        redirected: !!cached.redirectsTo,
        finalUrl: cached.redirectsTo,
        error: cached.errorMessage,
      };
    }
  }

  let result: UrlCheckResult;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Racks-Catalog-Validator/1.0",
      },
    });

    const redirected = response.url !== url;

    result = {
      url,
      status: response.status,
      redirected,
      finalUrl: redirected ? response.url : undefined,
    };
  } catch {
    // Try GET request as fallback (some servers don't support HEAD)
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Racks-Catalog-Validator/1.0",
        },
      });

      const redirected = response.url !== url;

      result = {
        url,
        status: response.status,
        redirected,
        finalUrl: redirected ? response.url : undefined,
      };
    } catch (getError) {
      result = {
        url,
        status: "error",
        redirected: false,
        error: getError instanceof Error ? getError.message : String(getError),
      };
    }
  }

  // Update cache if enabled
  if (options?.updateCache && options.cache) {
    const status = result.status === "format_error" ? "error" : result.status;
    setCachedUrl(options.cache, url, status, {
      errorMessage: result.error,
      redirectsTo: result.finalUrl,
    });
  }

  return result;
}

// Process a single file
async function processFile(
  filePath: string,
  options?: {
    cache?: UrlCache;
    useCache?: boolean;
    updateCache?: boolean;
  }
): Promise<FileResult> {
  const relativePath = path.relative(process.cwd(), filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    return {
      file: relativePath,
      urls: [
        {
          url: "(file read error)",
          status: "error",
          redirected: false,
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  let data: Record<string, unknown>;
  try {
    data = parseYaml(content) as Record<string, unknown>;
  } catch (error) {
    return {
      file: relativePath,
      urls: [
        {
          url: "(yaml parse error)",
          status: "error",
          redirected: false,
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  const urls = [...new Set(extractUrls(data))]; // Dedupe URLs
  const results = await runWithConcurrency(urls, MAX_CONCURRENT_REQUESTS, (url) =>
    checkUrl(url, options)
  );

  return {
    file: relativePath,
    urls: results,
  };
}

// Main validation function
async function validate(
  changedOnly: boolean,
  baseSha?: string,
  cacheOptions?: {
    useCache: boolean;
    updateCache: boolean;
    ignoreCache: boolean;
  }
): Promise<ValidationResult> {
  let files: string[];

  if (changedOnly && baseSha) {
    files = getChangedFiles(baseSha);
    if (files.length === 0) {
      console.warn(
        `Warning: No changed YAML files found between ${baseSha} and HEAD.\n` +
          `This may indicate an issue with the base SHA or git configuration.`
      );
    }
    console.log(`Checking ${files.length} changed file(s)...`);
  } else {
    // Get all YAML files
    files = [
      ...getYamlFiles(path.join(DATA_DIR, "manufacturers")),
      ...getYamlFiles(path.join(DATA_DIR, "software")),
      ...getYamlFiles(path.join(DATA_DIR, "hardware")),
    ];
    console.log(`Checking ${files.length} file(s)...`);
  }

  // Load cache if needed
  let cache: UrlCache | undefined;
  const useCache = cacheOptions?.useCache && !cacheOptions?.ignoreCache;
  const updateCache = cacheOptions?.updateCache;

  if (useCache || updateCache) {
    cache = loadUrlCache();
    if (useCache) {
      const stats = getCacheStats(cache);
      console.log(
        `Cache loaded: ${stats.totalEntries} entries (${stats.successCount} valid, ${stats.expiredCount} expired)`
      );
    }
  }

  const results = await runWithConcurrency(files, MAX_CONCURRENT_FILES, (file) =>
    processFile(file, { cache, useCache, updateCache })
  );

  let totalUrls = 0;
  let brokenCount = 0;
  let redirectCount = 0;

  for (const fileResult of results) {
    for (const urlResult of fileResult.urls) {
      totalUrls++;

      if (urlResult.status === "error" || urlResult.status === "format_error" || (typeof urlResult.status === "number" && urlResult.status >= 400)) {
        brokenCount++;
      } else if (urlResult.redirected) {
        redirectCount++;
      }
    }
  }

  // Save cache if updating
  if (updateCache && cache) {
    const pruned = pruneExpiredEntries(cache);
    if (pruned > 0) {
      console.log(`Pruned ${pruned} expired cache entries`);
    }
    saveUrlCache(cache);
    console.log(`Cache saved with ${Object.keys(cache.entries).length} entries`);
  }

  return {
    valid: brokenCount === 0,
    results,
    stats: {
      filesChecked: files.length,
      urlsChecked: totalUrls,
      broken: brokenCount,
      redirected: redirectCount,
    },
  };
}

// Write GitHub Actions summary
function escapeMarkdownCell(value: string | undefined | null): string {
  if (value == null) {
    return "";
  }
  // Escape backslashes first, then pipe characters used in Markdown tables.
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function writeGitHubSummary(result: ValidationResult): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  let summary = "";

  if (result.valid) {
    summary += `## URL Validation Passed\n\n`;
    summary += `All ${result.stats.urlsChecked} URL(s) are valid!\n\n`;
  } else {
    summary += `## URL Validation Failed\n\n`;
    summary += `Found ${result.stats.broken} broken URL(s).\n\n`;
  }

  // Show broken URLs
  const broken = result.results.flatMap((r) =>
    r.urls
      .filter((u) => u.status === "error" || u.status === "format_error" || (typeof u.status === "number" && u.status >= 400))
      .map((u) => ({ file: r.file, ...u }))
  );

  if (broken.length > 0) {
    summary += `### Broken URLs\n\n`;
    summary += `| File | URL | Status |\n`;
    summary += `|------|-----|--------|\n`;
    for (const item of broken) {
      const status =
        item.status === "error" || item.status === "format_error"
          ? `Error: ${escapeMarkdownCell(item.error)}`
          : String(item.status);
      summary += `| \`${item.file}\` | \`${escapeMarkdownCell(String(item.url))}\` | ${escapeMarkdownCell(status)} |\n`;
    }
    summary += "\n";
  }

  // Show redirects
  const redirects = result.results.flatMap((r) =>
    r.urls.filter((u) => u.redirected).map((u) => ({ file: r.file, ...u }))
  );

  if (redirects.length > 0) {
    summary += `### Redirected URLs (${redirects.length})\n\n`;
    summary += `| File | Original URL | Redirects To |\n`;
    summary += `|------|--------------|---------------|\n`;
    for (const item of redirects) {
      summary += `| \`${item.file}\` | \`${escapeMarkdownCell(String(item.url))}\` | \`${escapeMarkdownCell(String(item.finalUrl))}\` |\n`;
    }
    summary += "\n";
  }

  summary += `### Stats\n\n`;
  summary += `- Files checked: ${result.stats.filesChecked}\n`;
  summary += `- URLs checked: ${result.stats.urlsChecked}\n`;
  summary += `- Broken: ${result.stats.broken}\n`;
  summary += `- Redirected: ${result.stats.redirected}\n`;

  fs.appendFileSync(summaryPath, summary);
}

// Console output
function writeConsoleOutput(result: ValidationResult): void {
  console.log("\nURL Validation Results\n");
  console.log("-".repeat(50));

  if (result.valid) {
    console.log(`All ${result.stats.urlsChecked} URL(s) are valid!\n`);
  } else {
    console.log(`Found ${result.stats.broken} broken URL(s)\n`);

    for (const fileResult of result.results) {
      const broken = fileResult.urls.filter(
        (u) => u.status === "error" || u.status === "format_error" || (typeof u.status === "number" && u.status >= 400)
      );

      if (broken.length > 0) {
        console.log(`\n${fileResult.file}`);
        for (const url of broken) {
          const status =
            url.status === "error" || url.status === "format_error"
              ? `Error: ${url.error}`
              : `HTTP ${url.status}`;
          console.log(`   ${url.url}`);
          console.log(`      ${status}`);
        }
      }
    }
  }

  // Show redirects
  const redirects = result.results.flatMap((r) =>
    r.urls.filter((u) => u.redirected).map((u) => ({ file: r.file, ...u }))
  );

  if (redirects.length > 0) {
    console.log(`\nRedirected URLs (${redirects.length}):`);
    for (const item of redirects) {
      console.log(`\n   ${item.file}`);
      console.log(`      ${item.url}`);
      console.log(`      -> ${item.finalUrl}`);
    }
  }

  console.log("\n" + "-".repeat(50));
  console.log("Stats:");
  console.log(`   Files checked: ${result.stats.filesChecked}`);
  console.log(`   URLs checked:  ${result.stats.urlsChecked}`);
  console.log(`   Broken:        ${result.stats.broken}`);
  console.log(`   Redirected:    ${result.stats.redirected}`);
  console.log();
}

// Main
const { changedOnly, baseSha, useCache, updateCache, ignoreCache } = parseArgs();

if (changedOnly && !baseSha) {
  console.error("Error: --changed-only requires --base <sha>");
  process.exit(1);
}

const result = await validate(changedOnly, baseSha, {
  useCache,
  updateCache,
  ignoreCache,
});

writeConsoleOutput(result);
writeGitHubSummary(result);

process.exit(result.valid ? 0 : 1);

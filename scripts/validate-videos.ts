/**
 * Video ID Validation Script
 *
 * Validates video IDs in YAML files by checking oEmbed endpoints.
 * Supports YouTube and Vimeo. Does not require API keys.
 *
 * Usage:
 *   pnpm validate:videos           # Validate all files
 *   pnpm validate:videos -- --changed-only --base <sha>  # Only changed files
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { DATA_DIR, getYamlFiles } from "./lib/utils.js";

const MAX_CONCURRENT_REQUESTS = 5;

// =============================================================================
// TYPES
// =============================================================================

interface VideoEntry {
  videoId: string;
  provider?: string;
  title?: string;
}

interface VideoCheckResult {
  videoId: string;
  provider: string;
  title?: string;
  status: "valid" | "invalid" | "error";
  url: string;
  error?: string;
}

interface FileResult {
  file: string;
  videos: VideoCheckResult[];
}

// =============================================================================
// HELPERS
// =============================================================================

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

function getOembedUrl(videoId: string, provider: string): string {
  if (provider === "vimeo") {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${videoId}`)}`;
  }
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
}

function getWatchUrl(videoId: string, provider: string): string {
  if (provider === "vimeo") {
    return `https://vimeo.com/${videoId}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// =============================================================================
// EXTRACT VIDEOS FROM YAML
// =============================================================================

function extractVideos(data: Record<string, unknown>): VideoEntry[] {
  const videos: VideoEntry[] = [];

  if (Array.isArray(data.videos)) {
    for (const v of data.videos) {
      if (typeof v === "object" && v !== null && "videoId" in v) {
        videos.push(v as VideoEntry);
      }
    }
  }

  // Check versions
  if (Array.isArray(data.versions)) {
    for (const ver of data.versions) {
      if (
        typeof ver === "object" &&
        ver !== null &&
        Array.isArray((ver as Record<string, unknown>).videos)
      ) {
        for (const v of (ver as Record<string, unknown>).videos as unknown[]) {
          if (typeof v === "object" && v !== null && "videoId" in v) {
            videos.push(v as VideoEntry);
          }
        }
      }
    }
  }

  // Check variants (hardware)
  if (Array.isArray(data.variants)) {
    for (const rev of data.variants) {
      if (typeof rev === "object" && rev !== null) {
        const revData = rev as Record<string, unknown>;
        if (Array.isArray(revData.videos)) {
          for (const v of revData.videos) {
            if (typeof v === "object" && v !== null && "videoId" in v) {
              videos.push(v as VideoEntry);
            }
          }
        }
      }
    }
  }

  // Check translations
  if (typeof data.translations === "object" && data.translations !== null) {
    for (const trans of Object.values(data.translations as Record<string, unknown>)) {
      if (
        typeof trans === "object" &&
        trans !== null &&
        Array.isArray((trans as Record<string, unknown>).videos)
      ) {
        for (const v of (trans as Record<string, unknown>).videos as unknown[]) {
          if (typeof v === "object" && v !== null && "videoId" in v) {
            videos.push(v as VideoEntry);
          }
        }
      }
    }
  }

  return videos;
}

// =============================================================================
// CHECK VIDEO
// =============================================================================

async function checkVideo(entry: VideoEntry): Promise<VideoCheckResult> {
  const provider = entry.provider ?? "youtube";
  const oembedUrl = getOembedUrl(entry.videoId, provider);
  const watchUrl = getWatchUrl(entry.videoId, provider);

  try {
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Aureo-Catalog-Validator/1.0" },
    });

    if (response.ok) {
      return {
        videoId: entry.videoId,
        provider,
        title: entry.title,
        status: "valid",
        url: watchUrl,
      };
    }

    if (
      response.status === 400 ||
      response.status === 404 ||
      response.status === 401 ||
      response.status === 403
    ) {
      return {
        videoId: entry.videoId,
        provider,
        title: entry.title,
        status: "invalid",
        url: watchUrl,
        error: `Not found (HTTP ${response.status})`,
      };
    }

    return {
      videoId: entry.videoId,
      provider,
      title: entry.title,
      status: "error",
      url: watchUrl,
      error: `Unexpected HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      videoId: entry.videoId,
      provider,
      title: entry.title,
      status: "error",
      url: watchUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// =============================================================================
// PROCESS FILES
// =============================================================================

async function processFile(filePath: string): Promise<FileResult> {
  const relativePath = path.relative(process.cwd(), filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return { file: relativePath, videos: [] };
  }

  let data: Record<string, unknown>;
  try {
    data = parseYaml(content) as Record<string, unknown>;
  } catch {
    return { file: relativePath, videos: [] };
  }

  const entries = extractVideos(data);
  if (entries.length === 0) {
    return { file: relativePath, videos: [] };
  }

  // Deduplicate by videoId
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    if (seen.has(e.videoId)) return false;
    seen.add(e.videoId);
    return true;
  });

  const results = await runWithConcurrency(unique, MAX_CONCURRENT_REQUESTS, checkVideo);
  return { file: relativePath, videos: results };
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const changedOnly = args.includes("--changed-only");
  const baseIndex = args.indexOf("--base");
  const baseSha = baseIndex !== -1 ? args[baseIndex + 1] : undefined;
  return { changedOnly, baseSha };
}

function getChangedFiles(baseSha: string): string[] {
  if (!/^[a-f0-9]{7,40}$/i.test(baseSha)) {
    console.error(`Invalid git SHA format: ${baseSha}`);
    return [];
  }

  try {
    const output = execSync(`git diff --name-only ${baseSha} HEAD`, { encoding: "utf-8" });
    return output
      .split("\n")
      .filter((f) => f.match(/^data\/(software|content|hardware|accessories)\/.*\.yaml$/))
      .map((f) => path.join(process.cwd(), f))
      .filter((f) => fs.existsSync(f));
  } catch {
    console.error("Failed to get changed files");
    return [];
  }
}

// =============================================================================
// MAIN
// =============================================================================

const { changedOnly, baseSha } = parseArgs();

if (changedOnly && !baseSha) {
  console.error("Error: --changed-only requires --base <sha>");
  process.exit(1);
}

let files: string[];

if (changedOnly && baseSha) {
  files = getChangedFiles(baseSha);
  console.log(`\nChecking videos in ${files.length} changed file(s)...\n`);
} else {
  files = [
    ...getYamlFiles(path.join(DATA_DIR, "software")),
    ...getYamlFiles(path.join(DATA_DIR, "content")),
    ...getYamlFiles(path.join(DATA_DIR, "hardware")),
    ...getYamlFiles(path.join(DATA_DIR, "accessories")),
  ];
  console.log(`\nChecking videos in ${files.length} file(s)...\n`);
}

const results = await runWithConcurrency(files, 5, processFile);

// Aggregate stats
let totalVideos = 0;
let validCount = 0;
let invalidCount = 0;
let errorCount = 0;

const invalid: { file: string; result: VideoCheckResult }[] = [];
const errors: { file: string; result: VideoCheckResult }[] = [];

for (const fileResult of results) {
  for (const video of fileResult.videos) {
    totalVideos++;
    if (video.status === "valid") {
      validCount++;
    } else if (video.status === "invalid") {
      invalidCount++;
      invalid.push({ file: fileResult.file, result: video });
    } else {
      errorCount++;
      errors.push({ file: fileResult.file, result: video });
    }
  }
}

// Output
console.log("Video Validation Results\n");
console.log("-".repeat(50));

if (invalidCount > 0) {
  console.log(`\nInvalid video IDs (${invalidCount}):\n`);
  for (const { file, result } of invalid) {
    console.log(`  ${file}`);
    console.log(`    videoId: ${result.videoId} (${result.provider})`);
    if (result.title) console.log(`    title: ${result.title}`);
    console.log(`    ${result.error}`);
    console.log();
  }
}

if (errorCount > 0) {
  console.log(`\nNetwork errors (${errorCount}):\n`);
  for (const { file, result } of errors) {
    console.log(`  ${file}`);
    console.log(`    videoId: ${result.videoId} (${result.provider})`);
    console.log(`    ${result.error}`);
    console.log();
  }
}

if (invalidCount === 0 && errorCount === 0) {
  console.log(`\nAll ${totalVideos} video ID(s) are valid!\n`);
}

console.log("-".repeat(50));
console.log("Stats:");
console.log(`  Videos checked: ${totalVideos}`);
console.log(`  Valid:          ${validCount}`);
console.log(`  Invalid:        ${invalidCount}`);
console.log(`  Errors:         ${errorCount}`);
console.log();

// Write GitHub Actions summary if available
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  let summary = "";

  if (invalidCount === 0 && errorCount === 0) {
    summary += `## Video Validation Passed\n\nAll ${totalVideos} video ID(s) are valid.\n\n`;
  } else {
    summary += `## Video Validation ${invalidCount > 0 ? "Failed" : "Warning"}\n\n`;
  }

  if (invalidCount > 0) {
    summary += `### Invalid Video IDs (${invalidCount})\n\n`;
    summary += `| File | Video ID | Provider | Error |\n`;
    summary += `|------|----------|----------|-------|\n`;
    for (const { file, result } of invalid) {
      summary += `| \`${file}\` | \`${result.videoId}\` | ${result.provider} | ${result.error} |\n`;
    }
    summary += "\n";
  }

  if (errorCount > 0) {
    summary += `### Network Errors (${errorCount})\n\n`;
    summary += `| File | Video ID | Error |\n`;
    summary += `|------|----------|-------|\n`;
    for (const { file, result } of errors) {
      summary += `| \`${file}\` | \`${result.videoId}\` | ${result.error} |\n`;
    }
    summary += "\n";
  }

  summary += `### Stats\n\n`;
  summary += `- Videos checked: ${totalVideos}\n`;
  summary += `- Valid: ${validCount}\n`;
  summary += `- Invalid: ${invalidCount}\n`;
  summary += `- Errors: ${errorCount}\n`;

  fs.appendFileSync(summaryPath, summary);
}

// Exit with failure only for invalid IDs, not network errors
process.exit(invalidCount > 0 ? 1 : 0);

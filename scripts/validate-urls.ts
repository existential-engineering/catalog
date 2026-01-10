/**
 * URL Validation Script
 *
 * Validates all URLs in YAML catalog files.
 * Can validate all files or only changed files (for PR reviews).
 *
 * Usage:
 *   pnpm validate-urls                    # Validate all files
 *   pnpm validate-urls --changed-only --base <sha>  # Validate only changed files
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { DATA_DIR, getYamlFiles } from "./lib/utils.js";

interface UrlCheckResult {
  url: string;
  status: number | "error";
  redirected: boolean;
  finalUrl?: string;
  error?: string;
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
function parseArgs(): { changedOnly: boolean; baseSha?: string } {
  const args = process.argv.slice(2);
  const changedOnly = args.includes("--changed-only");
  const baseIndex = args.indexOf("--base");
  const baseSha = baseIndex !== -1 ? args[baseIndex + 1] : undefined;

  return { changedOnly, baseSha };
}

// Get list of changed YAML files in data/
function getChangedFiles(baseSha: string): string[] {
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
function extractUrls(data: Record<string, unknown>, prefix = ""): string[] {
  const urls: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      // Check if this is a URL field
      if (key === "url" || key === "website" || key === "source") {
        if (value.startsWith("http://") || value.startsWith("https://")) {
          urls.push(value);
        }
      }
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "object" && item !== null) {
          urls.push(...extractUrls(item as Record<string, unknown>, `${currentPath}[${i}]`));
        }
      }
    } else if (typeof value === "object" && value !== null) {
      urls.push(...extractUrls(value as Record<string, unknown>, currentPath));
    }
  }

  return urls;
}

// Check a single URL
async function checkUrl(url: string): Promise<UrlCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Racks-Catalog-Validator/1.0",
      },
    });

    clearTimeout(timeout);

    const redirected = response.url !== url;

    return {
      url,
      status: response.status,
      redirected,
      finalUrl: redirected ? response.url : undefined,
    };
  } catch {
    clearTimeout(timeout);

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

      return {
        url,
        status: response.status,
        redirected,
        finalUrl: redirected ? response.url : undefined,
      };
    } catch (getError) {
      return {
        url,
        status: "error",
        redirected: false,
        error: getError instanceof Error ? getError.message : String(getError),
      };
    }
  }
}

// Process a single file
async function processFile(filePath: string): Promise<FileResult> {
  const content = fs.readFileSync(filePath, "utf-8");
  const data = parseYaml(content) as Record<string, unknown>;
  const urls = [...new Set(extractUrls(data))]; // Dedupe URLs

  const results: UrlCheckResult[] = [];

  for (const url of urls) {
    const result = await checkUrl(url);
    results.push(result);
  }

  return {
    file: path.relative(process.cwd(), filePath),
    urls: results,
  };
}

// Main validation function
async function validate(changedOnly: boolean, baseSha?: string): Promise<ValidationResult> {
  let files: string[];

  if (changedOnly && baseSha) {
    files = getChangedFiles(baseSha);
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

  const results: FileResult[] = [];
  let totalUrls = 0;
  let brokenCount = 0;
  let redirectCount = 0;

  for (const file of files) {
    const fileResult = await processFile(file);
    results.push(fileResult);

    for (const urlResult of fileResult.urls) {
      totalUrls++;

      if (urlResult.status === "error" || (typeof urlResult.status === "number" && urlResult.status >= 400)) {
        brokenCount++;
      } else if (urlResult.redirected) {
        redirectCount++;
      }
    }
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
      .filter((u) => u.status === "error" || (typeof u.status === "number" && u.status >= 400))
      .map((u) => ({ file: r.file, ...u }))
  );

  if (broken.length > 0) {
    summary += `### Broken URLs\n\n`;
    summary += `| File | URL | Status |\n`;
    summary += `|------|-----|--------|\n`;
    for (const item of broken) {
      const status = item.status === "error" ? `Error: ${item.error}` : item.status;
      summary += `| \`${item.file}\` | ${item.url} | ${status} |\n`;
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
      summary += `| \`${item.file}\` | ${item.url} | ${item.finalUrl} |\n`;
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
        (u) => u.status === "error" || (typeof u.status === "number" && u.status >= 400)
      );

      if (broken.length > 0) {
        console.log(`\n${fileResult.file}`);
        for (const url of broken) {
          const status = url.status === "error" ? `Error: ${url.error}` : `HTTP ${url.status}`;
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
      console.log(`   ${item.url}`);
      console.log(`   -> ${item.finalUrl}`);
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
const { changedOnly, baseSha } = parseArgs();

if (changedOnly && !baseSha) {
  console.error("Error: --changed-only requires --base <sha>");
  process.exit(1);
}

const result = await validate(changedOnly, baseSha);

writeConsoleOutput(result);
writeGitHubSummary(result);

process.exit(result.valid ? 0 : 1);

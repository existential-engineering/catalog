/**
 * Shared utilities for slash commands
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { DATA_DIR } from "../lib/utils.js";

// =============================================================================
// TYPES
// =============================================================================

export interface CommandResult {
  success: boolean;
  message: string;
}

export interface ParsedCommand {
  name: string;
  args: string[];
  flags: Record<string, boolean | string>;
}

// =============================================================================
// COMMAND PARSING
// =============================================================================

/**
 * Parse a slash command from a comment body
 * Examples:
 *   /crawl https://example.com -> { name: "crawl", args: ["https://example.com"], flags: {} }
 *   /submit --draft -> { name: "submit", args: [], flags: { draft: true } }
 *   /reject Not relevant -> { name: "reject", args: ["Not", "relevant"], flags: {} }
 */
export function parseCommand(body: string): ParsedCommand | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  const name = parts[0].slice(1).toLowerCase();
  const args: string[] = [];
  const flags: Record<string, boolean | string> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("--")) {
      const flagName = part.slice(2);
      // Check if next part is a value (not a flag)
      if (i + 1 < parts.length && !parts[i + 1].startsWith("--")) {
        flags[flagName] = parts[i + 1];
        i++;
      } else {
        flags[flagName] = true;
      }
    } else {
      args.push(part);
    }
  }

  return { name, args, flags };
}

// =============================================================================
// DATA HELPERS
// =============================================================================

/**
 * Get all existing manufacturer slugs from the catalog
 */
export function getExistingManufacturers(): Set<string> {
  const manufacturersDir = path.join(DATA_DIR, "manufacturers");
  if (!fs.existsSync(manufacturersDir)) {
    return new Set();
  }

  const files = fs.readdirSync(manufacturersDir).filter((f) => f.endsWith(".yaml"));
  return new Set(files.map((f) => path.basename(f, ".yaml")));
}

/**
 * Check if a slug already exists in any collection
 */
export function slugExists(slug: string): { exists: boolean; collection?: string } {
  const collections = ["manufacturers", "software", "hardware"] as const;

  for (const collection of collections) {
    const filePath = path.join(DATA_DIR, collection, `${slug}.yaml`);
    if (fs.existsSync(filePath)) {
      return { exists: true, collection };
    }
  }

  return { exists: false };
}

/**
 * Generate a unique slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// =============================================================================
// RESPONSE FORMATTING
// =============================================================================

/**
 * Format a success response for posting to discussions
 */
export function formatSuccess(title: string, content: string): string {
  return `### ${title}\n\n${content}`;
}

/**
 * Format an error response for posting to discussions
 */
export function formatError(title: string, error: string, suggestions?: string[]): string {
  let response = `### ${title}\n\n❌ **Error:** ${error}`;

  if (suggestions && suggestions.length > 0) {
    response += "\n\n**Suggestions:**\n";
    for (const suggestion of suggestions) {
      response += `- ${suggestion}\n`;
    }
  }

  return response;
}

/**
 * Format YAML in a code block for display
 */
export function formatYamlBlock(yaml: string): string {
  return "```yaml\n" + yaml + "\n```";
}

/**
 * Format JSON in a collapsible details block
 */
export function formatJsonDetails(title: string, data: unknown): string {
  return `<details>
<summary>${title}</summary>

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

</details>`;
}

// =============================================================================
// METADATA EXTRACTION
// =============================================================================

/**
 * Extract website URL from discussion metadata or body
 */
export function extractWebsiteUrl(
  metadata: DiscussionMetadata | null,
  body: string
): string | null {
  // Try to find URL in the table
  const websiteMatch = body.match(/\|\s*\*\*Website\*\*\s*\|\s*(\S+)\s*\|/);
  if (websiteMatch) {
    return websiteMatch[1];
  }

  // Try to find any URL in the body
  const urlMatch = body.match(/https?:\/\/[^\s<>"]+/);
  if (urlMatch) {
    return urlMatch[0];
  }

  return null;
}

/**
 * Determine the request type from discussion metadata or category
 */
export function getRequestType(
  metadata: DiscussionMetadata | null,
  discussionBody: string
): "software" | "hardware" | "manufacturer" {
  if (metadata?.type) {
    return metadata.type;
  }

  // Try to infer from content
  const lowerBody = discussionBody.toLowerCase();
  if (lowerBody.includes("manufacturer") || lowerBody.includes("company")) {
    return "manufacturer";
  }
  if (lowerBody.includes("hardware") || lowerBody.includes("synth") || lowerBody.includes("interface")) {
    return "hardware";
  }

  return "software";
}

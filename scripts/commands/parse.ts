/**
 * /parse command handler
 *
 * Validates and structures crawled data into YAML format.
 * Usage: /parse
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { parse } from "../lib/crawler-client.js";
import { getDiscussionComments } from "../lib/github.js";
import {
  formatSuccess,
  formatError,
  formatYamlBlock,
  getRequestType,
  getExistingManufacturers,
  extractTableData,
  type CommandResult,
} from "./utils.js";

/**
 * Extract crawled data from discussion body or comments
 * Searches through comments in reverse chronological order to find the most recent crawl result
 */
async function extractCrawledDataFromDiscussion(
  ctx: DiscussionContext
): Promise<Record<string, unknown> | null> {
  // First, try to extract from the discussion body
  const bodyResult = extractCrawledData(ctx.discussionBody);
  if (bodyResult) {
    return bodyResult;
  }

  // If not found in body, search through comments
  try {
    const comments = await getDiscussionComments(ctx.discussionNodeId);
    
    // Search comments in reverse order (most recent first)
    for (let i = comments.length - 1; i >= 0; i--) {
      const comment = comments[i];
      const result = extractCrawledData(comment.body);
      if (result) {
        return result;
      }
    }
  } catch (error) {
    console.error("Failed to fetch discussion comments:", error);
  }

  return null;
}

/**
 * Extract crawled data from a single body of text
 * Looks for JSON in code blocks from crawl results
 */
function extractCrawledData(body: string): Record<string, unknown> | null {
  // ... existing helper function

  }

  // Use the last JSON code block as the most recent crawl result
  const lastMatch = matches[matches.length - 1];
  const jsonContent = lastMatch[1];

  try {
    return JSON.parse(jsonContent);
  } catch {
    return null;
  }
}

/**
 * Extract crawled data from a single body of text
 * Looks for JSON in code blocks from crawl results
 */
function extractCrawledData(body: string): Record<string, unknown> | null {
  // Try to find JSON in a code block
  const jsonMatch = body.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      return null;
    }
  }

  return null;
}

export async function handleParse(
  ctx: DiscussionContext,
  metadata: DiscussionMetadata | null,
  _args: string[],
  _flags: Record<string, boolean | string>
): Promise<CommandResult> {
  // Try to get crawled data from comments or discussion body,
  // falling back to extracting from the discussion table if none is found
  const data = (await extractCrawledDataFromDiscussion(ctx)) ?? extractTableData(ctx.discussionBody);

  if (Object.keys(data).length === 0) {
    return {
      success: false,
      message: formatError(
        "Parse Failed",
        "No data found to parse.",
        [
          "Run `/crawl <url>` first to fetch product data",
          "Or ensure the discussion has a properly formatted details table",
        ]
      ),
    };
  }

  // Get existing manufacturers for validation
  const existingManufacturers = [...getExistingManufacturers()];

  // Determine type
  const type = getRequestType(metadata, ctx.discussionBody);

  // Call the parser
  console.log(`Parsing ${type} data...`);
  const result = await parse({
    type,
    data,
    existingManufacturers,
  });

  if (!result.success || result.validationErrors?.length) {
    if (result.validationErrors?.length) {
      return {
        success: false,
        message: formatError(
          "Parse Failed",
          "Validation errors found:",
          result.validationErrors
        ),
      };
    }

    return {
      success: false,
      message: formatError("Parse Failed", "Unknown validation error"),
    };
  }

  // Build success response
  let manufacturerStatus = "";
  if (result.manufacturerStatus) {
    if (result.manufacturerStatus.exists) {
      manufacturerStatus = `**Manufacturer Status:** \`${result.manufacturerStatus.slug}\` exists in catalog`;
    } else {
      manufacturerStatus = `**Manufacturer Status:** Not found. ${
        result.manufacturerStatus.suggestion
          ? `Did you mean \`${result.manufacturerStatus.suggestion}\`?`
          : "Create manufacturer first."
      }`;
    }
  }

  const warnings = result.warnings?.length
    ? `\n\n**Warnings:**\n${result.warnings.map((w) => `- ${w}`).join("\n")}`
    : "";

  const response = formatSuccess(
    "Parse Results",
    `**Validation:** Passed
**Slug:** \`${result.slug}\`
${manufacturerStatus}${warnings}

#### Generated YAML Preview

${formatYamlBlock(result.yaml || "# No YAML generated")}

---

Ready to submit! Run \`/submit\` to create a PR, or \`/submit --draft\` for a draft PR.`
  );

  return {
    success: true,
    message: response,
  };
}

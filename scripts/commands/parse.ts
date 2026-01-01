/**
 * /parse command handler
 *
 * Validates and structures crawled data into YAML format.
 * Usage: /parse
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { parse } from "../lib/crawler-client.js";
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
 * Extract crawled data from previous bot comments in the discussion
 * Looks for JSON in code blocks from crawl results
 */
function extractCrawledData(discussionBody: string): Record<string, unknown> | null {
  // This is a simplified version - in practice, we'd need to fetch discussion comments
  // and find the most recent crawl result
  // For now, we'll extract from the metadata enrichment field if present

  // Try to find JSON in a code block
  const jsonMatch = discussionBody.match(/```json\n([\s\S]*?)\n```/);
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
  // Try to get crawled data from previous comments or discussion body,
  // falling back to extracting from the discussion table if none is found
  const data = extractCrawledData(ctx.discussionBody) ?? extractTableData(ctx.discussionBody);

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
    const errors = result.validationErrors || ["Unknown validation error"];
    return {
      success: false,
      message: formatError("Parse Failed", "Validation errors found:", errors),
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

/**
 * /preview command handler
 *
 * Shows a YAML preview without creating a PR.
 * Usage: /preview
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { parse } from "../lib/crawler-client.js";
import {
  formatSuccess,
  formatError,
  formatYamlBlock,
  getRequestType,
  getExistingManufacturers,
  slugExists,
  extractTableData,
  type CommandResult,
} from "./utils.js";

export async function handlePreview(
  ctx: DiscussionContext,
  metadata: DiscussionMetadata | null,
  _args: string[],
  _flags: Record<string, boolean | string>
): Promise<CommandResult> {
  // Extract data from discussion
  const data = extractTableData(ctx.discussionBody);

  if (!data || Object.keys(data).length === 0) {
    return {
      success: false,
      message: formatError(
        "Preview Failed",
        "No data found in discussion.",
        [
          "Ensure the discussion has a properly formatted details table",
          "Or run `/crawl <url>` to fetch product data first",
        ]
      ),
    };
  }

  // Get existing manufacturers
  const existingManufacturers = [...getExistingManufacturers()];

  // Determine type
  const type = getRequestType(metadata, ctx.discussionBody);

  // Call parser
  const result = await parse({
    type,
    data,
    existingManufacturers,
  });

  if (!result.success) {
    return {
      success: false,
      message: formatError(
        "Preview Failed",
        "Failed to generate YAML preview.",
        result.validationErrors || ["Unknown error"],
      ),
    };
  }

  // Check if slug exists
  const slug = result.slug || "unknown";
  const existing = slugExists(slug);

  let statusLine = "";
  if (existing.exists) {
    statusLine = `\n\n**Slug Status:** \`${slug}\` already exists in ${existing.collection}`;
  } else {
    statusLine = `\n\n**Slug Status:** \`${slug}\` is available`;
  }

  const validationStatus = result.validationErrors?.length
    ? `**Validation:** Failed\n${result.validationErrors.map((e) => `- ${e}`).join("\n")}`
    : `**Validation:** Passed`;

  const response = formatSuccess(
    "YAML Preview",
    `${validationStatus}${statusLine}

---

${formatYamlBlock(result.yaml || "# No YAML generated")}

---

This is a preview only. Run \`/submit\` to create a PR with this YAML.`
  );

  return {
    success: true,
    message: response,
  };
}

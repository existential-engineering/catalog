/**
 * /crawl command handler
 *
 * Fetches product data from a manufacturer website.
 * Usage: /crawl [url]
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { crawl } from "../lib/crawler-client.js";
import {
  formatSuccess,
  formatError,
  formatJsonDetails,
  extractWebsiteUrl,
  getRequestType,
  type CommandResult,
} from "./utils.js";

export async function handleCrawl(
  ctx: DiscussionContext,
  metadata: DiscussionMetadata | null,
  args: string[],
  _flags: Record<string, boolean | string>
): Promise<CommandResult> {
  // Get URL from args or try to extract from discussion
  let url = args[0];

  if (!url) {
    url = extractWebsiteUrl(metadata, ctx.discussionBody) || "";
  }

  if (!url) {
    return {
      success: false,
      message: formatError(
        "Crawl Failed",
        "No URL provided and couldn't find one in the discussion.",
        [
          "Provide a URL: `/crawl https://manufacturer.com/product`",
          "Or add a Website field to the discussion table",
        ]
      ),
    };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return {
      success: false,
      message: formatError("Crawl Failed", `Invalid URL: ${url}`, [
        "Make sure the URL includes the protocol (https://)",
        "Example: `/crawl https://fabfilter.com/products/pro-q-3`",
      ]),
    };
  }

  // Determine request type
  const type = getRequestType(metadata, ctx.discussionBody);

  // Call the crawler
  console.log(`Crawling ${url} as ${type}...`);
  const result = await crawl({ url, type });

  if (!result.success) {
    return {
      success: false,
      message: formatError("Crawl Failed", result.error || "Unknown error", result.suggestions),
    };
  }

  // Format success response
  const response = formatSuccess(
    "Crawl Results",
    `**URL:** ${result.url}
**Status:** Success
**Fetched:** ${result.fetchedAt}

${formatJsonDetails("Raw Data (click to expand)", result.data)}

---

Run \`/parse\` to validate and structure this data, or \`/submit\` after review.`
  );

  return {
    success: true,
    message: response,
  };
}

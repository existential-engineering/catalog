/**
 * /add command handler
 *
 * One-shot command that runs crawl + parse + submit in sequence.
 * Usage: /add [url] [--draft]
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { handleCrawl } from "./crawl.js";
import { handleParse } from "./parse.js";
import { handleSubmit } from "./submit.js";
import { formatError, type CommandResult } from "./utils.js";

export async function handleAdd(
  ctx: DiscussionContext,
  metadata: DiscussionMetadata | null,
  args: string[],
  flags: Record<string, boolean | string>
): Promise<CommandResult> {
  // Step 1: Crawl
  console.log("Step 1/3: Crawling...");
  const crawlResult = await handleCrawl(ctx, metadata, args, flags);

  if (!crawlResult.success) {
    return {
      success: false,
      message: formatError(
        "Add Failed (Crawl Step)",
        "Could not fetch data from the URL.",
        [
          "Check that the URL is accessible",
          "Try `/crawl <url>` to debug the issue",
        ]
      ) + `\n\n<details>\n<summary>Crawl Error</summary>\n\n${crawlResult.message}\n</details>`,
    };
  }

  // Inject crawl results into discussion body for parse to find
  // We do this by temporarily modifying the context
  const ctxWithCrawlData = {
    ...ctx,
    discussionBody: ctx.discussionBody + "\n\n" + crawlResult.message,
  };

  // Step 2: Parse
  console.log("Step 2/3: Parsing...");
  const parseResult = await handleParse(ctxWithCrawlData, metadata, [], flags);

  if (!parseResult.success) {
    return {
      success: false,
      message: formatError(
        "Add Failed (Parse Step)",
        "Crawl succeeded but validation failed.",
        [
          "Review the crawled data below",
          "Use `/parse` after fixing any issues",
        ]
      ) + `\n\n<details>\n<summary>Crawl Results</summary>\n\n${crawlResult.message}\n</details>\n\n<details>\n<summary>Parse Error</summary>\n\n${parseResult.message}\n</details>`,
    };
  }

  // Inject parse results for submit to find
  const ctxWithParseData = {
    ...ctx,
    discussionBody: ctx.discussionBody + "\n\n" + parseResult.message,
  };

  // Step 3: Submit
  console.log("Step 3/3: Submitting...");
  const submitResult = await handleSubmit(ctxWithParseData, metadata, [], flags);

  if (!submitResult.success) {
    return {
      success: false,
      message: formatError(
        "Add Failed (Submit Step)",
        "Crawl and parse succeeded but PR creation failed.",
        [
          "The YAML is ready - try `/submit` manually",
          "Check if a PR already exists for this entry",
        ]
      ) + `\n\n<details>\n<summary>Generated YAML</summary>\n\n${parseResult.message}\n</details>\n\n<details>\n<summary>Submit Error</summary>\n\n${submitResult.message}\n</details>`,
    };
  }

  // All steps succeeded!
  return {
    success: true,
    message: `### ✅ Entry Added Successfully

All steps completed:
1. ✓ Crawled product data
2. ✓ Validated and generated YAML
3. ✓ Created pull request

---

${submitResult.message}`,
  };
}

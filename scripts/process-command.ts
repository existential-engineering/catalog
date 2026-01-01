/**
 * Discussion Command Processor
 *
 * Entry point for processing slash commands from GitHub Discussion comments.
 * Run via: pnpm tsx scripts/process-command.ts
 */

import {
  getDiscussionContext,
  parseDiscussionMetadata,
  addDiscussionComment,
  addReactionToComment,
} from "./lib/github.js";
import { parseCommand, formatError } from "./commands/utils.js";
import { handleCrawl } from "./commands/crawl.js";
import { handleParse } from "./commands/parse.js";
import { handleSubmit } from "./commands/submit.js";
import { handlePreview } from "./commands/preview.js";
import { handleReject } from "./commands/reject.js";
import { handleDuplicate } from "./commands/duplicate.js";

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

type CommandHandler = (
  ctx: ReturnType<typeof getDiscussionContext>,
  metadata: ReturnType<typeof parseDiscussionMetadata>,
  args: string[],
  flags: Record<string, boolean | string>
) => Promise<{ success: boolean; message: string }>;

const COMMANDS: Record<string, CommandHandler> = {
  crawl: handleCrawl,
  parse: handleParse,
  enrich: handleEnrich,
  submit: handleSubmit,
  preview: handlePreview,
  reject: handleReject,
  duplicate: handleDuplicate,
};

// Enrich is a combination of crawl + parse
async function handleEnrich(
  ctx: ReturnType<typeof getDiscussionContext>,
  metadata: ReturnType<typeof parseDiscussionMetadata>,
  args: string[],
  flags: Record<string, boolean | string>
): Promise<{ success: boolean; message: string }> {
  // Run crawl first
  const crawlResult = await handleCrawl(ctx, metadata, args, flags);
  if (!crawlResult.success) {
    return crawlResult;
  }

  // Then run parse
  const parseResult = await handleParse(ctx, metadata, [], flags);
  if (!parseResult.success) {
    return {
      success: false,
      message: `Crawl succeeded but parse failed:\n\n${parseResult.message}`,
    };
  }

  return {
    success: true,
    message: `### Enrichment Complete\n\n${crawlResult.message}\n\n---\n\n${parseResult.message}`,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("Processing discussion command...\n");

  // Get context from GitHub event
  const ctx = getDiscussionContext();
  console.log(`Discussion #${ctx.discussionNumber} by @${ctx.commentAuthor}`);
  console.log(`Comment: ${ctx.commentBody.slice(0, 100)}...`);

  // Parse the command
  const command = parseCommand(ctx.commentBody);
  if (!command) {
    console.log("No valid command found in comment");
    return;
  }

  const safeArgsSummary = Array.isArray(command.args)
    ? `${command.args.length} arg(s)`
    : "n/a";
  const safeFlagsSummary =
    command.flags && typeof command.flags === "object"
      ? Object.keys(command.flags)
          .map((key) =>
            typeof command.flags[key] === "boolean"
              ? `${key}`
              : `${key}=<redacted>`
          )
          .join(", ")
      : "n/a";

  console.log(`Command: /${command.name}`);
  console.log(`Args: ${safeArgsSummary}`);
  console.log(`Flags: ${safeFlagsSummary}`);

  // Parse discussion metadata
  const metadata = parseDiscussionMetadata(ctx.discussionBody);
  if (metadata) {
    console.log(`Metadata type: ${metadata.type}`);
  } else {
    console.log("No metadata found in discussion body");
  }

  // Find and execute the command handler
  const handler = COMMANDS[command.name];
  if (!handler) {
    const unknownMessage = formatError(
      "Unknown Command",
      `\`/${command.name}\` is not a recognized command.`,
      [
        "Available commands: /crawl, /parse, /enrich, /submit, /preview, /reject, /duplicate",
        "Use `/crawl <url>` to fetch product data",
        "Use `/enrich` to crawl and parse in one step",
      ]
    );

    await addDiscussionComment(ctx.discussionNodeId, unknownMessage);
    await addReactionToComment(ctx.commentId, "CONFUSED");
    console.log("Unknown command, posted help message");
    return;
  }

  // Execute the command
  try {
    const result = await handler(ctx, metadata, command.args, command.flags);

    // Post the result as a comment
    await addDiscussionComment(ctx.discussionNodeId, result.message);

    // Add reaction to the original command comment
    if (result.success) {
      await addReactionToComment(ctx.commentId, "ROCKET");
      console.log("Command succeeded");
    } else {
      await addReactionToComment(ctx.commentId, "CONFUSED");
      console.log("Command failed");
    }
  } catch (error) {
    const errorMessage = formatError(
      "Command Failed",
      error instanceof Error ? error.message : "An unexpected error occurred",
      ["Please try again or contact a maintainer"]
    );

    await addDiscussionComment(ctx.discussionNodeId, errorMessage);
    await addReactionToComment(ctx.commentId, "CONFUSED");

    console.error("Command error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

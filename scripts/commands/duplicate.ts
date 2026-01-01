/**
 * /duplicate command handler
 *
 * Marks a discussion as a duplicate of an existing catalog entry.
 * Usage: /duplicate <slug>
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { closeDiscussion } from "../lib/github.js";
import { formatSuccess, formatError, slugExists, type CommandResult } from "./utils.js";

export async function handleDuplicate(
  ctx: DiscussionContext,
  _metadata: DiscussionMetadata | null,
  args: string[],
  _flags: Record<string, boolean | string>
): Promise<CommandResult> {
  const slug = args[0]?.trim();

  if (!slug) {
    return {
      success: false,
      message: formatError(
        "Duplicate Failed",
        "A slug is required.",
        [
          "Usage: `/duplicate <slug>`",
          "Example: `/duplicate serum`",
        ]
      ),
    };
  }

  // Check if the slug exists
  const existing = slugExists(slug);
  if (!existing.exists) {
    return {
      success: false,
      message: formatError(
        "Duplicate Failed",
        `Slug \`${slug}\` does not exist in the catalog.`,
        [
          "Check the spelling of the slug",
          "Use `/reject <reason>` to close for other reasons",
        ]
      ),
    };
  }

  try {
    // Close the discussion
    await closeDiscussion(ctx.discussionNodeId, "DUPLICATE");

    // At this point, existing.exists is true, so collection is guaranteed to be defined
    const collection = existing.collection!;
    const yamlUrl = `https://github.com/${ctx.owner}/${ctx.repo}/blob/main/data/${collection}/${slug}.yaml`;

    const response = formatSuccess(
      "Duplicate Entry",
      `This ${collection.slice(0, -1) || "item"} already exists in the catalog!

**Existing entry:** [${slug}](${yamlUrl})

Closing as duplicate.`
    );

    return {
      success: true,
      message: response,
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(
        "Duplicate Failed",
        error instanceof Error ? error.message : "Failed to close discussion",
      ),
    };
  }
}

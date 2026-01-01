/**
 * /reject command handler
 *
 * Closes a discussion with a rejection reason.
 * Usage: /reject <reason>
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { closeDiscussion } from "../lib/github.js";
import { formatSuccess, formatError, type CommandResult } from "./utils.js";

export async function handleReject(
  ctx: DiscussionContext,
  _metadata: DiscussionMetadata | null,
  args: string[],
  _flags: Record<string, boolean | string>
): Promise<CommandResult> {
  const reason = args.join(" ").trim();

  if (!reason) {
    return {
      success: false,
      message: formatError(
        "Reject Failed",
        "A reason is required.",
        [
          "Usage: `/reject <reason>`",
          "Example: `/reject This plugin is discontinued and no longer available`",
        ]
      ),
    };
  }

  try {
    // Close the discussion
    await closeDiscussion(ctx.discussionNodeId, "RESOLVED");

    const response = formatSuccess(
      "Request Rejected",
      `This request has been closed by @${ctx.commentAuthor}.

**Reason:** ${reason}

---

If you believe this was in error, please open a new discussion with additional context.`
    );

    return {
      success: true,
      message: response,
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(
        "Reject Failed",
        error instanceof Error ? error.message : "Failed to close discussion",
      ),
    };
  }
}

/**
 * /submit command handler
 *
 * Creates a PR with the generated YAML file.
 * Usage: /submit [--draft]
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { createPullRequest, getDiscussionComments, branchExists, findPullRequestForBranch } from "../lib/github.js";
import {
  formatSuccess,
  formatError,
  getRequestType,
  slugExists,
  type CommandResult,
} from "./utils.js";

/**
 * Extract YAML from discussion body or comments
 * Searches through comments in reverse chronological order to find the most recent YAML
 */
async function extractYamlFromDiscussion(
  ctx: DiscussionContext
): Promise<{ yaml: string; slug: string } | null> {
  // First, try to extract from the discussion body
  const bodyResult = extractYamlFromBody(ctx.discussionBody);
  if (bodyResult) {
    return bodyResult;
  }

  // If not found in body, search through comments
  try {
    const comments = await getDiscussionComments(ctx.discussionNodeId);
    
    // Search comments in reverse order (most recent first)
    for (let i = comments.length - 1; i >= 0; i--) {
      const comment = comments[i];
      const result = extractYamlFromBody(comment.body);
      if (result) {
        return result;
      }
    }
  } catch (error) {
    console.error("Failed to fetch discussion comments:", error);
    // Fall through to return null
  }

  return null;
}

/**
 * Extract YAML from a single body of text
 */
function extractYamlFromBody(body: string): { yaml: string; slug: string } | null {
  // Look for YAML in a code block
  const yamlMatch = body.match(/```yaml\n([\s\S]*?)\n```/);
  if (!yamlMatch) {
    return null;
  }

  const yaml = yamlMatch[1];

  // Extract slug from YAML
  const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
  if (!slugMatch) {
    return null;
  }

  return {
    yaml,
    slug: slugMatch[1].trim(),
  };
}

/**
 * Generate changeset file content
 */
function generateChangeset(slug: string, type: string, name: string): string {
  return `---
"catalog": patch
---

Add ${name} (${type})
`;
}

export async function handleSubmit(
  ctx: DiscussionContext,
  metadata: DiscussionMetadata | null,
  _args: string[],
  flags: Record<string, boolean | string>
): Promise<CommandResult> {
  const isDraft = flags.draft === true;

  // Extract YAML from discussion body or comments
  const yamlData = await extractYamlFromDiscussion(ctx);
  if (!yamlData) {
    return {
      success: false,
      message: formatError(
        "Submit Failed",
        "No YAML found in discussion.",
        [
          "Run `/parse` or `/enrich` first to generate YAML",
          "The YAML should appear in a code block in the discussion",
        ]
      ),
    };
  }

  const { yaml, slug } = yamlData;

  // Check if slug already exists
  const existing = slugExists(slug);
  if (existing.exists) {
    return {
      success: false,
      message: formatError(
        "Submit Failed",
        `Slug \`${slug}\` already exists in ${existing.collection}.`,
        [
          "Choose a different slug by modifying the YAML",
          `Or use \`/duplicate ${slug}\` if this is a duplicate request`,
        ]
      ),
    };
  }

  // Determine type and collection folder
  const type = getRequestType(metadata, ctx.discussionBody);
  const collection = type === "manufacturer" ? "manufacturers" : type;

  // Extract name for PR title
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : slug;

  // Generate branch name
  const branchName = `contribution/${collection}/${slug}-${ctx.discussionNumber}`;

  // Check if branch already exists (prevents duplicate submissions)
  const branchAlreadyExists = await branchExists(ctx.owner, ctx.repo, branchName);
  if (branchAlreadyExists) {
    // Check if there's already a PR for this branch
    const existingPR = await findPullRequestForBranch(ctx.owner, ctx.repo, branchName);
    if (existingPR) {
      return {
        success: false,
        message: formatError(
          "Submit Failed",
          `A pull request already exists for this discussion.`,
          [
            `PR #${existingPR.number}: ${existingPR.url}`,
            existingPR.state === "open" 
              ? "The PR is still open for review" 
              : `The PR was ${existingPR.state}`,
          ]
        ),
      };
    }

    return {
      success: false,
      message: formatError(
        "Submit Failed",
        `Branch \`${branchName}\` already exists but no PR was found.`,
        [
          "This may indicate a previous submission attempt failed",
          "Contact a maintainer to clean up the branch",
        ]
      ),
    };
  }

  // Generate changeset
  const changesetSlug = `${slug}-${Date.now()}`;
  const changeset = generateChangeset(slug, type, name);

  // Create PR
  console.log(`Creating PR for ${type}: ${slug}...`);
  try {
    const pr = await createPullRequest({
      owner: ctx.owner,
      repo: ctx.repo,
      branch: branchName,
      title: `Add ${name} (${type})`,
      body: `## Summary

- Adds \`${slug}\` to the ${collection} collection
- Generated from discussion #${ctx.discussionNumber}

## Discussion

Closes #${ctx.discussionNumber}

---

Generated with [Claude Code](https://claude.com/claude-code)`,
      files: [
        {
          path: `data/${collection}/${slug}.yaml`,
          content: yaml,
        },
        {
          path: `.changeset/${changesetSlug}.md`,
          content: changeset,
        },
      ],
      draft: isDraft,
    });

    const response = formatSuccess(
      "Pull Request Created",
      `**PR #${pr.number}:** [Add ${name}](${pr.url})

**Branch:** \`${branchName}\`
**Files:**
- \`data/${collection}/${slug}.yaml\`
- \`.changeset/${changesetSlug}.md\`

The PR will run validation automatically. Once approved and merged, this discussion will be closed.

---

This discussion is linked in the PR for reference.`
    );

    return {
      success: true,
      message: response,
    };
  } catch (error) {
    // Check if this is a branch already exists error
    if (error instanceof Error && error.message.includes("Reference already exists")) {
      return {
        success: false,
        message: formatError(
          "Submit Failed",
          "The branch for this submission already exists.",
          [
            "This may be due to a concurrent submission attempt",
            "Try running `/submit` again in a moment",
            "If the issue persists, contact a maintainer",
          ]
        ),
      };
    }

    return {
      success: false,
      message: formatError(
        "Submit Failed",
        error instanceof Error ? error.message : "Failed to create pull request",
        [
          "Ensure the bot has write access to the repository",
          "Check if there are any conflicts with existing data",
        ]
      ),
    };
  }
}

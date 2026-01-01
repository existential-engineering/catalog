/**
 * /submit command handler
 *
 * Creates a PR with the generated YAML file.
 * Usage: /submit [--draft]
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { createPullRequest, getDiscussionComments, slugInOpenPR } from "../lib/github.js";
import {
  formatSuccess,
  formatError,
  getRequestType,
  slugExists,
  type CommandResult,
} from "./utils.js";

/**
 * Extract YAML from previous parse result in discussion comments or body
 */
async function extractYamlFromDiscussion(
  ctx: DiscussionContext
): Promise<{ yaml: string; slug: string } | null> {
  // First, try to get YAML from discussion comments (bot responses from /parse or /enrich)
  const comments = await getDiscussionComments(ctx.discussionNodeId);
  
  // Search comments in reverse order to find the most recent YAML
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];
    const yamlMatch = comment.body.match(/```yaml\n([\s\S]*?)\n```/);
    if (yamlMatch) {
      const yaml = yamlMatch[1];
      const slugMatch = yaml.match(/^slug:\s*(.+)$/m);
      if (slugMatch) {
        return {
          yaml,
          slug: slugMatch[1].trim(),
        };
      }
    }
  }

  // Fallback: check the discussion body
  const yamlMatch = ctx.discussionBody.match(/```yaml\n([\s\S]*?)\n```/);
  if (!yamlMatch) {
    return null;
  }

  const yaml = yamlMatch[1];
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

  // Extract YAML from discussion comments or body
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

  // Determine type and collection folder first (needed for slug checks)
  const type = getRequestType(metadata, ctx.discussionBody);
  const collection = type === "manufacturer" ? "manufacturers" : type;

  // Check if slug already exists in the catalog (merged PRs)
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

  // Check if slug is being used in any open PRs
  // This prevents race conditions where multiple discussions submit the same slug
  const inProgress = await slugInOpenPR(ctx.owner, ctx.repo, slug, collection);
  if (inProgress.exists) {
    return {
      success: false,
      message: formatError(
        "Submit Failed",
        `Slug \`${slug}\` is already being added in PR #${inProgress.number}.`,
        [
          `View the existing PR: ${inProgress.url}`,
          "Choose a different slug if this is a different item",
          `Or use \`/duplicate ${slug}\` if this is truly a duplicate`,
          "Wait for the other PR to be merged or closed before resubmitting",
        ]
      ),
    };
  }

  // Extract name for PR title
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : slug;

  // Generate branch name with discussion number to ensure uniqueness per discussion
  // This prevents conflicts when the same discussion runs /submit multiple times
  const branchName = `contribution/${collection}/${slug}-${ctx.discussionNumber}`;

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
    const errorMessage = error instanceof Error ? error.message : "Failed to create pull request";
    
    // Check if the error is due to a branch already existing
    const isBranchConflict = errorMessage.includes("Reference already exists") || 
                             errorMessage.includes("already exists");
    
    // Check if the error is due to a PR already existing
    const isPRConflict = errorMessage.includes("pull request already exists");
    
    if (isBranchConflict) {
      return {
        success: false,
        message: formatError(
          "Submit Failed",
          `A branch with the same name already exists. This might indicate that this discussion has already submitted a PR.`,
          [
            "Check the discussion comments for an existing PR link",
            "If the previous PR was closed, the branch may still exist",
            "Contact a repository maintainer if you believe this is an error",
          ]
        ),
      };
    }
    
    if (isPRConflict) {
      return {
        success: false,
        message: formatError(
          "Submit Failed",
          errorMessage,
          [
            "A PR already exists for this branch",
            "Check the discussion comments for the existing PR link",
          ]
        ),
      };
    }
    
    return {
      success: false,
      message: formatError(
        "Submit Failed",
        errorMessage,
        [
          "Ensure the bot has write access to the repository",
          "Check if there are any repository restrictions preventing the operation",
          "Contact a repository maintainer if the issue persists",
        ]
      ),
    };
  }
}

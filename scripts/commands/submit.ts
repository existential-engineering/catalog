/**
 * /submit command handler
 *
 * Creates a PR with the generated YAML file.
 * Usage: /submit [--draft]
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { createPullRequest, getDiscussionComments } from "../lib/github.js";
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
    
    return {
      success: false,
      message: formatError(
        "Submit Failed",
        errorMessage,
        [
          "If a PR already exists for this discussion, check the discussion comments for the PR link",
          "Ensure the bot has write access to the repository",
        ]
      ),
    };
  }
}

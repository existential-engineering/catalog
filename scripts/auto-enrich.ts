/**
 * Auto-Enrich Script
 *
 * Automatically runs enrich (crawl + parse) and creates a draft PR when a new discussion is created.
 * Triggered by the discussion-auto-enrich workflow.
 */

import fs from "node:fs";
import { Octokit } from "@octokit/rest";
import { crawl, parse } from "./lib/crawler-client.js";
import { createPullRequest, slugInOpenPR } from "./lib/github.js";
import {
  formatSuccess,
  formatError,
  getExistingManufacturers,
  slugExists,
} from "./commands/utils.js";

// =============================================================================
// TYPES
// =============================================================================

interface DiscussionEvent {
  discussion: {
    number: number;
    node_id: string;
    title: string;
    body: string;
    category: {
      name: string;
      slug: string;
    };
    user: {
      login: string;
    };
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  return new Octokit({ auth: token });
}

function getRepo(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY environment variable is required");
  }
  return { owner, repo };
}

function getDiscussionEvent(): DiscussionEvent {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH environment variable is required");
  }
  return JSON.parse(fs.readFileSync(eventPath, "utf-8"));
}

async function addDiscussionComment(
  discussionNodeId: string,
  body: string
): Promise<void> {
  const client = getOctokit();

  await client.graphql(
    `
    mutation($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
        comment { id }
      }
    }
  `,
    {
      discussionId: discussionNodeId,
      body,
    }
  );
}

/**
 * Extract URL from discussion body (from the template form)
 */
function extractUrl(body: string): string | null {
  // Look for URL in the "URL" section from the form
  const urlMatch = body.match(/### URL\s*\n\s*(https?:\/\/\S+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Fallback: look for any https URL (but not in metadata blocks)
  let bodyWithoutMetadata = body;
  let previous: string;
  do {
    previous = bodyWithoutMetadata;
    bodyWithoutMetadata = bodyWithoutMetadata.replace(/<!--[\s\S]*?-->/g, "");
  } while (bodyWithoutMetadata !== previous);
  const httpsMatch = bodyWithoutMetadata.match(/https?:\/\/[^\s\)]+/);
  if (httpsMatch) {
    return httpsMatch[0];
  }

  return null;
}

/**
 * Check if sync metadata is present in the discussion body
 */
function hasMetadata(body: string): boolean {
  return /<!--\s*metadata:type=\w+/.test(body);
}

/**
 * Extract type from discussion category
 * Categories are named: software-requests, hardware-requests, manufacturer-requests
 */
function extractType(categoryName: string): "software" | "hardware" | "manufacturer" {
  const name = categoryName.toLowerCase();
  if (name.startsWith("manufacturer")) return "manufacturer";
  if (name.startsWith("hardware")) return "hardware";
  // Default to software for any other category
  return "software";
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

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log("Auto-enriching new discussion...\n");

  const event = getDiscussionEvent();
  const discussion = event.discussion;
  const { owner, repo } = getRepo();

  console.log(`Discussion #${discussion.number}: ${discussion.title}`);
  console.log(`Category: ${discussion.category.name}`);
  console.log(`Created by: @${discussion.user.login}`);

  // Extract type from category
  const type = extractType(discussion.category.name);
  console.log(`Type: ${type}`);

  // Skip auto-processing for manufacturers (can trigger massive crawls)
  if (type === "manufacturer") {
    console.log("Manufacturer discussion - skipping auto-enrich");
    await addDiscussionComment(
      discussion.node_id,
      formatSuccess(
        "Manufacturer Request Received",
        `Thanks for the submission!

Manufacturer entries require manual processing because they can involve crawling many product pages.

**Next steps:**
- A maintainer will review and run \`/add\` to process this request
- Or use \`/enrich\` to preview the data first

*This may take longer than software/hardware requests.*`
      )
    );
    return;
  }

  // Extract URL from the discussion body
  const url = extractUrl(discussion.body);
  const hasSyncMetadata = hasMetadata(discussion.body);

  if (!url) {
    if (hasSyncMetadata) {
      // Sync submission without URL - ask for URL to complete
      console.log("Metadata found but no URL - awaiting URL");
      await addDiscussionComment(
        discussion.node_id,
        formatSuccess(
          "Sync Data Received",
          `Thanks for the submission!

We found sync metadata but need a **product URL** to fetch complete details.

**Next steps:**
- Edit this discussion to add the product URL
- Or a maintainer can run \`/crawl <url>\` followed by \`/submit\`

*The metadata will be used to enhance the crawled data.*`
        )
      );
    } else {
      // Manual submission without URL - error
      console.log("No URL found in discussion body, skipping auto-enrich");
      await addDiscussionComment(
        discussion.node_id,
        formatError(
          "URL Required",
          "No URL found in the discussion.",
          [
            "Edit this discussion to add a product URL",
            "Or a maintainer can use `/crawl <url>` to fetch data",
          ]
        )
      );
    }
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.log(`Invalid URL: ${url}`);
    await addDiscussionComment(
      discussion.node_id,
      formatError("Auto-Enrich Failed", `Invalid URL: ${url}`, [
        "Make sure the URL includes the protocol (https://)",
        "Use `/crawl <url>` to try again with a valid URL",
      ])
    );
    return;
  }

  console.log(`URL: ${url}`);

  // Step 1: Crawl
  console.log("\nStep 1/3: Crawling...");
  const crawlResult = await crawl({ url, type });

  if (!crawlResult.success || !crawlResult.data) {
    await addDiscussionComment(
      discussion.node_id,
      formatError(
        "Auto-Enrich Failed",
        `Could not fetch data from ${url}`,
        crawlResult.suggestions || ["Try using `/crawl <url>` manually"]
      )
    );
    return;
  }

  // Step 2: Parse
  console.log("Step 2/3: Parsing...");
  const existingManufacturers = [...getExistingManufacturers()];

  const parseResult = await parse({
    type,
    data: crawlResult.data as Record<string, unknown>,
    existingManufacturers,
  });

  if (!parseResult.success || parseResult.validationErrors?.length) {
    await addDiscussionComment(
      discussion.node_id,
      formatError(
        "Auto-Enrich Failed",
        "Could not parse the crawled data.",
        parseResult.validationErrors || ["Try using `/enrich` manually"]
      )
    );
    return;
  }

  const yaml = parseResult.yaml;
  const slug = parseResult.slug;

  if (!yaml || !slug) {
    await addDiscussionComment(
      discussion.node_id,
      formatError("Auto-Enrich Failed", "No YAML or slug generated.", [
        "Try using `/enrich` manually",
      ])
    );
    return;
  }

  // Check if slug already exists
  // Note: manufacturer type is handled earlier and returns, so type is "software" | "hardware" here
  const collection = type;
  const existing = slugExists(slug);
  if (existing.exists) {
    await addDiscussionComment(
      discussion.node_id,
      formatError(
        "Duplicate Entry",
        `\`${slug}\` already exists in the catalog.`,
        [
          `This ${type} is already in the ${existing.collection} collection`,
          "Use `/duplicate <slug>` to close this as a duplicate",
        ]
      )
    );
    return;
  }

  // Check if slug is in an open PR
  const inProgress = await slugInOpenPR(owner, repo, slug, collection);
  if (inProgress.exists) {
    await addDiscussionComment(
      discussion.node_id,
      formatError(
        "Already In Progress",
        `\`${slug}\` is already being added in PR #${inProgress.number}.`,
        [`View the existing PR: ${inProgress.url}`]
      )
    );
    return;
  }

  // Step 3: Create Draft PR
  console.log("Step 3/3: Creating draft PR...");

  // Extract name for PR title
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : slug;

  // Generate branch name
  const branchName = `contribution/${collection}/${slug}-${discussion.number}`;

  // Generate changeset
  const changesetSlug = `${slug}-${Date.now()}`;
  const changeset = generateChangeset(slug, type, name);

  try {
    const pr = await createPullRequest({
      owner,
      repo,
      branch: branchName,
      title: `Add ${name} (${type})`,
      body: `## Summary

Adds \`${slug}\` to the ${collection} collection.

**Submitted by:** @${discussion.user.login}
**Source URL:** ${url}

## Review Checklist

- [ ] Name and slug are correct
- [ ] Manufacturer exists (or is being added)
- [ ] Categories are appropriate
- [ ] Formats and platforms are accurate

---

Closes #${discussion.number}

🤖 Generated with [Claude Code](https://claude.com/claude-code)`,
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
      draft: true,
    });

    // Post success comment with PR link
    await addDiscussionComment(
      discussion.node_id,
      formatSuccess(
        "Draft PR Created",
        `Thanks for the submission, @${discussion.user.login}!

**Pull Request:** [#${pr.number} - Add ${name}](${pr.url})

The draft PR is ready for review. A maintainer will:
1. Review the generated YAML in the PR
2. Request changes if needed (comment on the PR)
3. Mark as ready for review and merge

---

*No further action needed here. All discussion moves to the PR.*`
      )
    );

    console.log(`\nDraft PR created: ${pr.url}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await addDiscussionComment(
      discussion.node_id,
      formatError("PR Creation Failed", errorMessage, [
        "A maintainer can use `/submit` to try again",
        "Or `/add` to redo the entire process",
      ])
    );
    console.error("PR creation error:", error);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

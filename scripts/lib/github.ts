/**
 * GitHub API helpers for discussion commands
 */

import fs from "node:fs";
import { Octokit } from "@octokit/rest";

// =============================================================================
// TYPES
// =============================================================================

export interface DiscussionContext {
  owner: string;
  repo: string;
  discussionNumber: number;
  discussionNodeId: string;
  discussionBody: string;
  commentBody: string;
  commentId: string;
  commentAuthor: string;
}

export interface DiscussionMetadata {
  version: number;
  type: "software" | "hardware" | "manufacturer";
  submittedAt: string;
  source: "studio-app" | "manual";
  identifier?: string;
  canonicalId?: string;
  formatIdentifiers?: Record<string, string>;
  detectedFormats?: string[];
  categories?: string[];
  enrichment?: {
    crawledAt?: string;
    parsedAt?: string;
    crawlUrl?: string;
    yamlPreview?: string;
    validationErrors?: string[];
  };
}

// =============================================================================
// OCTOKIT INSTANCE
// =============================================================================

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

// =============================================================================
// CONTEXT PARSING
// =============================================================================

export function getDiscussionContext(): DiscussionContext {
  // Parse GitHub event data from environment
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH environment variable is required");
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf-8"));

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY environment variable is required");
  }

  return {
    owner,
    repo,
    discussionNumber: event.discussion.number,
    discussionNodeId: event.discussion.node_id,
    discussionBody: event.discussion.body,
    commentBody: event.comment.body,
    commentId: event.comment.node_id,
    commentAuthor: event.comment.user.login,
  };
}

// =============================================================================
// METADATA PARSING
// =============================================================================

const METADATA_REGEX = /<!--\s*metadata:type=(\w+)\s*\n([\s\S]*?)\s*-->/;

export function parseDiscussionMetadata(
  body: string
): DiscussionMetadata | null {
  const match = body.match(METADATA_REGEX);
  if (!match) {
    return null;
  }

  const type = match[1] as DiscussionMetadata["type"];
  const base64Data = match[2].trim();

  try {
    const jsonStr = Buffer.from(base64Data, "base64").toString("utf-8");
    const data = JSON.parse(jsonStr);
    return {
      ...data,
      type,
    };
  } catch {
    return null;
  }
}

export function encodeMetadata(metadata: DiscussionMetadata): string {
  const { type, ...rest } = metadata;
  const jsonStr = JSON.stringify(rest);
  const base64 = Buffer.from(jsonStr).toString("base64");
  return `<!-- metadata:type=${type}\n${base64}\n-->`;
}

// =============================================================================
// DISCUSSION COMMENTS
// =============================================================================

export async function addDiscussionComment(
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

export async function addReactionToComment(
  commentNodeId: string,
  reaction: "THUMBS_UP" | "THUMBS_DOWN" | "ROCKET" | "EYES" | "CONFUSED"
): Promise<void> {
  const client = getOctokit();

  await client.graphql(
    `
    mutation($subjectId: ID!, $content: ReactionContent!) {
      addReaction(input: {subjectId: $subjectId, content: $content}) {
        reaction { content }
      }
    }
  `,
    {
      subjectId: commentNodeId,
      content: reaction,
    }
  );
}

// =============================================================================
// PULL REQUEST CREATION
// =============================================================================

export interface CreatePROptions {
  owner: string;
  repo: string;
  branch: string;
  baseBranch?: string;
  title: string;
  body: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  draft?: boolean;
}

export async function createPullRequest(
  options: CreatePROptions
): Promise<{ number: number; url: string }> {
  const client = getOctokit();
  const baseBranch = options.baseBranch || "main";

  // Get the base branch SHA
  const { data: ref } = await client.git.getRef({
    owner: options.owner,
    repo: options.repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = ref.object.sha;

  // Create a new branch
  await client.git.createRef({
    owner: options.owner,
    repo: options.repo,
    ref: `refs/heads/${options.branch}`,
    sha: baseSha,
  });

  // Create blobs for each file
  const blobs = await Promise.all(
    options.files.map(async (file) => {
      const { data: blob } = await client.git.createBlob({
        owner: options.owner,
        repo: options.repo,
        content: Buffer.from(file.content).toString("base64"),
        encoding: "base64",
      });
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  // Get the base tree
  const { data: baseCommit } = await client.git.getCommit({
    owner: options.owner,
    repo: options.repo,
    commit_sha: baseSha,
  });

  // Create a new tree
  const { data: tree } = await client.git.createTree({
    owner: options.owner,
    repo: options.repo,
    base_tree: baseCommit.tree.sha,
    tree: blobs,
  });

  // Create a commit
  const { data: commit } = await client.git.createCommit({
    owner: options.owner,
    repo: options.repo,
    message: options.title,
    tree: tree.sha,
    parents: [baseSha],
  });

  // Update the branch reference
  await client.git.updateRef({
    owner: options.owner,
    repo: options.repo,
    ref: `heads/${options.branch}`,
    sha: commit.sha,
  });

  // Create the pull request
  const { data: pr } = await client.pulls.create({
    owner: options.owner,
    repo: options.repo,
    title: options.title,
    body: options.body,
    head: options.branch,
    base: baseBranch,
    draft: options.draft,
  });

  return {
    number: pr.number,
    url: pr.html_url,
  };
}

// =============================================================================
// DISCUSSION MANAGEMENT
// =============================================================================

export async function closeDiscussion(
  discussionNodeId: string,
  reason: "RESOLVED" | "OUTDATED" | "DUPLICATE"
): Promise<void> {
  const client = getOctokit();

  await client.graphql(
    `
    mutation($discussionId: ID!, $reason: DiscussionCloseReason!) {
      closeDiscussion(input: {discussionId: $discussionId, reason: $reason}) {
        discussion { id }
      }
    }
  `,
    {
      discussionId: discussionNodeId,
      reason,
    }
  );
}

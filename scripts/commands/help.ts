/**
 * /help command handler
 *
 * Displays available slash commands and their usage.
 * Usage: /help
 */

import type { DiscussionContext, DiscussionMetadata } from "../lib/github.js";
import { formatSuccess, type CommandResult } from "./utils.js";

export async function handleHelp(
  _ctx: DiscussionContext,
  _metadata: DiscussionMetadata | null,
  _args: string[],
  _flags: Record<string, boolean | string>
): Promise<CommandResult> {
  const helpText = `## Available Commands

| Command | Description |
|---------|-------------|
| \`/help\` | Show this help message |
| \`/add [url]\` | **One-shot**: crawl + parse + submit in one command |
| \`/crawl [url]\` | Fetch product data from a URL |
| \`/parse\` | Validate and structure crawled data into YAML |
| \`/enrich\` | Run crawl + parse in one step |
| \`/preview\` | Show a YAML preview without creating a PR |
| \`/submit\` | Create a PR with the generated YAML |
| \`/reject <reason>\` | Close the discussion with a rejection reason |
| \`/duplicate <slug>\` | Mark as duplicate of an existing entry |

---

### Automatic Flow

New discussions automatically create a **draft PR** - no commands needed!

1. User submits discussion with URL
2. Bot creates draft PR with generated YAML
3. Review and merge the PR
4. Discussion auto-closes

### When to Use Commands

Commands are for edge cases:
- \`/add\` - Retry if auto-PR failed
- \`/reject\` - Close invalid requests
- \`/duplicate\` - Mark as duplicate

### Command Details

#### \`/add [url] [--draft]\`
One-shot command that runs crawl → parse → submit in sequence. Use \`--draft\` for a draft PR.

#### \`/crawl [url]\`
Fetches product information from the manufacturer's website. If no URL is provided, uses the URL from the discussion.

#### \`/parse\`
Validates crawled data and generates a YAML file.

#### \`/enrich\`
Runs \`/crawl\` + \`/parse\` in sequence (without submitting).

#### \`/submit [--draft]\`
Creates a pull request with the generated YAML.

#### \`/reject <reason>\`
Closes the discussion with the provided reason.

#### \`/duplicate <slug>\`
Closes as duplicate, linking to the existing catalog entry.

---

*Only maintainers can run slash commands.*`;

  return {
    success: true,
    message: formatSuccess("Slash Commands Help", helpText),
  };
}

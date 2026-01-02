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
| \`/crawl [url]\` | Fetch product data from a URL |
| \`/parse\` | Validate and structure crawled data into YAML |
| \`/enrich\` | Run crawl + parse in one step |
| \`/preview\` | Show a YAML preview without creating a PR |
| \`/submit\` | Create a PR with the generated YAML |
| \`/reject <reason>\` | Close the discussion with a rejection reason |
| \`/duplicate <slug>\` | Mark as duplicate of an existing entry |

---

### Typical Workflow

1. **Start a discussion** using the "Add Software" template
2. **Enrich the data**: \`/enrich\` or \`/crawl <url>\` followed by \`/parse\`
3. **Review the YAML**: Check the generated output
4. **Submit**: \`/submit\` to create a PR (or \`/submit --draft\` for draft PR)

### Command Details

#### \`/crawl [url]\`
Fetches product information from the manufacturer's website. If no URL is provided, it will try to use the Website field from the discussion.

#### \`/parse\`
Takes the crawled data and validates it against the catalog schema, generating a properly formatted YAML file.

#### \`/enrich\`
Convenience command that runs \`/crawl\` and \`/parse\` in sequence.

#### \`/submit [--draft]\`
Creates a pull request with the generated YAML. Use \`--draft\` to create a draft PR for further review.

#### \`/reject <reason>\`
Closes the discussion with the provided reason. Use for requests that don't meet contribution guidelines.

#### \`/duplicate <slug>\`
Closes the discussion as a duplicate, linking to the existing catalog entry.

---

*Only maintainers can run slash commands.*`;

  return {
    success: true,
    message: formatSuccess("Slash Commands Help", helpText),
  };
}

---
description: Deep review of all branch changes vs main with data quality analysis
---

Perform an exhaustive review of all data changes between the main branch and the current branch tip. Use extended
thinking to analyze every detail.

## Process

### Phase 1: Gather Context

1. Run `git rev-parse --abbrev-ref HEAD` to confirm the current branch
2. Run `git merge-base main HEAD` to find the common ancestor
3. Run `git diff main...HEAD --stat` to get an overview of all changed files
4. Run `git diff main...HEAD` to get the full diff
5. Run `git log main..HEAD --oneline` to see all commits on this branch
6. Read `schema/CONTEXT.md` for all valid categories, formats, platforms, and locales (auto-generated reference)

### Phase 1b: Run Automated Quality Checks

Run these validation scripts to gather automated analysis:

1. `pnpm validate` - Schema validation with **line numbers and error codes** (e.g., `E104:12: Invalid category`)
2. `pnpm identifier-coverage --json` - Check identifier coverage for software entries
3. `pnpm staleness-report --json` - Check for entries missing verification metadata

Parse the JSON output from these tools to incorporate into the agent analysis below.

### Phase 2: Parallel Deep Analysis (use 4 Opus agents concurrently)

Launch these agents in parallel, each performing deep analysis with extended thinking:

**Agent 1 - Schema & Data Quality:**

Start by reviewing the output from `pnpm validate` - errors include:

- Error codes (E1xx-E4xx) with documentation links
- Line numbers pointing to exact location of issues
- Suggested fixes for common errors

Then perform deeper analysis:

- Read each modified YAML file in full
- Verify all required fields are present:
  - Manufacturers: slug, name, website
  - Software: slug, name, manufacturer, primaryCategory, platforms, identifiers
  - Hardware: slug, name, manufacturer, primaryCategory, description
- Cross-reference with `schema/CONTEXT.md` for valid categories, formats, platforms
- Check that manufacturer references resolve to existing files in `data/manufacturers/`
- Verify slug matches the filename (e.g., `serum.yaml` should have `slug: serum`)
- Check description quality (too short, generic, or missing?)
- Validate markdown in description/details/specs fields
- Check that `id` field is NOT included in new entries (IDs are assigned by CI)
- Verify prices have both `amount` (number) and `currency` (string)
- Check links have `type` and `url` at minimum

**Identifier & Staleness Analysis** (from automated tools):

- Review `identifier-coverage` output for new software entries missing plugin identifiers
- Check if new entries have `verification` metadata (lastVerified, status)
- Flag high-priority missing identifiers (AU/VST3/AAX formats without bundle IDs)

**Agent 2 - Slug & ID Integrity:**

- Read `.slug-index.json` to check for slug collisions across all collections
- Verify all slugs are lowercase with hyphens only (`^[a-z0-9][a-z0-9-]*[a-z0-9]$` or single char `^[a-z0-9]$`)
- Check that existing IDs have not been modified (compare with main branch)
- Use fuzzy matching (Levenshtein distance) to flag near-duplicate names across all data files
- Verify no two entries share the same slug across manufacturers, software, and hardware

**Agent 3 - Translation Audit:**

- Check `translations` blocks use only approved locale codes: de, es, fr, ja, ko, pt-BR, zh
- Validate translatable fields are limited to: description, details, specs, website, links, io
- For hardware I/O translations, verify `originalName` matches an actual IO entry name
- Report translation coverage gaps: entries with descriptions but no translations
- Check that translated links have proper structure (type, title, url)
- Verify no untranslatable fields appear in translation blocks

**Agent 4 - CLAUDE.md & Structural Review:**

- Read the root CLAUDE.md and check every change against documented conventions
- Verify YAML formatting follows Prettier config (100 char width, preserve prose)
- Check naming conventions: slugs lowercase with hyphens
- Verify primaryCategory is appropriate for the entry type
- Check link structure consistency: every link should have `type` and `url`; video links need `videoId` and `provider`
- Look for structural inconsistencies with existing entries (field ordering, formatting patterns)
- Verify no unwanted files are included (.DS_Store, editor files)

### Phase 3: Synthesis and Final Review

After all parallel agents complete:

1. Collect all findings from the 4 agents
2. De-duplicate similar issues
3. Prioritize findings by severity:
   - **BLOCKING**: Missing required fields, invalid schema references, slug collisions, modified IDs
   - **WARNING**: Missing recommended fields, description quality issues, translation gaps
   - **INFO**: Formatting suggestions, optional field additions, structural improvements
4. For each finding, provide:
   - File path with line number (e.g., `data/software/serum.yaml:16`)
   - Error code if from automated validation (e.g., `E104`, `E200`)
   - Clear description of the issue
   - Suggested fix or resolution
   - Link to docs if applicable (from `docs/VALIDATION_ERRORS.md`)

### Phase 4: Holistic Check

Perform a final pass asking:

- Do the new entries represent complete, useful catalog additions?
- Are there obvious missing pieces (manufacturer without software, software without identifiers)?
- Would the data pass `pnpm validate` and `pnpm build` successfully?
- Are there any data quality concerns that automated validation wouldn't catch?

## Output Format

Present findings in this structure:

```text
## Data Review: [branch-name]

### Summary
[1-2 sentence overview of the branch changes and overall assessment]

### Changes Overview
- Files changed: X (Y manufacturers, Z software, W hardware)
- New entries: X
- Modified entries: X

### BLOCKING (must fix before merge)

1. `data/software/example.yaml:12` - **E104**: Invalid category 'synth'. Did you mean 'synthesizer'?
   - Docs: docs/VALIDATION_ERRORS.md#e104-invalid-category

[numbered list with file:line references and error codes]

### WARNING (should fix)

[numbered list with file references]

### INFO (suggestions)

[numbered list with file references]

### Identifier Coverage (new software)

| Entry | AU | VST3 | AAX | CLAP | Status |
|-------|-----|------|-----|------|--------|
| example | ✓ | ✓ | - | - | Partial |

### Translation Coverage
| Entry | de | es | fr | ja | ko | pt-BR | zh |
|-------|----|----|----|----|----|----|-----|
[table rows with checkmarks or dashes]

### Overall Assessment
[Final evaluation and recommendation: ready to merge, needs fixes, or needs discussion]
```

## Notes

- Use extended thinking for deep analysis
- Read full file context, not just diff hunks
- Cross-reference changes across files (e.g., new software should reference existing manufacturer)
- Be thorough but avoid false positives
- Focus on data quality issues that automated validation might miss

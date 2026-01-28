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
6. Read the schema files for reference: `schema/categories.yaml`, `schema/formats.yaml`, `schema/platforms.yaml`, `schema/locales.yaml`

### Phase 2: Parallel Deep Analysis (use 4 Opus agents concurrently)

Launch these agents in parallel, each performing deep analysis with extended thinking:

**Agent 1 - Schema & Data Quality:**

- Read each modified YAML file in full
- Verify all required fields are present:
  - Manufacturers: slug, name, website
  - Software: slug, name, manufacturer, primaryCategory, platforms, identifiers
  - Hardware: slug, name, manufacturer, primaryCategory, description
- Verify categories reference valid values from `schema/categories.yaml`
- Verify formats reference valid values from `schema/formats.yaml`
- Verify platforms reference valid values from `schema/platforms.yaml`
- Check that manufacturer references resolve to existing files in `data/manufacturers/`
- Verify slug matches the filename (e.g., `serum.yaml` should have `slug: serum`)
- Check description quality (too short, generic, or missing?)
- Validate markdown in description/details/specs fields
- Check that `id` field is NOT included in new entries (IDs are assigned by CI)
- Verify prices have both `amount` (number) and `currency` (string)
- Check links have `type` and `url` at minimum

**Agent 2 - Slug & ID Integrity:**

- Read `.slug-index.json` to check for slug collisions across all collections
- Verify all slugs are lowercase with hyphens only (`^[a-z0-9-]+$`)
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
   - File path reference
   - Clear description of the issue
   - Suggested fix or resolution

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
[numbered list with file references]

### WARNING (should fix)
[numbered list with file references]

### INFO (suggestions)
[numbered list with file references]

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

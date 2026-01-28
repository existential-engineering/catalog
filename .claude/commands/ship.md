---
description: Run quality checks, create changeset, and open PR
---

Run all quality checks (mirroring the CI pipeline), create a changeset for the changes, and open a pull request.

## Process

### Phase 1: Pre-flight Checks

1. Run `git rev-parse --abbrev-ref HEAD` to get the current branch name
2. **STOP** if on `main` branch - this command should only run on feature branches
3. Run `git status --porcelain` to check for uncommitted changes
4. Run `git log main..HEAD --oneline` to see commits on this branch
5. Verify `node_modules` exists (if not, run `pnpm install`)

### Phase 2: Quality Checks (Sequential, Fail Fast)

Run each check in order. **Stop immediately if any check fails** and report the error to the user.
These checks mirror `.github/workflows/validate.yml` so issues are caught locally before pushing.

1. `pnpm typecheck` - TypeScript type checking
2. `pnpm validate` - Full YAML schema validation (Zod schemas, manufacturer references, slug-filename match, categories, formats, platforms, markdown, IDs)
3. `pnpm validate:translations` - Translation validation (approved locales, valid fields, I/O translation references)
4. `pnpm format:check` - Prettier formatting check

   **If formatting fails:** Ask the user if they want to auto-fix with `pnpm format`. If yes, run it and stage the changes.

5. `pnpm check-slugs` - Slug uniqueness against `.slug-index.json`
6. `pnpm build 0` - Test database build (ensures YAML can be compiled to valid SQLite)

### Phase 3: Analyze Changes

1. Run `git diff main...HEAD --stat` to get an overview of changed files
2. Run `git diff main...HEAD --name-only` to list all modified files
3. Categorize changes by examining file paths:
   - `data/manufacturers/*` - Manufacturer entries
   - `data/software/*` - Software entries
   - `data/hardware/*` - Hardware entries
   - `schema/*` - Schema definitions
   - `scripts/*` - Build/validation tooling
4. For each changed data file, determine if it's new or modified (compare against main)
5. Analyze the changes to determine:
   - **Type**: What kind of change is this?
     - `feat` - New entries added
     - `fix` - Corrections to existing entries
     - `enhance` - Additional data for existing entries (descriptions, links, translations)
     - `refactor` - Schema or structural changes
     - `chore` - Maintenance, dependency updates
     - `docs` - Documentation changes
   - **Subject**: Brief description (lowercase, no period, max 72 chars total for header)

### Phase 4: Create Changeset

Ask the user to confirm or adjust:

- **Changeset type**:
  - `minor` - New entries or schema additions (default for new data)
  - `patch` - Corrections, updates to existing entries, translations
  - `major` - Breaking schema changes
- **Changeset message**: Brief description of the change

Create a changeset file at `.changeset/<random-name>.md` with format:

```markdown
---
"catalog": patch
---

Brief description of the change
```

### Phase 5: Stage and Commit Changes

1. Run `git status` to see what changed (formatted files, changeset)
2. If there are changes to commit:
   - Stage the changeset: `git add .changeset/`
   - Stage any auto-formatted files: `git add -u`
   - Create a commit with message: `chore: add changeset`
3. Push the branch: `git push -u origin HEAD`

### Phase 6: Create Pull Request

Use `gh pr create` with:

- **Title**: `type: subject`
  - Example: `feat: add Serum and Xfer Records`
  - Example: `fix: correct Diva platform listing`
  - Example: `enhance: add translations for Ableton Live`
- **Body**: Use this template with a HEREDOC:

```markdown
## Summary

<1-3 bullet points describing the changes>

## Changes

| File | Type | Action |
|------|------|--------|
| data/software/serum.yaml | software | added |
| data/manufacturers/xfer-records.yaml | manufacturer | added |

## Validation

- [x] TypeScript type check passed
- [x] YAML schema validation passed
- [x] Translation validation passed
- [x] Formatting check passed
- [x] Slug uniqueness verified
- [x] Database build successful
```

Return the PR URL to the user when complete.

## Error Handling

- If any quality check fails, **stop** and report the specific errors
- If on `main` branch, **stop** and ask user to switch to a feature branch
- If `gh` CLI is not authenticated, instruct user to run `gh auth login`
- If there are merge conflicts with main, suggest rebasing first

## Output

When complete, provide:

1. Summary of quality checks passed
2. Changeset created (filename and contents)
3. Commit hash (if changes were committed)
4. PR URL with title

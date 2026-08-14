# CI configuration notes

## `assign-ids` needs a GitHub App identity

`assign-ids.yml` assigns IDs to new entries and pushes an auto-commit back onto
the PR branch. That push has to be made by something other than the default
`GITHUB_TOKEN`.

### Why

A push made with `GITHUB_TOKEN` does not get treated as a normal contributor
push. Depending on the day it either triggers **no** workflow runs at all
(GitHub's guard against workflows re-triggering themselves) or creates runs
that sit in `action_required` waiting for manual approval. Both behaviours were
observed on the same afternoon, 2026-08-14, across PRs 582-587.

Either way the outcome is the same and easy to miss: `validate` and `audit` are
**required** status checks on `main` (ruleset `11289515`), and neither reports
on the commit `assign-ids` just pushed. A run stuck in `action_required` does
not show up in `gh pr checks` output at all, so the PR does not go red. It
quietly shows *fewer* checks than it should, every check it does show is green,
and the PR is unmergeable with nothing obviously wrong.

Pushing under an App identity makes the resulting `synchronize` event look like
any other contributor push, so the required checks run and report normally.

### Setup

1. Create a GitHub App on the org (Settings → Developer settings → GitHub Apps).
   It needs one permission: **Repository → Contents → Read and write**.
2. Install it on `existential-engineering/catalog`.
3. Generate a private key and record the App's numeric ID.
4. Add them to the repo:
   - variable `ASSIGN_IDS_APP_ID` — the numeric App ID (a variable, not a
     secret, because the workflow tests it for emptiness and secrets are not
     readable in `if:` conditions)
   - secret `ASSIGN_IDS_APP_PRIVATE_KEY` — the full PEM contents

```bash
gh variable set ASSIGN_IDS_APP_ID --repo existential-engineering/catalog --body '<app-id>'
gh secret   set ASSIGN_IDS_APP_PRIVATE_KEY --repo existential-engineering/catalog < app.private-key.pem
```

Until both exist the workflow falls back to `GITHUB_TOKEN`, so it keeps working
exactly as before rather than failing outright.

### Verifying it worked

Open a catalog PR that adds an entry with no `id:` and let `assign-ids` commit.
Then confirm the required checks ran on the **bot's** commit, not just yours:

```bash
gh pr checks <PR> --repo existential-engineering/catalog --json name,bucket \
  --jq '[.[]|"\(.name)=\(.bucket)"]|join(" ")'
```

`validate=pass` and `audit=pass` must both be present. If they are missing, the
App is not wired up and the run is waiting for approval:

```bash
gh run list --repo existential-engineering/catalog --branch <branch> \
  --json databaseId,conclusion,headSha \
  --jq '.[]|select(.conclusion=="action_required")|.databaseId'
```

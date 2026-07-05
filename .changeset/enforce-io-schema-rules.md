---
"catalog": patch
---

Enforce recurring import rules in CI and refresh the schema doc.

Regenerate `schema/CONTEXT.md` (previously stale, blocked by orphan
category mappings) so `speaker-level`, `speakon`, `binding-post`,
`euroblock`, `spring-terminal` and other IO enums are visible to the
importer; add a CI freshness gate + pre-commit hook so it can't drift.

Harden `pnpm validate`: hardware `io` entries now require
`maxConnections` and (except on played instruments) `position`, and
every product entry requires `primaryCategory`. Backfill the handful of
existing stragglers. Add the passive-speaker `speaker-level` rule and a
URL-whitespace rule to the schema docs and CodeRabbit path instructions.

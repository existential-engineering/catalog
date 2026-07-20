---
"catalog": minor
---

Add name-hygiene validation and bundle-entry auditing.

`pnpm validate` now hard-fails on mechanical name junk (E118: trademark
symbols, HTML entities, stray leading/trailing separators, doubled
spaces) and warns when a name starts with the manufacturer's display
name (W129) or contains a tagline-style en/em-dash or pipe separator
(W130, with a reviewed exclusion list for official stylings).
`pnpm dataset:audit` gains two Tier-2 review checks: name-tagline
(plain-hyphen suffixes that may be scraped taglines) and bundle-entry
(suite/bundle categories or bundle-ish software names, with an
allowlist for integrated products). Conventions documented in CLAUDE.md
and docs/VALIDATION_ERRORS.md.

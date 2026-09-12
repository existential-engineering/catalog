---
"catalog": minor
---

Add the identifier writer and the lanes that feed it.

Software identifiers were the thinnest field in the catalog (247 of
4,443 entries) and the one plugin sync depends on. Every observed
identifier now lands through one writer, `scripts/lib/identifier-writer.ts`,
which refuses a `local.*` fallback, an invalid value, a format already
resolving to a different id and a vendor segment naming another maker,
and adds an unlisted format beside its id and a version the entry lacks.
It is fed by `pnpm identifiers:from-telemetry` (Studio's name-match
observations, two or more installs), `pnpm identifiers:apply` (a
reviewed TSV), `pnpm identifiers:from-registry` (the Open Audio Stack
registry) and `pnpm identifiers:from-juce` (a JUCE project's build file).
`vst3` accepts the 32-digit class id beside the bundle id. No data file
changes and `schema_version` is unchanged.

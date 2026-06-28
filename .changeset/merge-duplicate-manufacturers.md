---
"catalog": patch
---

Merge 42 duplicate manufacturer stubs into their canonical entries.

Each pair was the same company split across two slugs (spelling, spacing,
accent, or typo variants — e.g. `ohmforce`/`ohm-force`,
`hexinverter-lectronique`/`hexinverter-electronique`,
`moog-music-inc`/`moog`). The duplicate's display name (and any of its own
search terms) is preserved on the surviving entry via `searchTerms`, 19
products were repointed to the canonical slug, and several manufacturer URLs
were corrected to their real homepages. Known distinct-company name
collisions (e.g. Jackson guitars vs Jackson Audio, Martin guitars vs Martin
Audio, Pulsar Audio vs Pulsar Modular) were deliberately left untouched.

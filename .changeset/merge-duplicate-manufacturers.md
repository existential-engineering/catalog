---
"catalog": patch
---

Merge 44 duplicate manufacturer stubs into their canonical entries.

Each pair was the same company split across two slugs (spelling, spacing,
accent, or typo variants — e.g. `ohmforce`/`ohm-force`,
`hexinverter-lectronique`/`hexinverter-electronique`,
`moog-music-inc`/`moog`). The duplicate's display name (and any of its own
search terms) is preserved on the surviving entry via `searchTerms`, 19
products were repointed to the canonical slug, and several manufacturer URLs
were corrected to their real homepages. Known distinct-company name
collisions (e.g. Jackson guitars vs Jackson Audio, Martin guitars vs Martin
Audio, Pulsar Audio vs Pulsar Modular) were deliberately left untouched.

Also backfilled official homepage URLs for four distinct (non-merged)
stubs that had none: `mod-sound`, `arc` (Analogue Research), `jmk-audio`,
and `jmk-music-pedals`.

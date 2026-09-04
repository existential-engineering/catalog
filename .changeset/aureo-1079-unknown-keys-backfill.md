---
"catalog": patch
---

Backfill the 465 unknown keys across 337 entries so `pnpm validate` reports no W132 on main.

Every key Zod was silently stripping now lives where the schema keeps
it or is gone: `versions[].notes` and `changes` become `description`,
`versions[].date` becomes `releaseDate`, `links[].label` becomes
`title`, `prices[].type` one-time and perpetual become `term: perpetual`,
a top-level `discontinued: true` becomes the `discontinued` category,
and the Grado S550 cable terminations become `variants`. Dropped with
no home: `platforms` on 219 STL content entries, a `type: software`
marker on 13 discoDSP entries, price notes, labels and regions, and 32
conditional discount, demo, intro and bundle price rows that were never
a term (AUREO-1079).

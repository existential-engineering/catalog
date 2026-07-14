---
"catalog": patch
---

Replace aggregator canonical `url`s (KVR, ModularGrid, Plugin Boutique,
Best Service, ...) with the makers' own official pages across product and
manufacturer entries, verified live. Entries whose maker is confirmed gone
keep their aggregator link as the only remaining page. Adds
`scripts/promote-canonical-urls.ts` (link promotion + researched-mapping
apply, with live URL verification) and an `aggregator-url` check to
`pnpm dataset:audit` so new imports can't silently reintroduce these.

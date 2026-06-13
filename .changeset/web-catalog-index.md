---
"catalog": minor
---

Emit a lean `catalog-index.json` web index alongside the SQLite build.

Adds `scripts/build-catalog-index.ts` (run via `pnpm build:index`),
which mirrors the SQLite source-of-truth loading to produce a
slim JSON summary of categories, brands, and products for
machine-readable / web consumption. The release workflow builds
and checksums the index and attaches it to the GitHub Release
next to `catalog.sqlite`.

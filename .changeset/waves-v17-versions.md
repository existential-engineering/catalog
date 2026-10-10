---
"catalog": patch
---

Add the Waves V17 version (17.1.42) to the 54 Waves entries that listed only
16.7.33 or no version, so an installed 16.7.33 no longer reads as current.
Each product was checked against its waves.com page (live, lists V17) and the
2026-06-23 "across-the-board update to V17" release note before the row was
written through `pnpm identifiers:apply`. The reviewed list is
`docs/reviews/2026-10-unmatched-makers.tsv`.

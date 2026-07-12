---
"catalog": patch
---

Resolve dataset audit (#365) and discontinued backlog (#362) findings.

**Duplicate-name groups (#365):**

- Merged true duplicates onto canonical manufacturer-slug filenames, keeping the
  richer entry and pulling in `formats`/`categories` from the thin twin: 10 uJAM
  Beatmaker instruments (`ujam-beatmaker-*` → `ujam-instruments-beatmaker-*`),
  WA Production Babylon 2 and BassShaper (`w-a-production-*` → `wa-production-*`),
  Airwindows Average (two blog-post imports of one plugin), and the DW
  Satin-Black-over-Brass snare and 4-Piece Performance Series kit (duplicate SKU
  codes).
- Folded the three Taylor T5z Pro colorways (Cayenne Red, Harbor Blue, Tobacco
  Sunburst) into one entry with a cosmetic `variants` array.
- Renamed `fostex-t50rpmk4g-2` → `fostex-t50rpmk4g-plus` to match its product
  name (T50RPmk4g+); it is a distinct SKU, not a duplicate.
- Fixed the audit's `normalizeName` to treat a trailing `+` as a significant
  `plus` token so distinct SKUs (ProFX10v3 vs ProFX10v3+, Prime 4 vs Prime 4+,
  etc.) no longer false-collide. This clears ~12 false-positive groups whose
  members were already correctly modeled as separate entries.

**Discontinued backlog (#362):**

- Auto-tagged 14 Tier-1 (superseded, missing `discontinued`) entries.
- Reviewed and tagged 34 Tier-2 entries with explicit discontinuation language
  (13 Audeze legacy headphones, 14 dbx Professional Audio units, Krotos and
  Synchro Arts software, and others). Excluded `dubreq-ltd-stylophone-s2` — its
  "discontinued in 1975" refers to the original Stylophone; the S2 is current.

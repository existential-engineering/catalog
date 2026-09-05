---
"catalog": patch
---

Layout hints (`rowPosition`/`columnPosition`) are now validated for shape, and the five entries that carry them were checked against their manuals and photos (AUREO-1115).

`pnpm validate` fails a hint that is not a positive integer (E122), one
set without its partner (E123), a cell occupied twice on one edge (E124)
and an edge where some ports carry a hint and others none (E125), because
Studio takes a hinted side down the grid path and back-fills the rest
row-major. `pnpm dataset:audit` reports hint coverage per collection and
for modular entries. The three Black Lion patchbays gain the
`columnPosition: 1` their single-column rows implied, the PBR-8 gains
the mult row its front panel shows, and the Eventide H90's USB-C and
power jacks move to the lower row the quick reference guide draws them
on. The Apollo Twin X matched its hardware manual and is unchanged.

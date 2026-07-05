---
"catalog": patch
---

Split aggregated hardware `io` entries into individual ports.

Where a single `io` entry collapsed multiple physical jacks into an
inflated `maxConnections` (e.g. `xlr, maxConnections: 8`), split it into
one entry per physical connector, each `maxConnections: 1`, preserving
signal type, connection, and position. Covers 109 files (308 entries →
individual ports). Heterogeneous, single-stereo-jack, and ambiguous
cases were left unchanged for manual review.

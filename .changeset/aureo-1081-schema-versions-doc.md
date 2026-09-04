---
"catalog": patch
---

The schema version history now documents every migration through version 22, including the optional price `term` column, so a consumer can see the four breaking changes it previously omitted.

`docs/SCHEMA_VERSIONS.md` is the compatibility contract consumers are
told to read, and nothing in the repo referenced it, so it drifted. It
stopped at "Version 10 (Current)" while `scripts/schema.sql` had reached
22, hiding versions 13, 15, 16 and 17 as breaking, and hiding the `term`
column of catalog#715. It had also mislabelled the v17
`hardware_revisions` rename as a second "Version 8". Versions 11 through
22 are backfilled from the `schema_migrations` rows, the mislabelled
entry is corrected, and a guard test diffs the doc against those rows so
the next migration cannot land without its entry (AUREO-1081).

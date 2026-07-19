---
"catalog": minor
---

Add telemetry-reported software versions (112 versions, 110 entries).

Backfills versions that Studio's catalog sync reported as installed
but missing (`catalog_version_not_found`, March–July exports).
Dominated by the Waves 16.x line (94 entries), plus Antares (10),
FabFilter (5), Kontakt, Bitwig Studio, UA Ravel, sonible truelevel,
and IK Multimedia. Adds the reusable
`scripts/add-telemetry-versions.ts` used to apply them.

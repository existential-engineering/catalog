---
"catalog": minor
---

Add an additive `hp` field to hardware (Eurorack panel width, positive integer) with a nullable `hardware.hp` column (schema migration 23, no `schema_version` bump), a `modular-missing-hp` audit finding with hp coverage, a reproducible `pnpm hp:backfill` pass, and `hp` on 359 of the 408 modular entries from their own prose, maker pages and ModularGrid.

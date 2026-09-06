---
"catalog": patch
---

Seven products superseded by a newer model are now marked discontinued (Belle Epoch, Kilobyte, Micro Clock mkII, Brick Lane 500, Phoenix, Tape Fiasco, Mininn Drum), and Splice's own Astra page is no longer flagged as an aggregator link.

Scripts: `validate.ts` and `build-sqlite.ts` no longer run on import.
Each main-guards its tail and exports its units, and both gain
characterization tests (#645, #646): the error-code mapping, markdown
scanning, supersedes cycle detection and every advisory warning for the
validator, and a fixture catalog built through the real `buildDatabase`
into a temp file for the SQLite build, asserting row counts, populated
FTS tables, alias search terms, compatibility edges, lineage, io
flattening, variants and translations. `buildDatabase` takes a
`{ dataDir, outputFile, version }` options object defaulting to the
production paths, so `pnpm build` is unchanged.

`isManufacturerOwnDomain` compares the manufacturer slug against each
host label rather than their concatenation (#644), so a maker's
subdomain or a multi-part TLD reads as the maker's own site. Measured
against the dataset, exactly one entry changes.

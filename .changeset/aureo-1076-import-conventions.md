---
"catalog": patch
---

Validator warns on unknown keys (W132) and untermed same-currency prices (W131), prices gain an optional term, scoped format normalises entry shape.

`pnpm validate --strict-unknown-keys` turns W132 into E121 for the import
lanes. `pnpm format <files>` now rewrites alias categories, drops a
secondary category equal to the primary, coerces details and specs to
block scalars and orders io fields. The unscoped run is unchanged. The
sqlite build carries an additive `term` column on every prices table.
CLAUDE.md gains the I/O modelling conventions, the price term, unknown
key and ios rules, the import supersedes policy and the known false
findings list, mirrored in .coderabbit.yaml (AUREO-1076).

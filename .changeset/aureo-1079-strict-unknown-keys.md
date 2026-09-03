---
"catalog": patch
---

An unknown key is now a validation error (E121) on every `pnpm validate` run, not a warning.

W132 and its opt-in flag existed only while 337 entries on `main`
predated the check. Those were backfilled in catalog#716, so strict is
the only mode and the W132 code is retired. `--strict-unknown-keys` is
still accepted and ignored, because the racks import lanes probe for
it and pass it on their changed files (AUREO-1079).

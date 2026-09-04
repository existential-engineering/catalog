---
"catalog": patch
---

`pnpm format` normalises entry shape on every run, scoped or not, so the `assign-ids` sync keeps the tree in shape.

The scoping existed only while 708 entries on `main` still carried
alias categories, and #718 and #720 rewrote those. `--normalize` is
still accepted and changes nothing (AUREO-1080).

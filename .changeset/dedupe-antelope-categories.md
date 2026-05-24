---
"catalog": patch
---

Dedupe redundant category aliases on Antelope Audio software entries.

62 Antelope Audio entries from the recent import listed both the
canonical category and its alias in the same `categories:` array
(`effect` + `fx`, or `equalizer` + `eq`), producing "Duplicate category
... after normalization" warnings at build time. Drop the redundant
alias rows; the canonical form remains.

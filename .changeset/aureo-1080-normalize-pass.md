---
"catalog": patch
---

One-time shape normalisation of 803 entries: 708 alias categories rewritten to their canonical name, 290 duplicate categories dropped, 94 details arrays turned into block scalars.

The pass `pnpm format --normalize` has run on every entry once, so
from here every scoped `pnpm format <file>` in an import PR is a no-op
on shape and the unscoped run can stop skipping it. No entry gains or
loses information: an alias and its canonical category are the same
category to the build, a category that repeats the primary was already
implied, and a `details` array and its block-scalar form render the
same paragraphs (AUREO-1080).

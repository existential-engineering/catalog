---
"catalog": patch
---

Validate every identifier value, `default` and `bundle` included.

`pnpm validate` now reports E400 for an identifier that does not match
its key's pattern. Until the build applied `default` and `bundle` to
format rows a malformed value under either key never reached the
database, so nothing checked it. `pnpm identifier-coverage` now counts
an entry as covered only when a listed format resolves, so a `bundle`
beside vst3 and aax, or a `productId` alone, is listed by what is still
missing rather than skipped.

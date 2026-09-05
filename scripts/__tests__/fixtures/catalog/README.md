# Build fixture

A five-collection catalog small enough to read in one sitting, built by
`build-sqlite.test.ts` through the real `buildDatabase` into a temp file.
Every entry here is also validated against the real collection schemas by
that test, so the fixture cannot drift from what `pnpm validate` accepts.

Each entry exists to exercise one path through the build: an alias that
normalises, a `supersedes` link, a `compatibleWith` that resolves to
software and one that resolves to hardware, a `bidirectional` port, a
variant with its own price, a translation under an approved locale and one
under an unapproved locale. Add a file only when a new build path needs
pinning, and say in the test which path it covers.

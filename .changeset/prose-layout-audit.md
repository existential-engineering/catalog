---
"catalog": minor
---

Fix `details` and `specs` that rendered as a wall of text (AUREO-1192).

Adds `pnpm prose-layout-audit`, which reads both fields the way the
build's `marked` pass renders them and reports one-block-per-line scrapes
that markdown joins into one paragraph, paragraphs over 1,500 characters,
bullet glyphs standing in for a list, lists flattened into prose,
four-space-indented lists that render as code, leftover markup, list-less
`specs`, and values not written as a `|-` block. `pnpm prose-layout:apply`
applies the lossless fixes, and this release carries them: 720 values in
668 entries. The 531 entries that need a person are listed in
`docs/reviews/2026-10-prose-layout.tsv`, and `--findings` files the walls
as a new `wall-of-text` kind.

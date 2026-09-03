---
"catalog": patch
---

`pnpm format` now turns a `details` or `specs` plain scalar that wraps over several lines into a `|-` block scalar, not only one that carries a paragraph break.

The rule tested the value for a newline, and a folded plain scalar has
none because YAML folds the line breaks to spaces, so 127 wrapped
`details` on `main` came through the first `--normalize` pass
untouched. A value wider than the writer's 80-column fold now counts
as multi-line too. A single short line is still left as it is
(AUREO-1080).

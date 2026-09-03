---
"catalog": patch
---

Second shape pass: 126 entries whose `details` or `specs` wrapped over several lines as a plain scalar now carry a `|-` block scalar.

These are the entries the first `pnpm format --normalize` pass left
behind because a folded plain scalar carries no newline in its value.
With that rule corrected, the pass is a no-op on `main`, and every
scoped `pnpm format <file>` in an import PR changes shape only for
what the PR itself introduced (AUREO-1080).

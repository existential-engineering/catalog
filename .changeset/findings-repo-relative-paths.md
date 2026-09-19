---
"catalog": patch
---

Give the hp findings a path that resolves from the repo root

`pnpm dataset:audit --findings <dir>` wrote its `file` as
`hardware/x.yaml`, while the other three audits write
`data/hardware/x.yaml`. Of the 431 rows the four audits file against
`main`, 200 carried a path that names nothing from the repo root.

The racks inbox prints the field as ``Entry: `...` `` on every issue it
opens, and the nightly triage resolves it to read the entry, so a
data-relative path there is a dead reference on just under half the
corpus. `Finding.files` is relative to `DATA_DIR` because that is what
the terminal report prints; the findings row is repo-relative because
that is what reads it.

The test fixture is the reason this shipped: it passed
`files: ["data/hardware/make-noise-maths.yaml"]`, already repo-relative,
where `checkModularMissingHp` emits `relPath(p.file)`. Both fixtures now
carry the real shape, and a cross-audit case asserts all four kinds land
on the same repo-relative path, so the next audit to join them cannot
pick the other convention silently.

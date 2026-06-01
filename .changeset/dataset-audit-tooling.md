---
"catalog": patch
---

Add layered whole-dataset review tooling: a deterministic `pnpm dataset:audit`
cross-entry check (duplicate names, broken `compatibleWith`, orphan
manufacturers, thin descriptions, coverage metrics), a `/dataset-review`
command for LLM review of the flagged subset, a monthly `dataset-audit`
workflow that opens a tracking issue, and a sampled mode for `/data-review`
on large bulk-import diffs.

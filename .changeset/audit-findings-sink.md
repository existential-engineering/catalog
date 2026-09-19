---
"catalog": patch
---

Give the corpus audits a durable sink. `power-input-audit`,
`speaker-level-audit`, `capability-gaps` and `dataset:audit` each take
`--findings <dir>` and append their findings to `findings.jsonl` beside the
report they already print, in the shape the submissions inbox reads. Each
pass files less than it reports, because a report row costs a glance and an
inbox issue costs an afternoon: only what the audit can settle without
opening a maker's page.

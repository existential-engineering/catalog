---
"catalog": patch
---

Remove non-schema `images` field from all entries

The `images:` field is not part of any collection schema (the
canonical JSON schemas are `additionalProperties: false`) and is
never read into `catalog.sqlite`. Product images are served from R2
keyed by id, so the YAML field was dead, misleading data — an entry
could carry `images:` yet show a placeholder because nothing was
uploaded.

Stripped `images:` from 224 entries and added a `validate.ts` rule
that rejects the field so it cannot reappear. All referenced images
were confirmed present in R2 before removal (no data loss).

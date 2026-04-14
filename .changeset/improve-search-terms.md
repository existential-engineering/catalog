---
"catalog": minor
---

Add dedicated search_terms FTS column for improved full-text search ranking. Search terms now get their own high-weight BM25 column instead of being diluted in the description field. Switches FTS tokenizer from porter to unicode61 to fix acronym matching. Adds W127 advisory warning for entries that would benefit from searchTerms. Backfills searchTerms for 70 high-priority entries across software, hardware, and content.

---
"catalog": minor
---

Expand FTS5 search terms with curated synonyms

Each product/manufacturer row now has additional search terms generated
from curated misspellings (e.g. `srum` → Serum, `oporator` → Operator),
common abbreviations (`comp` → compressor, `verb` → reverb), and brand
name variants (hyphen-stripped / space-separated, e.g. `ms20`/`ms 20`
for "MS-20"). These flow into both the `*_search_terms` table and the
FTS5 `search_terms` column, so Studio's strict FTS path returns hits
for these variants directly without needing the client-side fuzzy
fallback.

No schema change. Old Studio versions consuming new catalogs benefit
automatically; new Studio versions still work against older catalogs
(the JS fuzzy layer covers the gap).

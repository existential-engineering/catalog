---
"catalog": patch
---

Flag discontinued products in the web index

The index derived `discontinued` from `verification.status`, a field 3 of
11,042 entries carry, so web consumers showed no discontinued products at
all. It now unions the two signals Studio already uses: the canonical
`discontinued` category and entries another product supersedes. 1,770
products are flagged, up from 3.

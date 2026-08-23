---
"catalog": patch
---

Flag discontinued products in the web index

The index derived `discontinued` from `verification.status`, which only 3
of 11,042 entries carry, so web consumers saw 3 discontinued products
where the dataset marks 1,770. That signal is retained and unioned with
the two Studio already uses: the canonical `discontinued` category and
entries another product supersedes.

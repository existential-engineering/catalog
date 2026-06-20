---
"catalog": patch
---

Make punctuated brand names searchable by their unpunctuated forms.

`brandVariants()` now generates search-term variants for periods,
ampersands, apostrophes, and slashes, so the FTS index matches names
like "A.O.M." when a user types "aom", "Mesa/Boogie" for "mesaboogie"
/ "mesa boogie", "D'Addario" for "daddario", and "Bang & Olufsen" for
"bang and olufsen" / "bang olufsen". Mirrors the existing hyphen/space
handling; ampersands additionally seed an "and" rewrite.

---
"catalog": patch
---

Correct 154 software prices that wrongly read as free. Every Joey Sturgis
Tones entry but one carried a zero amount while the store charged for all
of them, and ujam, WA Production, Dear Reality and Tritik carried the same
thing, clustered on vendors whose product page leads with a free trial.
Prices are re-read from each maker's own page: 124 entries gain a real
amount, 30 whose maker page is retired or serves its price client-side
carry none rather than a wrong one, and the 10 that really are free keep
their zero with source and asOf. Adds E127, a hard error on a negative or
non-finite amount, and W133, an advisory on a zero carrying no provenance.

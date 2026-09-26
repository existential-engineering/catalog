---
"catalog": patch
---

Restore Kontakt compatibility on Impact Soundworks Plectra Series 1: 8-string Acoustic Bouzouki

Its `compatibleWith` named `kontakt`, which matches no entry, so the
Kontakt host was dropped. It now names `native-instruments-kontakt`,
the slug the other 165 Kontakt libraries use.

`pnpm validate` now fails an unknown `compatibleWith` slug (E206)
instead of warning (the retired W123), which is how this one got
through. No other unknown slug existed on main.

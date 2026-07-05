---
"catalog": patch
---

Fix category and compatibility warnings on existing entries.

Remove the redundant `fx` alias (normalizes to `effect`, causing a duplicate)
from seven entries — six Dotec-Audio plugins, Newfangled Audio Obliterate, and
the HOFA Special FX IR pack — and correct GetGood Drums Modern & Massive's
`compatibleWith` to the real `native-instruments-kontakt` slug (was the
non-existent `kontakt-player` / `kontakt`).

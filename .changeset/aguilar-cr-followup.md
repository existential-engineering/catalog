---
"catalog": patch
---

Apply CodeRabbit data-quality fixes to Aguilar entries (follow-up to the already-merged aguilar import).

- AG 700: speaker output connector `1/4-inch` → `speakon`; aux input `1/4-inch` → `1/8-inch` (per official manual).
- Tone Hammer 500: speaker output `1/4-inch`/`line` → `speakon`/`speaker-level`.
- SL 110/112/210/212/410x: add the missing second 1/4-inch input and Neutrik speakON input (each cabinet has 1× speakON + 2× 1/4-inch).
- SL 115: add the missing speakON input.
- TLC Compressor EQ DLX: add `supersedes` link to TLC Bass Compressor (product lineage).
- Aguilar Plugin Suite: add `standalone` to `formats` (the suite runs standalone).

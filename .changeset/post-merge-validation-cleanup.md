---
"catalog": patch
---

Post-merge cleanup after the 2026-09-06 import wave, plus the standing
dataset-audit backlog.

Import-wave fixes: `hp` backfilled on modular entries from sourced widths, 33
colorway duplicates folded into `variants`, tagline separators dropped from 9
names, specs lines restating structured fields removed, a scraped placeholder
description rewritten.

Backlog: every cv/gate, clock and expression jack filed by its documented rule
(548 ports across 127 entries), 260 dead AlphaTheta manual links repointed at
the help-center articles that replaced them (closes #673), 13 canonical urls
promoted over aggregator ones, and `hp` coverage on modular entries raised from
54% to 84%.

Adds `5-pin xlr` and `proprietary` to the io connection vocabulary.

---
"catalog": minor
---

Clean scraped junk out of product names and remove standalone bundle entries.

Renamed ~310 entries: stripped page-title marketing taglines ("nanobox |
tangerine – Compact Streaming Sampler" → "Nanobox Tangerine"), trademark
symbols (™/®/©), HTML entities, and manufacturer-name prefixes ("dbx 286s"
→ "286s") — the manufacturer is stored and indexed separately, so the
prefix duplicated data. Reattributed seven Sonuscore storefront listings
to their actual developers (Wavelet Audio, Soundiron) and added
searchTerms where names became bare acronyms (DDP, DJDI, DRMR, EX) or
lost a commonly searched compound form (EHX by JHS Big Muff 2, BAE 8CR).

Removed 86 standalone bundle/suite entries (HoRNet, Antelope Audio,
Arturia V Collection, Soundtoys 5, Softube collections, Lexicon PCM
bundles, and more) whose member products exist individually — a bundle is
a commercial SKU, not a discrete product. Integrated products that only
carry "Suite"/"Bundle" in the name (Waldorf Edition 2, PSP MixPack2,
Ampeg-style single packages) were kept.

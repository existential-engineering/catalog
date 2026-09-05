---
"catalog": patch
---

Capabilities are now recorded on 911 hardware entries, up from 768, and 106 operations that entries described in their own text but did not list are filled in, including the Eventide H90's granular, freeze, reverse, pitch correction and stutter effects.

Nothing wrote `capabilities` during import, merge or maintenance, so the
field was frozen at whatever the original pass produced and everything
imported afterwards carried none. `pnpm derive-capabilities` populates the
143 effects entries that had accumulated, and a new `pnpm capability-gaps`
reads each assessed entry's prose back against the vocabulary to report
operations the list omits.

That report deliberately has no bulk apply. Tier-1 probes measured about
87% precision against the corpus and the residue is not lexical: prose
names a sibling product, an influence, a simile or a denied spec row.
`pnpm capability-gaps:apply` takes reviewed `slug<TAB>capability` pairs
only, and the accepted list ships in `docs/reviews/` with the rejections
and their reasons beside it.

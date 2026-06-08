---
"catalog": minor
---

Add `pickup` as a hardware category with five companion subcategories:
`humbucker`, `single-coil`, `p90`, `active-pickup`, `passive-pickup`. Unblocks
imports of pickup-making manufacturers (Seymour Duncan, DiMarzio, EMG, Bare
Knuckle, Lollar, etc.) whose catalogs were previously deferred because the
schema had no home for pickups other than the loosely-typed accessory bucket.
Pickup entries belong in `data/hardware/` since they are first-class musical
electronics on par with effects pedals and amplifiers.

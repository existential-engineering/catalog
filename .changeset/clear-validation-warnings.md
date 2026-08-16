---
"catalog": patch
---

Clear the validation warning backlog (62 warnings across 51 files).

I/O connectors: Black Lion preamps and patchbays had port names copied
into the `connection` field ("AC Power", "TT/Bantam slot inputs"), now
real connectors. Added `tt`, `4-pin din`, `db15`, and `digilink` to the
connection vocabulary. Patchbay rows are aggregates by nature, so
`patch-bay` entries no longer trip the collapsed-jack heuristic (W128).

Search: added expansions for RAH (Royal Albert Hall), CJ (Collings
Jumbo), SJ (Small Jumbo), and SPA (grandPa Expander); recorded the
researched dead ends (Brauner VMA/VMX, Dangerous MQ, Burl BCLK,
Catalinbread SFT, Collings MF/MT) and the names that only look like
acronyms (URLA, CROM, LOL, BOB, BOBEK, MIXER, OR).

Also dropped `url` where it merely repeated the manufacturer homepage
(AIR Music, Artiphon, Forgotten Keys, Sonic Sirius, none of which
publish a live product page for those entries) and removed the
duplicated brand prefix from "Drumforge Djent Grooves: Vol. 1".

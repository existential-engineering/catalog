---
"catalog": patch
---

Correct a stale price and three doubled words, settling six inbox findings

Power Grid Disruptor carried a stale 99.99 USD. Korneff Audio gives the
plugin away: its JSON-LD AggregateOffer reads a zero low and high price
and InStock, and the struck-through 347.99 is a gag anchor on an April
Fools release the maker kept up. The entry now carries a verified zero
with source and asOf, which is what separates a giveaway from a price an
import could not read, so Studio renders "Free" and suppresses the
purchase link instead of quoting a price nobody can pay.

Four more Korneff prices were re-read at source and confirmed correct
as they stand. Shure Level-Loc is the one worth noting: the store shows
79.99 today, but that is display_price, a live sale, against a
display_regular_price of 149.99. A check reading the JSON-LD alone
publishes only the sale figure, so it would have "confirmed" the wrong
number and retired a correct price.

Three doubled words are fixed: "for the The Plex", "at at 96 khz" and
"set at at 15ips". All three sit inside wrapped block scalars, so the
line-based grep that filed the finding could not see any of them, while
11 of the 12 hits it did return are compounds a word boundary splits
("plug-in in your DAW", "in in-ear headphones") rather than defects.

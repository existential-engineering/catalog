---
"catalog": patch
---

Correct the Power Grid Disruptor price and two doubled words

Power Grid Disruptor carried a stale 99.99 USD. Korneff Audio gives the
plugin away: its JSON-LD AggregateOffer reads a zero low and high price
and InStock, and the struck-through 347.99 is a gag anchor on an April
Fools release the maker kept up. The entry now carries a verified zero
with source and asOf, which is what separates a giveaway from a price an
import could not read, so Studio renders "Free" and suppresses the
purchase link instead of quoting a price nobody can pay
(catalog-submissions #64).

Four more Korneff prices were re-read at source and confirmed correct as
they stand, one issue each (catalog-submissions #60, #61, #62 and #63),
so those close with no edit. Shure Level-Loc is the one worth noting: the
store shows 79.99 today, but that is display_price, a live sale, against
a display_regular_price of 149.99. A check reading the JSON-LD alone
publishes only the sale figure, so it would have "confirmed" the wrong
number and retired a correct price.

Two doubled words are fixed, "at at 96 khz" and "set at at 15ips". Both
sit inside wrapped block scalars and neither uses a function word the
earlier sweeps grepped for, which is why 3.66.0 left them: a line-based
scan over the raw file cannot see a pair that straddles a wrap, and this
pass read the parsed YAML values instead. The remaining hits on main are
the fifteen that sweep already judged correct as written, which stand
(catalog-submissions #24).

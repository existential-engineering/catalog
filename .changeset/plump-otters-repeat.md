---
"catalog": minor
---

Add `io`, `formats`, and `releaseDate` to `catalog-index.json`. Ports are
grouped (`{type, connection, flow, count}`) rather than emitted verbatim, and
I/O type spelling variants (`spdif`, `wordclock`, `aes3`) are folded into their
canonical forms so the data is queryable.

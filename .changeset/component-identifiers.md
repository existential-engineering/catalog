---
"catalog": minor
---

Match every plugin a collection installs, and add the Pultec, StudioVerse, ROLI and sonible entries Studio kept reporting

A UAD collection installs one plugin per member, each with its own
bundle id, but an entry could hold one identifier per format, so Studio
listed the 1176 Rev A, the LA-2 or InTrigger Live as unknown plugins on
every scan. `componentIdentifiers` takes the same keys and precedence as
`identifiers` with a list per key, and the build writes the primary and
every component into the new `software_format_identifiers` table (schema
migration 24, additive, no `schema_version` bump). `software_formats` is
unchanged for Studio builds that predate the table.

`pnpm validate` now fails an identifier two entries claim, or one
repeated within an entry (E402), because the matcher resolves an
identifier to one entry. None existed on main.

Data:

- Component ids for the 1176, Fairchild, LA-2A, Manley Massive Passive,
  Topline and Hitsville entries, and InTrigger Live. The 1176 collection
  also gains the formats it lacked, without which it matched nothing.
- The Nx Germano and StudioVerse Audio Effects identifiers. StudioRack is
  renamed StudioVerse Audio Effects, its name since V15.
- New entries: Pultec Passive EQ Collection, StudioVerse Instruments,
  ROLI Studio Player, and the discontinued smart:reverb (v1) and
  smart:comp 2, each superseded by the entry the catalog already carried.
- Add moves from Mesa/Boogie to its real developer, Mesa+, as a
  discontinued Windows VST.

---
"catalog": minor
---

Add the `/io-enrich` enrichment command and correct the Apollo Twin X I/O.

Pillar 2 of the I/O data-quality plan (#212): a repeatable, authoritative-source
process for fixing and enriching a hardware entry's `io`.

- New `.claude/commands/io-enrich.md` codifies the manual-first workflow proven on
  the Eventide H90: read the manufacturer manual/QRG panel diagrams, model one
  entry per physical jack, set positions and column/row from the diagram, verify
  adversarially (flag ambiguous jack faces to the user rather than guess), then
  validate and cite sources.
- Piloted it on the **Universal Audio Apollo Twin X**, replacing an incorrect
  6-entry list (collapsed "Two 1/4\" Monitor Outs"/"Line Outs" pairs, a split
  Thunderbolt, no mic/line/instrument inputs, everything guessed as `Top`) with
  the real 11 discrete jacks: front-panel Hi-Z and headphone (`Bottom`), and
  rear-panel (`Top`) Mic/Line 1–2 combo inputs, Monitor L/R, Line Out 3/4,
  optical, Thunderbolt, and 12VDC power — with column/row layout from the Apollo
  Twin X Hardware Manual.

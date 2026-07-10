---
"catalog": minor
---

Add IO port positioning (`columnPosition` / `rowPosition`) enrichment.

Starts issue #212: IO ports can now carry `columnPosition` (left-to-right) and
`rowPosition` (top-to-bottom) values describing their spatial arrangement on a
device edge, so the setup graph can render port layouts accurately. The schema
already accepted these fields; this adds the convention, tooling, and first data.

- New `pnpm enrich-io <slug>` interactive tool to assign column/row positions to a
  hardware entry's IO ports, writing back to YAML while preserving formatting.
- Document the ordering convention in `schema/CONTEXT.md` (via the generator) and
  `CLAUDE.md`.
- Fully correct and backfill the Eventide H90 Harmonizer as the validation case:
  its IO now lists all 14 discrete rear-panel jacks (Inputs 1–4, Outputs 1–4,
  Exp/Ctl 1–2, MIDI In, MIDI Out/Thru, USB-C, Power) with column/row positions,
  replacing an incomplete 5-entry list that omitted the audio I/O and MIDI Out and
  mis-positioned the jacks.

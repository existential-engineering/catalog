---
description: Correct and enrich a hardware entry's I/O from authoritative sources (manuals, photos)
---

Fix and enrich the `io` (input/output ports) of one hardware entry using
authoritative sources, then validate and summarize with citations. This is the
manual/agentic pass that bulk import cannot do reliably — port layout is visual
and combine/split errors are common (see issue #212).

**Argument:** an optional hardware slug (filename without `.yaml`). If omitted,
pick the highest-priority target from the triage report.

## Before starting

Read these once so you follow the conventions exactly:

- `schema/CONTEXT.md` → "IO Fields (Hardware)" (valid signalFlow, category,
  position, types, connections, and the columnPosition/rowPosition convention).
- `CLAUDE.md` → the IO field-formatting section (field order, one entry per
  physical jack, passive-speaker `speaker-level` rule, connectorDetail).

Core rules that drive everything below:

- **One `io` entry per physical jack**, each `maxConnections: 1`. Never collapse
  an L/R or numbered pair ("Outputs 1/2", "Analog In L/R") into one entry, and
  never split a single jack into two. This is the #1 import defect.
- `type` is the signal characteristic (line, instrument, mic, expression, usb…);
  `connection` is the physical connector (1/4-inch, xlr, usb-c, 5-pin din…).
  Don't swap them. Note software-switchable levels in the port `description`.
- `position` is the device edge the jack sits on (Top = rear edge, Bottom =
  front, Left/Right = sides). `columnPosition`/`rowPosition` order jacks within
  that edge (left→right / top→bottom, viewing the face head-on).

## Phase 1 — Select the target and read current state

1. If a slug was given, use `data/hardware/<slug>.yaml`. Otherwise run
   `pnpm io-quality` and take the top of the **Correctness** worklist (or ask
   the user which list — correctness, missing-I/O, or spatial — to work).
2. Read the current entry: its `name`, `url`, `manufacturer`, `primaryCategory`,
   and existing `io`. Note what looks wrong (collapsed pairs, uniform guessed
   positions, missing jacks, no column/row).

## Phase 2 — Gather authoritative sources

Prefer primary sources; marketing/retailer copy is a cross-check only.

1. **Manufacturer manual / quick-reference guide (best source).** From the
   product `url`, find the vendor's downloads/support page and locate the User
   Manual or Quick Reference Guide **PDF**. Download it to the scratchpad with
   `curl -sL` and open it with the Read tool — the panel/connections diagrams are
   the ground truth for the jack set AND their physical layout.
   - **Check every panel, not just the rear.** Manuals have separate Front / Rear
     / Side / Top panel sections. Missing inputs almost always mean a panel was
     overlooked (e.g. the Apollo Twin X's Hi-Z and headphone jacks are on the
     *front*). Read each panel section before concluding the set is complete.
2. **Product photos** of the rear/side panels (for position and column/row).
3. **Spec sheet / a retailer listing** to cross-check the jack count and
   connector types. Note: many retailers return HTTP 403 to WebFetch — don't
   rely on them for layout; use them only to corroborate the set.

Record the source URLs you actually used — they go in the summary.

## Phase 3 — Build the corrected `io`

`io` is for **connectors only**. Exclude non-port controls that appear on the
same panel — power switches, Kensington/security slots, ground screws, vent, and
built-in mics/talkback — even when the manual numbers them alongside the jacks.

For every physical jack, in the manual's own left-to-right / top-to-bottom order:

- `name` (use the panel label), `signalFlow`, `category`, `type`, `connection`,
  `connectorDetail` (if known, e.g. TS/TRS/center-positive), `maxConnections: 1`,
  `position`, then `columnPosition`/`rowPosition` when the layout is visible.
- Add a `description` for anything non-obvious (switchable level, insert/dual
  role, phantom power, etc.).
- Field order: name, signalFlow, category, type, connection, connectorDetail,
  maxConnections, position, columnPosition, rowPosition, description.

Assign `columnPosition`/`rowPosition` only for edges whose layout you can
actually see. Grids (e.g. stacked in/out pairs) share a column and differ by
row; a single row uses `rowPosition: 1`. If you can't see an edge's layout,
set `position` and leave column/row off rather than guessing.

## Phase 4 — Verify (do not skip)

- **Count/labels:** confirm the jack set against at least two sources.
- **Positions are visual — be adversarial.** For each jack ask "does the diagram
  actually show it on this face?" If a jack is drawn in a separate/perspective
  view or a source is ambiguous (a classic case: MIDI jacks that turn out to be
  on a side, not the rear), find a clearer source or **ask the user** — never
  invent Top/Bottom/Left/Right or column/row.
- Track a confidence level and citation for the set, the positions, and the
  column/row so the summary is honest about what's verified vs inferred.

## Phase 5 — Apply, format, validate

1. Edit only the `io:` block of the YAML, preserving the rest of the file. A
   brief comment above `io:` describing the panel layout is welcome.
2. `npx prettier --write data/hardware/<slug>.yaml` then `pnpm validate`.
3. Fix any errors and re-run. There must be no new advisory warnings for this
   file — especially **W128** (combine), **W120** (unknown type), **W121**
   (unknown connection). Add genuinely-new connector/type values to the schema
   YAML via the same PR only when you've confirmed they're valid.
4. Optional: `pnpm build` and query `hardware_io` to confirm the rows land.

For just column/row on an already-correct entry, `pnpm enrich-io <slug>` is the
interactive shortcut instead of hand-editing.

## Phase 6 — Summarize

Report:

- **Before → after**: jacks added/removed/split, position/type corrections,
  column/row added.
- **Sources** actually used (URLs).
- **Confidence** per dimension and **anything you flagged for the user** to
  confirm (e.g. an ambiguous jack face).
- Validation results (format/validate pass, warning check).

Then offer to `/ship` (create changeset + PR) or, for a batch, move to the next
target from `pnpm io-quality`.

## Batch mode

To work several at once, iterate the `pnpm io-quality` worklist one device at a
time — each through Phases 2–5 with its own verification. Do **not** bulk-guess
positions across many devices from a single template; every device's layout is
its own visual fact. Log any device you skip (e.g. no manual found) so coverage
isn't silently overstated.

## Worked example

The Eventide H90 (`eventide-audio-h90-harmonizer`) is the reference: 14 discrete
rear-edge jacks with Inputs/Outputs as 2×2 column/row grids, plus MIDI In and
Out/Thru on the **Left** side — the jack set and rear layout came from the H90
Quick Reference Guide PDF, and the MIDI side was confirmed with the user rather
than guessed from the ambiguous diagram.

# Catalog

Community-driven database of audio software, plugins, DAWs, and hardware for music production.

## Tech Stack

- TypeScript, Node.js, pnpm
- YAML for data files, SQLite for distribution
- Zod for schema validation

## Key Commands

- `pnpm install` - Install dependencies
- `pnpm validate` - Validate all YAML data files
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm build` - Build SQLite database
- `pnpm format` - Format YAML files with Prettier
- `pnpm capability-coverage` - Report which categories carry `capabilities`
- `pnpm capability-gaps` - Report operations an entry's prose names but its
  `capabilities` omits
- `pnpm format:check` - Check formatting

## Catalog Schema Compatibility

Studio downloads whatever `catalog.sqlite` is newest, on its own schedule,
so app and catalog versions are decoupled forever. Two rules keep every
cohort working:

- **Schema changes are additive.** Old Studio builds select columns by
  name, so a new column or table is invisible to them. Never remove,
  rename, or change the meaning of an existing column while any shipped
  Studio build still reads it. `signal_flow` vs `signal_flow_raw` is the
  standing example: `signal_flow` keeps the `bidirectional -> input`
  flattening because pre-peer builds read it raw, while `signal_flow_raw`
  carries the YAML value verbatim for builds that understand it.
- **`schema_version` in `catalog_meta` is the reader-compatibility
  number** (`CATALOG_SCHEMA_VERSION` in `scripts/build-sqlite.ts`).
  Studio refuses to activate a catalog whose `schema_version` exceeds
  what it supports, keeping its current catalog instead, so bumping it
  freezes catalog updates for every older app until its users update.
  Bump ONLY for a genuinely breaking change, in lockstep with raising
  `MAX_SUPPORTED_CATALOG_SCHEMA` in the racks repo
  (`apps/studio/src-tauri/src/data/mod.rs`), and only after the builds
  that cannot read the new schema are considered abandonable. Additive
  changes never bump it.

## Project Structure

- `data/` - YAML source files (manufacturers, software, content, hardware, accessories)
- `schema/` - Category, format, and platform definitions
- `scripts/` - Build and validation tools
- `dist/` - Built SQLite database output

## Conventions

- Filenames are slugs: lowercase with hyphens (e.g., `serum.yaml`, `massive-x.yaml`)
- All entries must pass `pnpm validate` before commit
- Use Prettier for YAML formatting
- Data follows strict schemas defined in `scripts/lib/types.ts`

### Incremental Patches

`pnpm patch` emits SQL that brings a released `catalog.sqlite` up to HEAD. It
reads the rows out of a freshly built database rather than encoding the YAML a
second time, and that is the whole point of its shape.

- **Never hand-write a table's INSERT into `generate-patch.ts`.** It used to,
  and covered sixteen of the sixty-odd tables `build-sqlite.ts` writes: I/O,
  prices, links, versions and variants were left stale on a patched database,
  markdown reached HTML columns unrendered, and category aliases went in
  unnormalized. The table graph is reflected from the built schema, so a new
  child table or column is carried for free. Adding a hand-written block
  reintroduces the drift.
- **A collection owns its child tables by name prefix.** `content_compatibility`
  references both `content` and `software`, but only `content` owns it. A new
  child table has to carry its collection's prefix and a foreign key reaching
  the root, or reflection fails loudly rather than skipping it.
- **A rewritten entry's root row is upserted, never deleted.** Another entry's
  `supersedes_id` can point at it, and dropping the row trips that key even
  though it is about to come straight back.
- **A nested row resolves its parent by natural key.** `hardware_variants.id`
  is assigned per build, so the target database has its own numbering and
  carrying the build's ids across would attach prices to the wrong variant.
- **The version stamp is written only when every change resolved.** A patch
  that skips a change and still stamps leaves a database claiming content it
  does not have, which is what makes the other failures hard to diagnose after
  the fact.

A patch only rewrites entries whose YAML changed, so renaming a manufacturer
leaves the denormalized `manufacturer_name` stale in the FTS rows of its
unchanged products. Ship a full database when manufacturer names move.

## Data Entry Format

Manufacturers require: name, url
Software requires: name, manufacturer, primaryCategory, platforms
Content requires: name, manufacturer, primaryCategory
Hardware requires: name, manufacturer, primaryCategory, description
Accessories require: name, manufacturer, primaryCategory, description

Optional fields: categories (array), url, description

Note: Slugs are derived from filenames, not stored in the YAML files.

**Manufacturer `defunct: true`** marks a company that no longer exists AND has
nothing still produced under its brand. Products of defunct manufacturers are
auto-tagged with the `discontinued` category. Never set it for revived brands
(Oberheim, Crumar, EDP) or brands whose catalog may gain current products
under the same slug (Dave Smith Instruments carries the still-produced OB-6).

## Discontinued Products

The `discontinued` category is the canonical marker for out-of-production
products (the Studio app also derives it from `supersedes` at runtime).
Tooling:

- `pnpm discontinued:report` — surfaces candidates by signal tier. Tier 1
  (auto-safe): superseded entries, defunct-manufacturer products. Tier 2
  (review required): vintagesynth.com-linked entries, entries released 20+
  years ago, description mentions.
- `pnpm discontinued:apply --apply` — tags superseded entries;
  `--signal defunct` tags defunct-manufacturer products; `--files <list.txt>`
  tags a human-reviewed list curated from the report's review tiers.

**Never auto-tag by age or VSE link alone.** Production lifetimes are
category-dependent (SM58: 1966–present; Boss DS-1: 1978–present; Doepfer
A-100: 1995–present), and Vintage Synth Explorer also covers current gear
(microKorg, Volcas, Prophet-5 reissue). Review those buckets, then apply
with `--files`.

**`url`** must be the maker's own official page (product page preferred,
homepage acceptable). Never point it at an aggregator or marketplace —
KVR, ModularGrid, Plugin Boutique, Best Service, etc. (list in
`scripts/lib/aggregator-domains.ts`) — unless the maker has no official
page anywhere (dead vendor, KVR-only freeware). Aggregator pages belong
in `links` at most. `pnpm dataset:audit` flags violations
(aggregator-url); `scripts/promote-canonical-urls.ts` fixes the ones
that already carry an official link.

## Field Formatting Conventions

**`name`** is the product name only — the manufacturer is stored and indexed
separately, and display/search compose the two:

- Never prepend the manufacturer: `name: SM7B`, not `Shure SM7B`; `name: 286s`
  under `manufacturer: dbx`, not `dbx 286s` (W129 warns)
- No marketing taglines or category descriptors from scraped page titles:
  `Nanobox Tangerine`, not `nanobox | tangerine – Compact Streaming Sampler`
  (W130 warns on en/em-dash and pipe separators; `pnpm dataset:audit` reviews
  plain-hyphen suffixes)
- No trademark symbols (™ ® ©), HTML entities (`&#038;`), or stray
  leading/trailing separators — these hard-fail validation (E118)
- Keep the maker's official casing (`mk2`, `d:facto`, `MONTAGE`)
- Products sold through a storefront (Sonuscore, marketplaces) are attributed
  to the actual developer in `manufacturer` — never leave the store's brand
  piped into the name (`Groth | Wavelet Audio` → `name: Groth`,
  `manufacturer: wavelet-audio`)
- Acronym-only names should add `searchTerms` with the expansion (W127)

**`platforms: [ios]` only when the source says so.** iOS is a legal
platform value and it was wrong on 81 of 85 HoRNet entries in one import.
Set it only when the page names iOS, iPadOS, AUv3, iPad or iPhone, or links
to the App Store. A desktop plugin page that says nothing about mobile gets
no `ios`.

**`manufacturer`** must be a slug reference (the manufacturer's filename without `.yaml`), not the display name:

```yaml
manufacturer: hologram-electronics # correct (slug)
manufacturer: Hologram Electronics # wrong (display name)
```

**`description`** uses flow scalar format (Prettier auto-wraps long lines):

```yaml
description: Dream Sequence is a programmable pedal that uses sequencing,
  envelope shaping, and pitch shifting to create synth-like arpeggios.
```

**`details`** uses block scalar `|-` with paragraphs separated by blank lines:

```yaml
details: |-
  First paragraph of details text here.

  Second paragraph continues here with more information.
```

**`specs`** uses block scalar `|-` with `"- "` prefixed list items:

```yaml
specs: |-
  - Octave up and down pitch shifting
  - Pattern sequencer
  - Tap tempo
  - MIDI in/out
```

Do NOT use YAML arrays for `details` or `specs`. Do NOT use `|` (use `|-` to strip trailing newlines).

**Hardware I/O entries** use this field order with all fields present:

```yaml
io:
  - name: Audio Input
    signalFlow: input
    category: audio
    type: line
    connection: 1/4-inch
    maxConnections: 1
    position: Top
```

**IO field validation** uses a two-tier system:

- **Strict (errors, blocks CI):** `signalFlow`, `category`, `type`, `position`, `price.currency`
  - `signalFlow`: input, output, bidirectional
  - `category`: audio, midi, digital, power
  - `type`: closed vocabulary in `schema/io-types.yaml` — unknown values fail with E117
  - `position`: Top, Bottom, Left, Right
  - `currency`: ISO 4217 codes (USD, EUR, GBP, etc.) — see `schema/currencies.yaml`
- **Advisory (warnings, non-blocking):** `connection`, `link.type`
  - Known values listed in `schema/io-connections.yaml`, `schema/link-types.yaml`
  - Unknown values produce warnings in `pnpm validate` output
  - Add new values to schema files via PR when they're confirmed valid

**The vocabularies are meant to grow.** Enforcement catches mistakes (connectors
in `type`, vague values); it must not force-fit genuinely new signals or
connectors onto near-miss values. When an import surfaces a legitimate new value
(verify via manual/photos), add it to the schema vocabulary in the same PR.

**Semantic distinction:** `type` describes the signal characteristic (line, instrument, headphone, midi, usb, expression). `connection` describes the physical connector (1/4-inch, xlr, usb-c, 5-pin din). Don't swap them.

**No Bluetooth or Wi-Fi io entries.** Wireless capabilities are not physical
ports — the app doesn't support them in the setup graph. Mention them in
`description`/`details`/`specs` only; `bluetooth` and `wifi` are intentionally
absent from the io type vocabulary, so such entries fail validation (E117).
(`rf` antenna jacks on wireless mic systems are real ports and stay.)

**No storage media slot io entries.** SD, microSD, CompactFlash, Memory Stick
and kin hold media, not cables, so the setup graph can do nothing with them —
the same reasoning as Bluetooth/Wi-Fi. An io entry whose name identifies a
storage slot fails validation (E120). Mention the slot in
`description`/`details`/`specs` instead. Option and expansion card bays
(Dante/MADI option cards) accept cards that present real connectors, so those
stay legal with `connection: card-slot`.

**Passive speakers use `speaker-level`, not `line`.** Passive-loudspeaker inputs
(speakON, binding-post, banana, euroblock, barrier/spring terminals) carry
amplified signals — set `type: speaker-level`. `line` is for low-voltage
preamp/mixer outputs; a powered speaker input is never `line`.

**Required presence (blocks CI):** every hardware `io` entry must include
`maxConnections` (default `1`) and, except on played instruments
(guitars/basses), `position`. Every product entry must include `primaryCategory`.
These are enforced by `pnpm validate`, not just review.

**Port ordering (optional):** `columnPosition` and `rowPosition` place a port
within its `position` edge so the setup graph can render the layout. Both are
1-based, numbered independently per edge, and go right after `position`:
`columnPosition` is left-to-right (column 1 = leftmost, viewing that face
head-on); `rowPosition` is top-to-bottom (row 1 = topmost). Stacked ports share a
`columnPosition` and differ by `rowPosition`; a single-row edge uses
`rowPosition: 1`. This is visual info from photos/manuals — assign it with
`pnpm enrich-io <slug>`, not during bulk import.

One `io` entry per **physical** jack (`maxConnections: 1`). Do not collapse an L/R
pair into one stereo entry with `maxConnections: 2`, and do not split one jack in
two — bulk imports get this wrong. E.g. the Eventide H90 has 14 discrete jacks
(Inputs 1–4, Outputs 1–4, Exp/Ctl 1–2, MIDI In, MIDI Out/Thru, USB-C, Power).

**Patchbays are the exception.** A `patch-bay` entry models each row as one `io`
entry with `maxConnections` set to the point count (a 48-point TRS row, not 48
entries), so W128 skips that category. TT/Bantam patch points use
`connection: tt`.

## I/O Modelling Conventions

These are the rules review kept restating on import PRs (about 110 of the
384 inline findings over 75 imports were I/O). The importers enforce the
mechanical ones (`io-lint` in the racks repo) and the reviewer checks the
rest. Write new ones here first, then mirror them in `.coderabbit.yaml`.

- **Every powered hardware entry has a power input.** A DC barrel, an IEC
  inlet, a USB power port or phantom power from a host each count. A unit
  with none of those says so in `specs` (`battery-only`, `bus-powered via
USB-C`). Not in an io entry: the io shape has no note field, so a note
  there is stripped like any other unknown key. A missing power input was the
  single most repeated finding (Sonicware, Darkglass, Empress, Benson,
  Joranalogue).
- **One entry per physical connector.** A name carrying `L/R`, `1-4` or
  `1/2` is a split candidate. `maxConnections` above 1 on 1/4-inch,
  1/8-inch, xlr, combo jack, rca, 5-pin din, usb or thunderbolt is a
  defect. A combo jack is one entry with `connection: combo jack`. A stereo
  TRS jack is one entry.
- **MIDI on a DIN socket is `connection: 5-pin din`** (`7-pin din` where the
  maker documents it). MIDI on a minijack or 1/4-inch jack keeps the jack as
  its connection with `type: midi`.
- **Footswitch and expression jacks** are `category: audio`,
  `type: expression`, with `connection` per the jack. This matches the
  existing Benson entries that review confirmed. A jack named for an
  expression or sustain pedal but typed `cv/gate` is the same mistake from
  the other side: Strymon and Fender entries typed them that way while
  Chase Bliss typed them `expression`, and the setup graph now draws the
  two as different shapes. `pnpm dataset:audit` lists them
  (`expression-typed-cv`).
- **CV, gate and clock jacks are `category: audio`.** They carry analog
  control voltages and pulses whatever the connector; `word clock` is the
  digital exception and stays `digital`. The catalog filed 461 cv/gate
  jacks under `digital` before this was written, which is why Studio
  resolves CV colour by type before category (AUREO-1099) and why
  `pnpm dataset:audit` reports the split (`cv-gate-category`) rather than
  `pnpm validate` failing on it.
- **USB host ports and network ports are `signalFlow: bidirectional`.**
- **Speaker outputs on amplifiers are `type: speaker-level`**, one entry per
  jack, with the impedance in the name (`Speaker Output 8 ohm`).
- **Rear-panel jacks are `position: Right` on pedals, desktop units and rack
  gear.** 500-series modules use `Bottom`. Eurorack modules use `Top` or
  `Bottom` per the panel. This rule existed nowhere before, which is how a
  review learning that every rear jack is `Right` came to misfire on
  500-series gear.
- **Option-card and optional-module connectors are not baseline `io`.** The
  card bay itself is (`connection: card-slot`). What a card would add is not.
- **`type` and `connection` never swap.** A connector name in `type` is a
  hard error (E117), not an advisory warning, so an import that meets it
  must fix the value rather than keep it and note it.

## Capabilities

`capabilities` records **what a product does** — the audio processing
operations it performs — as a closed vocabulary in `schema/capabilities.yaml`.
It is a hardware-only field today, populated across the Effects category group
(hand-authored for `multi-effect`, derived elsewhere) and written by both
import shapes for entries they create; `pnpm capability-coverage` reports which
categories have been assessed.

```yaml
primaryCategory: multi-effect
categories:
  - pedal
  - effect
capabilities:
  - looper
  - reverb
  - delay
  - pitch-shift
```

**Why it is not just more `categories`.** `categories` mixes at least five
axes: function (`reverb`), lifecycle (`discontinued`, 26% of hardware), form
factor (`rack-mount`, `pedal`), technology (`analog`, `digital`) and era
(`vintage`). That serves faceted browsing, which is what it was built for, and
it cannot answer whether two products overlap — two entries sharing
`discontinued` have told you nothing. Because every value in `capabilities` is
the same kind of claim, two entries' lists are comparable as sets, which
`primaryCategory` structurally cannot be: every member of a category is
equidistant from every other.

- **One dimension only.** If a value describes what a product **is** rather
  than what it **does**, it belongs in `categories`. The guard test
  `scripts/__tests__/capabilities.test.ts` fails if the vocabulary picks up a
  value from a non-functional category group, so this rule reports its own
  violations rather than relying on being read.
- **Describe the operation, not the algorithm's name.** A "Shimmer" mode is
  `reverb` + `pitch-shift`; "Auto-Tune Evo" is `pitch-correction`; "Neural
  Capture" is `amp-modeling`.
- **No aliases, unlike `categories`.** Invalid values hard-fail with E119 and
  duplicates with E205. A synonym would reintroduce the ambiguity the field
  exists to remove, and a near-miss value breaks comparability while leaving
  the entry looking populated.
- **Omit rather than guess.** An absent `capabilities` means "not yet
  assessed", which the coverage report can say out loud; an empty or
  speculative list is indistinguishable from a verified one. Never write
  `capabilities: []`.
- **The vocabulary is meant to grow**, same as `io-types.yaml`. It was derived
  from the effects corpus, so its coverage of synthesis, recording and playback
  operations is incomplete: `sampling`, `looper`, `granular` and `sequencing`
  are in, the operations around them mostly are not. When an entry performs an
  operation the vocabulary has no value for, add the value to
  `schema/capabilities.yaml` in the same PR as the entry, and to
  `CATEGORY_CAPABILITIES` in `scripts/derive-capabilities.ts` if a category
  implies it by definition. Writing the value on an entry alone fails
  validation with E119.

**A capability list is only as current as the pass that wrote it.** Until
this pass nothing wrote the field during import, merge, or maintenance: the
agent command never mentioned it and the fast runner's `vocab.ts` did not
even load `capabilities.yaml`, so its structured schema could not emit
one. Every populated entry came from the original `multi-effect` pass plus
`pnpm derive-capabilities`, and everything imported afterwards carried
nothing. Both import shapes now write it (see "Capabilities" in the racks
repo's CLAUDE.md), which is what keeps the rest of this section from
needing a re-run every quarter.

`pnpm capability-gaps` reports the drift that accumulated meanwhile: for
every entry that already carries capabilities, the operations its own
`description`/`details`/`specs` name but the list does not. The Eventide
H90 is the case it was built from — no `granular` while its `details`
described four granular algorithms and it linked a page titled "Eventide
Goes Granular". Scope is deliberately entries that already carry the field:
one with none is unassessed, not wrong, and `pnpm capability-coverage`
says so.

- **There is no bulk apply, and that is the design.** Tier-1 probes measured
  about 87% precision against the corpus before tightening, and the residue
  is not lexical: prose names a sibling product ("the Mini platform that
  also spawned DITTO LOOPER"), or a homonym (the Roland VP-550's "Mixed
  Chorus" is a choir voice). `discontinued:apply` gets a blanket `--signal`
  because "superseded" and "defunct manufacturer" are facts about the graph;
  a probe is a guess about language, so this tool gets only the `--files`
  half of that contract. `pnpm capability-gaps:apply --pairs <file>` takes
  `slug<TAB>capability` lines and nothing else. The pair is the reviewed
  unit rather than the slug, because an entry commonly has one accepted
  finding and one rejected.
- **The accepted list is committed** (`docs/reviews/`), with the rejections
  and their reasons in comments beside it. A pass that leaves no record of
  what it declined invites the next one to re-litigate the same entries.
- **Five failure classes are guarded, one is not.** Denied spec rows
  ("Arpeggiator/Sequencer: None"), measured specs ("total harmonic
  distortion below 0.001%", a speaker's "compression driver"), compatibility
  ("works with cabinet simulators"), influence ("inspired by the Akai S950
  sampler") and simile ("similar to auto-wah effects") each defeated a probe
  that looked sound until it ran, and each is a regression case in
  `capability-probes.test.ts`. Sibling-product mentions have no guard,
  because separating one needs a product index rather than a regex — which
  is why those probes sit in the review tier and why the reviewed list
  exists. A probe producing false positives moves down a tier; it never
  acquires a per-entry exception list.

**Two provenances, and the difference matters.** A hand-authored list is read
out of the entry's own prose and can name operations the categories never
admitted. A derived list, written by `pnpm derive-capabilities`, projects the
functional subset out of `categories`/`primaryCategory` through a table of
definitional mappings — it adds no information the file did not already carry,
and is a floor rather than a survey. The derivation never overwrites an
existing list, because a hand-authored one is strictly better. Run
`pnpm derive-capabilities --unmapped` to audit which categories the table
deliberately declines to map: family names (`dynamics`, `modulation`),
topologies (`multiband`), composites (`preamp`, `channel-strip`) and the
non-functional axes. Mapping any of those would be guessing, and a guessed
capability is indistinguishable from a verified one once written.

## Prices

A `prices` entry is `amount`, `currency`, optional `asOf` and `source`, and
optional `term`. Set `term` (`perpetual`, `monthly`, `yearly`,
`rent-to-own`) whenever one currency carries more than one price, so a
perpetual licence and a monthly plan can sit side by side without a reader
guessing which is which. One price per currency needs no term. `pnpm
validate` warns (W131) on same-currency prices that carry none, and never
errors, because 74 entries predate the field. Never drop a real price to
silence a duplicate-price review finding: add the term instead.

`prices[].type`, `prices[].note`, `prices[].label` and similar keys are not
schema and are silently dropped (see Unknown Keys).

## Unknown Keys

Zod strips every key a schema does not declare, so an entry carrying
`prices[].type`, `versions[].notes`, a top-level `note` or a top-level
`discontinued: true` validates, builds and ships with the value gone. That
is the structural cause of catalog#689, where ten entries marked with the
flag stayed live in Studio.

`pnpm validate` rejects every such key (E121, at any depth), so an entry
carrying one cannot merge. The check shipped as the advisory W132 while 337
files on `main` predated it; catalog#716 backfilled those and strict has
been the only mode since. `--strict-unknown-keys` is still accepted and
changes nothing, because the racks import lanes probe this repo for the
flag and pass it on their changed files. A top-level `images` block is
the one key reported as E199 instead, checked on the raw object before
any schema runs, because product images live in R2 keyed by id. A field
that is genuinely new data goes into the schema in the same PR.

## Content Entries

Content entries (presets, sample packs, expansions) live in `data/content/` as a separate collection. Content `primaryCategory` values include `preset`, `preset-pack`, `sample-pack`, `drum-sample-pack`, `loop-pack`, `sound-library`, `soundfont`, `impulse-response`, and `multisample`.

- Content entries do NOT have `platforms`, `formats`, or `identifiers` fields
- Use `compatibleWith` to reference host software or hardware products by slug:

```yaml
name: Zeus Presets for Serum
manufacturer: some-vendor
primaryCategory: preset-pack
compatibleWith:
  - serum
```

```yaml
name: Haunted Hearts
manufacturer: elektron
primaryCategory: preset-pack
compatibleWith:
  - elektron-digitone
```

Advisory warning W123 fires if a `compatibleWith` slug doesn't match an existing software or hardware file. Category aliases in `schema/category-aliases.yaml` map common synonyms (e.g., `soundbank` → `preset-pack`) to canonical categories.

## Accessory Entries

Accessory entries (cables, stands, acoustic treatment) live in `data/accessories/` as a separate collection. Accessory `primaryCategory` values include `cable`, `power-conditioner`, `mic-stand`, `boom-arm`, `pop-filter`, `shock-mount`, `reflection-filter`, `acoustic-treatment`, `acoustic-panel`, and `windscreen`.

- Accessory entries do NOT have `io` or `variants` fields (use those for hardware only)
- Like hardware, accessories require: name, manufacturer, primaryCategory, description

## Bundles

Do NOT create standalone entries for bundles, suites, or
"complete/starter/ultimate" collections that aggregate products sold
separately (V Collection, Soundtoys 5 class). A bundle is a commercial SKU,
not a discrete product — import the member products instead. Integrated
products that merely carry "Suite"/"Bundle" in the name (sold only as one
unit, e.g. Waldorf Edition 2, PSP MixPack2) are fine; allowlist them in
`BUNDLE_ALLOWLIST` in `scripts/dataset-audit.ts`. `pnpm dataset:audit`
flags suspects (bundle-entry) for `/dataset-review`.

## Product Lineage

Use `supersedes` to link product generations, form factor variants, and major versions. The value must be the **ID** of the older product. This applies to different hardware generations (MKI → MKII), form factors (keyboard → rack), capability upgrades, and software versions (Pro-C 2 → Pro-C 3):

```yaml
# pro-c-3.yaml
name: Pro-C 3
manufacturer: fabfilter
supersedes: 7QMeWge0fOrmQz_oVLCKk # ID of Pro-C 2
identifiers:
  au: com.fabfilter.Pro-C.AU.3
```

**Finding a product's ID:**

To find the ID of a product you want to reference, open its YAML file and look for the `id` field:

```yaml
# Example from pro-c-2.yaml
id: 7QMeWge0fOrmQz_oVLCKk # ← Use this value for supersedes
name: Pro-C 2
manufacturer: fabfilter
```

- IDs are 21-character nanoid strings (alphanumeric with `-` and `_`)
- IDs are auto-assigned by CI when you run `pnpm assign-ids` for new entries
- Every product entry must have an `id` field

**Importers resolve `supersedes` after IDs are assigned, behind a
confidence gate.** Both import shapes run a resolution step once
`pnpm assign-ids` has given the new entry an ID: a name carrying a
generation token (MKII, MK2, Mk3, V2, II, III, Plus) or prose reading
"replaces the X" is matched to a same-manufacturer entry whose name is the
token-free form, and `supersedes` is set only when exactly one candidate
matches. Every link lands in a PR-body table so a reviewer sees each pair.
A candidate that is ambiguous, or a predecessor that is not in the catalog,
stays unlinked and is left to the monthly `discontinued:report`. Do not ask
an import to hand-wire a link its resolver declined: the decline is the
signal that a person has to look.

The referenced ID must exist in the same collection (software, content, hardware, or accessories). Validation will fail if the ID is not found or if a cycle is detected in the supersedes chain.

The relationship is **bidirectional** - the database can query both directions:

- "What does this product supersede?" (older version)
- "What supersedes this product?" (newer version)

Multiple products can supersede the same predecessor, supporting branching product families:

```yaml
# machinedrum.yaml (original, id: PUpJjAZE1-cJB_tNEFtEu)
# machinedrum-sps-1-mkii.yaml → supersedes: PUpJjAZE1-cJB_tNEFtEu
# machinedrum-sps-1uw.yaml    → supersedes: PUpJjAZE1-cJB_tNEFtEu
# machinedrum-sps-1uw-mkii.yaml → supersedes: VzPj6jSJdm-uovTxHzUUH
```

## Hardware Variants (Cosmetic Only)

Hardware entries support a `variants` array, but it is **strictly for cosmetic variants** — products that are identical in hardware, capabilities, and I/O but differ only in appearance (color, finish, limited edition branding).

**Use a top-level entry with `supersedes`** when ANY of these are true:

1. It has a distinct model name or number (e.g., Analog Rytm MKII, SPS-1UW)
2. It has different I/O, capabilities, or specs
3. A user would say "I own an X" using this specific name
4. A retailer lists it as a separate product/SKU

**Use a variant** only when ALL of these are true:

1. Same hardware, same capabilities, same I/O
2. Difference is purely cosmetic (color, finish, limited edition branding)
3. Users wouldn't search for this variant specifically
4. A retailer lists it as a color/finish option, not a separate SKU

```yaml
# Correct: cosmetic variant
variants:
  - name: Black Colorway (Special Edition)
    slug: black-colorway

# Wrong: different hardware generation as a variant
# Instead, create a separate file with supersedes
```

Do NOT use variants for different hardware generations, form factors, or capability changes. These should be separate top-level entries linked via `supersedes`.

## Versions

Software, content, hardware, and accessory entries can have a `versions` array with release history.

**Version fields:**

- `name` (required) - version number (e.g., "1.3.3")
- `releaseDate` - ISO date or year-only (YYYY)
- `releaseDateYearOnly` - set true if releaseDate is year-only
- `preRelease` - true for beta/RC versions
- `unofficial` - true for unofficial builds
- `url` - link to official download/info page (prefer official pages over direct download links to reduce data drift)
- `description` - version notes
- `prices` - version-specific pricing
- `links` - version-specific links

## Search Terms

All entry types support an optional `searchTerms` array of strings that improve full-text search. Search terms get their own high-weight BM25 column in the FTS index, so they strongly influence ranking.

**When to add searchTerms:**

- Product name is an acronym or abbreviation (MPC, SM7B, OB-Xa)
- Product is commonly known by a nickname ("Moog Grandmother" → "Grandma")
- Model number has common variations (SM7B vs SM-7B vs "Shure SM7B")
- Manufacturer has alternate/former names ("Arturia" → "Arturia Instruments")
- Name alone is ambiguous or doesn't describe the product well

**What to include:**

- Acronyms and abbreviations: `["MPC", "Music Production Center"]`
- Model number variations: `["SM7B", "SM-7B", "SM 7B"]`
- Common nicknames or shorthand: `["Grandma", "Grandmother"]`
- Former or alternate brand names: `["Mackie Designs"]`
- Common misspellings users would search for: `["Berhinger"]`
- Compact/no-space forms users might type: `["ProQ3", "Pro-Q3"]`
- For content packs: the host software name if not in the entry name: `["Serum", "Xfer Serum"]`

**What NOT to include:**

- The product's own name (already indexed in the `name` column)
- The manufacturer's display name (already indexed in `manufacturer_name`)
- Category or genre terms (`DAW`, `synthesizer`, `compressor`, `drum machine`, `ambient`, `cinematic`) — these belong in `primaryCategory`/`categories`
- Descriptions of what the product does (`saturation plugin`, `pitch correction`, `wavetable synth`)

```yaml
# Example: hardware with model number variations
name: SM7B
manufacturer: shure
searchTerms:
  - SM-7B
  - SM 7B
  - Shure SM7B
```

## Video Links

Videos use a dedicated `videos` array (not the `links` array):

```yaml
videos:
  - videoId: lgKAzohhZjs
    title: Product Demo
  - videoId: "1017281280"
    provider: vimeo
    title: Overview
```

**Fields:**

- `videoId` (required) - platform-specific video identifier
- `provider` - video platform: `youtube` (default) or `vimeo`. Omit for YouTube.
- `title` - optional display title
- `description` - optional description

Do NOT put videos in the `links` array. The `links` array is for non-video links only (resources, reviews, support, etc.).

## Translations

Translations are optional and added inline to YAML files using a `translations` key:

```yaml
description: English description...

translations:
  de:
    description: German description...
  ja:
    description: Japanese description...
```

**Translatable fields:**

- `description`, `details`, `specs` (content - converted to HTML)
- `url` (locale-specific URLs)
- `links` (replaces default links for that locale)
- `videos` (replaces default videos for that locale)
- Hardware `io` (merge semantics - uses `originalName` to match)

**Important:** Locale-specific links (e.g., "User Manual (Spanish)") should NOT go in the main `links` array. Instead, move them to `translations.<locale>.links` with a localized title. Supported locales are in `schema/locales.yaml`.

**A language name in a link or video title means the item belongs under
`translations.<locale>`.** "Manual (Deutsch)", "Manuel (français)", a title
written in Japanese: move the link or video to `translations.<locale>.links`
or `.videos` with the localized title, for every locale in
`schema/locales.yaml`. A locale that is not in that file stays where it is,
a link in `links` or a video in `videos`, with a locale-neutral title. A
video never moves to `links`: the two shapes differ and the schema rejects
a video there. `pnpm validate:translations` checks the block.

**Adding a new locale:**

1. Add locale to `schema/locales.yaml`
2. Add translations to relevant YAML files
3. Run `pnpm validate:translations` to check

**Hardware I/O translations:**

```yaml
translations:
  de:
    io:
      - originalName: Headphone Out
        name: Kopfhörerausgang
        description: Hochwertiger Kopfhörerverstärker
```

## Known False Findings

Review findings that the resolver skips on sight with the standard reply,
because each cost a cycle to re-prove on an import PR:

- `details`, `specs`, `platforms` and `videos[].title` are optional. An
  entry without them is not incomplete.
- `trs` is not a `connection` value. The schema models the physical size
  (`1/4-inch`, `1/8-inch`) and a stereo jack is one entry.
- `rj45` is spelled `ethernet` (`ethercon` for the locking Neutrik shell).
- `variants[].slug` is a valid field.
- `position` is required on every io entry except on played instruments.
- `Bottom` is the 500-series convention, not a mistake.
- `maxConnections: 1` on a single jack is correct even when the unit has
  several of that jack. Each jack is its own entry.

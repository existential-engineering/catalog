# catalog

## 3.19.0

### Minor Changes

- a1908b5: Import Ibanez (20 effect pedal entries).

  First-pass import covers the electronics category: the Tube
  Screamer family (TS808, TS9, TS9B, TS9DX, TS-Mini, TS808HW v2),
  the MINI series of analog modulation/effects and the BIG MINI
  chromatic tuner (AD, BIG, BT, CS, FL, PH, SM, TR), the LD303
  Echo Shifter, the PT-EQ / PT-GATE / PT-PRE Tone-Lok rack pedals,
  the TWP10 tube preamp, and the WH10v3 wah. Guitars, basses,
  hollow bodies, acoustic guitars, and accessories are out of
  scope for this pass and will need separate imports.

- 2bffb7e: Import Ludwig (50 hardware/accessories entries).

  Covers Ludwig's full current lineup: 11 acoustic drum kits
  (Stainless Steel, Legacy Mahogany / Maple, Classic Maple,
  Classic Oak, NeuSonic, Vistalite, Element Evolution,
  Breakbeats by Questlove, Accent, Pocket Kit), 19 snare drums
  (Black Beauty, Supraphonic, Acrolite, Copper / Bronze /
  Chrome-Over-Brass / Hammered Brass / Raw Brass Phonic,
  Universal metal & wood, Jazz Fest, Legacy, Classic Maple,
  Supralite, Slotted Coliseum, Carl Palmer / Nate Smith /
  Jon Theodore signatures, Super Series), 3 electronic
  instruments (Verse, Edge, Total Percussion Pad), and the
  Classic / Gig / Atlas Standard / Atlas Pro hardware lines
  with associated Atlas accessories, Speed King / Speed
  Flyer pedals, Pro Touring Bags, and the Thrones series.

- 2bffb7e: Import Marantz (33 hi-fi audio entries).

  Covers the Marantz US hi-fi lineup: CINEMA Series AV receivers
  (30/40/50/60/70s), AV processors (AV 10/20/30) and power
  amplifiers (AMP 10/20/30), the MODEL Series integrated amps
  (10/30/40n/50/60n/M1/M4/Stereo 70s), CD/SACD players (CD6007,
  CD 60, CD 50n, SACD 10, SACD 30n), the Link 10n streaming
  preamp, the TT-15S1 turntable, the M-CR612 and NR1510 network
  receivers, the Horizon and Grand Horizon wireless speakers,
  the MM8077 (archive/discontinued) power amp, plus two Horizon
  accessories (tripod, wall mount). The co-branded Bowers &
  Wilkins 600/700 Series speakers sold on the Marantz storefront
  are intentionally excluded — those belong under the B&W brand.

## 3.18.0

### Minor Changes

- 236dfd0: Add `discontinued:report` and `discontinued:apply` scripts plus a
  monthly CI check that surfaces and auto-tags catalog entries on the
  receiving end of a `supersedes` link but missing the `discontinued`
  category.
- 4904bf8: Import Allen & Heath (38 hardware entries).

  Covers current consoles (SQ, Qu, CQ, Avantis, dLive),
  audio matrix (AHM), powered/installed-sound mixers (XB,
  GR), wall controllers (IP, CC), personal monitoring
  (ME), MixWizard4 analogue, Xone DJ mixers/controller,
  and Everything I/O stage boxes (AB, DX, DT).

- 1e09af6: Import Blackstar Amplification (44 hardware/accessory entries).

  Adds the full Blackstar Amps product range: valve, solid-state and
  digital guitar/bass combos and heads (HT MKIII, Series One MKII,
  St. James 100, TV-10, Debut, ID:CORE V4, ID:X, Silverline, Unity,
  Unity Elite, Acoustic:Core, Sonnet, etc.), signature amps (Doug
  Aldrich DA100, Carmen Vandenberg CV10/CV30, Toby Lee, JJN 50, Marco
  Mendoza Debut Bass), Dept. 10 valve pedals + AMPED amp-in-a-pedal
  range, LT analogue pedals, FLY mini amps, Beam Mini / Beam Solo,
  Polar audio interfaces, Live Logic MIDI controller, Carry-on travel
  guitar and assorted accessories.

- 5d62691: Import Bowers & Wilkins (45 hardware/accessory entries).

  Adds the current Bowers & Wilkins product line: 800/700/600 Series
  loudspeakers (including Signature variants and HTM centres), DB and
  ASW Series subwoofers, Px7/Px8 over-ear headphones, Pi8 wireless
  earbuds (including McLaren editions), Formation Bar soundbar, M-1
  satellite speaker, and matching FS-series stands plus the Zeppelin
  wall bracket.

- 3757ede: Import Charvel (103 hardware entries).

  Bulk import of the Charvel electric guitar and bass lineup,
  including Pro-Mod, Pro-Mod Plus, MJ, USA Select, Super Stock,
  Standard Series, and Artist Signature models across San Dimas
  Style 1/2, So-Cal Style 1/2, DK24/DK22, and San Dimas Bass
  families. Adds 99 electric guitars and 4 bass guitars with
  auto-selected hero/detail imagery.

- 85ba216: Import Crown Audio (72 hardware/accessory entries).

  Adds Crown's complete current amplifier lineup including the CDi
  DriveCore Series (analog and BLU link), CDi legacy, DCi DriveCore
  Install (analog/DA/Network), I-Tech HD touring amps, VRack tour
  racks, XLi/XLS/XTi portable amps, XLC cinema amps, CT/CTD
  DriveCore commercial amps, 135MA/160MA mixer-amplifiers, and
  the DSi 2.0 cinema series. Also adds the XFMR-4 step-up
  transformer and EOL Box line terminator accessories.

- 73893c7: Import Danelectro (23 hardware entries).

  Reissues of the 1959, 1964, 1966 and 1967 vintage shorthorn and
  single-cutaway shapes (59X, 59XT, 64XT, 66T, 67, 59 Divine,
  59M NOS+ Metalflake), plus the Dan-O sub-line (Dan O. Cool,
  Dan O. Mano), the Fifty Niner family (incl. 12-string and
  short-scale bass), the Doubleneck, Red Hot Longhorn bass, and
  the Honeytone mini amp. Pedals include the 3699 Fuzz,
  Spring King Junior, Nichols 1966, and the "Peace, Love & Fuzz"
  book.

- 727aa1f: Import dbx (205 hardware entries).

  Bulk import of the dbx Professional Audio catalog (Harman). Covers the
  full product family: 160-series compressors, 166/266 dynamics
  processors, 30-series and iEQ graphic equalizers, 223/234 crossovers,
  286 channel-strip preamps, AFS feedback suppressors, DriveRack
  loudspeaker management, ZonePRO matrix processors, Personal Monitor
  controllers, 500-series modular processors, and assorted DI boxes,
  cable testers, and vintage 1bx/3bx/4bx range expanders. Many entries
  are discontinued but documented on dbxpro.com.

- 6a620d5: Import Denon DJ (16 hardware/software entries).

  Adds the PRIME standalone family (PRIME 4+, PRIME 4, PRIME 2, PRIME GO+,
  PRIME GO), SC LIVE controllers (SC LIVE 4, SC LIVE 2), SC media players
  (SC6000, SC6000M, SC5000, SC5000M), LC6000 expansion controller, X1850
  and X1800 club mixers, VL12 turntable, and the Engine DJ Desktop
  software.

- faa9544: Import DPA Microphones (66 hardware entries).

  Includes pencil mics (2006/2011/2012/2015/4006/4011/4015/4018/4041/4090),
  shotguns (2017/4017/4097g), handheld vocal mics (2028/4018v/4018vl),
  lavaliers (2061/4060/4080/4660/6060), headsets & earsets (4066/4088/
  4166/4188/4266/4288/4466/4488/4560/6066), goosenecks (4011f/4011g/
  4018d/4018f/4018g/4060d/4097/4098/4098f/4098g), instrument mics (4055/
  4099), the 5100 immersive surround mic, and the kit lineup (3506a/
  3511a/3532/4060imk/4060lmk/4060smk/4071eng/4071fmk/4097ink/4099kit/
  5006-11a/5006a/5015a/ddk4002/din4099/dlk4002/dls4000/dpk2015/dpk4011/
  dpk4099/drk4001/dsk4001).

- d0fd39f: Import DW Drums (231 hardware/accessory entries).

  Adds the full DW Drums lineup: Collector's, Performance, and
  Design Series shells; signature DW ICON and Specialty snare
  drums; all bass drum pedals (2000-9000 + MFG series) and
  hi-hat stands; cymbal and tom stands; thrones; hardware
  packs; and the MFG chain/direct-drive flagship pedals.

- 9674bcb: Import Dynaudio (38 hardware/accessory entries).

  Adds the full Dynaudio professional audio lineup: LYD nearfield
  monitors, Core mid-/main-monitor series with subs, Classic BM
  range, the Dynaudio Acoustics M-Series (M1-M4 MkII passive mains,
  MF15/MF30 flush-mount, MS15/MS18 subs, plus C3 MkII centre),
  Delta amplifiers (20/40/40 DSP/80/80 DSP), and the Control 01/02
  monitor controllers with the Control Link module. The SF1
  monitor stand is filed as an accessory.

- c3c1b55: Import Electro-Voice (117 hardware entries).

  Adds the full Electro-Voice professional audio line: RE series broadcast
  microphones (RE20, RE320, RE27N/D, RE420, RE520, RE920); ND series
  performance microphones (ND44/46/66/68/76/76S/86/96); PL series drum and
  vocal mics (PL-24/24S/33/35/37/44/80a/80c); RE3 wireless systems and
  components; PolarChoice install mics; ZLX G2, EKX, ELX, ELX200, ETX,
  Everse, Evolve, EVIVA, SX, TX, ZX portable and install loudspeaker
  families; and EV's line-array, install column, and stage-monitor
  products.

- fc161bf: Import ESP (55 hardware/accessory entries).

  Adds 50 ESP-branded electric guitars and basses (ESP Original Series,
  E-II, LTD, USA Custom Shop, plus Alexi Laiho, Gary Holt, and other
  signature models) and 5 accessories (form-fit cases and starter packs).

- 4d453f0: Import EVH (110 hardware/accessory entries).

  Eddie Van Halen's signature brand of guitars and amplifiers
  (owned by Fender). Catalog adds 79 hardware entries — the
  Wolfgang and 5150 Series electric guitars, SA-126 semi-hollows,
  Striped Series tribute models (Frankenstein, Bumblebee,
  Eruption), 5150III and 5150 Iconic Series amp heads, combos,
  and cabinets — plus 31 accessories (pickups, footswitches,
  tubes, cables, straps, picks, cases).

- 264d2ba: Import Focal (20 pro audio hardware entries).

  Adds the complete Focal Professional monitoring lineup: Alpha Evo
  nearfields (50/65/80/Twin), Shape Flax monitors (40/50/65/Twin),
  ST6 Beryllium range (Solo6, Twin6, Trio6, Trio11 Be), Utopia Main
  mastering monitors (112/212), studio subwoofers (Sub One, Sub12,
  Sub6), and the Professional headphone line (Clear Mg, Lensys,
  Listen).

- a1e1b9c: Import Focusrite (25 hardware/software entries).

  Adds the Scarlett 4th Gen audio interface family (Solo, 2i2, 4i4,
  16i16, 18i16, 18i20, Anniversary, Solo Studio, 2i2 Studio),
  the Vocaster One/Two podcasting interfaces, Clarett+ 2Pre/4Pre/8Pre,
  the ISA One/Two/428 MKII preamps, Red 4Pre/8Pre Thunderbolt
  interfaces, Scarlett OctoPre, and Focusrite software (Focusrite
  Control 2, Hitmaker Expansion, Red Plug-in Suite, RedNet Control,
  Focusrite x Sonnox Soften).

- ed9d3d8: Import Fostex (57 hardware/accessory entries).

  Added Fostex's current product line: studio monitors (PM, NF, 6301,
  RM, GS, P802 series), TH/RP premium headphones, T50/T60 planar
  magnetic headphones, HP-A3mk2 USB DAC, AP-series personal amps,
  PC volume controllers, and headphone cable/earpad accessories.

### Patch Changes

- f7039f3: Split aggregated IO ports into per-jack entries across 23 hardware entries (adam-audio, ampeg, antelope-audio, elektron, fostex, ik-multimedia, neural-dsp) to correct maxConnections semantics.

## 3.17.0

### Minor Changes

- e99438f: Import ADAM Audio (23 hardware/accessory entries).

  Adds the current ADAM Audio studio monitor lineup: A Series
  (A4V, A44H, A7V, A77H, A8H), S Series (S2V, S3H, S3V, S5H, S5V),
  T Series (T5V, T7V, T8V), D3V desktop monitor, H200 studio
  headphones, subwoofers (Sub8, Sub10 MK2, Sub12, Sub15, Sub2100,
  T10S), plus two accessories (A Series Mounting Plate, D3V Travel
  Bag).

- 88c5379: Import Ampeg (20 hardware/software entries).

  Adds the current Ampeg lineup: Heritage series (50th
  Anniversary SVT head, HSVT-CL, HSVT-810E, HSVT-810AV,
  HSVT-410HLF), Classic heads (SVT-CL, V-4B), Pro Series
  heads (SVT-7PRO, SVT-4PRO, SVT-3PRO), Portaflex heads
  (PF-50T, PF-20T), Rocket Bass combos (RB-108 through
  RB-210), the SGT-DI and SCR-DI bass pedals, and the
  SVT Suite plugin.

- 8ecd0db: Import Antelope Audio (144 hardware/software entries).

  Adds Antelope Audio's full product line: audio interfaces (Discrete 8
  Oryx, Orion Studio/32 Gen 4, Galaxy 32/64, Zen Quadro/Tour), modeling
  microphones (Edge family, Axino), master clocks (Isochrone Trinity,
  OCX-HD, 10MX), monitor controllers (Satori), mastering converter
  (Amari), hi-fi gear (Zeo), and 120 Synergy Core FX plugins/bundles
  (BAE/NEU/VEQ/Gyratec emulations, FX Bundles, Synergy Core Native).

- 47d2ae2: Import Audeze (77 hardware/software/accessory entries).

  Adds the full Audeze product line: 41 hardware entries (LCD planar
  magnetic headphones, MM-series studio reference headphones, Maxwell
  and Mobius wireless gaming headsets, iSine and CRBN in-ear monitors,
  Deckard and The King MkII headphone amplifiers, the Filter speaker-
  phone), 3 software entries (Reveal+ HRTF plugin, Audeze HQ for Dolby
  Atmos Renderer, ASIO Driver for Mobius), and 33 first-party
  accessories (replacement cables, ear pads, headbands, travel cases,
  USB dongles).

### Patch Changes

- b6d26b0: Dedupe redundant category aliases on Antelope Audio software entries.

  62 Antelope Audio entries from the recent import listed both the
  canonical category and its alias in the same `categories:` array
  (`effect` + `fx`, or `equalizer` + `eq`), producing "Duplicate category
  ... after normalization" warnings at build time. Drop the redundant
  alias rows; the canonical form remains.

## 3.16.0

### Minor Changes

- c37057e: Import AIAIAI (19 hardware entries).

  Adds 19 products across AIAIAI's TMA-2 modular headphone platform,
  Tracks on-ear headphones, and the UNIT-4 portable studio monitors:
  - Wired TMA-2 headphones: DJ, DJ XE, Studio, Studio XE, Studio XE (2023)
  - Wireless TMA-2 headphones: DJ Wireless, Studio Wireless+, Move
    Wireless, Move XE Wireless
  - TMA-2 limited editions: COLORS, Deviation, KNTXT, Ninja Tune,
    Places+Faces, Yeti Out
  - Tracks on-ear headphones: Mini-Jack, USB-C
  - UNIT-4 studio monitors: Wireless+ pair, Wireless+ Single

### Patch Changes

- 547b6b5: Tighten the W127_MISSING_SEARCH_TERMS validation warning and add
  searchTerms to 28 acronym entries with documented expansions.

  The W127 warning previously fired on every entry whose name contained a
  hyphenated model number (e.g. `DR-110`, `SM-7B`) or any all-caps string
  of two or more letters (e.g. `REAPER`, `TONIC`, `IRON`). That covered
  526 entries — almost all of them false positives:
  - Model-number variants (`dr110`, `dr 110`) are already generated by
    `brandVariants()` in `synonyms.ts` at build time and indexed in FTS,
    so asking authors to add them by hand is duplicate work.
  - All-caps stylized brand names that happen to be English words
    (`REAPER`, `TONIC`, `IRON`, `MOOD`) are not acronyms and have nothing
    meaningful to expand.

  The check now flags only short (2–5 character) all-caps names that
  aren't on a small exclusion list of known English words and stylized
  brand names.

  Of the ~65 entries that remained after the rule change, 28 had
  expansions explicitly stated in their own descriptions or were
  universal audio-engineering terms (`VCA` → Voltage Controlled
  Amplifier, `ADT` → Automatic Double Tracking). Those expansions are
  now in `searchTerms`, leaving 37 advisory warnings where the
  expansion would require manufacturer-specific research.

## 3.15.0

### Minor Changes

- d20ee33: Add Cakewalk Next and Cakewalk Sonar DAWs
- 1d274bc: Expand FTS5 search terms with curated synonyms

  Each product/manufacturer row now has additional search terms generated
  from curated misspellings (e.g. `srum` → Serum, `oporator` → Operator),
  common abbreviations (`comp` → compressor, `verb` → reverb), and brand
  name variants (hyphen-stripped / space-separated, e.g. `ms20`/`ms 20`
  for "MS-20"). These flow into both the `*_search_terms` table and the
  FTS5 `search_terms` column, so Studio's strict FTS path returns hits
  for these variants directly without needing the client-side fuzzy
  fallback.

  No schema change. Old Studio versions consuming new catalogs benefit
  automatically; new Studio versions still work against older catalogs
  (the JS fuzzy layer covers the gap).

## 3.14.3

### Patch Changes

- 10eda21: Upgrade to pnpm 11.
  - Move build allowlist from `package.json` `pnpm.onlyBuiltDependencies` to `pnpm-workspace.yaml` `allowBuilds` (pnpm 11 no longer reads the `pnpm` field in `package.json`).
  - Pin transitive `vite` to `>=7.3.2` via pnpm override to clear GHSA-v2wj-q39q-566r and GHSA-p9ff-h696-f583 (pnpm 11 now correctly fails `pnpm audit --audit-level=high`, which pnpm 10 silently ignored).
  - Bump dev dependencies.

## 3.14.2

### Patch Changes

- c9717ee: Update dev dependencies and pnpm to latest patch versions (biome, changesets, @types/node, better-sqlite3, marked, nanoid, prettier, typescript, vitest, yaml, zod).
- 10140cc: Replace `&amp;` HTML entities with literal `&` across 43 entries, and remove duplicate `{amount: 0, currency: USD}` price rows from 64 wa-production entries.

## 3.14.1

### Patch Changes

- 4735744: Consolidate duplicate AIR Music Technology manufacturer entries onto `air-music` slug and update references.

## 3.14.0

### Minor Changes

- 02bc391: Add 8 new entries from production submissions (Quad Cortex, Fender Kurt Cobain Jaguar, Torso T-1/S-4, AIR Music Flex Beat/Tape Double Track, UA Fairchild Tube Limiter Collection, sonible smart:EQ 3) and backfill bundle identifiers for Logic Pro, Kontakt, Decapitator, and Studer A800.

## 3.13.0

### Minor Changes

- d3fe8b4: Add dedicated search_terms FTS column for improved full-text search ranking. Search terms now get their own high-weight BM25 column instead of being diluted in the description field. Switches FTS tokenizer from porter to unicode61 to fix acronym matching. Adds W127 advisory warning for entries that would benefit from searchTerms. Backfills searchTerms for 70 high-priority entries across software, hardware, and content.

## 3.12.0

### Minor Changes

- 54f4237: Add Kraftur saturation plugin by Soundtheory

## 3.11.1

### Patch Changes

- 10b5366: Add CI security hardening: pnpm audit, SHA-pinned GitHub Actions, SBOM generation on release, and OpenSSF Scorecard
- f87e9af: Update devDependencies: @biomejs/biome 2.4.10, @types/node 25.5.2, typescript 6.0.2, vitest 4.1.2, yaml 2.8.3

## 3.11.0

### Minor Changes

- e2c39d1: Add hardware support to content compatibleWith

## 3.10.2

### Patch Changes

- 6c8ff7e: Remove affiliate link type and all affiliate link entries (moved upstream to Studio app)

## 3.10.1

### Patch Changes

- a6c1515: hardware(add): MPC Sample

## 3.10.0

### Minor Changes

- 8d19e22: Add 92 Reason Studios Rack Extension entries including synthesizers, effects, utilities, samplers, drum machines, mixers, and romplers

## 3.9.1

### Patch Changes

- d121281: Add version history for XLN Audio and u-he products

## 3.9.0

### Minor Changes

- ec9265f: Add Elektron hardware catalog (Analog Four, Analog Keys, Analog Heat, Analog Drive, Digitone Keys, Monomachine SFX-60) with IO/details/specs enrichment for existing entries, plus Celemony Capstan and Melodyne 5 editions

## 3.8.0

### Minor Changes

- 7f6b48f: Add 19 Elektron products: 7 hardware (Analog Four MKII, Analog Heat +FX, Digitakt II, Digitone II, Model:Cycles, Model:Samples, Octatrack MKII), 1 software (Overbridge), 5 content packs, and 6 accessories
- 40b98a0: Add 458 Eurorack manufacturers from ModularGrid

## 3.7.0

### Minor Changes

- fe8443b: feat: add 4 Toontrack products (EZbass, EZdrummer 3, EZkeys 2, EZmix 3)

## 3.6.0

### Minor Changes

- 62f8329: Add 35 Cherry Audio products

## 3.5.0

### Minor Changes

- bbb85fc: Add missing Valhalla DSP plugins
- 5348ce0: Add Chase Bliss Billy Strings Wombtone phaser
- 660a064: Add Output software: Arcade, Co-Producer, Creator, Movement, Portal, Thermal
- a1222fb: Rename all data files (software, hardware, content, accessories) to {manufacturer}-{name} format and update compatibleWith references
- a3f5bab: Add Softube software, hardware, and accessory entries

## 3.4.2

### Patch Changes

- 9cb275b: Remove duplicate links from software, content, and hardware entries

## 3.4.1

### Patch Changes

- 94c63ab: add missing Waves v16.7.33 version to 148 plugin entries

## 3.4.0

### Minor Changes

- 2983538: Add default identifiers to 201 software entries and 6 new entries based on analytics

### Patch Changes

- 6536264: software(update): REAPER

## 3.3.1

### Patch Changes

- 637a5ae: Add JSON Schema generation and VS Code YAML validation support

## 3.3.0

### Minor Changes

- 654fd92: Promote hardware revisions to top-level entries linked via supersedes. Revisions are now cosmetic-only (colorways, limited editions). 25 new hardware entries created from former revisions across Elektron, Access, Roland, Korg, Waldorf, DSI, Novation, Ensoniq, Crumar, Doepfer, and Sherman product families.

## 3.2.0

### Minor Changes

- e9a0ea5: Remove redundant format/platform specs lines from 378 software entries, add W126 validation warning for specs that overlap with structured fields, enrich data for 15 seeded entries, and add 3 new hardware entries (Maths, Morphagene, Plaits)

## 3.1.4

### Patch Changes

- 5c8f8f7: Fix 1,461 truncated descriptions and add E304 validation error to prevent future truncated content

## 3.1.3

### Patch Changes

- b6f4098: Downgrade identifiers from required to recommended for software entries in documentation and review tooling
- ef70455: software(add): Snapback

## 3.1.2

### Patch Changes

- 05fb0a9: Remove redundant manufacturer homepage links from 1080 data files and add W125 validation warning

## 3.1.1

### Patch Changes

- 15416ed: software(add): ShaperBox 3

## 3.1.0

### Minor Changes

- 3012d6d: Add 80 initial accessory entries across 10 categories (cables, mic stands, boom arms, pop filters, shock mounts, reflection filters, acoustic panels, acoustic treatment, windscreens, power conditioners) with 22 new manufacturers and a new windscreen category.

### Patch Changes

- 31225a5: Move id field to top of YAML files, add format-yaml script

## 3.0.0

### Major Changes

- 543c90c: Rename `website` field to `url` across all data files, scripts, schema, and documentation. This is a breaking change — the SQLite `website` column is now `url` in all tables and translation tables.

### Minor Changes

- 2c14746: Add 35 content entries, 9 manufacturers, and 17 software entries including major DAWs and instruments

## 2.12.0

### Minor Changes

- e15ef59: Add 197 new entries (41 manufacturers, 129 software, 17 content, 10 hardware), remove duplicate links across 746 files, add W124 duplicate URL validation warning, and expand IO/category schemas

### Patch Changes

- 0b6432e: hardware(add): Monos CV
- 2ce9a8f: Rename Racks to Aureo across documentation and scripts

## 2.11.0

### Minor Changes

- d5ac9de: Add content/accessory schema categories, category aliases, and enrich content entries with compatibleWith references

## 2.10.0

### Minor Changes

- ee00147: Add content collection with 613 entries migrated from software

## 2.9.0

### Minor Changes

- 10305c4: Bulk import of 1,483 new entries (263 manufacturers, 1,206 software, 14 hardware), schema updates, URL validation tooling, and compatibleWith ID conversion

## 2.8.0

### Minor Changes

- 3cc4fa3: Add IK Multimedia hardware and software catalog with IO schema standardization

## 2.7.0

### Minor Changes

- 38bd9d9: Add Plugin Alliance software catalog and enhance Arturia entries

## 2.6.0

### Minor Changes

- 3e504cc: Add Waves Audio software catalog with 245 plugin entries

## 2.5.0

### Minor Changes

- ce60fe6: Add Universal Audio hardware and software catalog (59 hardware, 139 software entries)

## 2.4.0

### Minor Changes

- 934e36a: Add 785 hardware and 29 manufacturer entries, consolidate product variants into revisions, and reclassify Virus TDM as software

## 2.3.0

### Minor Changes

- 8de6a68: Add Leapwing Audio plugin catalog (8 entries: Al Schmitt, CenterOne, DynOne, Joe Chiccarelli, LimitOne, RootOne, StageOne 2, UltraVox 2)

## 2.2.0

### Minor Changes

- dfd0adb: Add Arturia product catalog with 136 entries (46 hardware, 90 software)

### Patch Changes

- dee7e1a: Add Spectrasonics plugin catalog with Keyscape, Omnisphere 2, Omnisphere 3, Stylus RMX, and Trilian

## 2.1.0

### Minor Changes

- 19c8ba3: Add 11 new FabFilter plugin entries (Micro, One, Pro-DS, Pro-G, Pro-Q 4, Pro-R 2, Saturn 2, Simplon, Timeless 3, Twin 3, Volcano 3), enhance 3 existing entries (Pro-C 3, Pro-L 2, Pro-MB) with descriptions, specs, prices, videos, and identifiers, and fix identifier validation regex to accept digit-starting bundle ID segments
- 350f0ef: Add 2,723 new manufacturer entries to the catalog
- 6977c58: software: add Soundtoys plugin catalog

## 2.0.10

### Patch Changes

- 5122b39: software(add): Multiband Filterbank
- 6f53fde: hardware(add): Nano Cortex

## 2.0.9

### Patch Changes

- c416d79: hardware(update): MPC Live III - add I/O, details, links; rename from mpc-live-3

## 2.0.8

### Patch Changes

- 23548cd: software(add): Flavor Pro
- 56fb243: hardware(add): LCT 940
- 764e341: hardware(add): Quad Cortex Mini
- ee7767d: software(add): Tekno

## 2.0.7

### Patch Changes

- 074d6f3: software(update): Diva

## 2.0.6

### Patch Changes

- 9f9292b: hardware(add): 1992 High Gain Amp

## 2.0.5

### Patch Changes

- 1d3f2d2: software(update): AmpliTube 5

## 2.0.4

### Patch Changes

- 2ca6d2d: software(update): Pro-L 2

## 2.0.3

### Patch Changes

- f07822f: hardware(add): Tone Master Pro

## 2.0.2

### Patch Changes

- eae825d: hardware(add): Chroma Console

## 2.0.1

### Patch Changes

- 3567f93: hardware(add): H90 Harmonizer
- 3b090dd: hardware(update): Infinite Jets

## 2.0.0

### Major Changes

- 25f52bb: Separate video links into dedicated `videos` array with new SQLite tables. Videos are no longer stored in the `links` array.

## 1.5.2

### Patch Changes

- 22d8639: Standardize specs and details fields to block scalar format. Add full version history to Gullfoss.

## 1.5.1

### Patch Changes

- 05c9ac1: hardware(update): Dream Sequence

## 1.5.0

### Minor Changes

- 61a1f44: Add slug column to hardware revisions for stable identifiers

## 1.4.8

### Patch Changes

- c42213b: add new effect and hardware categories, fix effects->effect typo

## 1.4.7

### Patch Changes

- 0c57862: software(add): Vintageverb

## 1.4.6

### Patch Changes

- 6ca56b7: software(add): Gullfoss

## 1.4.5

### Patch Changes

- d000d0f: hardware(update): Microcosm

## 1.4.4

### Patch Changes

- e8e6830: hardware(update): Tonverk

## 1.4.3

### Patch Changes

- 1c0effc: software(add): Pro-Mb

## 1.4.2

### Patch Changes

- e3f6b2d: software(add): smart:deess

## 1.4.1

### Patch Changes

- a5c9d1e: software(add): Plate

## 1.4.0

### Minor Changes

- a38fe75: Add bidirectional product lineage tracking with ID-based supersedes references. Implements database schema updates, cycle detection validation, and migrates 7 existing product entries to use the new ID-based system.

## 1.3.0

### Minor Changes

- 026ad13: Add product lineage tracking and improve translation handling
  - Add `supersedes` field for tracking product version upgrades (e.g., Pro-L 2 supersedes Pro-L)
  - Add predecessor entries for existing versioned products (Pro-L, Pro-C 2/3, AmpliTube 4, Transit, Infinity EQ, MPC Live/III)
  - Move locale-specific links to translations sections (Satin, Diva)
  - Change unapproved locale translations from errors to warnings for forward compatibility
  - Support string arrays for `details` and `specs` fields

## 1.2.1

### Patch Changes

- fe73100: Add development infrastructure: Biome for linting/formatting, Vitest for testing, and husky pre-commit hooks
- 1a1b597: software(add): Satin

## 1.2.0

### Minor Changes

- 7233bad: Add 58 new categories including software types (audio-editor, notation, stem-separator), restoration effects (noise-reduction, de-click, de-reverb), reverb types (spring, hall, room, convolution), MIDI tools (chord-generator, scale-helper), world instruments (bagpipes, didgeridoo, kalimba, hurdy-gurdy), hardware accessories (headphone-amp, pop-filter, acoustic-treatment), and content assets (sample-pack, preset, impulse-response)

## 1.1.0

### Minor Changes

- 63eff4a: Add enhanced validation infrastructure with line numbers, error codes, and reporting tools
  - Enhanced error reporting with line numbers, error codes (E1xx-E4xx), and documentation links
  - New scripts: identifier-coverage, staleness-report, benchmark, generate-context
  - New schema-loader module for shared schema access
  - URL health checking workflow with caching
  - Staleness detection workflow for data quality monitoring
  - Schema versioning with migrations table
  - Updated /data-review skill to use automated tools

### Patch Changes

- 29ae985: Remove redundant slug field from all YAML files - slugs are now derived from filenames. Fix Ruby '63 Top Boost Amplifier entry data.

## 1.0.0

### Major Changes

- 924c4fe: Migrate all entity IDs from sequential integers to nanoid strings. Schema version bumped to 9 with all primary/foreign key columns changed from INTEGER to TEXT. Existing SQLite databases must be rebuilt.

## 0.5.1

### Patch Changes

- 57fcb83: software(add): Diva

## 0.5.0

### Minor Changes

- beac328: feat: allow year-only release date when specific date is unknown

## 0.4.0

### Minor Changes

- fc0e54c: Add verified prices to hardware entries

  **Elektron devices:**
  - syntakt: $1,149
  - digitakt: $599
  - digitone: $899

- fc0e54c: Add plugin formats and verified prices to software entries

  **Formats added (14 entries):**
  - ableton-live, acid-pro, bitwig-studio, traktor: standalone
  - amplitube-5: vst3, au, aax, standalone
  - super-massive: vst2, vst3, au, aax
  - l2-ultramaximizer, manny-marroquin-reverb: vst3, au, aax
  - anthem-analog-synthesizer, oxide-tape-recorder, pure-plate-reverb, ravel, softube-vocoder, uad-ruby-63-top-boost-amplifier: vst3, au, aax

  **Prices added (10 software entries):**
  - ableton-live: $749, bitwig-studio: $399, serum: $189, traktor: $149
  - amplitube-5: $199, acid-pro: $199, manny-marroquin-reverb: $99
  - super-massive: $0 (free), uad-ruby-63-top-boost-amplifier: $299

### Patch Changes

- fc0e54c: Remove unused image support from catalog schema
  - Removed Image interface from types
  - Removed manufacturer_images, software_images, hardware_images tables from SQL schema
  - Removed image insertion logic from build script
  - Removed ImageSchema validation

  No YAML files were using images, so this is purely a schema/code cleanup with no data impact.

## 0.3.10

### Patch Changes

- 0625f44: hardware(add): Tonverk

## 0.3.9

### Patch Changes

- 14773df: feat: add missing descriptions

## 0.3.8

### Patch Changes

- a361cb3: Add CLAUDE.md and CodeRabbit configuration files for AI-assisted development and code review.
- a361cb3: Fix data issues: remove duplicate Brigade Chorus & Vibrato entry, move Traktor and ACID Pro from manufacturers to software.

## 0.3.7

### Patch Changes

- b68885a: software: add amplitube 5

## 0.3.6

### Patch Changes

- 0f17fc9: software: add sonible true:level
- 9dceb03: software: add fabfilter pro-l 2

## 0.3.5

### Patch Changes

- 469fc05: feat(manufacturer): add sonible
- 469fc05: feat(software): add sonible smart:limit

## 0.3.4

### Patch Changes

- 4d0fb6d: enhance: prepare public repo

## 0.3.3

### Patch Changes

- 6389557: feat: markdown formatting in more complex fields

## 0.3.2

### Patch Changes

- 42832f9: feat: sync data from postgres
- e468f3f: feat: add missing revision indexes

## 0.3.1

### Patch Changes

- 3f576a7: fix: use semver as catalog version

## 0.3.0

### Minor Changes

- c9e4ba3: feat: add uniqueness checks for slugs
- cab907e: feat: additional manufacturers; related parentCompany instead of text field

## 0.2.2

### Patch Changes

- 68b0a68: chore: remove duplicate manufacturer in Ableton Live

## 0.2.1

### Patch Changes

- 0e26f61: refactor: make synthesizer serum's primary category
- 0e26f61: fix: correct url

## 0.2.0

### Minor Changes

- 8def154: refactor: remove dedicated DAW types in favor of Software with DAW category

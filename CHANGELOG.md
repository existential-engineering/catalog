# catalog

## 3.58.0

### Minor Changes

- cf677a7: Import Animal Factory Amplification (14 hardware/software entries).
- b8af251: catalog-import-merge: joey-sturgis-tones — add 32 sample, impulse-response
  and plugin entries; all 61 existing entries re-verified and unchanged.

  Adds 30 content entries (Conquer All IR volumes I–V, the ANVIL and JTW v30
  IR packs, Make Believe, the Riff Vault loop packs, and the Blood Series,
  Departure Drums, Truth Custom, Shoulder City, Cymbalism and Kaoss sample
  packs) plus 2 software entries (Black Box, Impossible Fader).

  Bundle SKUs were deliberately excluded. Every pre-existing entry matched a
  live product URL, so nothing was marked discontinued.

- bd60937: Import Rossum Electro-Music (22 hardware/software entries).

### Patch Changes

- 4505ebf: Validator warns on unknown keys (W132) and untermed same-currency prices (W131), prices gain an optional term, scoped format normalises entry shape.

  `pnpm validate --strict-unknown-keys` turns W132 into E121 for the import
  lanes. `pnpm format <files>` now rewrites alias categories, drops a
  secondary category equal to the primary, coerces details and specs to
  block scalars and orders io fields. The unscoped run is unchanged. The
  sqlite build carries an additive `term` column on every prices table.
  CLAUDE.md gains the I/O modelling conventions, the price term, unknown
  key and ios rules, the import supersedes policy and the known false
  findings list, mirrored in .coderabbit.yaml (AUREO-1076).

- 4ee935a: An unknown key is now a validation error (E121) on every `pnpm validate` run, not a warning.

  W132 and its opt-in flag existed only while 337 entries on `main`
  predated the check. Those were backfilled in catalog#716, so strict is
  the only mode and the W132 code is retired. `--strict-unknown-keys` is
  still accepted and ignored, because the racks import lanes probe for
  it and pass it on their changed files (AUREO-1079).

- 5d10a93: Backfill the 465 unknown keys across 337 entries so `pnpm validate` reports no W132 on main.

  Every key Zod was silently stripping now lives where the schema keeps
  it or is gone: `versions[].notes` and `changes` become `description`,
  `versions[].date` becomes `releaseDate`, `links[].label` becomes
  `title`, `prices[].type` one-time and perpetual become `term: perpetual`,
  a top-level `discontinued: true` becomes the `discontinued` category,
  and the Grado S550 cable terminations become `variants`. Dropped with
  no home: `platforms` on 219 STL content entries, a `type: software`
  marker on 13 discoDSP entries, price notes, labels and regions, and 32
  conditional discount, demo, intro and bundle price rows that were never
  a term (AUREO-1079).

- 188979b: `pnpm format` now turns a `details` or `specs` plain scalar that wraps over several lines into a `|-` block scalar, not only one that carries a paragraph break.

  The rule tested the value for a newline, and a folded plain scalar has
  none because YAML folds the line breaks to spaces, so 127 wrapped
  `details` on `main` came through the first `--normalize` pass
  untouched. A value wider than the writer's 80-column fold now counts
  as multi-line too. A single short line is still left as it is
  (AUREO-1080).

- aecaa3c: Second shape pass: 126 entries whose `details` or `specs` wrapped over several lines as a plain scalar now carry a `|-` block scalar.

  These are the entries the first `pnpm format --normalize` pass left
  behind because a folded plain scalar carries no newline in its value.
  With that rule corrected, the pass is a no-op on `main`, and every
  scoped `pnpm format <file>` in an import PR changes shape only for
  what the PR itself introduced (AUREO-1080).

- 8f2c09f: One-time shape normalisation of 803 entries: 708 alias categories rewritten to their canonical name, 290 duplicate categories dropped, 94 details arrays turned into block scalars.

  The pass `pnpm format --normalize` has run on every entry once, so
  from here every scoped `pnpm format <file>` in an import PR is a no-op
  on shape and the unscoped run can stop skipping it. No entry gains or
  loses information: an alias and its canonical category are the same
  category to the build, a category that repeats the primary was already
  implied, and a `details` array and its block-scalar form render the
  same paragraphs (AUREO-1080).

- 2aaa0c5: `pnpm format` normalises entry shape on every run, scoped or not, so the `assign-ids` sync keeps the tree in shape.

  The scoping existed only while 708 entries on `main` still carried
  alias categories, and #718 and #720 rewrote those. `--normalize` is
  still accepted and changes nothing (AUREO-1080).

- 493c105: Prices on 61 entries that carried several amounts in one currency now say what each amount is: 48 gain a `term` (perpetual, monthly or yearly) and 77 sale, upgrade, free-tier and bundle rows are removed.

  Every maker's page was read for this pass. Subscriptions keep their
  monthly and yearly rows with a term each (Output Arcade and Co-Producer,
  Serato DJ Pro, Slate Transient Shaper, the A.O.M. Total Bundle), one-off
  licences keep the list price as `perpetual`, and an intro price, a
  loyalty discount, a free edition beside a paid one, an upgrade fee or a
  higher edition sold as a bundle goes. Sonuscore Percussion carried only
  two sale prices and now lists the Series edition at 299 USD. AudioMulch
  is untouched because its site could not be reached. Distinct hardware
  models that shared one entry (CDMK sizes, iLoud Precision models,
  Majesty string counts) keep the base model's price, with the rest
  recorded in AUREO-1084 for entries of their own (AUREO-1081).

- 3b56f45: The schema version history now documents every migration through version 22, including the optional price `term` column, so a consumer can see the four breaking changes it previously omitted.

  `docs/SCHEMA_VERSIONS.md` is the compatibility contract consumers are
  told to read, and nothing in the repo referenced it, so it drifted. It
  stopped at "Version 10 (Current)" while `scripts/schema.sql` had reached
  22, hiding versions 13, 15, 16 and 17 as breaking, and hiding the `term`
  column of catalog#715. It had also mislabelled the v17
  `hardware_revisions` rename as a second "Version 8". Versions 11 through
  22 are backfilled from the `schema_migrations` rows, the mislabelled
  entry is corrected, and a guard test diffs the doc against those rows so
  the next migration cannot land without its entry (AUREO-1081).

- 703baf4: catalog-import-merge: acon-digital refreshes 12 existing entries with current product data

  Updates descriptions, details, specs, formats, platforms, versions and
  images across the full Acon Digital plugin line from the manufacturer's
  current product pages. No new entries and no retirements.

- 8bfa29a: catalog-import-merge: adam-audio refreshes all 24 existing entries with current product data

  Updates descriptions, details, specs, images, links and videos across the
  A, S and T series, the subwoofer line, the H200 headphones, S Control and
  the two accessories. No new entries and no retirements. Proposed `io`
  changes are listed in the pull request for review rather than applied.

- 177c82d: catalog-import-merge: audio-modeling refreshes the Ambiente entry with current product data

  Updates the canonical URL to the maker's current /products/ path and adds
  description, details, specs, formats, platforms, prices, links, videos and
  version history. No new entries and no retirements.

- ab6e3b7: catalog-import-merge: jam-origin, refreshed all 7 entries from the current jam.live product pages

  Updates descriptions, details, specs, formats, platforms, prices and
  version history for MIDI Guitar 3, MIDI Guitar 3 Hex, MIDI Guitar 3 for
  Logic, MIDI Bass 3, MIDI Cello 3, Guitar Mods and MIDI Guitar 2. No
  entries were added or retired.

- 2b69662: catalog-import-merge: kazrog, refreshed 12 plugin entries with current specs, system requirements and pricing

  Reconciled all 13 existing Kazrog entries against the live
  kazrog.com storefront. No products were added or discontinued:
  every catalog entry is still on sale.

  - 36 safe-add fields applied across 12 entries (details, specs,
    descriptions, formats, prices).
  - KClip 3's price corrected to its current regular price.
  - KClip Zero regained the platform requirements its product page
    no longer lists, sourced from the Kazrog Plugin Manager page.
  - Avalon EQ Bundle left untouched pending a human decision on its
    pre-existing bundle-entry flag.

## 3.57.0

### Minor Changes

- c86d0b1: catalog-import-merge: acon-digital adds 6 new plug-ins (Remix, Remix:Drums,
  DeBleed:Drums, Extract:Dialogue 2, Multiply, Verberate Basic), refreshes
  7 existing entries and marks AudioLiquid Converter discontinued.
- dbace44: catalog-import-merge: adam-audio adds S Control and refreshes all 23
  existing entries with current details, specs, videos and cosmetic
  variants. Existing curated I/O left untouched.
- 717935c: catalog-import-merge: audioblast adds 50 new entries (11 software, 39 content) and refreshes Abx3

  Adds Audioblast's full current roster: the plugin line (AcidBox, Blast
  Delay, BreadSlicer Pro, DistoBlast, Drum Blaster, Instalooper3,
  Minilooper, Mininn Drum, Mininn Drum 2, Multi FX Blaster, Rave
  Generator 3) plus 39 preset banks, sample packs and add-ons for ABX3
  and Rave Generator 3.

  The existing Abx3 entry gains formats, prices, specs, releaseDate,
  videos and a refreshed description. Bundle SKUs were excluded per the
  catalog's no-bundles rule.

- 491c5c0: Import Darkglass Electronics (50 hardware/software/accessory entries).

  Bass amplifier heads, combos and cabinets (Alpha·Omega and Microtubes
  lines), overdrive/distortion/compressor pedals, the Anagram multi-effects
  unit, footswitch and carrying-bag accessories, and the free Darkglass
  Suite companion app.

- 8cd57cb: Import Death By Audio (30 hardware/accessory entries).

  Death By Audio is a Brooklyn-based boutique effects pedal maker.
  Adds their core lineup of fuzz, distortion, delay, reverb, and
  modulation pedals (Fuzz War, Apocalypse, Echo Dream 2, Rooms,
  Total Sonic Annihilation 2, Time Shadows II, and others), plus a
  handful of accessories (Raw Power supply, patch cables, mic-stand
  mounting hardware, and a gig bag).

- f552ae8: Import Empress Effects (37 hardware/accessory entries).

  Adds the full current pedal lineup (compressors, drives, distortions,
  delays, modulation, EQ, reverb, buffers, the ZOIA modular platform and
  ZOIA Euroburo eurorack module) plus MIDI/power accessories. Four
  limited-edition cosmetic variants (Heavy Menace Limited Edition,
  ParaEq MKII Deluxe Black, 10th Anniversary Tremolo, ZOIA 10K) are
  folded into their base entries' `variants` arrays. Five supersedes
  edges link discontinued predecessors to their successors.

- 3bf6f3b: Import HEDD (43 hardware/accessory entries)

  Adds HEDD's studio monitor and headphone lineup: the TYPE 05/07/20/30
  MK2 and A-CORE monitors, Tower Mains, BASS 08/12 subwoofers, and the
  HEDDphone / HEDDphone TWO / TWO GT / D1 headphones, plus their
  official cables, earpads, and adapters. Also adds the IsoAcoustics V120
  mounting brackets and HEDD's own M05/M07/M20/M30 mount bundles used to
  pair HEDD monitors with the V120 isolation system.

  Four Atmos bundle/consultation listings (Bespoke, Bold, Dream, Light)
  were intentionally excluded: they package existing monitor/subwoofer
  SKUs rather than being standalone products.

- b8a5f35: catalog-import-merge: hofa-plugins, 3 new entries and 36 refreshed

  Adds SYSTEM ThirdPartyPluginLoader plus two 4U freeware utilities
  (Meter, Fader & MS-Pan and Goniometer & Korrelator) that were absent
  from the sitemap and reachable only from the freeware page. Refreshes
  descriptions, details, specs, prices, videos and links across the 28
  existing software and 8 content entries, filling 17 entries that
  previously carried no description at all. No discontinuations.

- 9e8b94c: catalog-import-merge: hornet, 3 new entries and 85 refreshed

  Adds Spaces MK2, SpectraDuck and ZeroWidth. Refreshes descriptions,
  details, specs, prices, formats and videos across the existing 85
  HoRNet plugin entries, replacing changelog fragments and one-line
  taglines with multi-paragraph prose and adding specs throughout. Marks
  the original Spaces as discontinued. Its product page now redirects to
  Spaces MK2.

- 42d593a: Import Joranalogue Audio Design (28 catalog entries: 27 hardware modules and 1 accessory).

  Belgian Eurorack modular manufacturer. Adds 27 modules spanning
  slew limiters, filters, oscillators, sequencers, mixers and utility
  modules (Contour 1, Filter 8, Generate 3, Step 8, Morph 4, and more),
  plus the Patch cable line as an accessory entry.

- ee5183a: Import JZ Microphones (16 hardware/accessory entries).

  Nine condenser and hybrid ribbon/condenser studio microphones (The
  Amethyst, BB29 Signature Series, Black Hole BH1s/BH2, MU-1 Hybrid,
  Vintage 11/12/47/67), plus seven accessories (shock mounts, pop
  filter, wooden storage cases).

- df42de7: Import Lowden (41 hardware entries).

  Irish acoustic guitar maker: the Original Series, 35 and 50 Series
  tonewood lines, Jazz Series (S/WL body shapes with LR Baggs
  electronics), the GL-10 and GL-J solid/semi-hollow electrics, and
  signature models built with Alex De Grassi, Paul Brady, Pierre
  Bensusan, Richard Thompson, and Thomas Leeb.

- cc047b3: Import LR Baggs (30 hardware entries).

  Acoustic pickup and amplification specialist: the AEG-1 acoustic-electric
  guitar, the Anthem/Element/HiFi/M1/M80/LB6 pickup and blend-mic systems,
  the Align Series pedalboard (Active DI, Chorus, Delay, EQ, Reverb,
  Session), and the Para/Session/Venue/Stadium/Voiceprint DI preamps.

- 3be85d5: Import Mr. Black (59 hardware entries).

  Boutique guitar-effects pedals from Mr. Black (Portland, Oregon):
  reverbs (BloodMoon, SuperMoon, Ambience), delays (Echo Repeater,
  TapeX-2, TrancePortal), modulation (Vintage Ensemble, Analog Chorus &
  Vibrato Deluxe, ThunderClaw, GilaMondo), and the "Black LTD." limited
  production run of 21 additional circuits.

- baadf0d: feat(catalog): import pedaltrain (63 hardware/accessory entries)

  Adds Pedaltrain's pedalboard lineup (Classic, Metro, Novo, XD, JR MAX,
  Terra 42), Deluxe MX soft cases, BTC-X tour cases, mounting hardware,
  and three guitar effect pedals (Daylight Overdrive, Nightlight
  Distortion, SUPERFUN! Awesome Overdrive).

- a8ea170: Import Sonicware (19 hardware/accessory entries).

  LIVEN series synths and grooveboxes (8bit warps, Ambient Ø,
  BASS&BEATS, Evoke, Lofi-12, MEGA SYNTHESIS, Texture Lab, XFM),
  ELZ_1 play, deconstruct MINIMAL, Lofi-12 XT (standard and retro
  color), and SmplTrek, plus carrying cases, the LIVEN/deconstruct
  PSU, deconstruct knob caps, and a TRS-to-MIDI adapter.

- da07c7b: Import Source Audio (29 hardware/accessory entries).

  Adds the full Source Audio pedal lineup (Ventris, Nemesis, C4 Synth,
  Collider, Encounter, Ultrawave/Ultrawave Bass, and the rest of the
  One Series and Soundblox 2 effects) plus the Neuro Hub, cables, and
  control accessories that make up their ecosystem.

- 4ad02a3: Import Walrus Audio (74 hardware/accessory entries).

  Effects pedals (compressors, fuzzes, overdrives, reverbs, delays,
  modulation) plus the Canvas line of pedalboard accessories (power
  supplies, DI/reamp boxes, cables). Includes the MAKO Series and MAKO
  Series MKII lineups as separate entries, and 27 cosmetic finish
  editions (Craftsman/Platinum/Onyx/Obsidian/Harvest/Black Friday
  Floral) folded into their base product's `variants` array rather
  than imported as standalone entries.

### Patch Changes

- 874d964: catalog-import-merge: getgood-drums, refresh product details on 53 entries

  Replaces one-line placeholder details with the current vendor prose for
  all 24 GetGood Drums software entries and 29 content entries. No products
  added, removed, or discontinued; names, descriptions, categories, formats,
  prices and URLs are unchanged.

- 08f1eb7: catalog-import-merge: gforce, refresh product details on 59 entries

  Adds current vendor prose to 59 GForce Software entries, adds specs to 40
  entries that had none, and follows the vendor's URL rename for The Streetly
  Tapes Vol 2, 3 and 4. Corrects three prices that had been captured at a sale
  value. No products added, removed, or discontinued.

- 8fb3f18: catalog-import-merge: gg-audio, refresh Blue3 and Spin

  Replaces scraped label fragments with real product prose on both entries,
  adds full specs and demo videos to Blue3, and corrects its price, which was
  recorded as zero against a listed 49 USD. No products added or removed.

- 16a39b0: catalog-import-merge: glitchmachines, refreshed 22 existing entries

  Refreshes details, specs and descriptions across 9 software and 13
  content entries, adds version history to 9 plugins, formats to 5, and
  `compatibleWith` host references to 3 sample packs. No new products and
  no discontinuations.

- 512be92: catalog-import-merge: goodhertz, refreshed 21 existing entries

  Refreshes details and specs across all 21 software entries, adds
  video references to 11, version history to 6, plugin formats to 2, and
  corrects the primary category on CanOpener Studio and LA-210. No new
  products and no discontinuations.

- 04891a4: catalog-import-merge: hitnmix, refreshed 6 existing entries

  Refreshes details and specs across all six RipX entries, adds pricing
  and plugin formats to RipX DAW PRO, video references to two, and a
  primary category to RipX. No new products and no discontinuations.

- a3b0bf7: catalog-import-merge: ignite-amps, refreshed 11 existing entries

  Adds details and specs to the 11 free Ignite Amps plugin entries, which
  previously carried a description and little else. No new products and no
  discontinuations: the site's roster matches the catalog exactly. The three
  hardware pedals are deliberately untouched, their only presence on the
  site being a photo portfolio with no specs.

- 55f06af: catalog-import-merge: illformed, refreshed 1 existing entry (Glitch 2 now free, VST3 added)
- 6f88adf: catalog-import-merge: inphonik, refreshed 4 existing entries (added user manual links)

## 3.56.0

### Minor Changes

- 17f7e31: catalog-import-merge: future-audio-workshop, 26 new packs and a 4-entry refresh

  Adds 26 Circle², SubLab, SubLab XL and Notes patch and sample packs as
  content entries with images, and refreshes the four existing software
  entries (Circle², Notes, SubLab, SubLab XL) with current formats,
  details, specs and videos. Corrects SubLab's price from a previously
  captured sale price to its regular price.

### Patch Changes

- 0bfdd75: catalog-import-merge: drumforge, refreshed 63 existing entries

  Refreshes descriptions, details, specs and videos across 15 software
  and 48 content entries, adds `compatibleWith` host references to 11
  groove and sample packs, and adds the `standalone` format to the
  David Bendeth sampler. Strips OS-requirement, supported-DAW and
  license boilerplate from specs. No new entries, no deletions, and
  every existing ID is preserved.

## 3.55.0

### Minor Changes

- b0483af: catalog-import-merge: d16-group adds 4 Lush 2 sound expansions and Plasticlicks, and enriches 19 existing plugin entries

  Added Aurora, Lure, Pulse, Ripple (Lush 2 preset packs) and Plasticlicks
  (drum sample collection) as new content entries. Enriched all 19 existing
  D16 plugin entries with details, specs and version history that were
  previously missing. Pulsatec's primaryCategory is now equalizer, the
  canonical category for the analog passive EQ its own product page
  describes. PunchBox's name stays flagged for human review (PunchBox vs
  PunchBox 2, reflecting the manufacturer's in-place product refresh).

- 85edfd9: catalog-import-merge: discodsp adds TDminator and refreshes versions/prices/descriptions across 9 existing entries
- 94551ae: catalog-import-merge: dotec-audio adds DeeMultiWider and refreshes DeeVocalTools version history

### Patch Changes

- a766b4e: catalog-import-merge: audiosourcere refreshes descriptions, details, specs, and video links for all 5 entries from current site content
- 7348f35: catalog-import-merge: ddmf, fill in missing descriptions for the free
  IIEQ and Transport plugins, and record Tube Preamp's current version.
- e958d6b: catalog-import-merge: dmg-audio refreshes all 16 existing plugin entries (prices, descriptions, specs, versions, formats)
- 40aec2a: catalog-import-merge: dmitry-sches-audio-software refreshes descriptions,
  details, specs, and version history for Diversion, Tantra, Thorn, and
  their free preset packs from the current manufacturer site.

## 3.54.0

### Minor Changes

- 1564d44: Add hardware_io.signal_flow_raw carrying the unflattened
  YAML signal flow, and stamp schema_version into catalog_meta
  for Studio's reader-compatibility gate. Additive only, the
  flattened signal_flow column is unchanged.
- e452187: catalog-import-merge: black-salt-audio — add BSA Mix Bus, refresh copy/pricing/URLs across the 16 existing entries

### Patch Changes

- b5f34b1: catalog-import-merge: audiomulch — fix dead product URL (site dropped /products, now points to the What is AudioMulch page)
- c29f00f: catalog-import-merge: chase-bliss — refresh 15 existing hardware/accessory
  entries (descriptions, details, specs, I/O, videos, manuals, and a
  Lost + Found URL update) from the current chasebliss.com product pages.
  No new or newly-discontinued entries in this pass.
- 9e6c92b: Reclassify 70 mislabeled `connection: pin` ports to their real connectors (binding-post, db25, hdmi, pin-header, 1/8-inch, xlr) and add a `suspect-pin` dataset-audit check that flags the remaining pin ports for review (AUREO-1043).
- 33d883c: Reclassify 495 remaining `connection: pin` ports to their real connectors (euroblock, db25, speakon, binding-post, spring-terminal, 1/8-inch, mini-xlr, idc, card-slot, db9, xlr, mmcx, apple-30-pin), fix speaker-level typing on the reclassified speaker paths, and keep genuine pin contacts (phono cartridges, 500-series card edges). Adds `mmcx`, `apple-30-pin`, `barrier-strip`, `rj11`, and `twist-lock` to the connector vocabulary, corrects Crown CDi/XLC/DSi barrier-strip outputs, DCi RJ-11 GPIO ports, vRack twist-lock mains inlets, and I-Tech HD Speakon/binding-post outputs, and splits aggregated multi-socket entries (Antelope/RME DB25 pairs, Fostex L/R speaker terminals, Mackie MMCX earpieces) into one entry per physical connector (AUREO-1043).
- cc61483: Repoint dead manual links on 7 Pioneer DJ effector entries. The
  `downloads.support.alphatheta.com/manuals/dj-effectors/` tree no longer
  exists, so every link under it 404s; AlphaTheta moved manual content into
  support articles. EFX-1000 keeps its "Specifications" title against a
  dedicated specifications article; the other six point at the instruction
  manual and are retitled, since the per-page anchor no longer exists.
- 084af2c: Remove storage media card slots (SD, microSD) from hardware io, 44 entries across 44 files. Card slots hold media, not cables, so the setup graph cannot use them, the same reasoning as Bluetooth and Wi-Fi. New validation error E120 blocks reintroducing them by name while leaving option and expansion card bays legal.

## 3.53.0

### Minor Changes

- d9bed2a: Add a `capabilities` field to hardware entries recording what a product does, covering 768 effects entries

  `capabilities` is a closed, single-dimension vocabulary
  (`schema/capabilities.yaml`) describing the audio processing operations a
  product performs. It exists because `categories` cannot answer whether two
  products overlap: 26% of hardware carries `discontinued`, 12% `analog`, 12%
  `rack-mount`, while the functional tags sit under 1% each, so the frequent
  values are lifecycle, form factor and technology rather than function.

  Validation is strict. E119 flags an unknown value, E205 flags a duplicate, and
  there are no aliases. A guard test fails the build if the vocabulary picks up a value from a
  non-functional category group. Built into SQLite as `hardware_capabilities`,
  and reported by `pnpm capability-coverage`.

  Also recategorises 21 dbx entries out of `multi-effect`: the 16 DriveRack
  loudspeaker-management processors move to a new `speaker-management` category,
  and five others move to what they actually are (`reverb`, `dynamics`, `flanger`,
  and `utility` for a remote-control panel that processes no audio).

## 3.52.1

### Patch Changes

- 938986b: Record Bad Mood's two colourways, Ink Edition and Xtreme Red

## 3.52.0

### Minor Changes

- c34f50a: catalog-import-merge: algorithmix — add Sound Laundry compact edition, refresh version numbers on 6 existing products
- 3b58592: catalog-import-merge: chase-bliss. Adds Bad Mood, refreshes 14 existing
  entries with current copy/specs/images/videos, marks exp discontinued

### Patch Changes

- 9d9dd88: Add the four rear panel io ports to the IK Multimedia iLoud MTM MKII, which had none and so could not be wired into a setup
- daa7781: catalog-import-merge: accentize — refresh 11 existing entries with current pricing, descriptions and specs
- c654b17: catalog-import-merge: aly-james-lab, refresh specs and versions for all 8 existing entries from the current manufacturer site

## 3.51.2

### Patch Changes

- 7419a46: Flag discontinued products in the web index

  The index derived `discontinued` from `verification.status`, which only 3
  of 11,042 entries carry, so web consumers saw 3 discontinued products
  where the dataset marks 1,770. That signal is retained and unioned with
  the two Studio already uses: the canonical `discontinued` category and
  entries another product supersedes.

- 27c6cdd: catalog-import-merge: aberrant-dsp — add current version numbers to 4 plugins (Digitalis, Lair, ShapeShifter, SketchCassette II)

## 3.51.1

### Patch Changes

- b6b7bc0: Clear the validation warning backlog (62 warnings across 51 files).

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

## 3.51.0

### Minor Changes

- 39b17bc: Import AC noises (4 hardware entries).

  Italian boutique effect pedals: CONTINUA (stereo dynamic sampler and
  multi-effect), RICORDA (stereo granular reverb with freeze and loop),
  URLA (CMOS fuzz into an MS-20 style dual resonant filter), and AMA V.2
  (oscillating spring reverb into a bit crusher). RICORDA and AMA V.2
  carry their Limited RETRO Series finish as a cosmetic variant rather
  than a separate entry. Merchandise listings were excluded.

- 3068b2a: Import Cranborne Audio (12 hardware, 2 accessory entries).

  500-series preamps, EQs, and compressors (Camden 500, Carnaby 500,
  Brick Lane 500) alongside their standalone rack evolutions (Camden
  EC1/EC2, Carnaby HE2, Brick Lane MC4), audio interfaces (500R8,
  500ADAT), and C.A.S.T. breakout/distribution gear (N22, N22H, N8).
  Includes a half-rack mounting kit and a cosmetic blanking-plate
  accessory.

### Patch Changes

- d9b9084: Fix Tape Fiasco 2 description: it was carried over from Tape Fiasco 1
  (three engines) — rewritten to match the actual v2 feature set of four
  time-based engines (Stretch, Varispeed, Stutter, BendIt), consistent
  with the entry's details text.

## 3.50.0

### Minor Changes

- 205a1cd: Import Conductive Labs (5 hardware entries).

  Adds The NDLR (MIDI interval sequencer/groovebox), MRCC (modular
  MIDI Router Control Center), the discontinued MRCC 880, and two
  MRCC expansions: XpandR 4x1 and Remote 7.

- fce031d: Import Cordoba (93 hardware entries).

  Classical/flamenco nylon-string guitars (Protege, Iberia, Luthier,
  Luthier Select, Master, Fusion, Stage, Mini lines) and ukuleles
  (15/20/24/25/35 series). Includes Cordoba x Abasi Concepts signature
  7-strings and 5 cosmetic colorway families folded into `variants`.

- a30954a: Import Crane Song (17 hardware/software entries).

  Hardware: Avocet IIA monitor controller, Egret summing mixer, Falcon
  and STC-8 tube compressors, Flamingo and Syren mic preamps, HEDD
  Quantum and Interstellar/Solaris Quantum converters, Ibis and Insigna
  equalizers, Spider preamp mixer, Titan² compressor, and Trakker
  compressor-limiter. Software: the Phoenix and Phoenix II tape-emulation
  plug-in suites and the Peacock vinyl-emulation plug-in.

- a0c3fe0: Import Cre8audio (17 hardware/accessory entries).

  Adds cre8audio's Eurorack/semi-modular lineup: Assembler
  mixer, Boom Chick drum machine, East Beast and West Pest
  synths, Programm sequencer, NiftyKEYZ and NiftyCASE, plus
  standalone modules (Capt'n Big-O, Chipz, Mr. Phil Ter,
  Cellz, Function Junction) and accessories (Nazca Noodles
  cables, Box 'o' Cables, NiftyCASE PSU, BigEARS, bag).

- 5c80ca0: Import Critter & Guitari (8 hardware/accessory entries).

  Adds the Organelle S2 synthesizer and 7 accessory/spare-part
  entries (replacement mic, microSD card, power adapter,
  replacement keypad, MIDI cables, USB WiFi adapter).

- 1b0b34c: Import Phase Fiasco (8 entries: 4 software, 4 hardware).

  Jonas Eriksson's Phase Fiasco brand: the Tape Fiasco 2, Tape
  Fiasco, Annulus, and Modular Fiasco plugins, plus the Meteor
  Shower, [i], 240 DL, and Skalman eurorack modules.

### Patch Changes

- 7908b02: Retire the inert monthly staleness-check workflow. The fields it
  reported on (verification.lastVerified, prices[].asOf) are populated
  in zero entries, so every run filed the same meaningless issue.
  Freshness detection now happens in the racks repo (AUREO-890).

## 3.49.0

### Minor Changes

- a2887f8: Import Intellijel (168 hardware/accessory entries).

  Eurorack modules, cases, power systems, and accessories:
  Metropolix, Cascadia, Atlantix, Rubicon², Planar², Shapeshifter,
  Rainmaker, plus the 1U tile line, 4U/7U performance cases,
  TPS power supplies, and the recovered legacy line (Metropolis,
  Rubicon, Dixie, µMod, µScale, µStep, Spock, Plog) with
  supersedes edges wired between generations.

## 3.48.1

### Patch Changes

- f795592: Backfill prices for 1,271 hardware entries that were missing them. Befaco
  modules (50) sourced from the official Befaco store; ~1,221 other entries
  across ~90 manufacturers researched from manufacturer webstores and major
  retailers (Sweetwater, Thomann, B&H, Andertons). Prices are bare
  `amount + currency`. Discontinued products and entries with no confidently
  findable price were left unpriced. Hardware price coverage rises from 36% to
  58%.

## 3.48.0

### Minor Changes

- 1896b74: Remove April Fools gag plugins and clean up joke-framed copy.

  Deleted two Joey Sturgis Tones novelty entries that are gags rather than
  usable tools: JST Black Box (a plugin that "doesn't actually do anything" by
  design) and JST Impossible Fader (a fader deliberately engineered to ignore
  input). Both were real downloads but function as jokes, not production gear.

  Kept the Deathcore Soundboard — a genuinely functional sample instrument (16
  triggerable vocal phrases) — but rewrote its description/details/specs to drop
  the "THIS PLUGIN STARTED AS AN APRIL FOOLS' JOKE" framing and gag "Known
  Issues", and corrected its platforms (VST3/AU/AAX plugin, no Linux build).

  The JHS Voice Tech fake was already removed in #595.

## 3.47.0

### Minor Changes

- cde6a99: Import Dirtywave (3 products): the M8 Tracker Model:02 and the discontinued
  original M8 Tracker (superseded by Model:02), plus the DW01 Synthdrums preset
  pack. Adds the Dirtywave manufacturer.

## 3.46.0

### Minor Changes

- b0d3b14: Import Dangerous Music (23 hardware entries).

  Analog summing mixers (2-BUS family), monitor controllers
  (MONITOR/MONITOR-ST/MONITOR-SR/SOURCE), converters (CONVERT
  series), the BAX EQ/BAX500 shelving equalizers, COMPRESSOR,
  LIAISON patchbay, MASTER transfer console, and the S&M
  (Sum-Minus) mid-side matrix.

- 07e430e: Clean scraped junk out of product names and remove standalone bundle entries.

  Renamed ~310 entries: stripped page-title marketing taglines ("nanobox |
  tangerine – Compact Streaming Sampler" → "Nanobox Tangerine"), trademark
  symbols (™/®/©), HTML entities, and manufacturer-name prefixes ("dbx 286s"
  → "286s") — the manufacturer is stored and indexed separately, so the
  prefix duplicated data. Reattributed seven Sonuscore storefront listings
  to their actual developers (Wavelet Audio, Soundiron) and added
  searchTerms where names became bare acronyms (DDP, DJDI, DRMR, EX) or
  lost a commonly searched compound form (EHX by JHS Big Muff 2, BAE 8CR).

  Removed 86 standalone bundle/suite entries (HoRNet, Antelope Audio,
  Arturia V Collection, Soundtoys 5, Softube collections, Lexicon PCM
  bundles, and more) whose member products exist individually — a bundle is
  a commercial SKU, not a discrete product. Integrated products that only
  carry "Suite"/"Bundle" in the name (Waldorf Edition 2, PSP MixPack2,
  Ampeg-style single packages) were kept.

- 07e430e: Add name-hygiene validation and bundle-entry auditing.

  `pnpm validate` now hard-fails on mechanical name junk (E118: trademark
  symbols, HTML entities, stray leading/trailing separators, doubled
  spaces) and warns when a name starts with the manufacturer's display
  name (W129) or contains a tagline-style en/em-dash or pipe separator
  (W130, with a reviewed exclusion list for official stylings).
  `pnpm dataset:audit` gains two Tier-2 review checks: name-tagline
  (plain-hyphen suffixes that may be scraped taglines) and bundle-entry
  (suite/bundle categories or bundle-ish software names, with an
  allowlist for integrated products). Conventions documented in CLAUDE.md
  and docs/VALIDATION_ERRORS.md.

- 07e430e: Remove Bluetooth and Wi-Fi from hardware io sections.

  Wireless capabilities are not physical ports, so they don't belong in
  the io graph. Removed the Bluetooth io entry from 31 hardware files and
  the Wi-Fi entry from the KEF XiO, and dropped `bluetooth` and `wifi`
  from the io type vocabulary so future imports fail validation instead
  of reintroducing them. Wireless capabilities remain documented in
  description/details/specs. Also corrected the Midas MR18's Ethernet and
  ULTRANET ports, which were mislabeled as `dante`.

## 3.45.0

### Minor Changes

- e430a3b: Add telemetry-reported software versions (112 versions, 110 entries).

  Backfills versions that Studio's catalog sync reported as installed
  but missing (`catalog_version_not_found`, March–July exports).
  Dominated by the Waves 16.x line (94 entries), plus Antares (10),
  FabFilter (5), Kontakt, Bitwig Studio, UA Ravel, sonible truelevel,
  and IK Multimedia. Adds the reusable
  `scripts/add-telemetry-versions.ts` used to apply them.

### Patch Changes

- 765c43a: Fold the JHS Colour Box 10 into the Colour Box V2 as a cosmetic variant.

  The "Colour Box 10" is the 10th Anniversary Edition of the Colour Box V2 —
  identical circuit, controls, and I/O in a limited navy-blue finish — so it
  fails the separate-entry test and becomes a `variants` entry on the V2
  (resolving the open consolidation note from the jhs-pedals import, #571).
  Adds `searchTerms` ("Colour Box 10", "Color Box") so the anniversary name
  still ranks in search, and carries over the one demo video unique to the
  removed entry.

## 3.44.0

### Minor Changes

- c2d3c81: Import 1010 Music (30 hardware/accessory entries).

  Covers the current desktop and Eurorack lineup (Bento, Blackbox 2,
  Bluebox, Tangerine, the Nanobox line, Bitbox mk2/Micro and their Black
  Edition variants), the archived first-generation modules (Blackbox,
  Bitbox, Fxbox, Synthbox, Toolbox, Waverazor, MX4, Euroshield), and
  cables/faceplates/spare parts accessories.

- 199e5b2: Import 1V/Oct (3 hardware entries).

  Eurorack modular synthesizer manufacturer. Includes The Centre
  (polyphonic modular-in-modular synth voice), Twins (quad FX
  processor), and Taipo (MIDI extender module).

## 3.43.0

### Minor Changes

- 50b1428: Import Origin Effects (29 hardware/accessory/content entries).

  UK boutique guitar/bass pedal manufacturer. Adds the full Cali76
  compressor line, BASSRIG and DELUXE/RevivalDRIVE amp-recreation
  pedals, Halcyon and DCX overdrive/boost pedals, the M-EQ Driver and
  MAGMA57, plus the IR Cab Library and replacement knob/accessory
  parts.

## 3.42.0

### Minor Changes

- 984910b: Import Alvarez (4 hardware entries).

  Adds baritone acoustic guitars and acoustic bass from the Alvarez
  Artist Series: ABT60 (current and 2017 archived models), ABT60ce
  8-String (with Shadowburst variant), and AB60ce acoustic bass.
  All entries feature solid Sitka Spruce tops and FST2 bracing.

- 51a2155: Import Amphion Amp400.8 (1 hardware entry).

  The Amp400.8 is an 8-channel rack-mount power amplifier with Class-D
  amplification and a proprietary buffer stage, designed as a sonic match
  for Amphion and other passive studio monitors.

- b41ea97: Import Bastl Instruments (19 products).

  Seven discontinued Eurorack hardware modules: grandPA granular sampler,
  SPA expander, Noise Square noise/square generator, LOL mute utility,
  Little Nerd clock/trigger processor, Multiple passive splitter, and
  the original Skis envelope+VCA (predecessor to Skis II).

  Eight accessories: Juice Bus busboard, Rumburack Case, Marton Case,
  Long Skiff, Marton Skiff, and three full Eurorack systems (Rumburack
  2.0, BOB, BOBEK).

  Four VCV Rack software plugins (free): VCV Basil delay, VCV Crust
  drum voice, VCV Pizza synthesizer, VCV Kompas sequencer.

- fd9126c: Import Benson Amps (26 hardware entries).

  Handmade boutique amp builder from Portland, OR. Adds their full
  lineup: 12 guitar amplifiers (Monarch Reverb Plus and Bellringer
  in head and 1x12 combo configurations, Redland Reverb in 15W/35W
  head and combo configurations, Vincent, Nathan Junior, Vinny
  Reverb, Babylon), 1 bass head (B700), the Tall Bird Plus
  reverb/tremolo unit, 4 speaker cabinets, and 8 guitar pedals
  (424 MKII, Germanium Boost, Preamp Pedal, Germanium Preamp,
  Delay, Störkn B0kš, Deep Sea Diver Fuzz-Echo, Florist).

  Note: product images were not auto-selected because the source site
  uses Squarespace JavaScript rendering; source-page image references
  are available for manual upload.

- 0fc0955: Import Bricasti Design (25 entries: 24 hardware, 1 accessory).

  Covers the full current product lineup: M7/M7M reverbs, M3/M1/M1S2/M11/M11S2/M21
  DACs, MC1 Reference DAC, M12 Source Controller, M5 Network Player, M19 CD transport,
  M10 Remote Console, M15/M15 Pro/M25 stereo amps, M20 preamp, M28/M30/M32 monoblocks,
  Platinum series (M21/M1S2/M12 Platinum, M32 Platinum), and the MDx network
  processor board accessory.

- 595d83a: Import Burl Audio (25 hardware entries).

  Includes the B80 and B16 Mothership modular chassis systems with their
  full range of daughter cards (BAD8, BAD16, BAD4M, BDA4, BDA4M, BDA8,
  BDA12, BDA16, BAES4, BCLK, B4 Mic Pre, B22 ORCA) and swappable
  motherboards (BMB1 DigiLink, BMB2 MADI, BMB3 Dante, BMB4 SoundGrid,
  BMB6 AES/EBU). Also includes the standalone B2 Bomber ADC/DAC,
  B26 ORCA monitor controller, B32 Vancouver summing mixer, B1 Mic Pres,
  and the announced BC5000 Bigfoot compressor.

- c8eb450: Import Caroline Guitar Company (15 hardware entries).

  Fifteen pedals covering current and legacy lineup: Kilobyte-2000 tap
  delay flagship, Wave Cannon Zero distortion, Arigato phaser, Somersault
  chorus/vibrato, Météore reverb, Parabola tremolo, Shigeharu IC Fuzz +
  Octave, CROM fuzz/distortion, Hawaiian Pizza fuzz, The Blues overdrive,
  Aaron Graves Overdrive, Wave Cannon MKII, plus three legacy products
  (Kilobyte, Megabyte, Icarus V2).

- 2e6a2f9: Import Catalinbread (64 hardware entries).

  Full product lineup of the Portland, Oregon guitar effects pedal maker.
  Covers overdrives (Dirty Little Secret series, RAH, Sabbra Cadabra, WIIO,
  Formula amp-sims), delays (Belle Epoch series, Echorec), reverbs (Talisman,
  Soft Focus series, Sinkhole), fuzzes (Fuzzrite series, Katzenkonig, Giygas),
  and modulation (Callisto, Wake, Zero Point Flanger). Also includes Proto Club
  limited releases and Legacy Series reissues.

- 7f1a215: Import Chandler Limited (31 hardware entries).

  Covers the full current product line including EMI Abbey Road
  Series gear (TG12345 Curve Bender, REDD.47 Mic Amp, REDD
  Microphone, TG1 Limiter, Zener Limiter, RS124/RS660),
  500-series modules (TG12345 MKIV EQ, TG2-500 Pre Amp, Little
  Devil family, TG Opto Compressor, Germ 500 MKII Pre Amp),
  rack-mount preamps/compressors/EQs (TG2 Pre Amp/DI, Germanium
  Pre Amp/DI, TG12411 Channel), microphones (TG Microphone, TG
  Microphone Type L, REDD Microphone), guitar amp and pedals (GAV
  19T, Germanium Drive, Little Devil Colored Boost), and the
  pre-announced REDD Mixing System console. Also includes four
  discontinued models (LTD-1, LTD-2, Germanium Tone Control,
  Germanium Compressor).

- f74ae04: Import Coles Electroacoustics (30 hardware/accessory entries).

  Adds an imported subset of Coles Electroacoustics products, a British
  manufacturer with BBC broadcast heritage. Includes 6 ribbon microphones
  and 1 microphone with unknown transducer type (4030L, 4038, 4050, 4104,
  4115, 4155, FIST), 4 speaker drive units (CE2000, CE 3000, CE-4001,
  CE 5000), and 19 microphone accessories (cases, shock mounts, stand
  adaptors, connectors, and broadcast accessories).

- 58335bd: Import Collings Guitars (103 hardware entries).

  Products span the full Collings lineup: acoustic guitars (0, 00, 000, OM,
  dreadnought, slope-shoulder dreadnought, jumbo, parlor, classical, and
  Hill Country series), electric guitars (CL, 290, 360, 470, 620, 71, I-35,
  SoCo, Eastside, Ladybird, and archtop AT series), and mandolins (MT,
  MT2, MF, and MF5 families in F-style and A-style configurations).

- 461e088: Import Fairfield Circuitry (19 hardware/accessory entries).

  Covers the full current lineup of effects, utility, and accessory
  products from the Hull, Quebec maker: overdrive (Barbershop,
  Modèle B), fuzz (900, Unpleasant Surprise), modulation (Shallow
  Water), delay (Meet Maude), ring modulator (Randy's Revenge),
  filter/EQ (Long Life), distortion (20% More), reverb (Placeholder),
  compressor (Accountant), FM degradation (Roger That), feedback loop
  (Hors d'Oeuvre?), CV sag (Board Member), envelope follower (Conflict
  of Interest), plus four utility/accessory products (Either/Or, Less
  & Less, PB & J, Split!).

- 3562225: Import JHS Pedals (149 hardware entries).

  Complete production and vintage lineup from Kansas City-based effects
  manufacturer: 3 Series budget line, Colour Box preamps, Morning Glory
  overdrive, Emperor chorus/vibrato, Panther delay, Kodiak tremolo,
  Muffuletta fuzz, Bonsai OD, and 40+ discontinued boutique designs.
  Includes 500-series variants and utility pedals.

## 3.41.0

### Minor Changes

- 7e34ce7: Import Benson Amps (26 hardware entries).

  Handmade boutique amp builder from Portland, OR. Adds their full
  lineup: 12 guitar amplifiers (Monarch Reverb Plus and Bellringer
  in head and 1x12 combo configurations, Redland Reverb in 15W/35W
  head and combo configurations, Vincent, Nathan Junior, Vinny
  Reverb, Babylon), 1 bass head (B700), the Tall Bird Plus
  reverb/tremolo unit, 4 speaker cabinets, and 8 guitar pedals
  (424 MKII, Germanium Boost, Preamp Pedal, Germanium Preamp,
  Delay, Störkn B0kš, Deep Sea Diver Fuzz-Echo, Florist).

  Note: product images were not auto-selected because the source site
  uses Squarespace JavaScript rendering; source-page image references
  are available for manual upload.

- 69e4644: Import Brauner Microphones (14 hardware entries).

  Tube and FET condenser microphones from this Berlin-based German
  manufacturer, including the flagship VM1 tube series, the phantom-
  powered Phantom and Phanthera families, the Valvet and Valvet X
  cardioid tube mics, and the pure cardioid variants of the VM1
  and VMX.

## 3.40.0

### Minor Changes

- 229b1c9: Import Benchmark Media Systems (20 hardware, 24 accessory entries).

  Covers the full active and historical lineup: AHB2 power amplifier,
  HPA4 headphone amp, LA4 line amplifier, DAC1/DAC2/DAC3 families
  (including discontinued HDR, PRE, USB, DX, D, L, HGC, B variants),
  ADC1/ADC1 USB/ADC16 analog-to-digital converters, PRE420 microphone
  preamplifier, SMS1 studio monitor, and 24 accessories including
  cables, connectors, rack hardware, and remote control.

- 9b943ef: Import Bettermaker (18 hardware/software entries).

  Adds 15 hardware entries covering the full Bettermaker rack
  hardware lineup: mastering limiters (original and 2.0),
  mastering equalizers (including the 50-unit Millennium Edition),
  mastering compressor, bus compressor, PEQ_Core parametric EQ,
  SPE/VSPE stereo processors, 500-series modules (EQ502P, EQ542,
  C502V), 232P MK II mastering EQ, and Auratone A2-30 amplifier.
  Adds 3 software entries: BM60 reverb plugin, Bus Compressor DSP,
  and EQ232D parametric equalizer plugin.

- 97b8190: Import Black Lion Audio (66 hardware/accessory entries).

  Covers the full product line: Auteur preamp series (mkIII, 8DAT, DT,
  Quad, Quad2); B-series compressors (B12A, B172A, B173); Revolution
  audio interfaces and clocks; PBR patchbay line (TRS, TT, XLR, XSplit8);
  Micro Clock series; Bluey and Seventeen compressors; MIDI Eight; and
  25 PG-series power conditioners/accessories (PG-1, PG-2, PG-P,
  PG-X, PG-XLM) with regional variants.

## 3.39.2

### Patch Changes

- 3a1abe6: Replace 7 YouTube playlist IDs stored as videoIds with real video IDs.

  All Aly James Lab software entries (Elastic Bender, FMDrive, OB-Xtreme,
  Super PSG, SY-4X Syncussion, VProm, VSDSX) stored 34-char `PL…` playlist
  IDs in `videoId`, which no embed player accepts and whose thumbnails 404.
  Each is replaced with the first video of that playlist plus its real
  title, resolved from YouTube and verified via oEmbed.

## 3.39.1

### Patch Changes

- ef826bc: Canonicalize IO connection values and expand the connection vocabulary. Adds `ethercon`, `hdmi`, `db9`, `idc`, `pin-header`, `card-slot`, and `iec-c6` to `schema/io-connections.yaml`, and normalizes ~300 near-miss connection values across 100+ hardware files (`trs`/`ts`/`trs-male`/`trs-female` → `1/4-inch`, `xlr-male`/`xlr-female` → `xlr`, `phoenix` → `euroblock`, `rj45` → `ethernet`, `etherCON` → `ethercon`, `d-sub-9` → `db9`, Eurorack bus power `proprietary` → `idc`, plus casing/singleton fixes), resolving the W121 warning backlog. Also splits the ME-1/ME-500 collapsed Network entries into their physical Link In / Link Out EtherCON ports and corrects the KEF Reference 8b passive inputs to `type: speaker-level`.
- ef826bc: Fix W128 collapsed-jack IO entries across 11 hardware files: split multi-jack entries into one entry per physical jack (A&H GR4 stereo RCA inputs, Antelope Satori DB25 in/thru, Blackstar cab inputs and TV-10 speaker outputs, RME UFX III AES/EBU in/out, dbx 166XL/XS per-channel sidechain inserts) and correct Midas DL155 AES3 XLR entries to maxConnections 1 (each XLR carries 2 channels on one jack). Blackstar passive-cab/speaker entries also corrected from `line` to `speaker-level`, and the Satori entry from `1/4-inch` to `db25`.
- 3e1dffa: Replace aggregator canonical `url`s (KVR, ModularGrid, Plugin Boutique,
  Best Service, ...) with the makers' own official pages across product and
  manufacturer entries, verified live. Entries whose maker is confirmed gone
  keep their aggregator link as the only remaining page. Adds
  `scripts/promote-canonical-urls.ts` (link promotion + researched-mapping
  apply, with live URL verification) and an `aggregator-url` check to
  `pnpm dataset:audit` so new imports can't silently reintroduce these.
- b8055bc: Import 11 Chase Bliss products and complete the discontinued lineage.

  - New entries: Gravitas, Condor, Ayahuasca, Generation Loss, Bliss Factory,
    Tonal Recall, Tonal Recall RKM, Brothers, Warped Vinyl (MKI), Faves, and
    Big Time (current, ships August 2026) — sourced from official manuals and
    archived chasebliss.com/chaseblissaudio.com product pages.
  - Tag 8 existing Chase Bliss entries `discontinued` per the manufacturer's
    discontinued section (Habit, Preamp MKII, Thermae, Condor HiFi, Dark World,
    Warped Vinyl HiFi, Spectre, Wombtone MKII).
  - Wire `supersedes`: Condor HiFi → Condor, Generation Loss MKII → Generation
    Loss, Warped Vinyl MkII → Warped Vinyl. Tonal Recall RKM deliberately left
    unwired (sold concurrently with the original).
  - Add Brothers AM Monochrome Edition as a cosmetic variant.

- bb32901: Data cleanup: remove links[] entries that duplicate the main `url` (or an earlier link) across 68 files, drop the nakst-apricot link that duplicated the manufacturer homepage, and remove specs lines that restate the structured formats/platforms fields in 19 files. Clears all W124/W126 validation warnings.
- 957d455: Resolve the W127 acronym backlog: add researched searchTerms (verified expansions like Pentatone Equalizer, Rupert Neve Direct Interface, Constant Loudness Monitor System, plus documented spacing/model variants) to 41 acronym-named entries, add 24 stylized non-acronym names (BASIL, CIAO, CRBN, MJUC, TAIP, ZHEGA, …) to the W127 false-positive exclusion list, and add a researched-no-expansion suppression list for 16 letter-name products (Oberheim DMX/DSX/DX, Ensoniq VFX, Waldorf STVC, …) whose names have no documented expansion to index.
- b8055bc: Mark 712 out-of-production products with the `discontinued` category and add
  a `defunct` manufacturer flag.

  - New optional manufacturer field `defunct: true` (company gone, nothing
    still produced under the brand); set on 13 manufacturers (E-mu, Ensoniq,
    ARP, Siel, Quasimidi, Elka, Technosaurus, Gleeman, Chamberlin, EML, PPG,
    Steiner-Parker, Future Retro). Products of defunct manufacturers are
    tier-1 auto-tag candidates. The flag ships in the SQLite build as a new
    `manufacturers.defunct` column (INTEGER, default 0) so downstream apps
    can render manufacturer status.
  - `discontinued:report` gains three signals: defunct-manufacturer (tier 1),
    vintagesynth.com-linked (review tier — VSE also covers current gear), and
    released-20+-years-ago (review tier — age is never auto-safe: SM58, DS-1,
    A-100 are evergreen).
  - `discontinued:apply` gains `--signal defunct` and `--files <list.txt>` for
    applying human-reviewed lists.
  - Tagged: 112 defunct-manufacturer products plus 600 reviewed
    vintagesynth-linked entries (55 VSE-linked products verified still in
    production or uncertain were deliberately left untagged).

## 3.39.0

### Minor Changes

- 5c6b735: Standardize `io[].type` across the catalog and enforce the vocabulary. Widen
  `schema/io-types.yaml` with 10 real port types that were missing (`rf`, `hdmi`,
  `gpio`, `insert`, `clock`, `bluetooth`, `wifi`, `video`, `ground`,
  `proprietary`), canonicalize 371 ports across 78 hardware entries, and promote
  unknown types from an advisory warning to a hard validation error (E117).
- 6ce285f: Add `io`, `formats`, and `releaseDate` to `catalog-index.json`. Ports are
  grouped (`{type, connection, flow, count}`) rather than emitted verbatim, and
  I/O type spelling variants (`spdif`, `wordclock`, `aes3`) are folded into their
  canonical forms so the data is queryable.

### Patch Changes

- 13a9cbe: IO vocabulary follow-ups from the #539 review: correct Bastl Klik clock output to `type: clock`, correct Mackie DLM12 channel inputs to `mic`/`instrument`, add `usb-b-mini` to the connection vocabulary (Bastl Klik, Artiphon INSTRUMENT 1), canonicalize Xone:43 connections (`trs` → `1/4-inch`, `minijack` → `1/8-inch`), and update CLAUDE.md/CONTEXT.md/VALIDATION_ERRORS.md to reflect enforced IO types (E117) and the expand-the-vocabulary policy.

## 3.38.0

### Minor Changes

- ef2316e: Add the `/io-enrich` enrichment command and correct the Apollo Twin X I/O.

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

## 3.37.0

### Minor Changes

- 860c7be: Add IO data-quality triage: `pnpm io-quality` report and warning W128.

  Follow-up to the IO positioning work (#212). Adds tooling to find and prevent
  bad hardware I/O data at scale:

  - New `pnpm io-quality` report scores every hardware entry and prints a
    prioritized worklist: correctness smells (combine candidates, collapsed
    stereo/numbered-pair names, uniform-position imports), connectivity-category
    devices missing I/O entirely, and entries lacking column/row layout (densest
    first). Supports `--json` and `--limit`.
  - New advisory validation warning **W128** flags `maxConnections > 1` on
    single-jack connections (e.g. two jacks collapsed into one entry), excluding
    intentional aggregates. Non-blocking.
  - Shared heuristic in `scripts/lib/io-heuristics.ts` keeps the report and the
    validator in lockstep.

### Patch Changes

- 744529d: Resolve dataset audit (#365) and discontinued backlog (#362) findings.

  **Duplicate-name groups (#365):**

  - Merged true duplicates onto canonical manufacturer-slug filenames, keeping the
    richer entry and pulling in `formats`/`categories` from the thin twin: 10 uJAM
    Beatmaker instruments (`ujam-beatmaker-*` → `ujam-instruments-beatmaker-*`),
    WA Production Babylon 2 and BassShaper (`w-a-production-*` → `wa-production-*`),
    Airwindows Average (two blog-post imports of one plugin), and the DW
    Satin-Black-over-Brass snare and 4-Piece Performance Series kit (duplicate SKU
    codes).
  - Folded the three Taylor T5z Pro colorways (Cayenne Red, Harbor Blue, Tobacco
    Sunburst) into one entry with a cosmetic `variants` array.
  - Renamed `fostex-t50rpmk4g-2` → `fostex-t50rpmk4g-plus` to match its product
    name (T50RPmk4g+); it is a distinct SKU, not a duplicate.
  - Fixed the audit's `normalizeName` to treat a trailing `+` as a significant
    `plus` token so distinct SKUs (ProFX10v3 vs ProFX10v3+, Prime 4 vs Prime 4+,
    etc.) no longer false-collide. This clears ~12 false-positive groups whose
    members were already correctly modeled as separate entries.

  **Discontinued backlog (#362):**

  - Auto-tagged 14 Tier-1 (superseded, missing `discontinued`) entries.
  - Reviewed and tagged 34 Tier-2 entries with explicit discontinuation language
    (13 Audeze legacy headphones, 14 dbx Professional Audio units, Krotos and
    Synchro Arts software, and others). Excluded `dubreq-ltd-stylophone-s2` — its
    "discontinued in 1975" refers to the original Stylophone; the S2 is current.

## 3.36.0

### Minor Changes

- 9721b39: Add IO port positioning (`columnPosition` / `rowPosition`) enrichment.

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

## 3.35.0

### Minor Changes

- b467a1f: Import A-Designs Audio (18 hardware entries).

  Covers the full current and discontinued lineup: REDDI, REDDI V2,
  Pacifica, MP-2A, P1 Preamp (500-Series), NAIL compressor, ATTY
  attenuator, EM-EQ2, Hammer 2, HM2EQ, Ventura, Ventura SE, KGB-II,
  Mix Factory, EM-PEQ, EM-Silver, EM-Gold, and 503HR rack chassis.

- 4e13ed5: Import AEA Ribbon Mics (17 hardware entries).

  Adds the full current product line from AEA Ribbon Mics
  (Pasadena, CA): passive ribbon mics (R44C, R84, R88mk2, R92,
  NUVO N8, N13, NUVO N22, N28), active ribbon mics (KU4, KU5A),
  tube/solid-state preamps (TRP3, TRP500, RPQ3, RPQ500, RPQ503),
  stereo DI (TDI Duo), and compressor (1029).

- fe214f7: Import Aguilar Amplification (31 hardware/software entries).

  Covers the full current product lineup: AG Series and Tone Hammer Series
  amp heads, Tone Hammer 210 Combo, DB and SL speaker cabinet lines,
  the complete pedal lineup (chorusaurus, filter twin, octamizer, fuzzistor,
  AG preamp, TLC compressor, agro, grape phaser, tone hammer preamp, storm
  king, DB 316, octamizer DLX, TLC compressor EQ DLX), and the Aguilar
  Plugin Suite (VST3/AU/AAX).

- ebf2303: Import Amphion (33 entries).

  Amphion is a Finnish manufacturer of passive loudspeakers and power
  amplifiers. This import covers the full product line: passive studio
  monitors (One12, One15, One18, One18X, Two15, Two18, Two18X), the
  active One25A, home/hi-fi speakers (Argon and Helium series),
  subwoofers (BaseTwo25, FlexBase25), power amplifiers (Amp400, Amp700),
  and accessories (cables, color grids, mounting hardware, spare parts).

- 2da4b50: Import API Audio (61 hardware/software entries).

  API: Automated Processes, Inc. — professional recording hardware spanning
  500-series modules (512V, 550A, 525, 527, 560, 562, 565 etc.), 200-series
  console modules, standalone rack gear (SR22, SR24, T12, T25, TCS-II),
  large-format analog consoles (Vision, AXS, 2448, 1608), the ASM164
  summing mixer, the MC531 monitor controller, and TranZformer guitar/bass
  pedals. Includes both active and discontinued products.

- eadf3bc: Import Artiphon (4 hardware/software entries).

  Artiphon made expressive smart instruments including the Instrument 1
  (a multi-mode guitar/violin/piano/drum controller), Orba 3 (a palm-sized
  synth, looper, and MIDI controller), and Chorda (a smart stringed
  instrument). Also includes Artiphon Connect, their macOS/Windows companion
  app. All entries marked discontinued following the company's shutdown.

- c330128: Import Austrian Audio (72 products).

  Austrian Audio is a Vienna-based manufacturer founded by former AKG
  engineers. Product families include the OC-series large-diaphragm
  condensers (OC818, OC18, OC16, OC7), the CC8/CC8 SC small-diaphragm
  condensers, the OD-series dynamic handhelds (OD303, OD505, OC707),
  the Hi-X headphone line (Hi-X15 through Hi-X65, plus the Composer
  and Arranger open-back flagships), the Full Score One headphone amp,
  the MiCreator Studio USB mic system, and the free PolarDesigner plugin.
  Accessories cover cables (HXC, MCC, TCC families), windscreens, shock
  mounts, ear cushions, mic clips, and pouches.

- 0080bfc: Import Avalon Design (4 hardware / 1 accessory entries).

  Avalon Design is a California-based manufacturer of high-end Pure Class A
  analog studio equipment. This import covers the VT-737SP tube channel strip,
  U5 instrument DI preamp, V5 single-channel mic preamp/DI/re-amp,
  V55 dual-channel mic preamp/DI/re-amp, and B2-T external AC power supply.

- aa048ad: Import Avantone Pro (32 hardware entries).

  Avantone Pro makes professional studio monitors, microphones,
  and headphones. Major product families include the CLA series
  (active/passive monitors and reference amplifiers), the CV-12
  and BV-1 ribbon/tube condenser microphones, the CK and CDMK
  drum mic kits, and the Mixcube reference monitors. Also
  includes the Planar the II open-back headphones, MixPhones
  MP-1, and accessories (PS-1 pop filter, SSM shockmount, PK1
  drum rim mount).

- 3119004: Import BAE Audio (35 hardware / 1 accessory entries).

  BAE Audio is a California-based manufacturer of hand-wired, Neve-style
  analog recording equipment. This import covers the 1073-family preamps and
  preamp/EQs (1073, 1073MP, 1073MPF, 1073MPL, 1073D, 1073DMP, 1073-Dual-DMP),
  the 1023/1084/1032 modules, mic pre/EQ modules (1066D, 1066DL, 1028), the
  1272 and 312A preamps, the 500-series line (500C, 10DCF, 8CM, 73EQL,
  1073-module), rack chassis and 500-series racks, DI boxes (DLB, 3LB, PDI,
  PDIS), the RoyalTone and Hot Fuzz pedals, power supplies, and related
  accessories.

- 41c17b1: Import Bastl Instruments (68 entries: 67 hardware, 1 software).

  Bastl Instruments is a Czech modular synthesizer and experimental
  instrument maker. This import covers their full Eurorack module line
  — including the Thyme delay, Ikarie filter, Cinnamon oscillator,
  Waver wavefolder, and Citadel series — plus the Kastle mini-synth
  family, Microgranny granular sampler, and Outsidify iOS app.
  Discontinued modules are included with the `discontinued` category.

- 6353cd2: Import Befaco (58 hardware / 15 accessory entries).

  Befaco is a Barcelona-based manufacturer of Eurorack modular synthesizer
  modules, DIY kits, and accessories. This import covers the current module
  lineup — oscillators (Pony VCO, Even VCO, Octaves VCO), filters (Pony VCF),
  function generators (Rampage 2, Slew), mixers (Hexmix, Mixer V2, STMix),
  sequencing and utility modules (Muxlicer 2, Morphader 2, Percall, Sampling
  Modulator), effects (Crush Delay V3, Spring Reverb, Noise Plethora, Oneiroi),
  MIDI interfaces (MIDI Thing V2, VCMC 2), 1U tiles, power solutions, cases,
  and the accessory range (patch cables, Knurlies, Bananuts, bus boards, and
  cleaning/maintenance items).

- 3d91b07: Import ALM Busy Circuits (84 products).

  UK Eurorack modular synthesizer manufacturer known for Pamela's
  PRO Workout, Squid Salmple, and MFX modules. Includes 55 hardware
  modules, 9 iOS/desktop software plugins (MFX series, Pam Sync,
  MUM M8 DSP), and 20 accessories (cases, bus boards, cables).

### Patch Changes

- c9acacc: Apply CodeRabbit data-quality fixes to Aguilar entries (follow-up to the already-merged aguilar import).

  - AG 700: speaker output connector `1/4-inch` → `speakon`; aux input `1/4-inch` → `1/8-inch` (per official manual).
  - Tone Hammer 500: speaker output `1/4-inch`/`line` → `speakon`/`speaker-level`.
  - SL 110/112/210/212/410x: add the missing second 1/4-inch input and Neutrik speakON input (each cabinet has 1× speakON + 2× 1/4-inch).
  - SL 115: add the missing speakON input.
  - TLC Compressor EQ DLX: add `supersedes` link to TLC Bass Compressor (product lineage).
  - Aguilar Plugin Suite: add `standalone` to `formats` (the suite runs standalone).

- fe214f7: Enforce recurring import rules in CI and refresh the schema doc.

  Regenerate `schema/CONTEXT.md` (previously stale, blocked by orphan
  category mappings) so `speaker-level`, `speakon`, `binding-post`,
  `euroblock`, `spring-terminal` and other IO enums are visible to the
  importer; add a CI freshness gate + pre-commit hook so it can't drift.

  Harden `pnpm validate`: hardware `io` entries now require
  `maxConnections` and (except on played instruments) `position`, and
  every product entry requires `primaryCategory`. Backfill the handful of
  existing stragglers. Add the passive-speaker `speaker-level` rule and a
  URL-whitespace rule to the schema docs and CodeRabbit path instructions.

- 1a0f022: Fix category and compatibility warnings on existing entries.

  Remove the redundant `fx` alias (normalizes to `effect`, causing a duplicate)
  from eight entries — six Dotec-Audio plugins, Newfangled Audio Obliterate, and
  the HOFA Special FX IR pack — and correct GetGood Drums Modern & Massive's
  `compatibleWith` to the real `native-instruments-kontakt` slug (was the
  non-existent `kontakt-player` / `kontakt`).

- 5f4b027: Split aggregated hardware `io` entries into individual ports.

  Where a single `io` entry collapsed multiple physical jacks into an
  inflated `maxConnections` (e.g. `xlr, maxConnections: 8`), split it into
  one entry per physical connector, each `maxConnections: 1`, preserving
  signal type, connection, and position. Covers 109 files (308 entries →
  individual ports). Heterogeneous, single-stereo-jack, and ambiguous
  cases were left unchanged for manual review.

## 3.34.2

### Patch Changes

- a3c88dc: Merge 44 duplicate manufacturer stubs into their canonical entries.

  Each pair was the same company split across two slugs (spelling, spacing,
  accent, or typo variants — e.g. `ohmforce`/`ohm-force`,
  `hexinverter-lectronique`/`hexinverter-electronique`,
  `moog-music-inc`/`moog`). The duplicate's display name (and any of its own
  search terms) is preserved on the surviving entry via `searchTerms`, 19
  products were repointed to the canonical slug, and several manufacturer URLs
  were corrected to their real homepages. Known distinct-company name
  collisions (e.g. Jackson guitars vs Jackson Audio, Martin guitars vs Martin
  Audio, Pulsar Audio vs Pulsar Modular) were deliberately left untouched.

  Also backfilled official homepage URLs for four distinct (non-merged)
  stubs that had none: `mod-sound`, `arc` (Analogue Research), `jmk-audio`,
  and `jmk-music-pedals`.

## 3.34.1

### Patch Changes

- edcba30: Remove non-schema `images` field from all entries

  The `images:` field is not part of any collection schema (the
  canonical JSON schemas are `additionalProperties: false`) and is
  never read into `catalog.sqlite`. Product images are served from R2
  keyed by id, so the YAML field was dead, misleading data — an entry
  could carry `images:` yet show a placeholder because nothing was
  uploaded.

  Stripped `images:` from 224 entries and added a `validate.ts` rule
  that rejects the field so it cannot reappear. All referenced images
  were confirmed present in R2 before removal (no data loss).

## 3.34.0

### Minor Changes

- c359ed2: catalog-import-merge: hofa-plugins — added 8 IR-pack content entries, enriched 28 software entries with specs, links, videos, and prices.
- 52dfb8c: catalog-import-merge: ignite-amps

  Merged ignite-amps catalog:
  - Added 3 hardware entries (CS-1, PT Wah, Tube Griller)
  - Updated 11 existing software entries with descriptions
    and details from current website
  - Removed stale free price from Emissary (now via STL Tones)

- c3fc67d: Merge-refresh inphonik (5 software entries updated).

  Updates descriptions, details, specs, and version history for
  PCM2612 Retro Decimator Unit, RX1200, RX950, RYM2612, and
  RYMCast. Adds rack-extension format to plugin entries.

- d0876f6: Merge-import Jam Origin (7 software entries updated).

  Updated descriptions, details, and specs across all seven entries.
  Fixed dead URLs for Guitar Mods (GuitarMods→GM) and MIDI Guitar 3 for
  Logic (MG3Logic→MG3forLogic). Added prices, versions, and links to
  MIDI Guitar 3. Added specs to Guitar Mods and MIDI Guitar 2.

- dea5ef2: catalog-import-merge: kazrog (new=3 discontinued=0 updated=10)
- acda7a0: Merge-import Korneff Audio (1 new, 12 updated entries).

  Adds Power Grid Disruptor (glitch/distortion/stutter effect, $99.99,
  VST3/AU/AAX/LV2, Mac/Windows/Linux). Updates 12 existing software
  entries with details, specs, images, videos, versions, and prices:
  Amplified Instrument Processor, Chocolate Milk, Echoleffe Tape Delay,
  El Juan Limiter, Micro Digital Reverberator, Pawn Shop Comp 2.1,
  Puff Puff mixPass, Pumpkin Spice Latte, Shure Level-Loc,
  SITRAL Klangfilter W295, Talkback Limiter, The Wow Thing.

- 192e71e: catalog-import-merge: landr — added 2 new instruments (Strata, Horizon); enriched all 20 existing LANDR plugin entries with updated descriptions, specs, videos, and more-specific primaryCategories.
- 9b0a2df: Merge refresh Lindell Audio (15 software plugins updated).

  Updated all 15 existing entries with current Plugin Alliance data:
  formats (vst→vst2, rtas added for 500-series), URLs migrated
  to new Shopify store paths, prices updated from $0 to current
  retail pricing, and version history added to 14 entries.

- 63f74b8: Merge import: Louder Than Liftoff (28 hardware + 2 software updated).

  Adds 28 new hardware entries: the Silver Bullet mk2, Chroma/ChromaPlus/Chroma X
  channel strips, 1-Track tape emulation module, Chop Shop 500 Series EQ, and
  all current Colour Modules (Hitmaker 4000, Implode, Mass Drivr, MN-50 Smash
  Compressor, Pentode Mk2, Pulse, Rogue-Tec Air, Royal Blue, Super Filter Mk1/Mk2,
  TAPE•C) plus Mojo Modules (Fairi-Mu, Hitmaker Comp, LA-76, TAPE•79).

  Also includes the Mister Focus hardware family (Comp, EQ, RGB, Stage II),
  discrete op amp modules (Rogue Five, Rogue Six), and the discontinued
  Silver Bullet mk1 (drBill's Stereo Tone-Amp).

  The two existing software plugins (Chop Shop EQ Plugin, Silver Bullet mk2 Plugin)
  were updated with current pricing (now paid via Plugin Alliance).

- 716431f: Refresh Massey Plugins catalog entries (3 updated).

  Updates CT5 compressor description and adds hard-knee Limit mode
  detail; refreshes De:Esser description copy; extends TD5 tape delay
  with noise floor and dither specs from the manufacturer site.

- 29daf1a: Merge refresh for MeterPlugs (6 entries).

  Enriches all 6 existing entries with description, details, and specs from
  the current manufacturer website. Key changes:

  - Dynameter 2: adds vst3 format (confirmed from support page), enriches
    content
  - K-Meter: adds videos (3 YouTube), enriches description/details/specs
  - LCAST: primaryCategory updated metering → loudness; enriches content
  - Loudness Penalty: enriches content for Loudness Penalty 2 release;
    name conflict (v1 → v2) flagged for human review in PR
  - Loudness Penalty Studio: adds full version history (v1.0.0–v1.5.1),
    releaseDate, enriches content
  - Perception AB: enriches description/details/specs

- 1a4101b: Merge refresh for Nembrini Audio (2 new, 1 discontinued, 59 updated).

  New entries: Acoustic Voice Pro Guitar Preamplifier (acoustic amp-sim),
  Bass Resonance (Little Labs Voice of God 500 Series emulation).
  Discontinued: Acoustic Voice Guitar Preamp (superseded by the Pro
  version). Updated 59 existing entries with descriptions, details,
  specs, videos, prices, and platform/format data.

- 62f6135: catalog-import-merge: newfangled-audio — added 7 new software entries (Articulate,
  Fixate Midrange, Invigorate, Obliterate, Punctuate, Recirculate, Saturate) and
  enriched 4 existing entries (Elevate, Equivocate, Generate, Pendulate) with updated
  descriptions, specs, prices, and formats.
- 3edd9b4: Merge refresh OddSound (3 updated entries).

  Enriches MTS-ESP Mini, MTS-ESP Suite, and MR Editor with
  descriptions, details, specs, version history, links, and
  updated category/primaryCategory classifications.

- 379ef37: Merge-refresh Polyverse Music (8 software entries).

  Updates prices, descriptions, details, specs, and videos for
  all 8 plugins: Comet, Filterverse, Filtron, Gatekeeper, I Wish,
  Manipulator, Supermodal, and Wider. Refines primaryCategory for
  Gatekeeper (stutter → gate), I Wish (glitch → pitch-shifter),
  and Wider (effect → stereo-widener).

- 379ef37: Merge-refresh PSP Audioware (56 software entries).

  Updates formats, prices, descriptions, details, specs, versions, videos,
  and releaseDate across 55 existing plugins. Adds 1 new entry: Levelizer
  (dynamics/auto-fader, $69).

  Refines primaryCategory for 11 entries where existing values were missing
  or broad. Skipped 2 bundle entries (MixPack2, StereoPack) — still for sale
  but not standalone catalog entries.

- 822b80a: Merge-refresh Relab Development (12 software entries).

  Updates descriptions, details, specs, versions, prices, formats,
  primaryCategory, and videos across all 12 existing plugins.

  Adds primaryCategory where missing: compressor (Relab 176),
  multiband (Maselec MLA-4), stereo-widener (Sonsig ACE),
  saturation (Color Drive).

  4 conflicts deferred for human review: name changes on VSR REV6000
  and Color Drive, description rewrites on Q82 Natural Resonance Reverb
  and VSR REV6000 (see PR body).

- d5b62ca: catalog-import-merge: sir-audio-tools — added SIR2 (discontinued convolution
  reverb), enriched 6 existing entries with descriptions, specs, prices, links,
  versions, and videos.
- ab8ebae: catalog-import-merge: sonarworks (new=3 discontinued=0 updated=3)

  New entries: SoundID (mobile app), SoundID Reference Measurement
  Microphone (hardware), SoundID Virtual Monitoring (base tier).

  Updated entries: SoundID Reference (prices, specs, versions),
  SoundID Virtual Monitoring PRO (formats enriched, primaryCategory
  binaural, description/details/specs added), SoundID VoiceAI
  (description/details/specs/price added).

- 62c32b3: Merge-refresh Sonuscore catalog entries (3 new, 95 updated).

  New products: LUX Orchestral Strings Elements (free), LUX Orchestral
  Strings Essentials, and TRANSFORCE transient shaper. Updates enrich
  existing 95 entries with descriptions, specs, prices, videos, and
  platform data from the current Sonuscore shop. The full Origins series,
  The Orchestra family, The Pulse, The Score, and Wavelet Audio titles
  are included. Nine bundle SKUs were excluded from the safe-add pass.

- b49b711: Merge-refresh synchro-arts (5 products updated, 1 discontinued).

  Updates descriptions, details, specs, and prices across all five
  active Synchro Arts products (RePitch Elements, RePitch Standard,
  Revoice Pro 5, VocAlign Pro, VocAlign Standard). Adds product
  images and support links. Marks Vocal Production Bundle as
  discontinued (it is a bundle SKU, not a discrete installable
  product — flagged for removal in PR).

- f3e1461: Merge import Three-Body Technology (3 new, 18 updated).

  Three new software entries: Sapphire Drive (saturation),
  Transi-Q (EQ), and UNMASK (psychoacoustic dynamic EQ).
  Eighteen existing entries enriched with specs, details,
  videos, and versions via safe-add pass. Deep Vintage
  (12-plugin bundle) excluded from enrichment — flagged
  for removal review.

- 579edd5: Merge-refresh Togu Audio Line and Newfangled Audio.

  **Togu Audio Line** (16→26 software entries): adds 10 new entries:
  TAL-BassLine, TAL-BitCrusher, TAL-J-8X, TAL-Dub, TAL-Dub-2, TAL-Dub-3,
  TAL-Elek7ro, TAL-Reverb-2, TAL-Reverb-3, TAL-U-No-62. TAL-J-8X is a new
  $69 Roland JX-8P emulation; the other 9 are legacy free plugins now
  catalogued for completeness. Updates 16 existing entries with
  descriptions, specs, system requirements, formats, versions, and videos.
  Auto-resolved 21 fields via default-trust heuristic. 1 conflict pending
  human review: TAL-Dub-X description (extracted is a 2-sentence
  truncation of the existing — keep existing).

  **Newfangled Audio** (7 new entries, 4 updated): adds Articulate,
  FixateMidrange, Invigorate, Obliterate, Punctuate, Recirculate, and
  Saturate. Updates Elevate, Equivocate, Generate, and Pendulate with
  expanded descriptions, specs, and version history.

- bca2c55: Merge-refresh zplane (7 software entries).

  Updates descriptions, details, specs, videos, links, and versions for
  all 7 entries: deCoda, élastiqueAAX, ELASTIQUE PITCH, PEEL STEMS,
  PEEL, reTune, and TONIC. Refines primaryCategory for deCoda
  (utility → analyzer), élastiqueAAX (utility → time-stretching),
  PEEL (utility → source-separation), PEEL STEMS
  (utility → stem-separator), reTune (pitch → pitch-shifter).

### Patch Changes

- 443e947: catalog-import-merge: getgood-drums — updated 54 existing entries with descriptions,
  specs, images, primaryCategory, and formats from current product pages on ggd.co
- 6916793: catalog-import-merge: glitchmachines

  Updated 22 existing entries (9 software, 13 content):
  - Added prices (corrected from $0 to $39 for content packs, $49–$69 for paid plugins)
  - Added/refreshed descriptions and details across all entries
  - Added specs to 9 software entries
  - Fixed Skein primaryCategory: creative → fm
  - Corrected macOS version naming in 5 specs blocks

- bbc4415: catalog-import-merge: illformed — update Glitch 2 (versions, videos, links, image)
- b77b289: catalog-import-merge: klanghelm refresh (10 updated)

  Refreshed all 10 existing klanghelm software entries with richer
  content from current product pages. No new products, no discontinued.

  Products updated: DC1A, DC8C, IVGI, MJUC jr., MJUC, SDRR,
  TENS jr., TENS, VUMT deluxe, VUMT.

  Fields added across entries: primaryCategory corrections (VUMT
  `meter`→`metering`, TENS/TENS jr. `effect`→`spring`), vst format
  ordering normalized, details and specs blocks enriched, versions
  added for freeware products.

- 54833f4: Merge update for LiquidSonics (12 products enriched): added pricing, version
  histories, descriptions, specs, and videos across the full product line.
- a46e8b6: catalog-import-merge: mixed-in-key — updated 12 existing entries with enriched
  descriptions, details, specs, versions, and videos from current product pages;
  3 name conflicts flagged for human review (Human Plugins, Mashup, Satellite Plugins)
- 9528f2e: catalog-import-merge: sonnox — 1 new product (Oxford SuprEsser DS, AAX DSP
  variant for Avid VENUE/S6L), 14 existing entries updated with descriptions,
  specs, prices, videos, and links from current product pages on sonnox.com
- 98416d3: catalog-import-merge: stl-tones — added 6 new entries (3 AmpHub bass/guitar
  models, 3 ControlHub/ToneHub expansion packs), applied descriptions and prices
  to 138 existing entries, marked 1 discontinued (Will Yip ToneHub)
- c62a5b6: catalog-import-merge: wavearts — enriched 14 existing software entries with updated
  descriptions, details, specs, and prices from current product pages. No new products,
  none discontinued.
- 3a80077: Normalize polyverse-music specs blocks to the `- ` list format and drop the
  redundant platform restatement (W126), and add the `ios` platform to Wider.
- 7baee5c: Remove inline links (URLs, `www.` domains, bare domain mentions, and email addresses) embedded in `description`/`details`/`specs` prose across 22 entries. These auto-linked at build time (GFM autolinks) and duplicated the dedicated `url`/`links` fields; the prose now reads cleanly with the links removed.

## 3.33.0

### Minor Changes

- 99bc8fb: Merge refresh for Hit'n'Mix (hitnmix).

  Adds 2 new companion apps — RipX Deconstruct (free macOS stem
  separator bridging to the RipX iPhone app) and RipX Separator
  (free macOS stem separator for RipX Backstage on Apple Vision Pro).

  Enriches all 4 existing entries with fuller details, specs, and
  platforms; description conflicts and category additions surfaced
  for reviewer.

## 3.32.0

### Minor Changes

- 8b8c0c7: Merge-refresh Dear Reality (discontinued=2, enrichment of 11 existing).

  Dear Reality is a German spatial audio company now operating under
  Sennheiser. All 11 software entries enriched with formats, platforms,
  prices, descriptions, details, and specs sourced from the Sennheiser
  product page. dearVR MIX-SE and dearVR UNITY marked discontinued per
  manufacturer deprecation notices. dearVR MUSIC noted as no longer
  actively maintained, still available to existing owners via Plugin
  Alliance.

- 4022a14: Remove bundle entries and strip purchase links.

  Removed 13 Drumforge bundle entries (7 software, 6 content). A bundle
  is a commercial SKU, not a discrete installable product — what exists
  on disk and syncs is the individual plugins/packs, which remain as
  their own entries.

  Stripped purchase/buy/store links from the `links` arrays across the
  catalog (186 links in 174 files). The canonical `url` already points
  users to the product, so retailer/cart links were redundant.
  App-store / play-store download links were preserved.

## 3.31.0

### Minor Changes

- b97b1fa: Merge-refresh DMG Audio (15 of 16 existing software entries updated).

  DMG Audio is a UK-based developer of professional audio plugins
  covering EQ, dynamics, de-essing, pitch-shifting, metering, and
  stereo processing — known for deep feature sets and high-quality
  processing algorithms.

  Updated entries received: expanded categories arrays (8 products),
  added format entries vst2/vst3 (EQuality, EQuilibrium, Limitless,
  Multiplicity), added full specs bullet lists (EQuality, EQuilibrium,
  Essence, Limitless, Multiplicity, PitchFunk, Dualism), and expanded
  details prose for EQuick and all Track\* products. DMG-Audio-Compassion
  was unchanged (no safe-add fields identified).

- c6b3c24: Merge-reconcile Drumforge (76 updated entries).

  Applied 121 safe-add field updates across 76 existing Drumforge
  entries covering drum samplers, drum replacers, MIDI groove packs,
  one-shot sample libraries, and mixing plugins. Includes
  primaryCategory canonicalization (drum-sample-pack → sample-pack,
  bundle → suite), prices for newly-priced items, and descriptions
  for previously empty fields. One discontinued entry confirmed.

### Patch Changes

- a7482a6: Make punctuated brand names searchable by their unpunctuated forms.

  `brandVariants()` now generates search-term variants for periods,
  ampersands, apostrophes, and slashes, so the FTS index matches names
  like "A.O.M." when a user types "aom", "Mesa/Boogie" for "mesaboogie"
  / "mesa boogie", "D'Addario" for "daddario", and "Bang & Olufsen" for
  "bang and olufsen" / "bang olufsen". Mirrors the existing hyphen/space
  handling; ampersands additionally seed an "and" rewrite.

## 3.30.0

### Minor Changes

- ed8b265: Merge-refresh Algorithmix (3 new entries + enrichment of 11 existing).

  Algorithmix is a German audio DSP company known for high-end spectral
  audio restoration, mastering EQs, and noise reduction tools (primarily
  Windows, late 1990s–2000s era). New entries: AlgoRec (WAV recorder
  with lossless compression), AlgoTest (free soundcard noise analyzer),
  Easy Tools (restoration plug-in suite for vinyl/tape cleanup).
  Existing entries enriched with version numbers (reNOVAtor, easyreNOVAtor)
  and full details/specs (Sound Laundry).

- 81efb1d: Merge aly-james-lab (8 updated software entries).

  Added product images (3 per entry), YouTube playlists (8), manufacturer
  manual links (ClapTrap 2, FMDrive, Super PSG, VProm 3, VSDSX), version
  history (all 8 entries), and release years (6 entries). Structural field
  conflicts (url www/non-www, categories ordering, prose descriptions) surfaced
  in PR for human review. Notable: Super PSG pricing conflict (€20 vs €15)
  requires manual verification on the product page.

- 2544616: catalog-import-merge: aom (new=0 discontinued=0 updated=14)

  Added releaseDate, videos, and links to 14 existing AOM Factory entries.
  Conflicts (description, specs, prices, categories, primaryCategory)
  surfaced in PR body for human review.

- e23753c: catalog-import-merge: audiosourcere (new=0 discontinued=0 updated=5)

  Added images, videos, and version history to all five AudioSourceRE
  entries (DeMIX Pro, DeMIX Essentials, DRUMLESS, RePAN, VOXLESS). DeMIX
  Pro and Essentials now reflect version 6.0. Conflicts on description,
  details, specs, and select categories are surfaced in the PR for human
  review.

- 7a2545b: catalog-import-merge: black-salt-audio (new=1 discontinued=0 updated=15)

  Added Instinct EQ (four-band EQ with Surgery notch module, $59). Refreshed
  all 15 existing entries with images and videos. BSA Delays also gained
  specs and a version entry (1.1.1).

- 1a5d82f: catalog-import-merge: cytomic (new=0 discontinued=0 updated=2)

  Added images to The Drop and The Glue. The Scream images require
  human review (only a third-party KVR source was found; official
  Cytomic CDN is CAPTCHA-gated). Categories, description, details,
  and specs conflicts surfaced in PR for reviewer to resolve.

- b4880c0: Merge refresh discoDSP: 1 new entry (Phantom), 12 entries enriched
  with images, videos, versions, and type field.
- 50093d3: catalog-import-merge: dmitry-sches-audio-software (new=1 discontinued=0 updated=3)

  Added Factory Expansions for Tantra (free preset pack, content type). Refreshed
  existing entries: Diversion gained expanded categories (granular, fm, subtractive,
  hybrid, electronic), prose details, trimmed specs, links, and version history;
  Tantra gained primaryCategory upgrade to multi-effect, expanded categories, prose
  details, trimmed specs, links, and version history; Thorn gained two new category
  tags (hybrid, electronic), prose details, 64-bit spec, links, and version history.

- 3c3b66c: catalog-import-merge: dotec-audio (new=5 discontinued=0 updated=32)

  Adds 5 discontinued legacy products (DeeComp, DeeGraphComp, DeeRAM, DeeTP,
  DeeTrim) and enriches 32 existing entries with descriptions, details, specs,
  formats, platforms, prices, versions, and URLs extracted from dotec-audio.com.

- 6117ac9: catalog-import-merge: drumforge (new=13 discontinued=1 updated=63)
- d9f0590: catalog-import-merge: fuse-audio-labs (new=1 discontinued=0 updated=0)

  Adds Tube Lab, a vintage channel strip combining tube preamp (5 models),
  Baxandall EQ, and optical leveler. Note: price field omitted — FastSpring
  product pages are not accessible headlessly; resolve manually before merging.

### Patch Changes

- 1395f12: merge(auburn-sounds): add images and versions (safe-add fields)

  Added CDN image URLs and current version numbers to 7 active Auburn
  Sounds products (Couture 1.10, Graillon 3.2, Renegate 1.6,
  Panagement 2.8, Inner Pitch 2.1, Lens 1.4, Selene 1.1). Added
  version 1.0 to 3 GFM legacy products (Distort, Koch, Psypan).

  Conflicts (primaryCategory, categories, description, details, specs,
  prices, formats for all 10 entries) require human review — see PR
  body for full conflict list.

- b47091a: catalog-import-merge: audiaire (new=0 discontinued=0 updated=1)

  Zone gained version 1.2.

- 60f2563: catalog-import-merge: future-audio-workshop — refresh 4 software entries (Circle², Notes, SubLab XL, SubLab): updated prices, enriched descriptions/details/specs, added categories, updated Notes URL and formats.

## 3.29.0

### Minor Changes

- 9ae6e0d: catalog-import-merge: accentize (new=2 discontinued=3 updated=0)

  Added Content Creator bundle (DialogueEnhance + DeRoom, $94.40) and
  dxLevel (free LUFS leveling plugin). Marked dxRevive Pro, DeRoom Pro,
  and Chameleon Surround as discontinued — their URLs redirect to the
  base products (dxRevive, DeRoom, Chameleon).

- c496097: catalog-import-merge: acoustica (new=1 discontinued=0 updated=4)

  Added Spin It Again (vinyl/cassette digitizer for Windows). Refreshed
  existing entries: Home Studio gained a YouTube video; Recording Studio
  gained a release year; Pianissimo gained its $19 price.

- ed5c6ec: Merge refresh for ADPTR Audio (5 software entries).

  Adds images, videos, version history, and release dates to Hype,
  Metric AB, Sculpt, Streamliner, and Utopia. All 5 products remain
  active on the manufacturer site. No new or discontinued entries.

- a9c48f5: Merge refresh DDMF: 26 entries updated with specs enrichment.

## 3.28.1

### Patch Changes

- c98f75b: Add "Aureo" to the cSpell dictionary

## 3.28.0

### Minor Changes

- ee2ed6e: Merge aberrant-dsp (7 updated software entries).

  Added user manual links (Lair, ShapeShifter, SketchCassette II, Tectonic),
  demo download links (Digitalis), version data (Cataclysm v1.1, Tectonic v1.1),
  and release year for Lofi Oddity (2023). All structural fields (formats,
  platforms, url, prices) match — this merge surfaces category and prose
  conflicts for human review.

- 9dba47f: Emit a lean `catalog-index.json` web index alongside the SQLite build.

  Adds `scripts/build-catalog-index.ts` (run via `pnpm build:index`),
  which mirrors the SQLite source-of-truth loading to produce a
  slim JSON summary of categories, brands, and products for
  machine-readable / web consumption. The release workflow builds
  and checksums the index and attaches it to the GitHub Release
  next to `catalog.sqlite`.

## 3.27.0

### Minor Changes

- 70464be: Merge update for AudioMulch (1 software entry).

  Adds version history (14 releases, 2.0.0–2.2.5, 2009–2016) and
  4 Vimeo demo videos. No new entries; no discontinuations.

- cc56140: Import Seymour Duncan (13 hardware entries).

  Adds the eight Seymour Duncan effects pedals (805, Diamondhead,
  Forza, Palladium, Pickup Booster Mini, Polaron, Studio Bass,
  Vapor Trail Deluxe) and the five PowerStage solid-state pedal
  amps (100 Stereo, 170, 200, 700, 700 Bass). Manufacturer
  already existed; this is the first product import for the brand.

## 3.26.0

### Minor Changes

- d8923b0: Import Jackson Guitars (77 hardware entries).

  Products span the full Jackson lineup: American Series (Rhoads,
  Soloist, Virtuoso), Concept Series limited editions, JS Series
  entry-level electrics and basses, Pro Series signatures (Misha
  Mansoor, Marty Friedman, Jeff Loomis, Gus G., Dave Davidson,
  Corey Beaulieu, Wes Borland, Josh Smith, Phil Demmel, Rob
  Caggiano, Mark Heylmun, Chris Broderick), Pro Plus Series, Pro
  Origins 1985 San Dimas, X Series Soloist, and USA Signature
  Misha Mansoor Baritone Surfcaster. Includes 9 bass guitar
  entries (JS Concert Bass, Kelly Bird Bass lines).

- 437bfd1: Import JBL Professional (19 hardware entries).

  Studio monitors: 104BT, 305P MkII, 306P MkII, 308P MkII,
  705P, 708P, LSR310S, M2 Master Reference Monitor, Control
  2P Master, Control 2P (Stereo Pair). Subwoofers: SUB18.
  PA systems: IRX ONE, PRX ONE, VTX A12, VTX B28. Installed:
  Control 1 Pro, Control HST. Commercial AV: Pro SoundBar
  PSB-1, Pro SoundBar PSB-2.

- 852f7f9: Import Kemper (11 hardware/software entries).

  The Kemper PROFILER line — Head, PowerHead, Rack, PowerRack, Stage,
  and Player — are the flagship hardware amp profilers. Also included:
  Kabinet (1×12 speaker cabinet), Kone NEO (replacement speaker
  driver), Power Kabinet (active cabinet), PROFILER Remote (foot
  controller), and Rig Manager (free companion software for Mac,
  Windows, iOS, and Android).

- a94dbaa: Import Soundcraft addendum — 6 additional entries + data quality fixes.

  Adds 6 hardware entries missing from the initial import (AES/EBU
  Interface, K1, K2, M Series, Si Option Cards, Vi Option Cards), removes
  3 duplicate accessories-directory entries and 3 double-prefixed filenames,
  and fixes 17 description/details fields that contained truncated text,
  marketing taglines, or placeholder content.

- 3de7e8f: Import Tannoy (50 hardware entries).

  Full Tannoy professional audio lineup covering the VX passive
  PA series, VXP/VXP active PA, VSX subwoofers, VQ/VQNET line
  arrays, GOLD/REVEAL studio monitors, Super Gold monitors, and
  Prestige/Legacy/Platinum HiFi loudspeakers.

- 5663b16: Import Taylor Guitars (61 hardware entries) and TASCAM
  (84 hardware/accessory entries).

  Taylor import covers the full acoustic catalog: 100–900 Series
  Grand Auditorium and Grand Orchestra models, Academy, GS Mini,
  Baby Taylor, Builder's Edition, Koa Series, Nylon Series,
  12-string variants, and the T5z hybrid hollowbody line (Classic
  and Pro). TASCAM import includes professional recorders, mixers,
  CD/BD players, clock generators, audio interfaces, and
  accessories.

- 5dc221d: Import TC Electronic (113 entries: 110 hardware, 3 accessories).

  TC Electronic is a Danish manufacturer of guitar effects pedals, bass
  amplifiers, studio equipment, and rack processors. This import covers
  their full active and discontinued catalog including the TonePrint
  pedal series (Flashback, Hall of Fame, HyperGravity, Polytune), bass
  heads (BH250/550/800, BAM200), studio monitoring controllers (Clarity
  M), the Plethora X series multi-effects, DT desktop plugin controllers
  (TC2290-DT, TC8210-DT), and isolated pedalboard power supplies
  (Protein Bar, Protein 10). Nine products are tagged as discontinued.

## 3.25.0

### Minor Changes

- cd33d70: Import Serato (9 software entries).

  Adds current Serato products — DJ Pro, DJ Lite, Studio, Sample,
  Hex FX, Pitch 'n Time, Visualizer — plus two discontinued legacy
  entries (Scratch Live, DJ Intro). Producer Suite and Serato DJ
  expansion packs (DVS, Video, Play, FX, Flip, Club Kit, Pitch 'n
  Time DJ) deferred — they share a single anchor-linked page and
  need a follow-up import. 46 Serato Studio sound packs also
  deferred.

## 3.24.0

### Minor Changes

- cbf7bc4: Add `pickup` as a hardware category with five companion subcategories:
  `humbucker`, `single-coil`, `p90`, `active-pickup`, `passive-pickup`. Unblocks
  imports of pickup-making manufacturers (Seymour Duncan, DiMarzio, EMG, Bare
  Knuckle, Lollar, etc.) whose catalogs were previously deferred because the
  schema had no home for pickups other than the loosely-typed accessory bucket.
  Pickup entries belong in `data/hardware/` since they are first-class musical
  electronics on par with effects pedals and amplifiers.
- cbf7bc4: Import Serato (9 software entries).

  Adds current Serato products — DJ Pro, DJ Lite, Studio, Sample,
  Hex FX, Pitch 'n Time, Visualizer — plus two discontinued legacy
  entries (Scratch Live, DJ Intro). Producer Suite and Serato DJ
  expansion packs (DVS, Video, Play, FX, Flip, Club Kit, Pitch 'n
  Time DJ) deferred — they share a single anchor-linked page and
  need a follow-up import. 46 Serato Studio sound packs also
  deferred.

## 3.23.0

### Minor Changes

- 340cef1: Import HiFiMAN (38 hardware entries).

  Covers headphones, in-ear monitors, headphone amplifiers, and DACs
  from HiFiMAN. Product families include: SUSVARA, HE1000, ANANDA,
  ARYA, SUNDARA, SVANAR, RE2000, EF-series DAC/amps, and electrostatic
  systems (SHANGRI-LA, Jade II, Mini Shangri-La). Also includes newer
  2024–2025 releases: ISVARNA, GOLDENWAVE GA-10, HE1000 Unveiled,
  Susvara Unveiled, ANANDA UNVEILED, and EDITION XV.

- 282c904: Import KEF (117 hardware/accessory entries).

  Products span KEF's full range: flagship Blade and Reference
  series floorstanding speakers; LS50 Meta, LS60 Wireless,
  LSX 2, LSX 2 LT wireless speakers; Q Meta and R Meta series;
  KC62, KC92, Kube and T2 subwoofers; Mu3, Mu7, Muo headphones;
  XIO Soundbar; CI in-ceiling/in-wall series (100–3160); Kasa500
  amplifier; KW1/KW2 wireless subwoofer adapter; and 23
  accessories (floor stands, grilles, cables, spike kits,
  stacking kits).

- 2c8326a: Import Klipsch (62 hardware entries).

  Covers the full current product range: Reference series
  floorstanders, bookshelves, and center channels (R and RP lines);
  subwoofers (R-101SW through RP-1600SW); Flexus soundbar and
  surround ecosystem (Core 100/200/300, Sub 100/200, Surr 100/200);
  Heritage Collection (Klipschorn AK7, La Scala AL6, Cornwall IV,
  Forte IV, Heresy IV, Jubilee, Rebellion); powered speakers (The
  Fives II, Sevens II, Nines II, R-40PM, R-50PM, The One Plus,
  The Three Plus); party speakers (Nashville, Detroit, Austin, Vegas,
  Miami, New York); true wireless earphones (T5 II Sport, T5 II ANC,
  S1); Heritage Active Crossover; and the limited-edition Klipsch x
  Ojas KO-R2.

- d3be7b4: Import PRS Guitars (111 hardware entries).

  Adds the current PRS lineup: electric guitars (Core, S2, SE
  series — Custom 24 family, McCarty 594 family, Silver Sky, NF
  53, Mark Tremonti, Mark Holcomb, Myles Kennedy, Santana Retro,
  Fiore, Studio, Standard, Modern Eagle V), acoustic guitars
  (SE A-series and P/T series), amplifiers (HDRX heads + cabs,
  Archon heads/combos/cabs, Sonzera, MT, DG, DGT), and three
  pedals (Horsemeat overdrive, Mary Cries optical compressor,
  Wind Through The Trees dual analog flanger).

- 54e4dbc: Import Rane (13 hardware entries).

  Adds 13 Rane DJ products: mixers (Seventy, Seventy A-Trak,
  Seventy-Two, Seventy-Two MKII, MP2015), motorized controllers
  (One, One MKII, Four, Performer, System One), motorized
  turntable controllers (Twelve, Twelve MKII), and the SL4
  USB DVS audio interface. Generational supersedes edges set
  for One MKII, Twelve MKII, and Seventy-Two MKII.

- 64d1ccb: Import Rickenbacker (20 hardware entries).

  Includes the full current Series 300, 600, 4000, Vintage and W
  series: Models 330, 330/12, 330W, 330/12W, 360, 360/12, 360W,
  360/12W, 1993Plus, 620, 660, 660/12, 4003, 4003S, 4003W, 4003SW,
  350V63 Liverpool, 4005V, 325C64 and 360/12C63. Hardware-only
  import — all electric guitars and bass guitars.

- 0d8c473: Import RME (39 hardware/accessory entries).

  Adds RME's current product lineup: 12Mic preamps, ADI-2 series
  converters, Babyface Pro FS, Digiface family (AES/AVB/Dante/
  Ravenna/USB), Fireface 802/UCX/UFX series, HDSPe PCI Express
  cards (AES/AIO Pro/AoX/MADI/RayDAT), M-1620 Pro and M-32 Pro
  II series converters, MADIface USB/XT II, Micstasy and OctaMic
  II preamps, plus ARC USB control surface, DPS-2 and LNI-2 DC
  power supplies, and Time Code Option expansion board.

- 79675d4: Import Rupert Neve Designs (35 hardware entries).

  Adds the current Rupert Neve Designs product line: the 5088 console; the
  Shelford Series (Channel, Dual Mic Pre, Compressor, 5051/5052/5053
  Penthouse modules, plus the 5022 dual mic pre); the 500 Series modules
  (511, 517, 535, 542, 543, 545, 551); the Portico II 5024 Quad Mic Pre,
  5045 PSE, 5017 Mobile Pre, and 5211 Dual Mic Pre; the 5057 Orbit, 5059
  Satellite, and 5060 Centerpiece summing mixers; the Master Bus Family
  (MBP, MBT, MBC); the RNDI family (RNDI, RNDI-S, RNDI-M, RNDI-8); the
  RNHP headphone amp; the RMP-D8 Dante preamp; the Newton Channel; the
  OptoFET; and the R6 / R10 500 Series chassis.

- 08e6e03: Import Soundcraft (187 hardware/software entries).

  Spans the full Soundcraft product history: current digital console
  families (Vi Series, Si Series, Si Performer/Expression, Ui Series,
  Notepad Series), current analog mixers (GB, EFX, EPM, LX7ii, FX16ii),
  plus legacy/discontinued products (Series 200/400/600/800/2400/etc.,
  Spirit series, Signature series, Venue, Vienna, Ghost, K-Series amps,
  and broadcast B100/B400/B800). Includes three companion iPad apps
  (ViSi Remote, ViSi Listen, Audio Calc Toolkit) and accessories.

- cebfc94: Import Stax (19 hardware/accessory entries).

  Adds the current STAX International electrostatic earspeaker lineup:
  SR-X9000 (flagship), SR-009S, SR-009D (revived), SR-007S, SR-L700MK2,
  SR-L500 MK2, SR-X1, SR-003 MK2 in-ear, plus the SRS-X1000 bundle.
  Includes the driver/headphone-amp range: SRM-T8000 (hybrid flagship),
  SRM-700T (tube) / SRM-700S (FET) / SRM-500T (tube) / SRM-400S (FET),
  SRM-D10 II portable, and SRM-D50 desktop with DAC. The
  expansion modules UIM-1 (USB DAC) and PIM-MC1 (MC phono, for SRM-T8000). The
  CES-A1 ear-tip kit ships as the accessory entry.

- 14be1e4: Import Tama (134 hardware entries).

  Drum kits (Club-JAM, Cocktail-JAM, Imperialstar, Stagestar,
  STAR, Starclassic, Superstar Classic), snare drums
  (Metalworks, SLP, Star Reserve, Starphonic, Woodworks, plus
  signature models from Charlie Benante, Mike Portnoy, John
  Tempesta, Peter Erskine, Simon Phillips, Lars Ulrich), and
  hardware (Iron Cobra and Speed Cobra pedals, hi-hat stands,
  cymbal stands, snare stands, drum thrones).

### Patch Changes

- 713483b: Dataset review cleanup: merge two true duplicates (Waves EMI TG12345 and REDD
  Consoles), expand 34 thin descriptions (HOFA, Universal Audio, Pioneer DJ) from
  existing entry details, disambiguate eight byte-identical names (DW Drums
  acrylic/wood and snare depths, Ludwig kit/snare), and add searchTerms plus a
  supersedes lineage link for several "+" models.

## 3.22.0

### Minor Changes

- 8e508ec: Import Genelec (54 hardware entries).

  Imports Genelec's studio monitor and subwoofer lineup
  spanning The Ones (8331A/8341A/8351B/8361A), the SAM 8000
  series, 7000-series subwoofers, the new 8380A/8381A/W371A,
  1234A/1235A/1236A/1237A/1238A main monitors, the 4000-series
  Smart IP installation loudspeakers (4410A-4436A, 3440A), the
  G Series and 6040R home audio products, and the 9320A
  Reference Controller, 9401A System Management Device and
  GLM Calibration Kit accessories.

- 033d7b8: Import Gretsch (198 hardware entries).

  Bulk import of the Gretsch guitar lineup across acoustic,
  folk-and-bluegrass (resonators + ukuleles), hollow-body,
  center-block, solid-body, and bass categories. Covers
  Players Edition, Vintage Select, Custom Shop, Streamliner,
  Electromatic, and artist signature lines (Brian Setzer,
  Stephen Stills, George Harrison, Malcolm Young, Tom Petersson,
  Richard Fortus, Eddie Cochran, Duane Eddy, Billy Duffy,
  Reverend Horton Heat, Bo Diddley, Nigel Hendroff, Patrick
  Stump, Steve Wariner, Michael Guy Chislett, Rich Robinson,
  Martin Gore, Jack Antonoff, Nick 13, Orville Peck, John
  Gourley, Chris Rocha, Tim Armstrong, Stephen Stills),
  with auto-selected hero/detail imagery.

- b13fbe6: Import Mackie (144 hardware/software/accessory entries).

  Adds the Mackie professional audio catalog spanning mixers (VLZ4, Onyx,
  ProFX, DL, Mix), loudspeakers (DRM, SRM, SRT, Thump, DLM, C series),
  studio monitors (HR, MR, CR, Big Knob), headphones (MC series), in-ear
  monitors (MP series), microphones (EM series), audio tools (HM, MDB,
  M48), amplifiers (MX), live streaming hardware (DLZ, MainStream), and
  the Master Fader / Matrix control software.

- ad5fa61: Import Marshall (94 hardware entries).

  Adds Marshall guitar amplifiers (JCM800, JCM900, JTM45,
  JVM, DSL, Studio, Origin, MG, Code, Silver Jubilee, AS50D,
  MS micro stacks), speaker cabinets (1960 series, MX, Origin,
  Studio, 2536, 2551), pedals (Vintage Reissue Bluesbreaker,
  Drivemaster, Guv'nor, Shredmaster + Overdrive series), and
  the Marshall x Synergy preamp modules.

- 7b431d0: Import Martin (81 acoustic guitar, ukulele, and bass entries).

  Covers the Martin lineup across the Standard, Modern Deluxe,
  Authentic, 15, 16/17 and Custom Shop series, plus tenor /
  concert / soprano ukuleles. A few discontinued models are
  tagged based on Martin's explicit retired-product copy.

- 5a83ca3: Import Neumann (43 hardware entries).

  Microphones (28): U 87 Ai, U 67 Set, U 89 i, U 47 fet i, TLM 102, TLM
  103, TLM 107, TLM 170 R, TLM 193, TLM 49 Set, TLM 67, KMS 104, KMS 105,
  KM 184 / KM 185 (Series 180), KMR 81 i, KMR 82 i, KU 100, USM 69 i,
  BCM 104, BCM 705, M 49 V, M 50 V, M 147 Tube, M 149 Tube, M 150 Tube,
  KK capsules (KK 104/105/120/131/133/143/145/184/204/205). Studio
  monitors (3): KH 120 II, KH 150, KH 150 AES67. Headphones (4): NDH 20,
  NDH 20 Black Edition, NDH 30, NDH 30 Black Edition. Audio interface
  (1): MT 48.

- 7946a36: Import Numark (100 hardware/accessory entries).

  Adds the full Numark DJ-gear catalog: 84 hardware entries covering
  DJ controllers (Mixtrack, Mixstream, NS, NV, NDX, N4 lines), turntables
  (PT01, TT250), standalone mixers (M-series, NS6, NS7 generations),
  headphones (HF, Red Wave), wireless microphones, monitors (N-Wave),
  and cartridges (CC1, CS1, GrooveTool); plus 16 accessory entries for
  cases, stands, and the Dashboard / Production Hub power-conditioner.
  48 legacy/discontinued items tagged via the discontinuation heuristic.

- c5ef26a: Import Pioneer DJ (451 hardware/software/accessory entries).

  Headless catalog import. Spans Pioneer's full DJ product
  lineup: CDJ multi-players, DJM mixers, DDJ controllers,
  XDJ all-in-one systems, HDJ headphones, DM/VM/XPRS
  monitors and PA, PLX turntables, RMX/EFX effectors, the
  Toraiz production trio (SP-16, AS-1, Squid), and ~166
  accessories (cases, cables, replacement parts).

  Roughly 60% of entries are tagged `discontinued` —
  detected via Pioneer's per-region `archived` status in
  the page's Next.js data payload.

  IO data on hardware entries is intentionally minimal:
  Pioneer hosts detailed port lists only in linked PDFs,
  which the import pass does not parse. Spec PDF URLs are
  captured in `links[]` for later enrichment.

### Patch Changes

- 722ee5f: Fix grado-labs cartridge descriptions and headphone spec labels

## 3.21.0

### Minor Changes

- 8b04bc9: Import Grado Labs (61 hardware/accessory entries).

  Imports Grado Labs' full product catalog: 18 headphones spanning the
  Prestige (SR60x–SR325x), Reference (RS1, RS2x), Statement (GS1000,
  GS3000, HP100 SE, Hemp Classic), Signature (S550, S750, S950) and
  wireless (GW100x) lines; 13 phono cartridges across the Lineage
  (Epoch4, Aeon4, Statement4), Timbre (Reference4, Master4, Sonata4,
  Platinum4, Opus4), Prestige (Gold4, Red4, Green4) and Specialty
  (DJ200i, ME+ Mono) series; plus replacement styluses, cables,
  cushions, cases, stands and a storage box.

- 3ae8ecc: Import Midas (48 hardware/accessory entries).

  Adds the Midas product line: PRO Series HD96 control centres
  (IP/TP variants), HD96-AIR, HD96-FB16; M32 LIVE/M32R LIVE/M32C
  digital consoles; MR12/MR18 rack mixers; analogue DM12/DM16
  mixers; DL Series stage boxes (DL8/16/32/151/152/153/154/155/
  231/251/431); DN48xx StageConnect interfaces; AS 80 / AS88 /
  COBALT HyperMAC hardware; HUB4 and HUB4 PRO personal-monitor
  hubs; DP48 + DP48MB; NEUTRON DSP rack; LEGEND L6 / L10
  500-series chassis; 500-series modules (Compressor Limiter
  522 V2, Parametric Equaliser 512 V2, Microphone Preamplifier
  502 / 502 V2); XL4-2 vacuum-tube preamp; and PRO Series
  spare parts and road cases.

- f515f49: Import Music Man (33 hardware entries).

  Adds 33 Ernie Ball Music Man electric guitars and basses, spanning
  the current StingRay, DarkRay, and Bongo bass families; the Axis,
  Majesty, JP15, Mariposa, Sabre, and StingRay guitar families;
  artist signature models (Tim Commerford, Pino Palladino, John
  Myung, Mike Herrera, Jason Richardson, Rabea Massaad, Ryan "Fluff"
  Bruce, Stephen Egerton, Dustin Kensrue); and 10 archived/
  discontinued models (Cutlass Bass, Caprice Bass, Cliff Williams
  Icon, Silhouette Bass, St. Vincent HH, Valentine Tremolo, et al.).

## 3.20.0

### Minor Changes

- cd216f5: Import Lexicon (90 entries).

  Bulk import of the Lexicon catalog (Harman). Covers the full product
  family: 224/480L/960L studio reverbs, PCM-series effects processors
  (PCM41/42/60/70/80/81/90/91/92/96 and surround variants), M-series and
  MX/MPX multi-effects, LXP reverbs, the i-O / Omega / Lambda / Alpha
  audio interfaces, LARC/MRC/MPX-R1 controllers, and the PCM/LXP/MPX
  Native reverb plug-in bundles. Includes current immersive/install
  products (BOB-32, QLI-32, PCM96 family) alongside many discontinued
  legacy units documented on lexiconpro.com.

- 8a767fa: Import Manley Laboratories (36 hardware entries).

  Adds the full Manley Labs lineup: tube hi-fi amplifiers (Mahi,
  Stingray II, Neo-Classic 250/500/300B SE-PP, Snapper), hi-fi
  preamps (Absolute, Jumbo Shrimp, Neo-Classic 300B RC, Oasis,
  Steelhead RC), and pro-audio outboard (CORE, VOXBOX, ELOP+,
  NU MU, SLAM!, Variable Mu, Massive Passive EQ, Stereo Pultec EQ,
  Backbone, FORCE, Reference Cardioid/Gold/Silver tube mics).
  Includes mastering variants of Variable Mu, SLAM!, and Massive
  Passive EQ, plus the Langevin sub-brand DVC channel strip and
  legacy entries (Skipjack, HP-112, Langevin ELOP/Mini-Massive/
  Pultec, Mid Frequency EQ, Tannoy ML10, Pultec EQP-1A) tagged
  discontinued.

### Patch Changes

- 5e34174: Add layered whole-dataset review tooling: a deterministic `pnpm dataset:audit`
  cross-entry check (duplicate names, broken `compatibleWith`, orphan
  manufacturers, thin descriptions, coverage metrics), a `/dataset-review`
  command for LLM review of the flagged subset, a monthly `dataset-audit`
  workflow that opens a tracking issue, and a sampled mode for `/data-review`
  on large bulk-import diffs.

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

# catalog

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

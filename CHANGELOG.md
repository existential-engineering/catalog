# catalog

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

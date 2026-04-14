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
- `pnpm format:check` - Check formatting

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

## Data Entry Format

Manufacturers require: name, url
Software requires: name, manufacturer, primaryCategory, platforms
Content requires: name, manufacturer, primaryCategory
Hardware requires: name, manufacturer, primaryCategory, description
Accessories require: name, manufacturer, primaryCategory, description

Optional fields: categories (array), url, description

Note: Slugs are derived from filenames, not stored in the YAML files.

## Field Formatting Conventions

**`manufacturer`** must be a slug reference (the manufacturer's filename without `.yaml`), not the display name:

```yaml
manufacturer: hologram-electronics  # correct (slug)
manufacturer: Hologram Electronics   # wrong (display name)
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

- **Strict (errors, blocks CI):** `signalFlow`, `category`, `position`, `price.currency`
  - `signalFlow`: input, output, bidirectional
  - `category`: audio, midi, digital, power
  - `position`: Top, Bottom, Left, Right
  - `currency`: ISO 4217 codes (USD, EUR, GBP, etc.) — see `schema/currencies.yaml`
- **Advisory (warnings, non-blocking):** `type`, `connection`, `link.type`
  - Known values listed in `schema/io-types.yaml`, `schema/io-connections.yaml`, `schema/link-types.yaml`
  - Unknown values produce warnings in `pnpm validate` output
  - Add new values to schema files via PR when they're confirmed valid

**Semantic distinction:** `type` describes the signal characteristic (line, instrument, headphone, midi, usb, expression). `connection` describes the physical connector (1/4-inch, xlr, usb-c, 5-pin din). Don't swap them.

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

## Product Lineage

Use `supersedes` to link product generations, form factor variants, and major versions. The value must be the **ID** of the older product. This applies to different hardware generations (MKI → MKII), form factors (keyboard → rack), capability upgrades, and software versions (Pro-C 2 → Pro-C 3):

```yaml
# pro-c-3.yaml
name: Pro-C 3
manufacturer: fabfilter
supersedes: 7QMeWge0fOrmQz_oVLCKk  # ID of Pro-C 2
identifiers:
  au: com.fabfilter.Pro-C.AU.3
```

**Finding a product's ID:**

To find the ID of a product you want to reference, open its YAML file and look for the `id` field:

```yaml
# Example from pro-c-2.yaml
id: 7QMeWge0fOrmQz_oVLCKk  # ← Use this value for supersedes
name: Pro-C 2
manufacturer: fabfilter
```

- IDs are 21-character nanoid strings (alphanumeric with `-` and `_`)
- IDs are auto-assigned by CI when you run `pnpm assign-ids` for new entries
- Every product entry must have an `id` field

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

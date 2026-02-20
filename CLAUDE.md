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

- `data/` - YAML source files (manufacturers, software, hardware)
- `schema/` - Category, format, and platform definitions
- `scripts/` - Build and validation tools
- `dist/` - Built SQLite database output

## Conventions

- Filenames are slugs: lowercase with hyphens (e.g., `serum.yaml`, `massive-x.yaml`)
- All entries must pass `pnpm validate` before commit
- Use Prettier for YAML formatting
- Data follows strict schemas defined in `scripts/lib/types.ts`

## Data Entry Format

Manufacturers require: name, website
Software requires: name, manufacturer, primaryCategory, platforms, identifiers
Hardware requires: name, manufacturer, primaryCategory, description

Optional fields: categories (array), website, description

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

## Product Lineage

Use `supersedes` to link major product versions (e.g., Pro-C 3 supersedes Pro-C 2). The value must be the **ID** of the older product:

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

The referenced ID must exist in the same collection (software or hardware). Validation will fail if the ID is not found or if a cycle is detected in the supersedes chain.

The relationship is **bidirectional** - the database can query both directions:

- "What does this product supersede?" (older version)
- "What supersedes this product?" (newer version)

## Versions

Software and hardware entries can have a `versions` array with release history.

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
- `website` (locale-specific URLs)
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

# Contributing to Catalog

Thank you for helping build the most comprehensive open database of audio software!

> **Authoritative field reference:** This guide is a quick start. For the
> complete field rules and entry-type requirements, see
> [`CLAUDE.md`](./CLAUDE.md), and for the exact valid values (categories,
> formats, platforms, IO enums, currencies, locales) see `schema/*.yaml` and the
> generated `schema/CONTEXT.md`. When this guide and the schema disagree, the
> schema wins — and please open a PR to fix the guide.

## Ways to Contribute

### 1. Add Missing Software

Know of a plugin or DAW that's not in the catalog? Submit a PR!

### 2. Fix Incorrect Data

Found a typo or wrong information? Open an issue or submit a fix.

### 3. Improve the Schema

Have ideas for better categorization or new fields? Let's discuss.

## Adding New Entries

### Prerequisites

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Create a new branch: `git checkout -b add-serum`

### Step 1: Check if Manufacturer Exists

Look in `data/manufacturers/` for the company. If it doesn't exist, create it:

```yaml
# data/manufacturers/xfer-records.yaml
name: Xfer Records
url: https://xferrecords.com
```

### Step 2: Create the Software Entry

```yaml
# data/software/serum.yaml
name: Serum
manufacturer: xfer-records # Must match a manufacturer slug
primaryCategory: synthesizer # Must NOT be repeated in `categories`
categories:
  - wavetable
formats:
  - au
  - vst3
  - aax
platforms:
  - mac
  - windows
identifiers:
  au: com.xferrecords.Serum
  vst3: com.xferrecords.Serum.vst3
url: https://xferrecords.com/products/serum
```

### Step 3: Validate

```bash
pnpm validate
```

Fix any errors before submitting.

### Step 4: Submit PR

1. Commit your changes
2. Push to your fork
3. Open a pull request

## Panel Width (`hp`) on Modular Entries

Eurorack modules carry `hp`, the panel width in horizontal pitch units
(1 HP = 5.08 mm). The Studio app draws a module at that scale, so a wrong
value is visible on screen.

```yaml
primaryCategory: modular
categories:
  - utility
hp: 20
```

- **A bare integer.** `hp: 12` validates; `hp: "12HP"`, `hp: 12.5` and
  `hp: 0` fail (E101). Half-HP does not exist in the standard.
- **Modular entries only.** Set it on entries filed under `modular`, as
  `primaryCategory` or in `categories`. A case, busboard, keyboard case or a
  non-Eurorack system (Buchla, Serge, a Nord Modular) has no single panel
  width and stays without it. A case's row capacity ("104HP per row") is not a
  width.
- **Never guessed.** Take the number from the maker's product page or manual
  first, from the entry's own `specs` second, and from ModularGrid only when
  the maker states none. Do not measure a photo, round, or infer from a
  sibling model.
- **Say where it came from.** The YAML has no field for the source, so name
  it in the PR description, one line per entry (`intellijel-plonk: 12,
  intellijel.com product page`). That is what lets a reviewer check the
  change in seconds.
- **Changing an existing value** follows the same rules, plus a sentence on
  why the old value was wrong. Two plausible widths with no reason given is
  the one case a reviewer cannot judge.

`pnpm dataset:audit` lists modular entries that still lack `hp`
(`modular-missing-hp`) if you are looking for ones to fill in.

## Naming Conventions

### Slugs (File Names)

- Lowercase only
- Use hyphens for spaces: `serum`, `massive-x`, `vital-synth`
- No special characters
- Must match the `slug` field in the YAML

### Categories

Use categories from `schema/categories.yaml`. Common ones:

**Instruments:**

- `synthesizer`, `sampler`, `drum-machine`, `piano`, `strings`

**Synthesis Types:**

- `analog`, `wavetable`, `fm`, `granular`, `physical-modeling`

**Effects:**

- `equalizer`, `compressor`, `reverb`, `delay`, `distortion`

**Utility:**

- `utility`, `analyzer`, `meter`, `routing`, `midi`

### Formats

The full list lives in `schema/formats.yaml`:

- `au` — Audio Unit (macOS/iOS)
- `vst` — Generic VST (use when the version is unknown)
- `vst2` — Explicit VST2
- `vst3` — VST3
- `aax` — Avid Audio eXtension (current Pro Tools)
- `rtas` — Real-Time AudioSuite (legacy Pro Tools)
- `tdm` — Time Division Multiplexing (legacy Pro Tools HD)
- `clap` — CLever Audio Plug-in
- `lv2` — LV2 plugin format (cross-platform, common on Linux)
- `rack-extension` — Reason Studios Rack Extension
- `standalone` — Standalone application

### Platforms

The full list lives in `schema/platforms.yaml`:

- `mac` — macOS
- `windows` — Windows
- `linux` — Linux
- `ios` — iOS (AUv3)
- `android` — Android

## Finding Bundle Identifiers

Bundle identifiers help Aureo identify installed plugins on your system.

### macOS

```bash
# For an Audio Unit
mdls -name kMDItemCFBundleIdentifier /Library/Audio/Plug-Ins/Components/Serum.component

# For a VST3
mdls -name kMDItemCFBundleIdentifier /Library/Audio/Plug-Ins/VST3/Serum.vst3
```

### Windows

VST3 plugins use the same reverse-domain identifier scheme across platforms.
Windows has no simple `mdls` equivalent — consult the plugin's documentation or
its bundle metadata to find the identifier.

## Code of Conduct

- Be respectful and constructive
- Focus on accuracy and helpfulness
- Credit original sources when possible

## Questions?

Open an issue or reach out to the maintainers.

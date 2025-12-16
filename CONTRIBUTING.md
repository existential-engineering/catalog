# Contributing to Catalog

Thank you for helping build the most comprehensive open database of audio software!

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
slug: xfer-records
name: Xfer Records
website: https://xferrecords.com
```

### Step 2: Create the Software Entry

```yaml
# data/software/serum.yaml
slug: serum
name: Serum
manufacturer: xfer-records    # Must match a manufacturer slug
type: plugin
categories:
  - synthesizer
  - wavetable
formats:
  - au
  - vst3
  - aax
platforms:
  - darwin
  - win32
identifiers:
  au: com.xferrecords.Serum
  vst3: com.xferrecords.Serum.vst3
website: https://xferrecords.com/products/serum
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

- `au` — Audio Unit (macOS)
- `vst` — VST2
- `vst3` — VST3
- `aax` — Avid Audio eXtension (Pro Tools)
- `clap` — CLever Audio Plug-in
- `standalone` — Standalone application

### Platforms

- `darwin` — macOS
- `win32` — Windows
- `linux` — Linux

## Finding Bundle Identifiers

Bundle identifiers help Racks identify installed plugins on your system.

### macOS

```bash
# For an Audio Unit
mdls -name kMDItemCFBundleIdentifier /Library/Audio/Plug-Ins/Components/Serum.component

# For a VST3
mdls -name kMDItemCFBundleIdentifier /Library/Audio/Plug-Ins/VST3/Serum.vst3
```

### Windows

VST3 plugins use the same identifier scheme but are stored differently. Check the plugin's Info.plist or manifest.

## Code of Conduct

- Be respectful and constructive
- Focus on accuracy and helpfulness
- Credit original sources when possible

## Questions?

Open a [Discussion](https://github.com/racks-fm/catalog/discussions) or reach out to the maintainers.


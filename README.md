# Catalog

[![Validate](https://github.com/racks-fm/catalog/actions/workflows/validate.yml/badge.svg)](https://github.com/racks-fm/catalog/actions/workflows/validate.yml)
[![Release](https://github.com/racks-fm/catalog/actions/workflows/release.yml/badge.svg)](https://github.com/racks-fm/catalog/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Data: CC0](https://img.shields.io/badge/Data-CC0%201.0-blue.svg)](https://creativecommons.org/publicdomain/zero/1.0/)

Open source database of audio software, plugins, DAWs, and hardware for the music production community.

## Overview

This repository contains:

- **YAML Source Files** — Human-readable and version-controlled data files
- **SQLite Database** — Pre-built database generated from YAML (distributed via GitHub Releases)
- **Validation Scripts** — Ensures data integrity and schema compliance
- **CI/CD Automation** — Auto-builds and releases on changes

## Data Structure

```
data/
├── manufacturers/     # Companies and developers
│   └── xfer-records.yaml
├── software/          # Plugins, DAWs, and standalone apps
│   ├── serum.yaml
│   └── ableton-live.yaml
└── hardware/          # Audio interfaces, controllers, instruments, etc.
    └── apollo-twin-x.yaml
```

## YAML Format

### Manufacturer

```yaml
slug: xfer-records
name: Xfer Records
website: https://xferrecords.com
```

### Software (Plugin)

```yaml
slug: serum
name: Serum
manufacturer: xfer-records
primaryCategory: synthesizer
categories:
  - plugin
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
website: https://xferrecords.com/products/serum
description: Advanced wavetable synthesizer with visual feedback
```

### Software (DAW)

```yaml
slug: ableton-live
name: Live
manufacturer: ableton
primaryCategory: daw
platforms:
  - mac
  - windows
identifiers:
  bundle: com.ableton.live
website: https://ableton.com/live
```

### Hardware

```yaml
slug: apollo-twin-x
name: Apollo Twin X
manufacturer: universal-audio
primaryCategory: audio-interface
website: https://www.uaudio.com/products/apollo-twin-x
description: Desktop Thunderbolt audio interface with UAD processing
```

## Using the Database

### Download Latest Release

```bash
# Get the latest SQLite database
curl -L https://github.com/racks-fm/catalog/releases/latest/download/catalog.sqlite -o catalog.sqlite
```

### Query Examples

```sql
-- Search for plugins by name
SELECT s.name, m.name as manufacturer
FROM software s
JOIN manufacturers m ON s.manufacturer_id = m.id
WHERE s.id IN (
  SELECT id FROM software_fts WHERE software_fts MATCH 'synth*'
);

-- Find plugins by category
SELECT s.name, m.name as manufacturer
FROM software s
JOIN manufacturers m ON s.manufacturer_id = m.id
JOIN software_categories sc ON s.id = sc.software_id
WHERE sc.category = 'synthesizer';

-- Get plugin formats and identifiers
SELECT sf.format, sf.identifier
FROM software_formats sf
WHERE sf.software_id = 'serum';

-- Find all DAWs
SELECT s.name, m.name as manufacturer
FROM software s
JOIN manufacturers m ON s.manufacturer_id = m.id
WHERE s.primary_category = 'daw';
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Fork the repository
2. Add or update YAML files in `data/`
3. Run validation: `pnpm validate`
4. Submit a pull request

### Adding New Software

1. Ensure the manufacturer exists in `data/manufacturers/`
2. Create a YAML file in `data/software/` with the slug as filename
3. Use categories from `schema/categories.yaml`
4. Use formats from `schema/formats.yaml`

## Development

```bash
# Install dependencies
pnpm install

# Validate all YAML files
pnpm validate

# Build SQLite database locally
pnpm build

# Type check
pnpm typecheck
```

## License

- **Code** (scripts, CI configs): [MIT License](LICENSE)
- **Data** (YAML files): [CC0 1.0 (Public Domain)](data/LICENSE)

## Related Projects

- [Racks](https://racks.fm) — Studio organization app that uses this catalog

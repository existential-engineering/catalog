# Catalog

[![Validate](https://github.com/existential-engineering/catalog/actions/workflows/validate.yml/badge.svg)](https://github.com/existential-engineering/catalog/actions/workflows/validate.yml)
[![Release](https://github.com/existential-engineering/catalog/actions/workflows/release.yml/badge.svg)](https://github.com/existential-engineering/catalog/actions/workflows/release.yml)
[![Latest Release](https://img.shields.io/github/v/release/existential-engineering/catalog?label=database)](https://github.com/existential-engineering/catalog/releases/latest)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/existential-engineering/catalog/badge)](https://scorecard.dev/viewer/?uri=github.com/existential-engineering/catalog)
[![License: MIT](https://img.shields.io/badge/code-MIT-yellow.svg)](LICENSE)
[![Data: CC0](https://img.shields.io/badge/data-CC0%201.0-blue.svg)](data/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**An open, community-driven database of music production gear** — synths,
plugins, DAWs, audio interfaces, pedals, microphones, sample packs, and the
cables that connect them all.

Over **12,000 products** from more than **4,000 manufacturers**, maintained as
human-readable YAML, validated by CI, and shipped as a ready-to-query SQLite
database on every release. The data is public domain (CC0), so you can build
whatever you want with it.

## Why this exists

Music production data is scattered across marketing pages, forum posts, and
manuals that go offline. This repo collects it in one structured,
version-controlled place:

- **Structured** — strict schemas (Zod-validated) for every entry type, with
  controlled vocabularies for categories, plugin formats, platforms, and
  physical I/O connections.
- **Deep** — hardware entries model every physical jack (signal flow, connector
  type, panel position), software entries carry bundle identifiers per plugin
  format, and product generations are linked (`supersedes` chains from MKI to
  MKII).
- **Verifiable** — every release ships `catalog.sqlite` with a SHA-256
  checksum, a minisign signature, and an SPDX SBOM.

It powers [Aureo](https://aureo.audio), a desktop app for organizing your
studio — but it isn't tied to it. Plugin managers, gear-matching tools,
research datasets: the data is yours.

## What's inside

| Collection      | Entries | What lives there                                        |
| --------------- | ------: | ------------------------------------------------------- |
| `manufacturers` |  4,000+ | Companies and developers, including defunct brands      |
| `hardware`      |  6,100+ | Synths, interfaces, pedals, mixers, mics — with full I/O |
| `software`      |  4,100+ | Plugins, DAWs, and standalone apps                      |
| `content`       |  1,600+ | Preset packs, sample libraries, expansions              |
| `accessories`   |    700+ | Cables, stands, acoustic treatment                      |

…and counting. Entries also support prices, release-history versions, videos,
search terms, translations, and product-lineage links.

## Get the data

Grab the latest build from
[GitHub Releases](https://github.com/existential-engineering/catalog/releases/latest):

```bash
curl -LO https://github.com/existential-engineering/catalog/releases/latest/download/catalog.sqlite

# Verify the checksum (optional but encouraged)
curl -LO https://github.com/existential-engineering/catalog/releases/latest/download/catalog.sqlite.sha256
sha256sum -c catalog.sqlite.sha256
```

Each release also includes a `catalog.sqlite.minisig` signature, a
`catalog-sbom.spdx.json` SBOM, and a `catalog.intoto.jsonl` build-provenance
attestation.

### Query it

The database has full-text search (FTS5) indexes across every collection:

```sql
-- Full-text search across names, manufacturers, and search terms
SELECT s.name, m.name AS manufacturer
FROM software_fts f
JOIN software s ON s.id = f.id
JOIN manufacturers m ON m.id = s.manufacturer_id
WHERE software_fts MATCH 'wavetable';

-- Every audio interface in the catalog
SELECT h.name, m.name AS manufacturer
FROM hardware h
JOIN manufacturers m ON m.id = h.manufacturer_id
WHERE h.primary_category = 'audio-interface';

-- Plugin formats and bundle identifiers for a product
SELECT sf.format, sf.identifier
FROM software s
JOIN software_formats sf ON sf.software_id = s.id
WHERE s.name = 'Serum';
```

## Contributing

**Every entry in this catalog was added by someone who cared about getting the
details right.** Spotted a missing plugin? A synth with the wrong I/O? A typo
in a description? That's your opening — contributions of any size are welcome.

```bash
# 1. Fork and clone, then install
pnpm install

# 2. Add or edit YAML files under data/

# 3. Validate (CI runs the same checks)
pnpm validate

# 4. Open a pull request
```

Validation is your safety net: it checks schemas, cross-references, controlled
vocabularies, and formatting, and its error codes are documented in
[`docs/VALIDATION_ERRORS.md`](docs/VALIDATION_ERRORS.md). You don't need to
memorize the rules — run `pnpm validate` and it will tell you what's off.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, and
[`CLAUDE.md`](CLAUDE.md) for the authoritative field conventions. JSON Schemas
for editor autocomplete live in [`schema/json/`](schema/json/).

### Entry format at a glance

Filenames are slugs. A product file is named
`<manufacturer-slug>-<product-slug>.yaml`, and its `manufacturer` field
references the manufacturer's filename:

```yaml
# data/manufacturers/xfer-records.yaml
name: Xfer Records
url: https://xferrecords.com/
description: Audio software company founded by Steve Duda, best known for
  creating Serum, one of the most popular wavetable synthesizers.
```

```yaml
# data/software/xfer-records-serum.yaml
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
  default: com.xferrecords.Serum
  vst3: com.xferrecords.Serum.vst3
url: https://xferrecords.com/products/serum-2
description: Serum is an advanced wavetable synthesizer by Xfer Records with
  a visual, high-quality workflow.
```

```yaml
# data/hardware/universal-audio-apollo-twin-x.yaml
name: Apollo Twin X
manufacturer: universal-audio
primaryCategory: audio-interface
url: https://www.uaudio.com/products/apollo-twin-x
description: Desktop Thunderbolt audio interface with realtime UAD processing.
io:
  - name: Hi-Z Instrument Input
    signalFlow: input
    category: audio
    type: instrument
    connection: 1/4-inch
    maxConnections: 1
    position: Bottom
```

Don't add an `id` field yourself — CI assigns a unique ID to new entries
automatically. Valid categories, formats, platforms, and I/O vocabularies live
in [`schema/`](schema/).

## Development

```bash
pnpm install           # Install dependencies

pnpm validate          # Validate all YAML data files
pnpm validate --files data/hardware/some-entry.yaml
                       # Fast pre-flight for just the files you touched.
                       # Skips cross-file checks (duplicate IDs, supersedes
                       # targets), so run the full validate before committing.

pnpm format            # Format all YAML files (or pass specific paths)
pnpm build             # Build catalog.sqlite locally (output in dist/)
pnpm typecheck         # Type-check the scripts
pnpm test              # Run the script test suite
```

## Repository layout

```text
data/
├── manufacturers/     # Companies and developers
├── software/          # Plugins, DAWs, standalone apps
├── hardware/          # Interfaces, synths, pedals, mics…
├── content/           # Presets, sample packs, expansions
└── accessories/       # Cables, stands, acoustic treatment
schema/                # Controlled vocabularies + generated JSON Schemas
scripts/               # Validation, build, and maintenance tooling
docs/                  # Validation error reference, schema versioning
dist/                  # Built SQLite output (local builds)
```

Every push to `main` re-validates the dataset, and releases are cut
automatically through [Changesets](https://github.com/changesets/changesets):
when the pending version PR merges, CI rebuilds `catalog.sqlite`, signs it,
and publishes it to GitHub Releases.

## License

- **Code** (scripts, CI configs): [MIT](LICENSE)
- **Data** (everything under `data/`): [CC0 1.0 — public domain](data/LICENSE)

## Related

- [Aureo](https://aureo.audio) — studio organization app built on this catalog
- [Releases](https://github.com/existential-engineering/catalog/releases) —
  versioned database builds with checksums and signatures

---
description: Scaffold a new manufacturer, software, or hardware entry
---

Interactively create a new catalog entry with proper structure, validation, and manufacturer dependency resolution.

## Before Starting

**Read `schema/CONTEXT.md` first** - this auto-generated file contains all valid categories, formats, platforms, and
other schema values. Use it to suggest valid options and validate user input.

## Process

### Phase 1: Determine Entry Type

Ask the user what they want to add:

1. **Manufacturer** - A company or individual that makes audio products
2. **Software** - A plugin, DAW, or audio application
3. **Hardware** - A physical audio device (interface, synth, pedal, etc.)

If adding software or hardware, ask for the manufacturer name and check if a matching file already exists
in `data/manufacturers/`. If the manufacturer does not exist, create it first before the main entry.

### Phase 2: Gather Information

Prompt the user for relevant fields based on entry type. Reference `schema/CONTEXT.md` for all valid values.

**For Manufacturer:**

- **Required:** name
- **Recommended:** website
- **Optional:** companyName (if different from name), parentCompany, description, searchTerms
- **Filename:** derived from name (lowercase, spaces to hyphens, remove special characters)

**For Software:**

- **Required:** name, manufacturer (slug reference)
- **Recommended:**
  - primaryCategory (from CONTEXT.md categories)
  - platforms (from CONTEXT.md platforms section)
  - identifiers (plugin bundle IDs, e.g., `vst3: com.vendor.product.vst3`, `au: vendor: product`)
  - categories (additional categories from CONTEXT.md)
  - formats (from CONTEXT.md formats section)
- Reference `schema/CONTEXT.md` for valid categories - suggest relevant ones based on the software type
- **Optional:** website, description, prices, links, releaseDate, searchTerms
- **Filename:** derived from name (lowercase, spaces to hyphens, remove special characters)

**For Hardware:**

- **Required:** name, manufacturer (slug reference)
- **Recommended:**
  - primaryCategory (from CONTEXT.md categories)
  - description
  - categories (additional categories from CONTEXT.md)
- Reference `schema/CONTEXT.md` for valid categories - suggest relevant ones based on the hardware type
- **Optional:** website, prices, io (I/O ports), links, releaseDate, searchTerms
- **Filename:** derived from name (lowercase, spaces to hyphens, remove special characters)

### Phase 3: Validate Before Writing

Before creating any files, verify:

1. **Filename format:** Must be a valid slug (lowercase, hyphens, no leading/trailing hyphens) with .yaml extension
2. **Filename uniqueness:** Check that the file doesn't already exist in the target collection directory
3. **Manufacturer reference:** For software/hardware, verify the manufacturer slug (filename) resolves to an existing
   file in `data/manufacturers/` (or will be created in this batch)
4. **Category validation:** All categories must exist in `schema/CONTEXT.md` (either canonical or alias)
5. **Format validation:** All formats must be listed in `schema/CONTEXT.md`
6. **Platform validation:** All platforms must be listed in `schema/CONTEXT.md`

If any validation fails, report the issue and ask the user to correct it before proceeding.

### Phase 4: Generate YAML Files

Create the YAML file(s) in the appropriate `data/` subdirectory.

**Important rules:**

- Do NOT include an `id` field. IDs are assigned automatically by CI via the `assign-ids` workflow on PR creation.
- Do NOT include a `slug` field. Slugs are derived from the filename.
- Follow the field ordering convention observed in existing entries:
  - Manufacturer: name, companyName, parentCompany, website, description, searchTerms
  - Software: name, manufacturer, primaryCategory, categories, formats, platforms, identifiers, website,
    prices, description, details, specs, versions, links, translations
  - Hardware: name, manufacturer, primaryCategory, categories, website, prices, description, details, specs,
    io, versions, revisions, links, translations
- File name IS the slug: `data/{type}/{slug}.yaml`

After writing the file(s):

1. Run `pnpm format` to ensure Prettier-compliant YAML formatting
2. Run `pnpm validate` to verify the new entry passes all schema checks

If validation fails, fix the issues and re-validate.

### Phase 5: Post-Creation Summary

Present the results:

```text
## Entry Created

### Files
- data/manufacturers/xfer-records.yaml (new)
- data/software/serum.yaml (new)

### Validation
- pnpm format: PASS
- pnpm validate: PASS

### Next Steps
1. Review the generated YAML files and add any additional optional fields
2. Add description, links, prices, or other details as needed
3. Run `/ship` to validate and submit a PR

### Notes
- IDs will be assigned automatically when the PR is created
- Translations can be added later with inline `translations:` blocks
```

## Examples

**Adding a software plugin (filename: `serum.yaml`):**

```yaml
name: Serum
manufacturer: xfer-records
primaryCategory: synthesizer
categories:
  - plugin
  - wavetable
formats:
  - vst3
  - au
  - aax
platforms:
  - mac
  - windows
identifiers:
  vst3: com.xferrecords.Serum.vst3
website: https://xferrecords.com/products/serum
prices:
  - amount: 189
    currency: USD
description: Advanced wavetable synthesizer with visual and creative
  workflow-oriented interface. Features a wavetable editor, extensive modulation
  system, and built-in effects.
```

**Adding a manufacturer (filename: `xfer-records.yaml`):**

```yaml
name: Xfer Records
website: https://xferrecords.com
description: Developer of Serum wavetable synthesizer and other audio plugins.
```

**Adding hardware (filename: `digitakt.yaml`):**

```yaml
name: Digitakt
manufacturer: elektron
primaryCategory: sampler
categories:
  - drum-machine
prices:
  - amount: 599
    currency: USD
description: Eight-track digital drum machine and sampler with Elektron's
  signature sequencer.
```

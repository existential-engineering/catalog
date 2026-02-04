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

## Product Lineage

Use `supersedes` to link major product versions (e.g., Pro-Q 4 supersedes Pro-Q 3):

```yaml
# pro-q-4.yaml
name: Pro-Q 4
manufacturer: fabfilter
supersedes: pro-q-3
identifiers:
  au: com.fabfilter.Pro-Q.AU.4
```

The referenced slug must exist in the same collection (software or hardware). Validation will fail if the slug is not found.

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

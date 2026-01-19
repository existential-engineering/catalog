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
- `pnpm check-slugs` - Check for duplicate slugs

## Project Structure

- `data/` - YAML source files (manufacturers, software, hardware)
- `schema/` - Category, format, and platform definitions
- `scripts/` - Build and validation tools
- `dist/` - Built SQLite database output

## Conventions

- Slugs: lowercase with hyphens (e.g., `serum`, `massive-x`)
- All entries must pass `pnpm validate` before commit
- Use Prettier for YAML formatting
- Data follows strict schemas defined in `scripts/lib/types.ts`

## Data Entry Format

Manufacturers require: slug, name, website
Software requires: slug, name, manufacturer, primaryCategory, platforms, identifiers
Hardware requires: slug, name, manufacturer, primaryCategory, description

Optional fields: categories (array), website, description

## Translations

Translations are optional and added inline to YAML files using a `translations` key:

```yaml
slug: example
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

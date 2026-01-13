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
Software requires: slug, name, manufacturer, category, formats, platforms, identifiers
Hardware requires: slug, name, manufacturer, category, description

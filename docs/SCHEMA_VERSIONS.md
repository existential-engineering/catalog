# Schema Version History

This document tracks all schema changes to the catalog database.
Consumers can use this to understand compatibility and migration requirements.

## Checking Schema Version

Query the current schema version:

```sql
SELECT MAX(version) as schema_version FROM schema_migrations;
```

Check for breaking changes since a known version:

```sql
SELECT version, description
FROM schema_migrations
WHERE version > ? AND breaking_change = 1
ORDER BY version;
```

## Version History

### Version 23 (Current)

**Description:** Added nullable hp column to hardware for Eurorack panel width

**Breaking:** No

**Changes:**

- Added nullable `hp` column to `hardware`, carrying the YAML `hp` value: the
  panel width in Eurorack HP (1 HP = 5.08 mm) as a positive integer
- `NULL` where the entry declares none, which is every non-modular entry and
  a modular entry whose width has not been sourced
- Additive: a reader that selects columns by name never sees it, so
  `schema_version` in `catalog_meta` stays at 1

---

### Version 22

**Description:** Added optional term column to every prices table

**Breaking:** No

**Changes:**

- Added nullable `term` column to `software_prices`, `content_prices`,
  `hardware_prices`, `hardware_variant_prices` and `accessories_prices`
- Values are `perpetual`, `monthly`, `yearly` or `rent-to-own`, and `NULL`
  where the YAML entry declares no term
- Distinguishes several prices in one currency (a perpetual licence from a
  monthly plan), which the price shape previously could not express
- Additive: a reader that selects columns by name never sees it

---

### Version 21

**Description:** Added stable port_key column to hardware_io

**Breaking:** No

**Changes:**

- Added `port_key` column to `hardware_io`, carrying the YAML `io[].key`
- Unique per hardware entry (`idx_hardware_io_port_key`)
- Stable across rebuilds, so a consumer can reference a port by key

---

### Version 20

**Description:** Added search_terms column to all FTS5 tables; changed tokenizer from porter unicode61 to unicode61

**Breaking:** Yes

**Changes:**

- Added `search_terms` column to every FTS5 table
- Changed tokenizer from `porter unicode61` to `unicode61`

**Consumer Action Required:**

- Full database re-download required
- Re-check any query that relied on porter stemming

---

### Version 19

**Description:** Added content_hardware_compatibility table for content-to-hardware references

**Breaking:** No

**Changes:**

- Added `content_hardware_compatibility` table
  (`content_id`, `compatible_with_id`)

---

### Version 18

**Description:** Added manufacturers_fts FTS5 full-text search table

**Breaking:** No

**Changes:**

- Added `manufacturers_fts` virtual table for manufacturer full-text search

---

### Version 17

**Description:** Renamed hardware_revisions to hardware_variants; removed io/versions sub-tables

**Breaking:** Yes

**Changes:**

- Renamed `hardware_revisions` → `hardware_variants`
- Renamed `hardware_revision_prices` → `hardware_variant_prices`
- Renamed `hardware_revision_links` → `hardware_variant_links`
- Renamed `hardware_revision_videos` → `hardware_variant_videos`
- Removed `hardware_revision_io` table (variants are cosmetic-only, share parent I/O)
- Removed `hardware_revision_versions` table (variants share parent firmware versions)
- YAML field renamed from `revisions` to `variants`

**Consumer Action Required:**

- Full database re-download required
- Update any query naming a `hardware_revision*` table

---

### Version 16

**Description:** Renamed website column to url across all tables

**Breaking:** Yes

**Changes:**

- Renamed the `website` column to `url` on every table carrying one

**Consumer Action Required:**

- Full database re-download required
- Update any query selecting `website`

---

### Version 15

**Description:** Added content and accessories tables with related tables, FTS, and translations

**Breaking:** Yes

**Changes:**

- Added `content` and `accessories` tables with their categories, prices,
  links, videos, versions and search-term tables
- Added `content_fts` and `accessories_fts` full-text search tables
- Added translation tables for both collections

**Consumer Action Required:**

- Full database re-download required

---

### Version 14

**Description:** Added connector_detail column to hardware_io and hardware_revision_io

**Breaking:** No

**Changes:**

- Added `connector_detail` column, a JSON array
  (e.g. `["TS"]`, `["center-negative", "9V"]`)

---

### Version 13

**Description:** Separated video links into dedicated video tables

**Breaking:** Yes

**Changes:**

- Moved video links out of the links tables into dedicated video tables

**Consumer Action Required:**

- Full database re-download required
- Read videos from the video tables rather than filtering links

---

### Version 12

**Description:** Added slug column to hardware_revisions for stable identifiers

**Breaking:** No

**Changes:**

- Added `slug` column to `hardware_revisions` (now `hardware_variants`),
  unique per hardware entry

---

### Version 11

**Description:** Added supersedes_id column for product lineage tracking

**Breaking:** No

**Changes:**

- Added `supersedes_id` column to `software`, `content` and `hardware`,
  referencing the entry a product replaces

---

### Version 10

**Description:** Added schema_migrations table for version tracking

**Breaking:** No

**Changes:**

- Added `schema_migrations` table with version history
- Consumers can now programmatically check schema compatibility

---

### Version 9

**Description:** Migrated IDs from auto-increment integers to nanoid strings

**Breaking:** Yes

**Changes:**

- All `id` columns changed from `INTEGER` to `TEXT`
- IDs are now nanoid strings (e.g., `V1StGXR8_Z5jdHi6B-myT`)
- Foreign key references updated accordingly

**Consumer Action Required:**

- Full database re-download required
- Update any code that expects integer IDs
- Update any caches that store IDs

---

### Version 8

**Description:** Added hardware_io_translations table

**Breaking:** No

**Changes:**

- Added `hardware_io_translations` table for localized I/O port names
- Uses merge semantics with `original_name` to match ports

---

### Version 7

**Description:** Added hardware_revisions tables for hardware variants

**Breaking:** No

**Changes:**

- Added `hardware_revisions` table
- Added `hardware_revision_io` table
- Added `hardware_revision_versions` table
- Added `hardware_revision_prices` table
- Added `hardware_revision_links` table

---

### Version 6

**Description:** Added locales and translation tables

**Breaking:** No

**Changes:**

- Added `locales` table
- Added `manufacturer_translations` table
- Added `software_translations` table
- Added `hardware_translations` table
- Added `software_links_localized` table
- Added `hardware_links_localized` table

---

### Version 5

**Description:** Added prices and links tables for software and hardware

**Breaking:** No

**Changes:**

- Added `software_prices` table
- Added `software_links` table
- Added `hardware_prices` table
- Added `hardware_links` table

---

### Version 4

**Description:** Added hardware_io table for I/O port definitions

**Breaking:** No

**Changes:**

- Added `hardware_io` table with port metadata (signal_flow, type, connection, position)

---

### Version 3

**Description:** Added FTS5 full-text search for software and hardware

**Breaking:** No

**Changes:**

- Added `software_fts` virtual table (FTS5)
- Added `hardware_fts` virtual table (FTS5)
- Uses Porter stemming and unicode61 tokenizer

---

### Version 2

**Description:** Added software_categories many-to-many table

**Breaking:** No

**Changes:**

- Added `software_categories` table for multiple categories per software entry
- Added `hardware_categories` table for multiple categories per hardware entry

---

### Version 1

**Description:** Initial schema with manufacturers, software, hardware tables

**Breaking:** No (initial version)

**Changes:**

- Core `manufacturers` table
- Core `software` table with formats and platforms
- Core `hardware` table
- Search terms tables
- Basic metadata in `catalog_meta`

---

## Breaking Change Policy

A schema change is considered **breaking** if:

1. Column types change (e.g., INTEGER to TEXT)
2. Columns or tables are removed
3. Primary key structure changes
4. Required columns are added (without defaults)

Non-breaking changes include:

- Adding new tables
- Adding nullable columns
- Adding indexes
- Adding new values to existing enums

## Consumer Guidelines

### Handling Version Mismatches

```javascript
const db = new Database("catalog.sqlite");
const { schema_version } = db
  .prepare("SELECT MAX(version) as schema_version FROM schema_migrations")
  .get();

const REQUIRED_VERSION = 10;

if (schema_version < REQUIRED_VERSION) {
  console.log("Database schema is outdated. Please download the latest version.");
  // Offer to download new database
}
```

### Checking for Breaking Changes

```javascript
const LAST_KNOWN_VERSION = 9;

const breakingChanges = db
  .prepare(
    `
  SELECT version, description
  FROM schema_migrations
  WHERE version > ? AND breaking_change = 1
  ORDER BY version
`
  )
  .all(LAST_KNOWN_VERSION);

if (breakingChanges.length > 0) {
  console.log("Breaking changes detected:", breakingChanges);
  // Handle migration or re-download
}
```

## Getting Updates

The latest database is available from GitHub Releases:

```bash
curl -L -o catalog.sqlite \
  https://github.com/existential-engineering/catalog/releases/latest/download/catalog.sqlite
```

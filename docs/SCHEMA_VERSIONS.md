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

### Version 10 (Current)

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

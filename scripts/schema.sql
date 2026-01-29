-- Catalog SQLite Schema
-- This schema is used to generate the catalog database from YAML files

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Manufacturers / Companies
CREATE TABLE IF NOT EXISTS manufacturers (
    id TEXT PRIMARY KEY NOT NULL,     -- Nanoid string ID
    name TEXT NOT NULL,               -- Display name
    company_name TEXT,                -- Official company name (if different)
    parent_company_id TEXT REFERENCES manufacturers(id), -- Parent company ID
    website TEXT,                     -- Company website
    description TEXT,                 -- Description
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_manufacturers_name ON manufacturers(name);
CREATE INDEX idx_manufacturers_parent ON manufacturers(parent_company_id);

-- Manufacturer Search Terms
CREATE TABLE IF NOT EXISTS manufacturer_search_terms (
    manufacturer_id TEXT NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    PRIMARY KEY (manufacturer_id, term)
);

-- Software (Plugins, Standalone apps)
CREATE TABLE IF NOT EXISTS software (
    id TEXT PRIMARY KEY NOT NULL,     -- Nanoid string ID
    name TEXT NOT NULL,               -- Display name
    manufacturer_id TEXT REFERENCES manufacturers(id),
    website TEXT,                     -- Product page URL
    release_date TEXT,                -- Initial release date
    release_date_year_only INTEGER DEFAULT 0, -- If 1, only year is meaningful
    primary_category TEXT,            -- Primary category
    secondary_category TEXT,          -- Secondary category
    description TEXT,                 -- Short description
    details TEXT,                     -- Detailed description
    specs TEXT,                       -- Technical specifications
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_software_name ON software(name);
CREATE INDEX idx_software_manufacturer ON software(manufacturer_id);
CREATE INDEX idx_software_primary_category ON software(primary_category);

-- Software Categories (many-to-many)
CREATE TABLE IF NOT EXISTS software_categories (
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (software_id, category)
);

CREATE INDEX idx_software_categories_category ON software_categories(category);

-- Software Search Terms
CREATE TABLE IF NOT EXISTS software_search_terms (
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    PRIMARY KEY (software_id, term)
);

-- Software Formats (many-to-many with identifiers)
CREATE TABLE IF NOT EXISTS software_formats (
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    format TEXT NOT NULL,             -- au, vst3, aax, etc.
    identifier TEXT,                  -- Bundle ID for this format
    PRIMARY KEY (software_id, format)
);

CREATE INDEX idx_software_formats_format ON software_formats(format);

-- Software Platforms (many-to-many)
CREATE TABLE IF NOT EXISTS software_platforms (
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,           -- mac, windows, linux, ios, android
    PRIMARY KEY (software_id, platform)
);

-- Software Versions
CREATE TABLE IF NOT EXISTS software_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    name TEXT NOT NULL,               -- Version number (e.g., '1.2.3')
    release_date TEXT,
    release_date_year_only INTEGER DEFAULT 0,
    pre_release INTEGER DEFAULT 0,    -- Boolean
    unofficial INTEGER DEFAULT 0,     -- Boolean
    url TEXT,
    description TEXT
);

CREATE INDEX idx_software_versions_software ON software_versions(software_id);

-- Software Prices
CREATE TABLE IF NOT EXISTS software_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL
);

CREATE INDEX idx_software_prices_software ON software_prices(software_id);

-- Software Links
CREATE TABLE IF NOT EXISTS software_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    url TEXT,
    video_id TEXT,
    provider TEXT,
    description TEXT
);

CREATE INDEX idx_software_links_software ON software_links(software_id);

-- Hardware
CREATE TABLE IF NOT EXISTS hardware (
    id TEXT PRIMARY KEY NOT NULL,     -- Nanoid string ID
    name TEXT NOT NULL,
    manufacturer_id TEXT REFERENCES manufacturers(id),
    website TEXT,
    release_date TEXT,
    release_date_year_only INTEGER DEFAULT 0,
    primary_category TEXT,
    secondary_category TEXT,
    description TEXT,
    details TEXT,
    specs TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_hardware_name ON hardware(name);
CREATE INDEX idx_hardware_manufacturer ON hardware(manufacturer_id);
CREATE INDEX idx_hardware_primary_category ON hardware(primary_category);

-- Hardware Categories (many-to-many)
CREATE TABLE IF NOT EXISTS hardware_categories (
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (hardware_id, category)
);

CREATE INDEX idx_hardware_categories_category ON hardware_categories(category);

-- Hardware Search Terms
CREATE TABLE IF NOT EXISTS hardware_search_terms (
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    PRIMARY KEY (hardware_id, term)
);

-- Hardware I/O Ports
-- Note: (hardware_id, name) is NOT unique - devices can have multiple ports with same name
-- I/O translation validation is handled at build time in build-sqlite.ts
CREATE TABLE IF NOT EXISTS hardware_io (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    signal_flow TEXT NOT NULL,        -- input, output
    category TEXT NOT NULL,           -- audio, digital, midi, power
    type TEXT NOT NULL,
    connection TEXT NOT NULL,
    max_connections INTEGER DEFAULT 1,
    position TEXT,                    -- top, right, left, bottom
    column_position INTEGER,
    row_position INTEGER,
    description TEXT
);

CREATE INDEX idx_hardware_io_hardware ON hardware_io(hardware_id);

-- Hardware Versions (Firmware)
CREATE TABLE IF NOT EXISTS hardware_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    release_date TEXT,
    release_date_year_only INTEGER DEFAULT 0,
    pre_release INTEGER DEFAULT 0,
    unofficial INTEGER DEFAULT 0,
    url TEXT,
    description TEXT
);

CREATE INDEX idx_hardware_versions_hardware ON hardware_versions(hardware_id);

-- Hardware Revisions
CREATE TABLE IF NOT EXISTS hardware_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    release_date TEXT,
    release_date_year_only INTEGER DEFAULT 0,
    url TEXT,
    description TEXT
);

CREATE INDEX idx_hardware_revisions_hardware ON hardware_revisions(hardware_id);

-- Hardware Revision I/O (if different from main hardware)
CREATE TABLE IF NOT EXISTS hardware_revision_io (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revision_id INTEGER NOT NULL REFERENCES hardware_revisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    signal_flow TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    connection TEXT NOT NULL,
    max_connections INTEGER DEFAULT 1,
    position TEXT,
    column_position INTEGER,
    row_position INTEGER,
    description TEXT
);

CREATE INDEX idx_hardware_revision_io_revision ON hardware_revision_io(revision_id);

-- Hardware Revision Versions
CREATE TABLE IF NOT EXISTS hardware_revision_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revision_id INTEGER NOT NULL REFERENCES hardware_revisions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    release_date TEXT,
    release_date_year_only INTEGER DEFAULT 0,
    pre_release INTEGER DEFAULT 0,
    unofficial INTEGER DEFAULT 0,
    url TEXT,
    description TEXT
);

CREATE INDEX idx_hardware_revision_versions_revision ON hardware_revision_versions(revision_id);

-- Hardware Prices
CREATE TABLE IF NOT EXISTS hardware_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL
);

CREATE INDEX idx_hardware_prices_hardware ON hardware_prices(hardware_id);

-- Hardware Revision Prices
CREATE TABLE IF NOT EXISTS hardware_revision_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revision_id INTEGER NOT NULL REFERENCES hardware_revisions(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL
);

CREATE INDEX idx_hardware_revision_prices_revision ON hardware_revision_prices(revision_id);

-- Hardware Links
CREATE TABLE IF NOT EXISTS hardware_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    url TEXT,
    video_id TEXT,
    provider TEXT,
    description TEXT
);

CREATE INDEX idx_hardware_links_hardware ON hardware_links(hardware_id);

-- Hardware Revision Links
CREATE TABLE IF NOT EXISTS hardware_revision_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revision_id INTEGER NOT NULL REFERENCES hardware_revisions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    url TEXT,
    video_id TEXT,
    provider TEXT,
    description TEXT
);

CREATE INDEX idx_hardware_revision_links_revision ON hardware_revision_links(revision_id);

-- =============================================================================
-- LOCALIZATION / TRANSLATIONS
-- =============================================================================

-- Supported locales registry
CREATE TABLE IF NOT EXISTS locales (
    code TEXT PRIMARY KEY,          -- ISO 639-1 code (e.g., 'de', 'ja')
    name TEXT NOT NULL,             -- English name (e.g., 'German')
    native_name TEXT,               -- Native name (e.g., 'Deutsch')
    enabled INTEGER DEFAULT 1       -- Whether locale is active
);

-- Category translations
CREATE TABLE IF NOT EXISTS category_translations (
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    category_key TEXT NOT NULL,     -- e.g., 'synthesizer', 'compressor'
    translated_name TEXT NOT NULL,
    PRIMARY KEY (locale, category_key)
);

-- Manufacturer translations
CREATE TABLE IF NOT EXISTS manufacturer_translations (
    manufacturer_id TEXT NOT NULL REFERENCES manufacturers(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    description TEXT,               -- Translated description (HTML)
    website TEXT,                   -- Locale-specific website URL
    PRIMARY KEY (manufacturer_id, locale)
);

-- Software translations
CREATE TABLE IF NOT EXISTS software_translations (
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    description TEXT,               -- Translated short description (HTML)
    details TEXT,                   -- Translated detailed description (HTML)
    specs TEXT,                     -- Translated specifications (HTML)
    website TEXT,                   -- Locale-specific website URL
    PRIMARY KEY (software_id, locale)
);

CREATE INDEX idx_software_translations_locale ON software_translations(locale);

-- Hardware translations
CREATE TABLE IF NOT EXISTS hardware_translations (
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    description TEXT,               -- Translated short description (HTML)
    details TEXT,                   -- Translated detailed description (HTML)
    specs TEXT,                     -- Translated specifications (HTML)
    website TEXT,                   -- Locale-specific website URL
    PRIMARY KEY (hardware_id, locale)
);

CREATE INDEX idx_hardware_translations_locale ON hardware_translations(locale);

-- Localized software links (videos, purchase, affiliate, docs per locale)
CREATE TABLE IF NOT EXISTS software_links_localized (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    type TEXT NOT NULL,             -- video, documentation, purchase, etc.
    title TEXT,
    url TEXT,
    video_id TEXT,
    provider TEXT,
    description TEXT
);

CREATE INDEX idx_software_links_localized ON software_links_localized(software_id, locale);

-- Localized hardware links
CREATE TABLE IF NOT EXISTS hardware_links_localized (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    url TEXT,
    video_id TEXT,
    provider TEXT,
    description TEXT
);

CREATE INDEX idx_hardware_links_localized ON hardware_links_localized(hardware_id, locale);

-- Hardware I/O translations (MERGE semantics - only translates name/description)
-- Technical fields (signalFlow, type, connection, position) come from hardware_io
-- Note: No FK to hardware_io because (hardware_id, name) is not unique
-- Validation is handled at build time in build-sqlite.ts
CREATE TABLE IF NOT EXISTS hardware_io_translations (
    hardware_id TEXT NOT NULL REFERENCES hardware(id) ON DELETE CASCADE,
    locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
    original_name TEXT NOT NULL,    -- Matches hardware_io.name for merging
    translated_name TEXT,
    translated_description TEXT,
    PRIMARY KEY (hardware_id, locale, original_name)
);

CREATE INDEX idx_hardware_io_translations ON hardware_io_translations(hardware_id, locale);

-- =============================================================================
-- FULL-TEXT SEARCH
-- =============================================================================

-- Software FTS index
-- Note: Not using content='' (contentless mode) because we need to retrieve
-- the id column to join back to the software table for full results
CREATE VIRTUAL TABLE IF NOT EXISTS software_fts USING fts5(
    id,
    name,
    manufacturer_name,
    categories,
    description,
    tokenize='porter unicode61'
);

-- Hardware FTS index
-- Note: Not using content='' (contentless mode) because we need to retrieve
-- the id column to join back to the hardware table for full results
CREATE VIRTUAL TABLE IF NOT EXISTS hardware_fts USING fts5(
    id,
    name,
    manufacturer_name,
    categories,
    description,
    tokenize='porter unicode61'
);

-- =============================================================================
-- METADATA
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalog_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Schema migrations table for version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    breaking_change INTEGER DEFAULT 0,
    applied_at TEXT DEFAULT (datetime('now'))
);

-- Insert schema migration history
INSERT OR REPLACE INTO schema_migrations (version, description, breaking_change) VALUES
    (1, 'Initial schema with manufacturers, software, hardware tables', 0),
    (2, 'Added software_categories many-to-many table', 0),
    (3, 'Added FTS5 full-text search for software and hardware', 0),
    (4, 'Added hardware_io table for I/O port definitions', 0),
    (5, 'Added prices and links tables for software and hardware', 0),
    (6, 'Added locales and translation tables', 0),
    (7, 'Added hardware_revisions tables for hardware variants', 0),
    (8, 'Added hardware_io_translations table', 0),
    (9, 'Migrated IDs from auto-increment integers to nanoid strings', 1),
    (10, 'Added schema_migrations table for version tracking', 0);

-- Insert initial metadata (version comes from build script)
INSERT OR REPLACE INTO catalog_meta (key, value) VALUES
    ('version', '1'),
    ('created_at', datetime('now')),
    ('updated_at', datetime('now'));



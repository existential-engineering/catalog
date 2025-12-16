-- Catalog SQLite Schema
-- This schema is used to generate the catalog database from YAML files

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Manufacturers / Companies
CREATE TABLE IF NOT EXISTS manufacturers (
    id TEXT PRIMARY KEY,              -- slug (e.g., 'xfer-records')
    name TEXT NOT NULL,               -- Display name
    website TEXT,                     -- Company website
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_manufacturers_name ON manufacturers(name);

-- Software (Plugins, Standalone apps)
CREATE TABLE IF NOT EXISTS software (
    id TEXT PRIMARY KEY,              -- slug (e.g., 'serum')
    name TEXT NOT NULL,               -- Display name
    manufacturer_id TEXT REFERENCES manufacturers(id),
    type TEXT NOT NULL,               -- plugin, standalone, suite
    website TEXT,                     -- Product page URL
    description TEXT,                 -- Short description
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_software_name ON software(name);
CREATE INDEX idx_software_manufacturer ON software(manufacturer_id);
CREATE INDEX idx_software_type ON software(type);

-- Software Categories (many-to-many)
CREATE TABLE IF NOT EXISTS software_categories (
    software_id TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (software_id, category)
);

CREATE INDEX idx_software_categories_category ON software_categories(category);

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
    platform TEXT NOT NULL,           -- darwin, win32, linux
    PRIMARY KEY (software_id, platform)
);

-- DAWs (Digital Audio Workstations)
CREATE TABLE IF NOT EXISTS daws (
    id TEXT PRIMARY KEY,              -- slug (e.g., 'ableton-live')
    name TEXT NOT NULL,               -- Display name
    manufacturer_id TEXT REFERENCES manufacturers(id),
    bundle_identifier TEXT,           -- macOS bundle ID
    website TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_daws_name ON daws(name);
CREATE INDEX idx_daws_bundle_identifier ON daws(bundle_identifier);

-- DAW Platforms
CREATE TABLE IF NOT EXISTS daw_platforms (
    daw_id TEXT NOT NULL REFERENCES daws(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    PRIMARY KEY (daw_id, platform)
);

-- Hardware (future use)
CREATE TABLE IF NOT EXISTS hardware (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manufacturer_id TEXT REFERENCES manufacturers(id),
    type TEXT,                        -- interface, controller, synth, etc.
    website TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_hardware_name ON hardware(name);
CREATE INDEX idx_hardware_manufacturer ON hardware(manufacturer_id);

-- =============================================================================
-- FULL-TEXT SEARCH
-- =============================================================================

-- Software FTS index
CREATE VIRTUAL TABLE IF NOT EXISTS software_fts USING fts5(
    id,
    name,
    manufacturer_name,
    categories,
    content='',                       -- External content mode
    tokenize='porter unicode61'
);

-- DAW FTS index  
CREATE VIRTUAL TABLE IF NOT EXISTS daws_fts USING fts5(
    id,
    name,
    manufacturer_name,
    content='',
    tokenize='porter unicode61'
);

-- =============================================================================
-- METADATA
-- =============================================================================

CREATE TABLE IF NOT EXISTS catalog_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert initial metadata
INSERT OR REPLACE INTO catalog_meta (key, value) VALUES 
    ('version', '1'),
    ('schema_version', '1'),
    ('created_at', datetime('now')),
    ('updated_at', datetime('now'));


PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS cpami_data_templates (
    template_id     TEXT PRIMARY KEY,
    template_version TEXT NOT NULL DEFAULT '1',
    schema_version  TEXT NOT NULL,
    template_kind   TEXT NOT NULL,
    name            TEXT NOT NULL COLLATE NOCASE,
    source_table    TEXT NOT NULL,
    fields_json     TEXT NOT NULL,
    is_default      INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cpami_templates_active_name
    ON cpami_data_templates (template_kind, name)
    WHERE is_active = 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cpami_templates_one_default
    ON cpami_data_templates (template_kind)
    WHERE is_active = 1 AND is_default = 1;

CREATE INDEX IF NOT EXISTS idx_cpami_templates_kind_active
    ON cpami_data_templates (template_kind, is_active, name);

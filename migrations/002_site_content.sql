-- Adds the tables that make the rest of the site editable.
--   npx wrangler d1 execute web3ashley --remote --file=./migrations/002_site_content.sql
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  collection  TEXT NOT NULL,
  slug        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published'
              CHECK (status IN ('draft', 'review', 'published')),
  data        TEXT NOT NULL DEFAULT '{}',
  author      TEXT NOT NULL DEFAULT '',
  last_editor TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (collection, slug)
);
CREATE INDEX IF NOT EXISTS idx_entries_render
  ON entries (collection, status, position);

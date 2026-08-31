-- 003 — image dimensions, image alt text, and revision history.
--
--   npx wrangler d1 execute web3ashley --remote --file=./migrations/003_media_and_history.sql
--
-- Only needed for a database created before these existed. The studio's
-- Set up button applies the same changes, so on a deployment managed from
-- the dashboard there is nothing to run here.

-- Measured in the browser before upload and written into every <img>, so a
-- page reserves the space instead of reflowing as each image arrives.
ALTER TABLE media ADD COLUMN width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN height INTEGER NOT NULL DEFAULT 0;

-- Described once, at upload, rather than retyped at each use.
ALTER TABLE media ADD COLUMN alt TEXT NOT NULL DEFAULT '';

-- One row per save, holding what the thing looked like before it.
CREATE TABLE IF NOT EXISTS revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('article', 'entry')),
  ref        TEXT NOT NULL,                     -- slug, or 'collection/slug'
  data       TEXT NOT NULL DEFAULT '{}',
  editor     TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_ref
  ON revisions (kind, ref, id DESC);

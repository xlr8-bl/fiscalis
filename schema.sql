-- D1 schema for the journal.
--
--   npx wrangler d1 create web3ashley
--   npx wrangler d1 execute web3ashley --remote --file=./schema.sql
--
-- Articles are rows rather than objects in R2 because every page the site
-- renders is a query: newest first, published only, by slug, by tag. Object
-- storage answers those by listing the bucket and opening every object.

CREATE TABLE IF NOT EXISTS articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',        -- markdown
  tags          TEXT NOT NULL DEFAULT '',        -- comma separated
  -- draft:    only visible in the studio
  -- review:   written by the agent, waiting on a person
  -- published: live, in the sitemap and the feed
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'review', 'published')),
  source        TEXT NOT NULL DEFAULT 'studio'   -- 'studio' | 'spark' | 'import'
                CHECK (source IN ('studio', 'spark', 'import')),
  published_at  TEXT,                            -- YYYY-MM-DD, set on publish
  author        TEXT NOT NULL DEFAULT '',       -- who created it
  last_editor   TEXT NOT NULL DEFAULT '',       -- who saved it last
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- the index page's query: published, newest first
CREATE INDEX IF NOT EXISTS idx_articles_live
  ON articles (status, published_at DESC);

-- the studio's queue
CREATE INDEX IF NOT EXISTS idx_articles_status
  ON articles (status, updated_at DESC);

-- Uploaded images. The bytes live in R2; this is what the studio lists.
CREATE TABLE IF NOT EXISTS media (
  key          TEXT PRIMARY KEY,                 -- the R2 object key
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes        INTEGER NOT NULL DEFAULT 0,
  -- Measured in the browser before upload, which is the only place the
  -- pixels are already decoded. Written into every <img> so a page
  -- reserves the space instead of reflowing as each image arrives.
  width        INTEGER NOT NULL DEFAULT 0,
  height       INTEGER NOT NULL DEFAULT 0,
  -- Written once here rather than retyped at each use.
  alt          TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ==================================================================
-- History.
--
-- One row per save, of an article or an entry, holding what the thing
-- looked like *before* that save. An agent writes into the same store
-- a person does; being able to read back and restore is what makes
-- that safe rather than merely convenient.
-- ==================================================================
CREATE TABLE IF NOT EXISTS revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('article', 'entry')),
  -- 'article' -> the slug; 'entry' -> 'collection/slug'
  ref        TEXT NOT NULL,
  data       TEXT NOT NULL DEFAULT '{}',        -- JSON of the previous state
  editor     TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',          -- 'saved', 'published', 'restored'…
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- the history panel's query: one thing, newest first
CREATE INDEX IF NOT EXISTS idx_revisions_ref
  ON revisions (kind, ref, id DESC);


-- ==================================================================
-- Everything else on the site.
--
-- Two tables rather than one per content type. A new type — case
-- studies, testimonials, whatever comes next — is a definition in
-- lib/collections.js, not a migration.
-- ==================================================================

-- Single values: hero copy, the contact email, the socials, SEO defaults.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT NOT NULL DEFAULT ''
);

-- Repeating things: projects, services, process steps, FAQs.
-- `data` is JSON shaped by the collection's field definitions.
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

-- the render query: one collection, in order
CREATE INDEX IF NOT EXISTS idx_entries_render
  ON entries (collection, status, position);


-- ==================================================================
-- Columns added after the first release.
--
-- A database created from the CREATE statements above already has
-- these, so each of these raises "duplicate column" there. Setup
-- expects that and moves on; the point of running them is the
-- databases that predate the column.
-- ==================================================================
ALTER TABLE media ADD COLUMN width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN height INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN alt TEXT NOT NULL DEFAULT '';

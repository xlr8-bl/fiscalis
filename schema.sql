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
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

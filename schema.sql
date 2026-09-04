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
-- The social pipeline.
--
-- Gemini Spark researches, plans five carousels a day and generates
-- their slides; a person here approves them; a scheduler posts them.
-- These four tables are the whole handover, which is the point — the
-- staging folder and the review email are replaced by rows a person
-- can see in the studio and an agent can read back over its token.
--
-- None of this is public. Nothing here is rendered by any site route.
-- ==================================================================

-- The buckets a day's five carousels are spread across.
CREATE TABLE IF NOT EXISTS pillars (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  brief      TEXT NOT NULL DEFAULT '',      -- what to aim at, in your words
  position   INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The brand kit: the reference images the image model is given.
-- 'likeness' is you, 'aesthetic' is the look. The bytes are in R2 and
-- the row in `media`; this only says which ones are references and why.
CREATE TABLE IF NOT EXISTS brand_refs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key  TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('likeness', 'aesthetic')),
  position   INTEGER NOT NULL DEFAULT 0,
  note       TEXT NOT NULL DEFAULT '',      -- what this one is for
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brand_refs_role
  ON brand_refs (active, role, position);

-- One carousel: a day's post for one pillar.
CREATE TABLE IF NOT EXISTS carousels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  pillar        TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',   -- what to call it in here
  topic         TEXT NOT NULL DEFAULT '',   -- what was researched
  research      TEXT NOT NULL DEFAULT '',   -- JSON: sources, why this, why now
  -- The seed the whole set's designs were chosen from. Kept so a set
  -- can be re-rolled by changing one number, and so the same spec
  -- redrawn later comes back identical.
  design_seed   INTEGER NOT NULL DEFAULT 0,
  caption       TEXT NOT NULL DEFAULT '',
  hashtags      TEXT NOT NULL DEFAULT '',
  -- planned:    filed, no images yet
  -- generating: the slides are being made
  -- review:     everything rendered and self-checked, waiting on a person
  -- changes:    a person asked for particular slides again
  -- approved:   cleared to post, no slot yet
  -- scheduled:  a slot is claimed
  -- posted:     it went out
  -- rejected:   killed by a person; kept so the agent stops re-proposing it
  status        TEXT NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'generating', 'review', 'changes',
                                  'approved', 'scheduled', 'posted', 'rejected')),
  -- which of the five slots, and when it goes
  slot          INTEGER,
  scheduled_for TEXT,                       -- ISO 8601, UTC
  -- TikTok alone by default, because it is the one that is connected.
  -- Instagram is added per carousel, or here, once it is. Facebook is not
  -- posted to at all: its multi-photo shape was never verified, and a
  -- target that is always skipped is noise in every result.
  targets       TEXT NOT NULL DEFAULT 'tiktok',
  feedback      TEXT NOT NULL DEFAULT '',   -- a note to the agent about the whole thing
  qc            TEXT NOT NULL DEFAULT '',   -- JSON: the agent's own check
  posted_at     TEXT,
  results       TEXT NOT NULL DEFAULT '',   -- JSON: per-platform id or error
  author        TEXT NOT NULL DEFAULT '',
  last_editor   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- the review queue, and the scheduler's "what is due"
CREATE INDEX IF NOT EXISTS idx_carousels_status
  ON carousels (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_carousels_due
  ON carousels (status, scheduled_for);

-- The slides, in order. A slide is the unit of feedback: asking for one
-- again must not cost the other nine.
CREATE TABLE IF NOT EXISTS slides (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  carousel_id INTEGER NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  kind        TEXT NOT NULL DEFAULT 'slide'
              CHECK (kind IN ('hook', 'slide', 'cta')),
  copy        TEXT NOT NULL DEFAULT '',     -- the type set into the image
  prompt      TEXT NOT NULL DEFAULT '',     -- what the image model was given
  media_key   TEXT NOT NULL DEFAULT '',     -- the master in R2
  -- The drawn picture before the copy was set over it. Only the free
  -- path fills this: Workers AI draws a wordless background and the
  -- studio typesets it into media_key. Kept rather than discarded so
  -- the type can be reset without paying to redraw the picture.
  ground_key  TEXT NOT NULL DEFAULT '',
  -- The generator's spec for this panel: the words, and the device,
  -- ground and seed chosen for it. Separate from `prompt` because a
  -- slide is drawn either by an image model from a prompt or by the
  -- generator from a design, never both.
  design      TEXT NOT NULL DEFAULT '',
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  -- pending: planned, not generated
  -- ready:   generated and self-checked
  -- redo:    a person asked for this one again
  -- failed:  generation or the check failed
  state       TEXT NOT NULL DEFAULT 'pending'
              CHECK (state IN ('pending', 'ready', 'redo', 'failed')),
  note        TEXT NOT NULL DEFAULT '',     -- why it is being asked for again
  qc          TEXT NOT NULL DEFAULT '',     -- JSON: the agent's own check
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (carousel_id, position)
);

CREATE INDEX IF NOT EXISTS idx_slides_carousel
  ON slides (carousel_id, position);

-- what the agent asks for on every poll: which slides need work
CREATE INDEX IF NOT EXISTS idx_slides_state
  ON slides (state, carousel_id);


-- ==================================================================
-- OAuth authorization codes.
--
-- Gemini Spark connects over MCP, and the MCP authorization spec is
-- OAuth 2.1 — a static bearer token is not a path the client offers.
-- An authorization code has to be single use, and a signed stateless
-- code can be replayed inside its own lifetime, so they are rows that
-- get deleted the moment they are exchanged.
--
-- Short lived by design. Anything older than its expiry is swept on the
-- next exchange rather than by a job.
-- ==================================================================
CREATE TABLE IF NOT EXISTS oauth_codes (
  code           TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  redirect_uri   TEXT NOT NULL,
  -- PKCE, which OAuth 2.1 requires rather than merely allows
  code_challenge TEXT NOT NULL,
  method         TEXT NOT NULL DEFAULT 'S256',
  -- RFC 8707: the token is bound to the resource it was asked for, so a
  -- token minted for this server cannot be replayed at another
  resource       TEXT NOT NULL DEFAULT '',
  scope          TEXT NOT NULL DEFAULT '',
  subject        TEXT NOT NULL DEFAULT '',
  expires_at     INTEGER NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expiry
  ON oauth_codes (expires_at);


-- ==================================================================
-- What happened after it went out.
--
-- One row per carousel per platform. The counters are NULLABLE on
-- purpose: "nobody liked it" and "the account is not allowed to read
-- likes" are different facts, and writing 0 for the second is a lie
-- that reads as a fact. Null means not known; the note says why.
--
-- `post_id` is not always what the posting call returned. Instagram
-- hands back the media id and that is the thing to query. TikTok hands
-- back a publish_id, which is a receipt for the upload, not a post —
-- the real id only appears once the post is public and has cleared
-- moderation, so it is looked up later and written here.
-- ==================================================================
CREATE TABLE IF NOT EXISTS post_stats (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  carousel_id INTEGER NOT NULL,
  platform    TEXT NOT NULL,
  post_id     TEXT NOT NULL DEFAULT '',
  permalink   TEXT NOT NULL DEFAULT '',
  likes       INTEGER,
  comments    INTEGER,
  shares      INTEGER,
  saves       INTEGER,
  views       INTEGER,
  reach       INTEGER,
  -- ok:          the numbers below were read from the platform
  -- pending:     the post exists but the platform has nothing to give yet
  -- unavailable: it cannot be read at all, and `note` says what is missing
  state       TEXT NOT NULL DEFAULT 'ok'
              CHECK (state IN ('ok', 'pending', 'unavailable')),
  note        TEXT NOT NULL DEFAULT '',
  extra       TEXT NOT NULL DEFAULT '',   -- JSON: whatever else came back
  checked_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (carousel_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_post_stats_checked
  ON post_stats (checked_at);


-- ==================================================================
-- Intro call requests.
--
-- /api/book used to deliver by email if RESEND_API_KEY was set, write
-- to a KV namespace if one was bound, and otherwise console.log the
-- request and return 200. With neither configured — which is the
-- state this site shipped in — every enquiry was logged to a stream
-- nobody reads and then discarded, while the visitor was told it had
-- been sent.
--
-- D1 is already bound, so the request lands here first and delivery
-- becomes the second step rather than the only one. An email that
-- bounces, a Resend key that expires, a KV namespace nobody created:
-- none of them lose the enquiry now.
-- ==================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  message      TEXT NOT NULL DEFAULT '',
  duration     TEXT NOT NULL DEFAULT '',
  wanted_date  TEXT NOT NULL DEFAULT '',   -- YYYY-MM-DD, the day they asked for
  slots        TEXT NOT NULL DEFAULT '',   -- comma separated, GMT+1
  country      TEXT NOT NULL DEFAULT '',   -- cf-ipcountry, for the timezone
  referrer     TEXT NOT NULL DEFAULT '',   -- which page sent them
  -- new:      nobody has looked at it
  -- read:     seen, not answered
  -- replied:  answered
  -- booked:   the call is in the diary
  -- closed:   nothing came of it
  state        TEXT NOT NULL DEFAULT 'new'
               CHECK (state IN ('new', 'read', 'replied', 'booked', 'closed')),
  note         TEXT NOT NULL DEFAULT '',   -- yours, not theirs
  delivered    TEXT NOT NULL DEFAULT '',   -- 'email' | 'stored' | 'failed: …'
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_state
  ON bookings (state, created_at DESC);


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
ALTER TABLE slides ADD COLUMN design TEXT NOT NULL DEFAULT '';
ALTER TABLE carousels ADD COLUMN design_seed INTEGER NOT NULL DEFAULT 0;

-- The article's own photograph: the card in the journal, the picture at
-- the top of the piece, and the link preview, all from one file.
--
-- Empty means "use the cover drawn from the headline", which is what
-- every article shipped with. A photograph is better and this is where
-- it goes.
ALTER TABLE articles ADD COLUMN cover TEXT NOT NULL DEFAULT '';

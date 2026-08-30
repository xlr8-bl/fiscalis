# The journal

Articles live in a **D1 database** and are rendered on request by a Worker.
There is no build step and nothing to commit — you write in the studio and
press Publish.

```
/studio.html                 write, edit, publish
functions/journal/*          renders /journal/ and /journal/:slug from D1
functions/api/studio/*       the API behind the studio and the agent
lib/                         queries, templates, auth
assets/js/markdown.js        the parser, shared by the Worker and the studio
schema.sql                   the D1 schema
content/articles/*.md        the original articles, kept as the import record
tools/seed_d1.py             imports those into D1 (once)
tools/draft_article.py       drafts a topic with Gemini into the review queue
```

## Setup, once

```bash
# 1. the database
npx wrangler d1 create web3ashley
#    paste the id it prints into wrangler.toml
npx wrangler d1 execute web3ashley --remote --file=./schema.sql

# 2. images
npx wrangler r2 bucket create web3ashley-media

# 3. secrets
npx wrangler pages secret put STUDIO_PASSWORD   # signs you into /studio
npx wrangler pages secret put SESSION_SECRET    # any long random string
npx wrangler pages secret put AGENT_TOKEN       # for Gemini Spark

# 4. bring the existing articles across
python3 tools/seed_d1.py > seed.sql
npx wrangler d1 execute web3ashley --remote --file=./seed.sql
rm seed.sql
```

`seed_d1.py` skips any slug already present, so running it twice is safe and
never overwrites something you edited.

## Writing

Go to `/studio.html`, sign in with `STUDIO_PASSWORD`.

- **New article** → title, description, body. The description is the sentence
  Google prints under the title in a search result, so write it for a stranger.
- **Preview** renders through the same parser the live page uses.
- **Save** keeps it as a draft. **Publish** puts it live, adds it to
  `sitemap.xml` and `feed.xml`, and clears the edge cache so it appears at once.
- **View** opens the real page. A draft is viewable at
  `/journal/<slug>?preview=<STUDIO_PASSWORD>` and is marked `noindex`.

The body takes Markdown: `##` headings (each becomes a section row),
`**bold**`, `*italic*`, `` `code` ``, `[links](https://example.com)`, lists,
and one `>` quote per article for the line worth repeating.

**A published URL is permanent.** The studio locks the slug once an article is
live, because renaming it throws away whatever ranking it earned.

## Drafting with Gemini

```bash
export GEMINI_API_KEY=...        # https://aistudio.google.com/apikey
export AGENT_TOKEN=...           # the same value as the Pages secret
export STUDIO_URL=https://web3ashley.com
python3 tools/draft_article.py               # next queued topic
python3 tools/draft_article.py "some topic"  # a specific one
```

The draft lands in the studio with status **review** — visible to you, not on
the site. `.github/workflows/draft-article.yml` runs the same thing every
Monday.

### Wiring it to Gemini Spark

Spark connects to a custom app by MCP server URL, so an MCP server in front of
these endpoints is all it needs:

| Endpoint | Method | What it does |
| --- | --- | --- |
| `/api/studio/articles` | GET | list everything, with status |
| `/api/studio/articles` | POST | create a draft (`{title, description, body, tags}`) |
| `/api/studio/articles/:slug` | GET | read one |
| `/api/studio/articles/:slug` | PUT | edit one it created |

Authenticate with `Authorization: Bearer $AGENT_TOKEN`.

**The token cannot publish, delete, or touch anything already live.** The API
refuses those with a 403 regardless of what it is asked. That ceiling is the
point: an agent that researches the open web can be instructed by anything it
reads, so the limit has to be what its credential is allowed to do, not what it
can be talked into wanting.

## Why there is a review step

Google's spam policy on **scaled content abuse** (March 2024) targets
publishing generated pages at volume without human oversight, and enforcement
is site-wide rather than per-page. One bad automated run can sink the rankings
of the pages you wrote yourself.

Ten articles that answer a real question outrank a hundred restating the same
advice.

## Backups

```bash
npx wrangler d1 export web3ashley --remote --output=journal-backup.sql
```

Worth doing before anything unusual. D1 is the only copy once you start editing
in the studio — `content/articles/` is the import record, not a live mirror.

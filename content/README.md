# The content

Everything on the site lives in a **D1 database** and is filled in on request
by a Worker. There is no build step and nothing to commit — you edit in the
studio and it is live.

`/studio.html` has two halves:

- **Journal** — the articles.
- **The site** — the work cards, services, process stages, FAQs,
  testimonials, and the copy and settings on the home page.

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
lib/collections.js           the content model — what the site is made of
tools/seed_content.py        imports the home page's current content (once)
functions/index.js           fills the home page's slots from D1
```

## How the home page works

`index.html` is still the page. The slots in it carry `data-cms` attributes,
and the Worker fills them on the way out:

```html
<h2 data-cms="projects.0.title">The eleven second booking page</h2>
```

Two things follow. **The design cannot drift** — no layout lives in the
Worker, so a content edit cannot break the page. And **it degrades to the
file**: a slot with nothing in the database keeps whatever the markup already
says, so the site is correct before anything is seeded and correct again if D1
is unreachable.

Repeating sections mark one row as the pattern:

```html
<div data-cms-list="projects">
  <!--cms:item-->  …one full card, with data-cms="projects.0.*"…  <!--/cms:item-->
  …the other cards, which are the fallback…
</div>
```

The block is copied once per entry with its keys renumbered. Adding a sixth
project in the studio puts a sixth card on the page with no code change.

### Adding a content type

Add it to `lib/collections.js` and put a `data-cms-list` in the markup. The
studio builds its forms from that file, so a new type appears with no
front-end work and no migration.

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

# 4. bring the existing content across
python3 tools/seed_d1.py > seed.sql          # the articles
python3 tools/seed_content.py >> seed.sql    # the home page
npx wrangler d1 execute web3ashley --remote --file=./seed.sql
rm seed.sql
```

Both seeds skip anything already present, so running them twice is safe and
never overwrites something you edited. `seed_content.py` reads the current
`index.html`, so the database starts by saying exactly what the page already
says — nothing looks different, it just becomes editable.

If your database predates this, add the tables first:

```bash
npx wrangler d1 execute web3ashley --remote --file=./migrations/002_site_content.sql
```

## Writing

Go to `/studio.html` and sign in.

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

## Accounts

One person needs nothing beyond `STUDIO_PASSWORD` — the account is called
`studio` and the name field can be left blank.

For a team, set `STUDIO_USERS` instead: a JSON object of name to password.

```bash
npx wrangler pages secret put STUDIO_USERS
# {"ashley":"…","sam":"…"}
```

Adding a colleague is one secret, not a migration. Every article records who
wrote it and who saved it last, and both show in the studio, so you can see at
a glance whose draft is whose.

If you created the database before this existed, add the two columns:

```bash
npx wrangler d1 execute web3ashley --remote --file=./migrations/001_authors.sql
```

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
| `/api/studio/content/schema` | GET | the whole content model |
| `/api/studio/content/:collection` | GET | list projects, services, FAQs… |
| `/api/studio/content/:collection` | POST | add one — arrives hidden |
| `/api/studio/content/:collection/:slug` | PUT | edit one that is not live |
| `/api/studio/content/settings` | GET | read the site settings |

Authenticate with `Authorization: Bearer $AGENT_TOKEN`.

So "we just finished a new project, add it" is one POST, and it waits in the
studio until you show it.

**The token cannot publish, delete, reorder, change settings, or touch
anything already live.** The API
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

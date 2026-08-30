# The journal

Articles are Markdown in `content/articles/`. One file per article, front
matter at the top, and a build step that turns them into pages.

```
content/articles/*.md    the articles
content/drafts/*.md      Gemini output, not published
content/topics.md        the queue
tools/build_journal.py   articles  ->  /journal/, sitemap.xml, feed.xml
tools/draft_article.py   topic     ->  content/drafts/
```

## Writing one by hand

Create `content/articles/some-slug.md`:

```markdown
---
title: The headline, under 70 characters
description: One sentence under 160 characters. Shows in search results.
date: 2026-08-30
tags: [speed, mobile]
---

Open with the reader's situation, in one specific sentence.

## A real section heading

Body text. **Bold**, *italic*, `code`, [links](https://example.com), lists,
and one `>` blockquote per article for the line worth repeating.
```

Then:

```bash
python3 tools/build_journal.py
```

That writes `/journal/<slug>.html`, rebuilds the index, and regenerates
`sitemap.xml` and `feed.xml`. Deleting a `.md` file and rebuilding removes the
page. Commit the generated files — Pages serves them directly, there is no
build step on deploy.

The filename becomes the URL, and the URL is permanent once Google has indexed
it. Renaming a published article costs you its ranking, so pick the slug once.

## Drafting one with Gemini

```bash
export GEMINI_API_KEY=...      # https://aistudio.google.com/apikey
python3 tools/draft_article.py                 # next queued topic
python3 tools/draft_article.py "some topic"    # a specific one
```

Output goes to `content/drafts/`, **not** to the site. To publish:

1. Read the whole thing. Check every claim and every number.
2. Rewrite anything that does not sound like you.
3. `git mv content/drafts/x.md content/articles/`
4. `python3 tools/build_journal.py`
5. Mark the topic `[done]` in `content/topics.md`.

`.github/workflows/draft-article.yml` runs this every Monday and opens a pull
request with the draft. Add `GEMINI_API_KEY` under repository Settings →
Secrets and variables → Actions, and enable "Allow GitHub Actions to create
pull requests" under Settings → Actions → General.

## Why there is a review step

Google's spam policy on **scaled content abuse** (March 2024) targets publishing
generated pages at volume without human oversight. Enforcement is site-wide, not
per-page: one bad automated run can sink the rankings of the pages you wrote
yourself.

Ten articles that answer a real question outrank a hundred that restate the same
advice. The pipeline is a drafting tool with a person at the end of it, and that
is the configuration that works.

`PUBLISH_WITHOUT_REVIEW=1` skips the gate. It still refuses to publish a draft
that fails the structural checks, but nothing checks whether the article is
true. Setting it is a decision to accept that risk.

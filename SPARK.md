# The content machine

Five carousels a day, planned and drawn by Gemini Spark, approved by a
person here, posted by the site. This is the contract between the two.

The site is the portal: the pillars, the brand kit, the plans, the slides
and their verdicts all live in D1 and R2 behind `/studio`. There is no
staging folder and no review email — the review is a screen, and Spark
reads its own feedback back over the same API it wrote to.

None of this is public. No site route renders any of it.

## Connecting it to Spark

Spark does not call REST endpoints, and it does not take a pasted token.
Its "custom connected app" panel asks for an **OAuth client ID and
secret**, because the MCP authorization spec is OAuth 2.1: a server MUST
publish Protected Resource Metadata (RFC 9728), and its authorization
server MUST do OAuth 2.1 with PKCE. So the site hosts one.

    /.well-known/oauth-protected-resource    where to authorize
    /.well-known/oauth-authorization-server  what it supports
    /oauth/authorize                         you approve, once
    /oauth/token                             code + verifier -> token

**Set these three secrets**, under both Production and Preview, then retry
the deployment:

| | what to put |
|---|---|
| `MCP_CLIENT_ID` | anything, e.g. `gemini-spark`. It is a name, not a secret |
| `MCP_CLIENT_SECRET` | a long random string. This one is a secret |
| `MCP_REDIRECT_URIS` | the redirect URI Gemini gives you, exactly |

**Then, in the Gemini web app:**

1. Custom app link: `https://web3ashley.com/mcp`
2. Advanced Settings → **Client ID**: whatever you set `MCP_CLIENT_ID` to
3. **Client secret**: whatever you set `MCP_CLIENT_SECRET` to
4. Press **Copy redirect URI** *first*, put it in `MCP_REDIRECT_URIS`, and
   redeploy — the redirect is matched exactly, so a near miss is refused
5. Next. A page on this site asks for the studio password, says what the
   token will and will not be able to do, and sends Gemini back with a code

The password is the approval. There is one account holder and one thing
being granted, so a consent screen enumerating scopes would be ceremony
over a single yes.

`AGENT_TOKEN` still works for curl and the check suites. It is a
deployment-wide secret rather than a granted one, which is why it is
second in the order the endpoint checks.

## The two credentials

| | how | what it can do |
|---|---|---|
| you | sign in at `/studio` | everything |
| Spark | the MCP server at `/mcp`, or `Authorization: Bearer $AGENT_TOKEN` on the REST API | plan, draw, hand over for review |

Spark cannot approve, schedule, post or delete, and cannot touch a
carousel once a person has approved it. That ceiling is the security
model, not a convention: Spark researches the open web, so anything it
reads can try to instruct it. What stops that reaching an audience is
that its credential cannot reach the states that put something in front
of one. `tools/check_social.mjs` drives the real API and asserts each of
those refusals.

## A day, in calls

    GET  /api/studio/carousels/-/brief

The pillars with their briefs, the brand kit as fetchable URLs split into
`likeness` and `aesthetic`, and the last 40 topics so the same one is not
proposed twice. One call to start a cycle.

    POST /api/studio/carousels
    { title, pillar, topic, research, caption, hashtags,
      slides: [ { kind: 'hook'|'slide'|'cta', copy, prompt }, … ] }

Files a plan. Lands `planned`. `copy` is the type that goes into the
image; `prompt` is what the image model is given.

**How long it runs is the topic's call.** A teardown with four findings is
four slides plus a hook and a card at the end; a single statistic is two.
Padding everything to the same length is how a set of posts starts to look
like a template, which is the thing this exists to avoid. Two is the floor
because below it there is no carousel, and ten is Instagram's ceiling —
anything past ten is cut to ten rather than refused. The brief repeats this
so it does not have to be remembered.

    PUT  /api/studio/carousels/:slug/slides/:position
    multipart: file, width, height, qc

One image, one call. The master goes to R2 and the slide turns `ready`.
Sending it again is how a regeneration is delivered; `attempts` counts.
The first image moves the carousel to `generating` on its own. A previous
master is never deleted — a regeneration you dislike has to be
recoverable.

    POST /api/studio/carousels/:slug/status
    { status: 'review', qc: { … } }

Hands it over. `qc` is Spark's own multimodal pass, kept alongside it.

Then a person opens it in the studio and either approves it or marks
particular slides. Which brings us to the loop that replaces the email:

    GET  /api/studio/carousels/-/queue

Every slide that needs work — `redo`, `pending` or `failed` — with the
note a person wrote against it, and the carousels waiting. Poll this.
Draw only what it names: asking for one slide again must not cost the
nine that were already right, in generation time or in the four takes
that were already good.

Deliver the redraw with the same `PUT` and hand it back with the same
`status: 'review'`.

    POST /api/studio/carousels/-/digest

The one mail a day: what is waiting, how many slides each, and a link
straight to it. Ask for it when the batch is actually ready — nothing
schedules it, because a clock firing while the images are still rendering
sends a mail about a day that is not finished.

A mail that would say "nothing" is not sent, since that trains you to stop
opening them. `GET` the same path to read what it *would* say without
sending. Needs `RESEND_API_KEY`, the same Resend account the booking form
uses; with no key it says so rather than reporting a success that never
arrived.

## Where it can go from where

    planned    -> generating, review, rejected
    generating -> review, planned, rejected
    review     -> changes, approved, rejected
    changes    -> review, approved, rejected
    approved   -> scheduled, changes, rejected
    scheduled  -> posted, approved, rejected
    rejected   -> planned

Spark may only move it between `planned`, `generating`, `review` and
`changes`. Everything past that is a person.

Approving is refused unless every slide is drawn, there are at least two,
and there is a caption. The studio hides the button and says which of the
three is missing rather than offering something certain to fail.

## Setting it up

1. `/studio` → **Pillars**. What Spark researches against.
2. `/studio` → **Brand kit**. Mark pictures in the library as *you* or
   *the look*. Four and six is the shape the pipeline was designed for;
   the brief reports the counts so Spark can check before it prompts.
3. Set `AGENT_TOKEN` in the Pages project, under **both** Production and
   Preview. A deployment carries the variables it was built with, so
   retry the deployment after adding it.

## What the platforms will take

Read off their own reference pages, not remembered. The numbers live in
`assets/js/platforms.js` with the URL each came from, and are checked at
approval — the alternative is a batch that looks finished for hours and
fails at the moment it was due to go out, with nobody watching.

**Instagram** ([media reference][ig-media], [content publishing][ig-pub])

| | |
|---|---|
| format | **JPEG only.** Not PNG, not WebP |
| file size | 8 MB |
| aspect ratio | 4:5 to 1.91:1 — **4:5 is the tallest a feed carousel takes** |
| width | min 320, max 1440; outside that it is scaled, not refused |
| carousel | 2 to 10 items |
| caption | 2200 characters, 30 hashtags, 20 @ tags |
| rate | 100 API-published posts per rolling 24 hours |
| account | Professional (Business or Creator) on a linked Facebook Page |
| media | pulled by Meta **from a public URL** — no direct upload |

Two things follow for a 4K pipeline. Instagram downscales to 1440 wide
anyway, so the 4K master is for the archive, not for the post — what the
8MB cap actually bites is a 4K JPEG. And **9:16 is a Reel or a Story, not
a feed carousel**; if "4K vertical" means 9:16 it will be refused. Generate
at 4:5.

**TikTok** ([photo post reference][tt-photo], [getting started][tt-start])

| | |
|---|---|
| photos | up to 35 |
| title | 90 UTF-16 runes |
| description | 4000 UTF-16 runes |
| media | publicly accessible URLs, verified by the app |
| scope | `video.publish`, approved and user-authorised |
| modes | `DIRECT_POST`, or `MEDIA_UPLOAD` to hand off to TikTok's editor |

An unaudited client **can** direct-post — the content is restricted to
private viewing until the audit passes. So the automation can run end to
end from day one; what the audit buys is the posts being public.

Format, file size and resolution are not stated on TikTok's photo-post
reference, so nothing is checked for them.

**Facebook Pages** is deliberately unchecked. Its photo limits were not
verified, and a guessed limit that silently passes reads as checked when
it is not.

**Gemini** ([image generation][gem]) — `gemini-3-pro-image` (Nano Banana
Pro) does 1K, 2K and 4K, and takes up to **14 reference images**, so ten
fits with room. `gemini-3.1-flash-image` (Nano Banana 2) also reaches 4K
and is the cheaper option if the likeness holds.

[ig-media]: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
[ig-pub]: https://developers.facebook.com/docs/instagram-platform/content-publishing
[tt-photo]: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
[tt-start]: https://developers.tiktok.com/doc/content-posting-api-get-started
[gem]: https://ai.google.dev/gemini-api/docs/image-generation

## Posting

`poster/` is a second Worker, deployed separately, bound to the same D1
and the same R2 as the site. It exists apart from the site because Pages
Functions have no cron triggers and Workers do.

    npx wrangler deploy --config poster/wrangler.toml

Five cron lines, in UTC. It does not care what time it is — it posts
whatever is due, so a missed firing catches up rather than skipping.

**Secrets**, set with `npx wrangler secret put NAME --config poster/wrangler.toml`:

| | |
|---|---|
| `IG_USER_ID` | the Instagram professional account's ID |
| `IG_ACCESS_TOKEN` | long-lived, with `instagram_business_content_publish` |
| `TIKTOK_ACCESS_TOKEN` | a user token with `video.publish` |
| `AGENT_TOKEN` | the same one the site uses, to reach `/run` by hand |
| `RESEND_API_KEY` | so a failure reaches you |

A platform with no credential is **skipped, not failed** — so Instagram
can go live while TikTok is still waiting on its audit.

### What it will and will not do

It reads carousels in `scheduled` and nothing else. There is no path in
it that can reach something still in review.

It claims a row with a conditional `UPDATE` before making a single API
call, so two overlapping firings cannot both post the same carousel.

A carousel that reached nobody goes back to **Approved** with the reason
written against it, and you get a mail. One that reached *somewhere*
stays posted with the failures recorded beside it — a live Instagram
carousel cannot be unsent, so marking it unposted would be a lie in the
database.

You can run it by hand rather than waiting for a slot:

    curl -X POST https://web3ashley-poster.<subdomain>.workers.dev/run \
      -H "Authorization: Bearer $AGENT_TOKEN"

### Facebook is deliberately not implemented

Its multi-photo shape is not on the Pages API guide and the reference
pages were erroring when this was written, so there was nothing to read
it off. It returns "skipped" every time rather than guessing at a call
that would post the wrong thing to a real audience. Instagram and TikTok
were both read off their own references; see `poster/platforms.js`.

## Still to do

Nothing in the code. What is left is external and slower than the build:

- **Meta App Review** for `instagram_business_content_publish`, and an
  Instagram professional account on a linked Facebook Page.
- **The TikTok audit.** Posting works unaudited; the content is
  restricted to private viewing until it passes.
- **Facebook**, once its reference pages are readable again.

# The content machine

Five carousels a day, planned and drawn by Gemini Spark, approved by a
person here, posted by the site. This is the contract between the two.

The site is the portal: the pillars, the brand kit, the plans, the slides
and their verdicts all live in D1 and R2 behind `/studio`. There is no
staging folder and no review email — the review is a screen, and Spark
reads its own feedback back over the same API it wrote to.

None of this is public. No site route renders any of it.

## The two credentials

| | how | what it can do |
|---|---|---|
| you | sign in at `/studio` | everything |
| Spark | `Authorization: Bearer $AGENT_TOKEN` | plan, draw, hand over for review |

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
image; `prompt` is what the image model is given. Two to ten slides —
ten is Instagram's ceiling.

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

## Not built yet

Posting. The five timed publishes need cron, which Pages Functions do not
have — [Workers has cron triggers and Pages does not][cf-migrate]. Two ways
out:

- **A companion Worker** on the same D1 and R2, deployed alongside. Small,
  and leaves this project exactly as it is.
- **Migrate the project to Workers static assets**, which folds the cron
  in and gains Durable Objects and proper observability. `_headers` is
  supported and the D1/R2 bindings carry over, but `functions/` has to be
  compiled (`wrangler pages functions build`) rather than file-routed, and
  Workers does not yet split production and preview bindings the way Pages
  does — which is the thing that has already cost us a deployment once.

The companion Worker is the smaller bet. The migration is the better place
to end up.

[cf-migrate]: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

Before writing either, start the two applications — they are the long pole,
and neither is a code problem:

- **Meta App Review** for `instagram_business_content_publish` (Instagram
  Login) or `instagram_content_publish` (Facebook Login).
- **The TikTok audit**, which lifts posts out of private-only.

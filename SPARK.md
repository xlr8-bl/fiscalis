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

## Not built yet

Posting. The five timed publishes need cron, which Pages Functions do not
have — that is a companion Worker bound to the same D1 and R2, and it is
the next piece. Two things about it are worth knowing before it is
written, because they are external gates rather than code:

- **Instagram** pulls media from a public URL rather than accepting an
  upload, which R2 already serves. But `instagram_business_content_publish`
  needs Meta App Review, and the account has to be Business or Creator on
  a linked Facebook Page.
- **TikTok** Direct Post needs the app to pass audit. Until it does, an
  unaudited app can only drop a draft into the inbox for you to finish by
  hand — so TikTok may stay semi-manual for a while after IG and FB are
  automatic.

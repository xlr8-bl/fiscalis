# The content machine

Five carousels a day, planned by Gemini Spark, drawn on the site,
approved by a person here, posted by the site. This is the contract
between the two.

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
| Spark | the MCP server at `/mcp`, or `Authorization: Bearer $AGENT_TOKEN` on the REST API | carousels: plan, draw, hand over for review, fill the brand kit, read how it is going. The journal: research, source a photograph, write, and publish |

The ceiling is different on the two sides, on purpose.

**Carousels.** Spark cannot approve, schedule, post or delete, and cannot
touch a carousel once a person has approved it. That is the security
model, not a convention: Spark researches the open web, so anything it
reads can try to instruct it, and what stops that reaching an audience is
that its credential cannot reach the states that put something in front
of one. A post on somebody else's platform cannot be recalled.
`tools/check_social.mjs` drives the real API and asserts each refusal.

**The journal.** Spark can put a post on the site. That is a real change
and it is bounded on three sides: it can only publish an article in
`review`, which is a state only it writes into; the publish path re-runs
every check against the stored row rather than trusting whatever wrote
it; and you can unpublish from the studio in one tap. That last one is
the whole difference. `tools/check_journal.mjs` asserts the checks and
the annotations.

### One thing asks

Every tool on this server declares its MCP annotations explicitly,
including the read-only ones — `destructiveHint` **defaults to true** in
the MCP schema, so a client that reads the fields in the wrong order
prompts on a tool that only reads a list. Stating all four hints on all
of them is what stops that.

Exactly two tools are declared destructive, and they are the two that
make something public:

    post_due          posts an approved carousel to the platforms
    publish_article   puts an article on the site

Everything else is additive and undoable from the studio, so nothing else
should interrupt you. That is the point: a prompt still means something
when it is the only one you see.

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

    POST /api/studio/carousels/:slug/draw
    { positions?: [0, 2] }              # tool: draw

The plan becomes pictures. The site draws them itself, so Spark never
has to make an image in its own chat and carry it back through the
conversation as base64. One call per carousel. Leave `positions` out and
it draws every slide that is `pending` or that a person asked for again,
and leaves the rest alone.

Two paths, chosen in the studio and invisible from here. On Cloudflare
(the default, free) it draws a wordless background and answers
`awaiting_type`: a person opens the carousel and the studio sets the copy
over it. On Google (paid) the model sets the type itself and the slide
comes back finished. Either way Spark's next move is `hand_over`.

It draws one slide at a time rather than all of them at once, so a
five-slide carousel takes a minute or two. That is deliberate: five in
parallel is five times the rate limit, and on a failure there is no way
to say which ones were already paid for. What comes back names the
slides that were drawn, the ones that failed and why, and how many
references it drew against.

A failure is recorded as a failure. If the model answers with prose
instead of a picture, the words are never stored as an image file; the
slide goes to `failed` with what it said, and shows in `queue`.

    PUT  /api/studio/carousels/:slug/slides/:position
    multipart: file, width, height, qc

One image, one call. This is the by-hand path, for a picture made
somewhere else. The master goes to R2 and the slide turns `ready`.
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

Call `draw` again to redraw them, or deliver one by hand with the same
`PUT`. Either way it goes back with the same `status: 'review'`.

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

## A post in the journal, in calls

The other half of the machine, and the one that ends in something public.
Six tools, in this order.

    writing_brief          what the journal is, how it sounds, the cycle
    voice_rules            every pattern that will be refused, and why
    find_photo             search a stock library, store nothing
    keep_photo             download the one you picked into the site's media
    write_article          the draft, checked before anything is stored
    publish_article        put it on the site

**The voice rules are enforced, not suggested.** `write_article` runs a
detector over the draft and stores **nothing** if it trips a hard
pattern. The patterns come from Wikipedia's "Signs of AI writing"
(WikiProject AI Cleanup) by way of the humanizer skill, which is checked
into `.claude/skills/humanizer`, and the list lives in
`assets/js/tells.js` so `voice_rules` is generated from the checker
rather than written beside it — the brief cannot describe a rule the code
does not enforce.

Some patterns are refused and some are only reported. An em dash, a curly
quote, an emoji, a Title Case heading, a chatbot artifact, one of the
fifteen stock phrases: refused, with the line and the phrase quoted back.
A stock word like "robust" or "leverage": reported, never refused,
because those are also just words. The skill's own list of what is *not*
a tell is half its length and `voice_rules` returns that too.

A refusal is cheap and is meant to be. `check_draft` runs the identical
checks and stores nothing at all, which is what to use while still
rewriting.

Beyond the AI patterns the same call refuses: no description, a title
over 70 characters, a body under 500 words or over 2,200, no `##`
headings, and any price or package language — that last one is the
brand's rule and it is absolute.

**Every post needs a real photograph.** The journal used to draw a cover
from each headline, and it looked like exactly what it was.

    find_photo  { query: 'menu on a table', count: 6 }

Two libraries, in order. Unsplash when `UNSPLASH_ACCESS_KEY` is set — the
key is a Cloudflare secret and Spark never sees it, it calls a tool and
the Worker holds the key. Otherwise Wikimedia Commons, which needs no key
at all, so this works on a deployment nobody has configured.

Commons is an archive rather than a stock library and searching it
naively gives archive results: the first version of this returned nothing
for "menu on a table" and answered "phone in hand" with a Japanese
handset from 1997. Three things fixed it, and they are worth knowing
because they shape what to search for:

- Commons matches words, not phrases, so the query is stripped to its
  nouns and shortened pass by pass until something comes back.
- Commons mirrors a large set of CC0 Unsplash photographs, and they are
  the only genuinely editorial pictures in it. `"unsplash"` **with** the
  quotes finds them; without the quotes it finds nothing. That mirror is
  the first pass.
- What comes back is ranked: the Unsplash mirror first, then CC0 and
  public domain, then aspect ratio, because an archive will hand you a
  head-on scan of a menu at 1200x1619 and that cannot be cropped to a
  1200x630 cover and still be of anything.

Search for a **thing**, not an idea. "menu on a table", "empty
restaurant", "phone in hand", "laptop on a desk" all find photographs.
"digital transformation" finds nothing worth using.

    keep_photo  { photo: <one result, unchanged>, slug: 'the-article' }

Downloads it into R2 and the `media` table with its credit, and returns
the `/media/…` path to pass as `cover`. Only the two libraries' own hosts
are fetchable — a URL of your own is refused, because "fetch whatever URL
the agent hands you" is how a tool becomes a proxy for someone else's
traffic.

    publish_article  { slug }

The one tool here that makes anything public. It re-runs every check
against the stored row, refuses an article with no cover, then puts it in
the journal, the sitemap and the feed, and drops the edge cache for all
four. Unpublish from the studio in one tap.


## The kit, through Spark

    add_reference { role: 'likeness'|'aesthetic', note, image_url | image_base64 }

The brand kit — the ten or so pictures every slide is drawn against — can
be filled from a chat. Hand Spark an image and tell it which kind it is:
`likeness` is your face, so the person in the slides is the same person
every time; `aesthetic` is the look, the grain and palette and the way
type sits. It goes into R2, into the media library, and into the brief
from that moment on.

Same two shapes as a slide: a URL it fetches server side, or the bytes
inline. What comes back has to actually be an image — a URL that answers
with an HTML error page is refused rather than stored as a JPEG that only
fails later, in front of the image model.

Twenty-four is the ceiling. Past that the model is being averaged rather
than steered. **There is no remove**, on purpose: an agent that reads the
open web having a delete is the thing this design avoids, and a wrong
upload is a nuisance rather than a loss. Take one out in `/studio` →
**Brand kit**.

## Checking on it

    progress

One call for the state of everything, and the one to start a scheduled
task with, since a task wakes with no memory of the last one:

- how many carousels are in each state
- what is sitting in `review` waiting on a person, oldest first
- what is scheduled, and for when
- what is **approved with no slot** — ready, and going nowhere, which is
  the failure that looks like everything is fine
- what has gone out, where it went, and its likes and comments
- how many slides are still owed and how many were sent back
- whether the accounts and the kit are actually in a state that can
  produce a post: token expiry, whether TikTok can renew itself, how many
  likeness and aesthetic references exist, whether any pillars are set
- `blocking`, a plain list of what is in the way, and `next_step`, one
  sentence so a scheduled task does not have to reason it out

<!-- -->

    performance { carousel?, limit?, refresh? }

Goes and asks the platforms what the posts did — likes, comments, shares,
saves, views, reach — per post and per platform, with a total across
whichever platforms answered. Numbers read in the last hour are handed
back from storage rather than re-fetched; `refresh: true` asks anyway.

**A count that could not be read comes back `null`, never `0`.** "Nobody
liked it" and "this token is not allowed to see likes" would otherwise
look identical, and only one of them is a reason to change what gets
posted. The reason is on the platform's own entry.

Three honest limits, from the platforms' reference pages:

- `like_count` and `comments_count` are ordinary fields and need only
  `instagram_business_basic`. **Reach, saves and views are the insights
  edge** and additionally need `instagram_business_manage_insights` — if
  the token lacks it, the likes still come back and the reason is said.
- Instagram **omits** `like_count` entirely when the account hides like
  counts. That is a setting, not an error, and it is reported as one.
- TikTok's publish call returns a `publish_id`, which is a receipt for an
  upload, not a post. The real post id appears only once the post is
  public and has cleared moderation — so **until the client passes its
  audit, its posts are private and have no readable numbers at all**.
  Reading them then also needs the `video.list` scope, which is separate
  from the one that posts.

The same numbers appear in `/studio` under a posted carousel, as **How it
did**, with a button that spends the API call. Opening the screen does
not.

## Posting one by hand

Everything above assumes Spark fills the pipeline. It is worth being able
to put one out yourself — before trusting a day of automation, and
because a platform review wants to watch a post go all the way through on
your own site.

On the board, **Start one by hand** makes a two-slide carousel. Open it,
**Add a picture** on each slide (the pixel size is measured in the
browser, because that is what approval checks against), write the
caption, and **Approve it** — straight from making, without passing
through review, since review is where the agent hands work over and your
own pictures have nobody to hand them to. Then **Give it a slot**, and
**Post anything that is due** under Social → Accounts.

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
2. The brand kit. Either hand the pictures to Spark in a chat and let it
   call `add_reference`, or mark ones already in the library under
   `/studio` → **Brand kit**. Four likeness and six aesthetic is the
   shape the pipeline was designed for; the brief reports the counts so
   Spark can check before it prompts, and `progress` says so out loud
   when there is no likeness reference at all.
3. Set `AGENT_TOKEN` in the Pages project, under **both** Production and
   Preview. A deployment carries the variables it was built with, so
   retry the deployment after adding it.
4. Bind Workers AI in the dashboard, so the site can draw for nothing.
   See below. A Gemini key instead, if you would rather pay for a model
   that sets its own type and can use the brand kit.

### Drawing for nothing, on Cloudflare

This is the default, and it needs no card and no key.

1. Cloudflare dashboard → your Pages project → **Settings** → **Functions**
   → **Bindings** → **Add** → **Workers AI**, named `AI`. Then redeploy,
   because a deployment carries the bindings it was built with.
2. That is the whole setup. `/studio` → **Social** → **Accounts** shows
   **Draw with: Cloudflare**, and says so plainly if the binding has not
   landed yet.

**Why it is not in `wrangler.toml`.** Workers AI has no local
implementation. Declared in the config, `wrangler pages dev` classifies
it remote-only and opens a proxy session to Cloudflare to serve it, which
needs a `CLOUDFLARE_API_TOKEN` — so every local run and every check suite
dies at startup. There is no way round it from the config: `pages dev`
rejects `--config` so a stripped copy cannot be pointed at, and
`experimental_remote = false` is ignored for this binding. The dashboard
is the only place it can live without breaking local development.

The cost is that the binding is not in version control, so a rebuilt
project comes back unable to draw. What catches that is Accounts saying
so, rather than a carousel failing at its slot.

**What it costs.** The Workers Free plan includes 10,000 Neurons a day.
Flux Schnell is 4.80 neurons per 512×512 tile plus 9.60 per step, so a
4-step picture is about 58: twenty-five slides a day is roughly 14% of
the allowance. Past it the Free plan errors rather than charging, so
there is no bill that can arrive by surprise.

**What it does differently.** Flux Schnell is poor at rendering text, so
it does not draw the copy. It draws the picture, and the studio sets your
words over it in the site's own typeface when you open the carousel. That
is better than the paid path, not worse: type set from the string is
spelled correctly every time, at a size and weight chosen rather than
negotiated with a model.

It also cannot use the brand kit — Flux Schnell takes a prompt and
nothing else, so there is no likeness to steer with. That is the real
trade against Google, and it is the reason the paid path still exists.

The slide is only finished while the studio is open. That costs nothing:
nothing can post until a person approves it on that screen anyway, so the
typesetting happens on a visit that was already going to happen. A
carousel Spark drew overnight is typeset the moment you open it.

### The key that draws, if you would rather pay

The generation layer calls Google's image model directly. It needs one
key, and nothing else.

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and
   create an API key. It starts `AIza`.
2. Billing has to be on. See below: this is not optional and there is no
   way around it.
3. Paste it at `/studio` → **Social** → **Accounts**, under *Drawing the
   slides*, and save. Accounts then shows **Drawing: Ready** with the
   model name and what a slide costs.

It lives in the database, not in the deployment, for the same reason the
platform credentials do: it is set once from a phone and should not cost
a build. `GEMINI_API_KEY` in the Pages project still works as a
fallback; a key set in the studio wins over it.

### What it costs, and why there is no free option

There is no free tier on any Gemini image model. Not a small one, none.
And since March 2026 the $300 Google Cloud trial credit cannot be spent
on the Gemini API either.

A Google AI Pro subscription *does* come with $10 a month of Google Cloud
credit, and Ultra with $100 — Google folded Developer Program Premium
benefits into those subscriptions. But the credit cannot be reached
without a payment method: promotional credits only unlock once a billing
account has one, and on prepay only after funds are added. So the credit
is real and still costs you a card to touch, which is the whole reason
the Cloudflare path above is the default.

So every slide is money. Per 1K image, off the
[pricing page](https://ai.google.dev/gemini-api/docs/pricing), with the
monthly figures at five slides a carousel over thirty days:

| model | per slide | 1/day | 2/day | 5/day |
|---|---|---|---|---|
| `gemini-3-pro-image` (Nano Banana Pro) | $0.134 | $20 | $40 | $101 |
| `gemini-3.1-flash-image` (Nano Banana 2) | $0.067 | $10 | $20 | $50 |
| `gemini-3.1-flash-lite-image` (NB2 Lite) | $0.0336 | $5 | $10 | $25 |

Redraws cost again, so add whatever share of slides gets sent back.

**The default is Nano Banana 2**, the middle one. Pro is twice the price
for a picture that gets two seconds on a phone, which is not where its
advantage shows. Lite is half again cheaper and worth trying, but lite
models fumble small type first and these slides have the copy set into
them: a slide that comes back misspelled gets redrawn, and the saving
goes backwards.

That reasoning is a starting point, not a finding. Draw one carousel on
each and look at them. The model is a dropdown in the studio next to the
key, so switching costs a tap rather than a deployment, and `draw`
reports which model drew and what the run cost.

The volume dial matters more than the model dial. Five a day was an
early assumption, not a requirement.

Slides are asked for at `1K` and `4:5`, which comes back 1024×1280:
inside TikTok's 1080 cap, past Instagram's 320 floor, and the right
ratio for both, so nothing needs cropping afterwards.
`GEMINI_IMAGE_MODEL` sets it from the deployment; the studio wins over
it.

The brand kit is sent with every slide as pictures rather than as
adjectives, up to ten of them, because a likeness the model can see
beats any description of a face. Over and above the slide's own prompt,
it is told the ratio, that the copy has to be spelled exactly and be
legible at phone size, and that it must not invent a logo or a
watermark, which image models do unprompted and which is the fastest way
to look like a fake brand.

`node tools/check_imagen.mjs` covers the request shape and every failure
path without spending a call.

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

**9:16 is a Reel or a Story, not a feed carousel**; if "4K vertical" means
9:16 it will be refused. And Instagram downscales to 1440 wide anyway, so
the 4K master is for the archive, not the post — see the size to draw at,
below.

**TikTok** ([photo post reference][tt-photo], [getting started][tt-start])

| | |
|---|---|
| photos | up to 35 |
| title | 90 UTF-16 runes |
| description | 4000 UTF-16 runes |
| format | **JPEG or WebP.** Not PNG ([media transfer guide][tt-media]) |
| resolution | **maximum 1080p**, and TikTok does not resize |
| file size | 20 MB per image |
| media | HTTPS URLs, no redirects, **on a domain the app has verified** |
| scope | `video.publish`, approved and user-authorised |
| privacy | an unaudited client may only post `SELF_ONLY` |

An unaudited client **can** direct-post — the content is restricted to
private viewing until the audit passes. So the automation runs end to end
from day one; what the audit buys is the posts being public.

**The unaudited rule has two halves**, and the second one is easy to miss
because it is not about the post at all:

> Unaudited API Clients can only post contents in `SELF_ONLY` viewership.
>
> All user accounts using the API client to post must be set to private
> at the time of posting.

So `SELF_ONLY` on the post is necessary and not sufficient — posting to a
**public** account is refused however private the post claims to be, with
`unaudited_client_can_only_post_to_private_accounts`. Set the TikTok
account itself to private (Settings and privacy → Privacy → Private
account) until the audit clears. `creator_info` gives the account away —
only a public one is offered `PUBLIC_TO_EVERYONE` — so this is caught
before the posting call is spent, and the result says which setting to go
and change.

There is also a cap of five users posting per 24 hours while unaudited,
which one operator will not reach.

Nothing in the API says which side of the audit an app is on, so the
studio has a switch for it under Social → Accounts, off until the audit
actually passes.

### The size to draw at

**1080 × 1350, JPEG.** One file that both platforms take:

- TikTok caps photos at 1080p and does not resize, so anything wider is
  refused outright.
- Instagram takes JPEG only, downscales anything over 1440 wide, and 4:5
  is the tallest ratio a feed carousel accepts.

`brief` hands this back under `slides.size`, and approval refuses a slide
that is over it rather than letting the batch fail at its slot.

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
[tt-media]: https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
[gem]: https://ai.google.dev/gemini-api/docs/image-generation

## Posting

Pages Functions have no cron, so the *when* has to come from outside. The
*what* is one implementation in `lib/publish.js`, and there are two ways
to poke it.

**Spark's own schedule — no terminal needed.** Spark schedules recurring
tasks itself. Give it five, one per slot:

> Every day at 8am, call post_due on Web3ashley Studio.

That is the whole scheduler. It needs no second deployment and no
commands, which matters when the studio is run from a phone.

`post_due` looks like a hole in the ceiling and is not. It publishes only
carousels in `scheduled`, and a carousel reaches that state only because
a person approved it and gave it a slot. The capability being withheld
was never "cause a post to happen" — it was "put something in front of an
audience that nobody approved", and that stays impossible.

**Or the optional Worker**, if you would rather the schedule did not
depend on Spark being awake:

    npx wrangler deploy --config poster/wrangler.toml

Same code, real cron triggers, five lines in UTC. It is a shell over
`lib/publish.js`, and a check asserts it stays one so the two cannot
drift.

### Credentials

Neither platform issues a token you can set once and forget: Instagram's
lasts 60 days and TikTok's access token lasts 24 hours. A Cloudflare
Worker cannot rewrite its own secret, so a token kept in a secret is one
that dies on its own schedule with nobody watching. **The tokens live in
`settings`**, where they can be refreshed on use; the environment holds
only the app's own identity.

In the **Pages** project — dashboard, no terminal, both Production and
Preview, then retry the deployment:

| | |
|---|---|
| `TIKTOK_CLIENT_KEY` | from the app's page at TikTok for Developers |
| `TIKTOK_CLIENT_SECRET` | same page. This one is a secret |
| `TIKTOK_SCOPES` | optional. `video.list`, once the Display API product is on the app |
| `IG_APP_ID` | optional; the studio is the easier place for it |
| `IG_APP_SECRET` | optional; likewise |
| `IG_SCOPES` | optional. `instagram_business_manage_insights`, for reach and saves |
| `IG_USER_ID` | optional starting value; connecting sets it |
| `IG_ACCESS_TOKEN` | optional starting value, long-lived |

A platform with no credential is **skipped, not failed** — so Instagram
can go live while TikTok waits on its audit.

### Connecting Instagram

Instagram Login, not Facebook Login. Meta is explicit that this setup
"does not require a Facebook Page to be linked to the Instagram
professional account" — which is why the site uses it, and why the
approval screen is told not to offer the Facebook button.

**On the app at developers.facebook.com:**

1. Create an app, type **Business**, and add the **Instagram** product.
2. Open **Instagram → API setup with Instagram login**. Everything below
   is on that page.
3. Step 1, **Generate access tokens**: connect your Instagram professional
   account — business or creator. A personal account cannot be used.
4. Step 3, **Set up Instagram business login → Business login settings**:
   put `https://web3ashley.com/oauth/instagram/callback` in **valid OAuth
   redirect URIs**. Meta matches the whole string, so a trailing slash is
   a different URI.
5. Copy the **Instagram app ID** and **Instagram app secret** — the ones
   on this page, not the Meta app ID and secret above them. They are
   different values and the wrong pair fails with nothing useful.

**Then, in the studio:** Social → Accounts, paste those two, **Connect
Instagram**. You approve, and it comes back with the account name and the
granted permissions listed.

**No App Review, for now.** Unapproved permissions can be granted to
people who hold a role on the app, which as its admin you do — so
`instagram_business_content_publish` works while the app is in
development. Review is what a *different* person's account would need.

Two tokens are involved and only one is worth having: the code buys an
hour-long token, which is traded straight away for the 60-day one. That
second exchange is done for you; stopping after the first leaves a token
that looks fine until the afternoon it stops working.

### Connecting TikTok

TikTok has no token to copy out of a dashboard. It hands one over at the
end of an approval, so the site hosts both ends of that round trip and
the studio has a button for it.

**The order matters, because of a loop.** You cannot tick Web or register
a redirect URI on an app that has not been submitted, and you cannot
submit without a demo video of the integration working. Sandbox mode is
the way out, and is what TikTok points at: "a restricted environment that
allows you to try out integrations without having to submit your app for
review". A sandbox is a separate client with its own credentials,
products, scopes, redirect URIs and target users, configured
independently of the live app.

So: build and record against a sandbox, then import that configuration
into a production Draft and submit it with the video.

**In a sandbox** (Manage apps → toggle to Sandbox → Create Sandbox):

1. Add both products: **Login Kit** (the prerequisite — it is what grants
   `user.info.basic`) and **Content Posting API** (`video.publish`). Turn
   on **Direct Post** under the Content Posting configuration; without it
   the app can only hand content off to TikTok's editor.
2. **Redirect URI**: `https://web3ashley.com/oauth/tiktok/callback` —
   exactly. HTTPS, no query string, no trailing slash. It is matched
   character for character.
3. **URL properties** → add `web3ashley.com` and verify it, by DNS record
   or by the signature file. This is the one people miss: TikTok fetches
   the slides from the site with `PULL_FROM_URL`, and it refuses to fetch
   from a domain the app has not proved it owns — `url_ownership_unverified`,
   HTTP 403. Verifying the domain covers every path and subdomain under it.
4. Add your own TikTok under **Target users** — up to 10, and it can take
   an hour to appear.
5. Copy that sandbox's **client key** and **client secret** into the studio
   under Social → Accounts. They live there rather than in the deployment
   precisely because of this: the approval path runs against a sandbox
   first and the live app afterwards, and stored in the studio a swap is a
   paste rather than a dashboard edit and a build.

Sandbox mode excludes the Content Posting API for public videos, so the
demo posts will be `SELF_ONLY` — which is what an unaudited client is
limited to anyway, and what this code already does.

**Then, in the studio:** Social → Accounts → **Connect TikTok**. It sends
you to TikTok, you approve, and it comes back with the tokens stored and
the account name shown. Nothing to paste.

### When TikTok says "correct the following: client_key"

That is its answer to a key it does not recognise, and it names nothing
else — so the key was sent, and re-pasting the secret cannot help, since
the secret is not part of the authorization request at all.

**Check the setup**, beside Connect TikTok, shows what is actually being
sent — the key's ends and length, the redirect URI, the scopes, which
deployment is answering — and will ask TikTok directly whether the key
and secret are a real pair, using `client_credentials`, which involves no
user and no Login Kit. That splits the error in two:

- **TikTok accepts the pair** → the value is fine and the app is not
  configured for the web. Tick **Web** under Platforms, turn on
  **Configure for Web** under Login Kit, and register the redirect URI on
  it. A key with no web client behind it is exactly this error.
- **TikTok refuses the pair** → the value is wrong. Note that a sandbox
  and the live app are separate clients with separate credentials, so the
  demo recording has to use whichever one the key belongs to.

The access token is renewed on use and the refresh token — which lasts a
year, and which TikTok *replaces* on every refresh — is written back each
time. That last part is why this is not a secret: not writing it back is a
pipeline that works today and stops tomorrow.

Leave **TikTok has audited this app** switched off until the audit really
passes. Until then every post goes out `SELF_ONLY`, the result says so,
and the alternative is TikTok refusing the post outright.

### What it will and will not do

It reads carousels in `scheduled` and nothing else. It claims a row with
a conditional `UPDATE` before making a single API call, so two overlapping
pokes cannot both post it.

A carousel that reached nobody goes back to **Approved** with the reason
against it, and you get a mail. One that reached *somewhere* stays posted
with the failures recorded beside it — a live Instagram carousel cannot
be unsent, so marking it unposted would be a lie in the database.

### Facebook is deliberately not implemented

Its multi-photo shape is not on the Pages API guide and the reference
pages were erroring when this was written, so there was nothing to read
it off. It returns "skipped" every time rather than guessing at a call
that would post the wrong thing to a real audience.

## Still to do

Nothing in the code. What is left is external and slower than the build:

- **A Gemini API key with billing on**, or nothing draws. There is no
  free tier and no trial credit that covers it. Accounts says *Drawing:
  Ready* once it is in, and `draw` refuses with what is missing rather
  than half-drawing a carousel.
- **Which model, decided by looking.** The default is a reasoned guess
  at the price-to-legibility trade, not a measurement. Draw the same
  carousel on Pro and on Lite and pick.
- **Meta App Review**, but only eventually: unapproved permissions can be
  granted to accounts holding a role on the app, so posting works today as
  its admin. Review is what another person's account would need.
- **`instagram_business_manage_insights`**, if reach and saves are wanted
  alongside the likes. Put it in `IG_SCOPES` and connect again — a scope
  is granted at approval, so an existing token does not gain it.
- **The TikTok audit.** Posting works unaudited; every post is
  `SELF_ONLY` until it passes — and a private post has no readable likes,
  so `performance` reports TikTok as *pending* with that reason. When it
  clears, turn on the switch in Social → Accounts; nothing in the API
  announces it.
- **The Display API product**, if the TikTok numbers are wanted. Reading
  likes and views needs `video.list`, which that product grants and the
  Content Posting one does not. Add it, put `video.list` in
  `TIKTOK_SCOPES`, redeploy, and press Connect TikTok again — a scope is
  granted at approval, so an existing token does not gain it.
- **Facebook** is out. It is no longer a default target, its multi-photo
  shape was never verified, and a destination that is always skipped is
  noise in every result. The poster still answers for it truthfully if an
  old carousel names it.

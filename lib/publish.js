/**
 * publish.js — posting what a person approved.
 *
 * One implementation, two triggers. Cloudflare Pages Functions have no
 * cron, so the *when* has to come from outside; the *what* does not care
 * where the poke came from:
 *
 *   Gemini Spark   schedules its own recurring tasks, and calls the
 *                  post_due tool at each slot. Needs no terminal, which
 *                  matters when the studio is run from a phone.
 *   poster/        a Worker with real cron triggers, for a deployment
 *                  that would rather not depend on Spark being awake.
 *
 * Either way this is the code that runs, so there is no second copy to
 * drift.
 *
 * Three rules, all of them about the fact that it runs with nobody
 * looking:
 *
 *   Only what a person approved. It reads carousels in `scheduled` and
 *   nothing else. Nothing here can reach something still in review, and
 *   a carousel only reaches `scheduled` because a person approved it and
 *   gave it a slot.
 *
 *   Never twice. The row is claimed with a conditional UPDATE before a
 *   single API call, so two overlapping pokes cannot both post it.
 *
 *   Never silently. A failure puts it back where a person can see it,
 *   writes down what the platform actually said, and sends a mail.
 */

import { POSTERS, toInstagramStory } from './publishers.js';
import { toBuffer, postingRoute } from './buffer.js';
import { instagramToken, tiktokToken, getSetting, putSetting, isAudited } from './tokens.js';
import { problems } from '../assets/js/platforms.js';

const nowIso = () => new Date().toISOString();

/** What the platforms need: absolute, public URLs. */
const publicUrls = (site, slides) =>
  slides.map((s) => `${site}/media/${s.media_key}`);

/**
 * Everything past its slot and still waiting. `scheduled_for` is ISO in
 * UTC; a row with no time set is due as soon as it is scheduled, which
 * is what makes "post this now" work without a special case.
 */
export async function due(db) {
  const { results } = await db
    .prepare(
      `SELECT id, slug, title, caption, hashtags, targets, slot, scheduled_for
       FROM carousels
       WHERE status = 'scheduled'
         AND (scheduled_for IS NULL OR scheduled_for <= ?1)
       ORDER BY scheduled_for
       LIMIT 10`
    )
    .bind(nowIso())
    .all();
  return results ?? [];
}

async function slidesOf(db, carouselId) {
  const { results } = await db
    .prepare(
      `SELECT s.position, s.media_key, s.copy, s.width, s.height,
              m.content_type, m.bytes
       FROM slides s LEFT JOIN media m ON m.key = s.media_key
       WHERE s.carousel_id = ?1 AND s.media_key != '' ORDER BY s.position`
    )
    .bind(carouselId)
    .all();
  return results ?? [];
}

/**
 * Take the row, or find that somebody else already did. The UPDATE is
 * the lock: it only matches a row still in `scheduled`, so of two
 * overlapping firings exactly one gets a changed-row count above zero.
 */
async function claim(db, id) {
  const out = await db
    .prepare(
      `UPDATE carousels SET status = 'posted', posted_at = ?2,
                            last_editor = 'poster', updated_at = datetime('now')
       WHERE id = ?1 AND status = 'scheduled'`
    )
    .bind(id, nowIso())
    .run();
  return (out?.meta?.changes ?? out?.changes ?? 0) > 0;
}

/** Put it back, with the reason, for a person to look at. */
async function release(db, id, results) {
  await db
    .prepare(
      `UPDATE carousels SET status = 'approved', posted_at = NULL, results = ?2,
                            last_editor = 'poster', updated_at = datetime('now')
       WHERE id = ?1`
    )
    .bind(id, JSON.stringify(results).slice(0, 40_000))
    .run();
}

async function record(db, id, results) {
  await db
    .prepare(`UPDATE carousels SET results = ?2, updated_at = datetime('now') WHERE id = ?1`)
    .bind(id, JSON.stringify(results).slice(0, 40_000))
    .run();
}

/** One carousel, to every platform it is aimed at. */
async function publish(env, row, opts = {}) {
  const site = (env.SITE || '').replace(/\/$/, '');
  const slides = await slidesOf(env.DB, row.id);
  if (slides.length < 2) {
    return { posted: false, results: { error: `Only ${slides.length} slide(s) with pictures.` } };
  }

  const urls = publicUrls(site, slides);
  const caption = [row.caption, row.hashtags].filter(Boolean).join('\n\n');
  const targets = String(row.targets || '')
    .split(',').map((t) => t.trim()).filter(Boolean);

  /*
   * The platform's own limits, at the moment of posting rather than at
   * approval.
   *
   * The studio runs this when a person approves, but approval and posting
   * are hours apart and a slide can be redrawn in between. The Ayrshare
   * road had a format gate of its own and the direct road had none, so a
   * PNG reached TikTok, which takes JPEG and WebP, and came back as a
   * transfer error that named nothing. One gate, before either road.
   */
  const refuse = problems({
    targets, slides, caption: row.caption, hashtags: row.hashtags, title: row.title,
  });
  if (refuse.length) {
    return {
      posted: false,
      results: Object.fromEntries(targets.map((t) => [t, {
        ok: false, skipped: true, error: refuse.join(' '),
      }])),
    };
  }

  /*
   * One broker, or three platform apps.
   *
   * Buffer posts under its own platform apps, which is what makes it
   * useful while TikTok's review of ours is open. It short-circuits
   * everything below: no tokens to resolve, because it holds the
   * connections, and the results come back in the same per-target shape
   * so nothing downstream can tell which road was taken.
   */
  /* Buffer holds the connections and posts under its own platform apps,
     so neither the privacy level nor the story is ours to set on that
     road. Said plainly rather than posted publicly by surprise. */
  if (await postingRoute(env.DB, getSetting) === 'buffer') {
    if (opts.visibility === 'test') {
      return {
        posted: false,
        results: Object.fromEntries(targets.map((t) => [t, {
          ok: false, skipped: true,
          error: 'A private test post cannot go through Buffer — it posts under its '
            + 'own apps and does not expose TikTok\'s privacy level. Switch the '
            + 'posting route to direct in Accounts, or post publicly.',
        }])),
      };
    }
    const results = await toBuffer(env, {
      urls, caption, targets, getSetting, putSetting,
      /* A story on this road is the SAME post with a different Instagram
         type, not a follow-on: Buffer takes one `createPost` per channel
         and a story is what that post IS. The direct road posts the
         carousel and then the hook sheet separately, because there a
         carousel genuinely cannot be a story. */
      story: opts.story === true,
    });
    const list = Object.values(results);
    return {
      posted: list.some((r) => r.ok),
      failed: list.some((r) => !r.ok && !r.skipped),
      results,
    };
  }

  /*
   * Tokens are resolved once per carousel rather than per platform call,
   * and resolving one is what refreshes it. Instagram's lasts 60 days and
   * TikTok's lasts 24 hours, so a token read straight from a secret is a
   * pipeline that stops on its own with nobody watching.
   */
  const creds = {};
  if (targets.includes('instagram')) {
    const ig = await instagramToken(env.DB, env);
    creds.instagram = { token: ig.token, userId: await getSetting(env.DB, 'ig.user_id') || env.IG_USER_ID };
    if (ig.error) creds.instagram.error = ig.error;
    if (ig.warning) creds.instagram.warning = ig.warning;
  }
  if (targets.includes('tiktok')) {
    const tt = await tiktokToken(env.DB, env);
    creds.tiktok = { token: tt.token, audited: await isAudited(env.DB, env) };
    if (tt.error) creds.tiktok.error = tt.error;
  }

  const results = {};
  let anyPosted = false;
  let anyFailed = false;

  for (const target of targets) {
    const poster = POSTERS[target];
    if (!poster) {
      results[target] = { ok: false, skipped: true, error: 'No poster for that platform.' };
      continue;
    }
    try {
      const cred = { ...(creds[target] || {}), visibility: opts.visibility };
      // a token that could not be resolved is reported as such rather than
      // sent as undefined and turned into a platform error nobody can read
      if (cred.error && !cred.token) {
        results[target] = { ok: false, skipped: true, error: cred.error };
        continue;
      }
      const out = await poster(env, {
        urls,
        caption,
        title: row.title,
        description: caption,
        token: cred.token,
        userId: cred.userId,
        audited: cred.audited,
      });
      if (cred.warning) out.warning = cred.warning;
      results[target] = out;
      if (out.ok) anyPosted = true;
      else if (!out.skipped) anyFailed = true;
    } catch (e) {
      // a thrown platform must not take the others down with it
      results[target] = { ok: false, error: String(e?.message || e) };
      anyFailed = true;
    }
  }

  return { posted: anyPosted, failed: anyFailed, results };
}

/**
 * A carousel that reached nobody goes back to `approved`. One that
 * reached somewhere stays posted, with the failures written beside it —
 * unposting a live Instagram carousel is not something this can do, so
 * pretending it did not happen would be a lie in the database.
 */
/**
 * One carousel, now, by name. No slot, no waiting for a run.
 *
 * `runDue` was the only road to posting, and it only looks at rows in
 * `scheduled` — so posting anything meant giving it a time first, and a
 * scheduling form is a strange thing to meet when what you wanted was
 * to press post. This is the direct road; the scheduled one still
 * exists for anything that genuinely wants a slot.
 *
 * @param opts.visibility 'test' is TikTok alone, at SELF_ONLY: a real
 *   post through the real API that only he can see. Instagram has no
 *   private post of any kind, so a rehearsal cannot include it. 'public'
 *   is both platforms, together.
 * @param opts.story also put slide one up as an Instagram story. TikTok
 *   is not offered: the Content Posting API has no story endpoint.
 */
export async function postOne(env, slug, opts = {}) {
  if (!env.DB) return { error: 'No database bound.' };

  const row = await env.DB
    .prepare(
      `SELECT id, slug, title, caption, hashtags, targets, status
       FROM carousels WHERE slug = ?1`
    )
    .bind(slug)
    .first();
  if (!row) return { error: 'No carousel by that name.' };

  /* Approved is the gate, and it is a person's decision either way. The
     agent cannot reach this: AGENT_STATES stops at review. */
  if (!['approved', 'scheduled'].includes(row.status)) {
    return {
      error: `This is ${row.status}. Approve it first — posting is the one thing `
        + 'that cannot be undone.',
    };
  }

  const wanted = opts.visibility === 'test' ? 'test' : 'public';
  const targets = String(row.targets || '').split(',').map((t) => t.trim()).filter(Boolean);

  /* A rehearsal is TikTok alone, and that is the design rather than a
     shortfall. Instagram has no private post — no API for one and no
     such thing in the app, since a post is visible to whoever can see
     the account — so the only two honest options are TikTok on its own
     or a real public post. Both platforms go together when it is real. */
  const row2 = wanted === 'test' && targets.includes('instagram')
    ? { ...row, targets: targets.filter((t) => t !== 'instagram').join(',') }
    : row;

  const { posted, failed, results } = (row2.targets || '').trim()
    ? await publish(env, row2, { visibility: wanted })
    : { posted: false, failed: false, results: {} };

  if (wanted === 'test' && targets.includes('instagram')) {
    results.instagram = {
      ok: false, skipped: true,
      error: 'not part of a private test. Instagram has no private post, so a '
        + 'rehearsal is TikTok on its own; both go out together when you post '
        + 'publicly.',
    };
  }

  /* Only on the direct road. Buffer sends the story as its own
     createPost inside toBuffer, because a story there is a post with a
     different Instagram `type` rather than a follow-on call. */
  if (opts.story && !results.story) {
    results.story = await alsoStory(env, row, targets, wanted, results);
  }

  if (posted) await record(env.DB, row.id, results);
  else await release(env.DB, row.id, results);

  return { slug: row.slug, visibility: wanted, posted, failed, results };
}

/**
 * The hook sheet as a story, after the carousel is up.
 *
 * Only ever a follow-on. It runs after the post so a story never points
 * at something that is not there, and it never fails the post: a story
 * that did not go up is worth saying and not worth rolling back for.
 */
async function alsoStory(env, row, targets, visibility, results) {
  if (visibility === 'test') {
    return { ok: false, skipped: true,
      error: 'A story is public by definition, so it is not part of a test post.' };
  }
  if (!targets.includes('instagram')) {
    return { ok: false, skipped: true, error: 'Instagram is not one of the targets.' };
  }
  if (!results.instagram?.ok) {
    return { ok: false, skipped: true,
      error: 'The carousel did not go up, so a story would point at nothing.' };
  }

  const site = (env.SITE || '').replace(/\/$/, '');
  const slides = await slidesOf(env.DB, row.id);
  if (!slides.length) return { ok: false, error: 'No drawn slide to put up.' };

  const ig = await instagramToken(env.DB, env);
  if (ig.error) return { ok: false, skipped: true, error: ig.error };
  return toInstagramStory(env, {
    // slide one: the hook sheet. It is the cover and carries no instruction.
    url: `${site}/media/${slides[0].media_key}`,
    token: ig.token,
    userId: await getSetting(env.DB, 'ig.user_id') || env.IG_USER_ID,
  });
}

export async function runDue(env) {
  if (!env.DB) return { ran: 0, error: 'No database bound.' };

  const rows = await due(env.DB);
  const summary = [];

  for (const row of rows) {
    if (!await claim(env.DB, row.id)) continue;   // somebody else has it

    const { posted, failed, results } = await publish(env, row);
    if (posted) {
      await record(env.DB, row.id, results);
    } else {
      await release(env.DB, row.id, results);
    }
    summary.push({ slug: row.slug, posted, failed, results });
  }

  if (summary.some((s) => !s.posted || s.failed)) await tellSomebody(env, summary);
  return { ran: summary.length, summary };
}

/**
 * Only ever about a problem. A mail for every successful post trains you
 * to ignore the ones that matter, and the studio already shows what went
 * out.
 */
async function tellSomebody(env, summary) {
  if (!env.RESEND_API_KEY) return;
  const bad = summary.filter((s) => !s.posted || s.failed);
  if (!bad.length) return;

  const site = (env.SITE || '').replace(/\/$/, '');
  const lines = bad.map((s) => {
    const which = Object.entries(s.results)
      .filter(([, r]) => !r.ok)
      .map(([name, r]) => `    ${name}: ${r.error}`)
      .join('\n');
    return `${s.slug} — ${s.posted ? 'went out, but not everywhere' : 'did not go out'}\n${which}\n`
      + `    ${site}/studio#/social/${encodeURIComponent(s.slug)}`;
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL || 'studio@web3ashley.com',
      to: [env.TO_EMAIL || 'ashleymbaht@icloud.com'],
      subject: `${bad.length} post${bad.length === 1 ? '' : 's'} did not go out`,
      text: [
        bad.length === 1 ? 'A post did not go out.' : `${bad.length} posts did not go out.`,
        '',
        ...lines,
        '',
        'Anything that failed is back in Approved, so it can go again once it is fixed.',
      ].join('\n'),
    }),
  }).catch(() => { /* a failed mail must not fail the run */ });
}

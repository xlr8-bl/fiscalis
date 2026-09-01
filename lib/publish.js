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

import { POSTERS } from './publishers.js';
import { instagramToken, tiktokToken, getSetting } from './tokens.js';

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
      `SELECT position, media_key, copy FROM slides
       WHERE carousel_id = ?1 AND media_key != '' ORDER BY position`
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
async function publish(env, row) {
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
    creds.tiktok = { token: tt.token };
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
      const cred = creds[target] || {};
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

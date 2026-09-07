/**
 * preflight.js — everything the posting run does, stopping before the post.
 *
 * The posting path has no rehearsal. Until this existed the only way to
 * find out whether a token still worked, whether the site was reachable
 * from Meta's fetchers, or whether TikTok would take the pictures, was to
 * approve a carousel and let it go out to a real audience at a real slot
 * with nobody watching. A failure at that point has already burned the
 * slot, and the reason arrives by email an hour later.
 *
 * So: the same resolution, the same reads, the same rules, and then it
 * stops. Nothing here writes to the database and nothing here posts.
 *
 * Three things it can prove that a static check cannot:
 *
 *   the token is live      resolving it is one thing; spending it on a
 *                          real authenticated GET is another, and only
 *                          the second catches a revoked or expired one
 *   the pictures are there Meta and TikTok fetch by URL. A slide row with
 *                          a media_key proves R2 has the bytes, not that
 *                          the internet can reach them
 *   the type is real       the media table records what was uploaded. A
 *                          HEAD asks what is actually being served
 *
 * A verdict is one of:
 *   ok      it will not stop the post
 *   warn    it will probably work, and it is worth knowing
 *   stop    it will fail, and here is what to change
 *
 * Never returns a token, a secret, or any part of one.
 */

import { problems } from '../assets/js/platforms.js';
import { postingRoute, channelsOf } from './buffer.js';
import { instagramToken, tiktokToken, getSetting, putSetting, isAudited } from './tokens.js';
import { creatorInfo } from './tiktok.js';

const ok = (what, detail) => ({ verdict: 'ok', what, detail });
const warn = (what, detail) => ({ verdict: 'warn', what, detail });
const stop = (what, detail) => ({ verdict: 'stop', what, detail });

/** The slides as the posting run sees them, plus what the media table knows. */
async function slidesOf(db, carouselId) {
  const { results } = await db
    .prepare(
      `SELECT s.position, s.media_key, s.copy, s.width, s.height,
              m.content_type, m.bytes
       FROM slides s LEFT JOIN media m ON m.key = s.media_key
       WHERE s.carousel_id = ?1 AND s.media_key != ''
       ORDER BY s.position`
    )
    .bind(carouselId)
    .all();
  return results ?? [];
}

/**
 * Ask R2 what it is holding, not the site.
 *
 * This used to fetch `${SITE}/media/...`, which from inside the Worker is
 * the Worker calling its own hostname — the request comes straight back
 * to Pages Functions and the runtime kills it. Error 1101, no body, and
 * only on the per-carousel check because the accounts one fetches
 * nothing.
 *
 * `head` gives the size and the content type without the bytes, which is
 * everything the platform rules need. What it cannot prove is that the
 * public internet can reach the file; nothing running in here can.
 */
async function inBucket(bucket, key) {
  if (!bucket) return { unknown: true };
  try {
    const o = await bucket.head(key);
    if (!o) return { ok: false, status: 404 };
    return {
      ok: true,
      type: o.httpMetadata?.contentType || null,
      bytes: o.size ?? null,
    };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * The pictures, checked the way the platform will meet them.
 *
 * The media table is what the studio checked at approval. This checks the
 * same slides against the live URL, because the two disagree exactly when
 * it matters: a slide replaced after approval, a bucket that lost an
 * object, a site that is up for a browser and 403 for a fetcher.
 */
async function checkMedia(site, slides, targets, bucket) {
  const out = [];
  if (!site) {
    return [stop('the picture URLs', 'SITE is not set, so there is no absolute URL to give the platforms.')];
  }

  const checks = await Promise.all(slides.map((s) => inBucket(bucket, s.media_key)));
  if (checks.every((r) => r.unknown)) {
    return [warn('the pictures are there',
      'No R2 bucket is bound here, so this could not be checked.')];
  }

  const missing = [];
  const mismatched = [];

  checks.forEach((r, i) => {
    const no = slides[i].position + 1;
    if (!r.ok) {
      missing.push(`slide ${no} (${r.status ? `HTTP ${r.status}` : r.error})`);
      return;
    }
    // what is served wins over what was recorded: the platform reads the header
    if (r.type && slides[i].content_type && r.type !== slides[i].content_type) {
      mismatched.push(`slide ${no} is recorded as ${slides[i].content_type} and served as ${r.type}`);
    }
  });

  out.push(missing.length
    ? stop('the pictures are there',
      `${missing.join(', ')}. Meta and TikTok fetch by URL, so a slide the bucket `
      + 'does not have is a post that does not happen.')
    : ok('the pictures are there', `all ${checks.length} in the bucket.`));

  if (mismatched.length) {
    out.push(warn('the recorded type matches what is served', mismatched.join('; ')));
  }

  /* The served type is the one the platform sees, so the rules are run
     against it rather than against the row. This is the trap the direct
     road had no guard for: TikTok takes JPEG and WebP, the sheets draw as
     PNG, and the failure comes back as a transfer error. */
  const served = slides.map((s, i) => ({
    ...s,
    content_type: checks[i]?.type || s.content_type,
    bytes: checks[i]?.bytes || s.bytes,
  }));
  const rules = problems({ targets, slides: served, caption: '', hashtags: '', title: '' });
  const aboutMedia = rules.filter((p) => /^Slide /.test(p));
  out.push(aboutMedia.length
    ? stop('the pictures suit every target', aboutMedia.join(' '))
    : ok('the pictures suit every target', `${targets.join(', ') || 'no target'}.`));

  return out;
}

/* ------------------------------------------------------------- platforms */

/**
 * Spend the token on the cheapest authenticated read there is. A token
 * that resolves is not a token that works: Instagram's lasts 60 days and
 * is revoked by a password change, and nothing tells you.
 */
async function checkInstagram(env, fetcher) {
  const got = await instagramToken(env.DB, env);
  const userId = await getSetting(env.DB, 'ig.user_id') || env.IG_USER_ID;

  if (!got.token) {
    return [stop('Instagram is connected', got.error || 'No token. Connect Instagram in the studio.')];
  }
  if (!userId) {
    return [stop('Instagram knows which account', 'No ig.user_id. Reconnect Instagram from the studio.')];
  }

  const out = [];
  if (got.warning) out.push(warn('the Instagram token has life left', got.warning));

  try {
    const res = await fetcher(
      `https://graph.instagram.com/v21.0/${userId}?fields=id,username`
      + `&access_token=${encodeURIComponent(got.token)}`
    );
    const json = await res.json().catch(() => ({}));
    if (json?.error) {
      out.push(stop('the Instagram token works',
        `${json.error.message}. Reconnect Instagram in the studio.`));
    } else if (json?.id) {
      out.push(ok('the Instagram token works', `posting as @${json.username || json.id}.`));
    } else {
      out.push(warn('the Instagram token works', `HTTP ${res.status}, and no account came back.`));
    }
  } catch (e) {
    out.push(warn('the Instagram token works', `Could not reach Meta: ${String(e?.message || e)}`));
  }
  return out;
}

/**
 * creator_info is the right call to make here for two reasons: the
 * posting run has to make it anyway before every direct post, and it is
 * the only thing that answers the audit question — a public account plus
 * an unaudited app is refused however private the post claims to be.
 */
async function checkTikTok(env, fetcher) {
  const got = await tiktokToken(env.DB, env);
  if (!got.token) {
    return [stop('TikTok is connected', got.error || 'No token. Connect TikTok in the studio.')];
  }

  const out = [];
  const who = await creatorInfo(got.token, { fetcher });
  if (who.error) {
    out.push(stop('the TikTok token works',
      `${who.error}. If it mentions the scope, the app needs Content Posting on it; `
      + 'otherwise reconnect TikTok in the studio.'));
    return out;
  }

  out.push(ok('the TikTok token works',
    `posting as @${who.info.creator_username || 'the connected account'}.`));

  const audited = await isAudited(env.DB, env);
  const options = who.info.privacy_level_options;
  if (!audited && Array.isArray(options) && options.includes('PUBLIC_TO_EVERYONE')) {
    out.push(stop('the account suits an unaudited app',
      'The account is public and the app is unaudited, so TikTok will refuse the post. '
      + 'In the TikTok app: Settings and privacy, Privacy, turn on Private account.'));
  } else if (!audited) {
    out.push(warn('who will see it',
      'The app is unaudited, so anything posted goes out SELF_ONLY — only you can see it.'));
  } else {
    out.push(ok('who will see it', `${env.TIKTOK_PRIVACY || 'PUBLIC_TO_EVERYONE'}.`));
  }

  if (who.info.comment_disabled) {
    out.push(warn('comments', 'This account has comments off, and the post will honour that.'));
  }
  return out;
}

/**
 * The broker's own key, spent on the two reads the posting run makes
 * anyway: the organization, and the channels hanging off it. Proves the
 * key and names what is actually connected, in one round trip each.
 */
async function checkBuffer(env, targets, fetcher) {
  if (!env.BUFFER_API_KEY) {
    return [stop('Buffer has a key',
      'post.route is buffer and BUFFER_API_KEY is not set, so nothing can go out. '
      + 'Buffer, Settings, API.')];
  }
  // fresh: the rehearsal's job is the live state, not what was cached
  const found = await channelsOf(env, { fetcher, getSetting, putSetting, fresh: true });
  if (found.error) return [stop('the Buffer key works', found.error)];

  const linked = Object.keys(found.channels);
  const out = [ok('the Buffer key works',
    linked.length ? `connected to ${linked.join(', ')}.` : 'no channels are connected to it yet.')];

  const absent = targets.filter((t) => !linked.includes(t));
  if (absent.length) {
    out.push(stop('every target is connected at Buffer',
      `${absent.join(' and ')} not connected. Connect it in Buffer, or drop it from where this goes.`));
  }
  return out;
}

/* ------------------------------------------------------------------ run */

/**
 * @param env    the same bindings the posting run gets
 * @param row    a carousel row, as `due` returns it
 * @param opts   { fetcher } so this is testable without a network
 * @returns { ready, route, checks[] }
 */
export async function preflight(env, row, { fetcher = fetch } = {}) {
  const checks = [];
  const site = (env.SITE || '').replace(/\/$/, '');
  const targets = String(row.targets || '')
    .split(',').map((t) => t.trim()).filter(Boolean);

  const route = await postingRoute(env.DB, getSetting);

  if (!targets.length) {
    checks.push(stop('it is aimed somewhere', 'No targets on this carousel.'));
  }

  const slides = await slidesOf(env.DB, row.id);
  if (slides.length < 2) {
    checks.push(stop('there are enough pictures',
      `${slides.length} slide${slides.length === 1 ? '' : 's'} with a picture. A carousel needs two.`));
  } else {
    checks.push(ok('there are enough pictures', `${slides.length} slides.`));
    checks.push(...await checkMedia(site, slides, targets, env.MEDIA));
  }

  /* The words, against every target's own limits. Same function the
     studio runs at approval, so a carousel cannot pass there and be
     refused here for a different reason. */
  /* Only the caption, the hashtags and the title. A slide's own problem
     is reported against the pictures, and so is the count — "this has 0
     slides" under "the words fit" reads as a second, different fault
     when it is the one already named above. */
  const wordRules = problems({
    targets, slides, caption: row.caption, hashtags: row.hashtags, title: row.title,
  }).filter((p) => !/^Slide /.test(p)
                && !/slides in a carousel|photos; this has/.test(p));
  checks.push(wordRules.length
    ? stop('the words fit', wordRules.join(' '))
    : ok('the words fit', 'caption, hashtags and title are within every limit.'));

  if (route === 'buffer') {
    checks.push(ok('the road', 'Buffer, every channel in one call.'));
    checks.push(...await checkBuffer(env, targets, fetcher));
    if (targets.length > 1) {
      const set = await getSetting(env.DB, 'post.gap_minutes');
      const n = Number(set === null || set === '' ? 30 : set);
      const gap = Number.isFinite(n) ? Math.max(0, Math.min(720, n)) : 30;
      checks.push(ok('when each one goes', gap
        ? `${targets[0]} at the slot, then ${targets.slice(1).join(' and ')} `
          + `${gap} minutes apart. Neither platform requires a gap; this is so `
          + 'the same person does not see it twice at once.'
        : 'all of them at the slot, together.'));
    }
  } else {
    checks.push(ok('the road', 'direct, one platform app each.'));
    if (targets.includes('instagram')) checks.push(...await checkInstagram(env, fetcher));
    if (targets.includes('tiktok')) checks.push(...await checkTikTok(env, fetcher));
    if (targets.includes('facebook')) {
      checks.push(stop('Facebook',
        'Facebook posting was never implemented — its multi-photo shape could not be '
        + 'verified. Post it through Buffer, or drop Facebook from where this goes.'));
    }
  }

  return {
    ready: !checks.some((c) => c.verdict === 'stop'),
    route,
    slug: row.slug,
    checks,
  };
}

/**
 * The credentials on their own, with no carousel in hand — what the
 * studio's Maintenance screen wants: is the pipeline standing up.
 */
export async function preflightAccounts(env, { fetcher = fetch, targets = ['instagram', 'tiktok'] } = {}) {
  const route = await postingRoute(env.DB, getSetting);
  const checks = route === 'buffer'
    ? await checkBuffer(env, targets, fetcher)
    : (await Promise.all([
        targets.includes('instagram') ? checkInstagram(env, fetcher) : [],
        targets.includes('tiktok') ? checkTikTok(env, fetcher) : [],
      ])).flat();

  return { ready: !checks.some((c) => c.verdict === 'stop'), route, checks };
}

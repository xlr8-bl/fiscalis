/**
 * ayrshare.js — one broker instead of three platform apps. A different
 * road to the same three, chosen by the `post.route` setting, so going
 * back to direct is one field and not a deploy.
 *
 * No free plan: 28-day trial, then $149/month for one profile.
 *
 * Changes nothing about who may post. publish.js still reads `scheduled`
 * only, which the agent's credential cannot reach.
 *
 * Shapes from https://www.ayrshare.com/docs/rest-api/endpoints/post:
 *   post, platforms[], mediaUrls[] (more than one IS the carousel),
 *   scheduleDate (UTC; a past date posts immediately).
 */

import { PLATFORMS } from '../assets/js/platforms.js';

const ENDPOINT = 'https://api.ayrshare.com/api/post';

/** Ayrshare's names for the three we post to. Ours already match. */
const NETWORKS = { instagram: 'instagram', tiktok: 'tiktok', facebook: 'facebook' };

/* The lowest platform in the call wins: Ayrshare sends one set of media
   to all of them. */
const MAX_MEDIA = { instagram: 10, tiktok: 35, facebook: 10 };
const ceiling = (targets) => Math.min(...targets.map((t) => MAX_MEDIA[t] ?? 10));

/**
 * Post one carousel to every target in a single call.
 *
 * Returns the same per-target shape the direct posters return, so a
 * carousel's results read identically whichever road it took and
 * nothing downstream has to know which was used.
 */
export async function toAyrshare(env, { urls, caption, targets, scheduleFor = null }) {
  const key = env.AYRSHARE_API_KEY;
  const want = (targets ?? []).filter((t) => NETWORKS[t]);

  if (!key) {
    return skipAll(want, 'Ayrshare is selected but AYRSHARE_API_KEY is not set.');
  }
  if (!want.length) {
    return {};
  }
  if (!urls?.length) {
    return skipAll(want, 'No slides to post.');
  }

  /* Refused rather than trimmed. Silently dropping slide eleven posts a
     carousel that is missing its ending, and the ending is usually the
     instruction. */
  const max = ceiling(want);
  if (urls.length > max) {
    const who = want.filter((t) => (MAX_MEDIA[t] ?? 10) === max).join(' and ');
    return skipAll(want,
      `${urls.length} slides, and ${who} takes ${max}. Ayrshare sends one set `
      + 'of media to every platform in the call, so the lowest limit is the '
      + 'limit. Drop one, or post to the others separately.');
  }

  /* TikTok takes WebP and JPEG, not PNG, and the sheets draw as PNG.
     Through a broker that fails inside a 200 looking like a transfer
     problem. platforms.js holds the rules; do not copy them here. */
  const badFormat = [];
  for (const t of want) {
    const rules = PLATFORMS[t];
    if (!rules?.formats) continue;
    for (const url of urls) {
      const mime = mimeOf(url);
      if (mime && !rules.formats.includes(mime)) {
        badFormat.push(`${t} does not take ${mime.replace('image/', '')}`);
        break;
      }
    }
  }
  if (badFormat.length) {
    return skipAll(want,
      `${[...new Set(badFormat)].join('; ')}. Draw the slides as JPEG before posting.`);
  }

  const body = {
    post: caption,
    platforms: want.map((t) => NETWORKS[t]),
    mediaUrls: urls,
  };
  /* Ayrshare posts immediately for a date in the past, which is exactly
     what we want for "post this now" and exactly wrong to send by
     accident, so only a future time is passed at all. */
  if (scheduleFor && Date.parse(scheduleFor) > Date.now()) {
    body.scheduleDate = new Date(scheduleFor).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  let res;
  let json = null;
  let text = '';
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* the message is the text */ }
  } catch (e) {
    return failAll(want, `Ayrshare could not be reached: ${String(e?.message || e)}`);
  }

  if (!res.ok) {
    return failAll(want, reason(res, json, text));
  }

  /* One call, but the answer is per platform: a network can fail on its
     own inside a 200. Reading only the status line records all three as
     posted when one was not. */
  const byNetwork = new Map(
    (json?.postIds ?? []).map((p) => [String(p.platform || '').toLowerCase(), p])
  );

  const out = {};
  for (const target of want) {
    const hit = byNetwork.get(NETWORKS[target]);
    if (!hit) {
      out[target] = {
        ok: false,
        error: json?.errors?.find?.((e) => e.platform === NETWORKS[target])?.message
          || 'Ayrshare accepted the post but said nothing about this platform.',
      };
      continue;
    }
    if (hit.status && String(hit.status).toLowerCase() !== 'success') {
      out[target] = { ok: false, error: hit.message || `Ayrshare said ${hit.status}.` };
      continue;
    }
    out[target] = { ok: true, id: hit.id || hit.postUrl || json?.id || 'posted', via: 'ayrshare' };
  }
  return out;
}

/** What a slide's URL says it is. Unknown extensions are not guessed at. */
const mimeOf = (url) => {
  const ext = String(url).split('?')[0].split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
           webp: 'image/webp' }[ext] ?? null;
};

/** Their real reason is in `message`, not in the status line. */
const reason = (res, json, text) =>
  json?.message
    ? `${json.message}${json.code ? ` (code ${json.code})` : ''}`
    : `HTTP ${res.status}: ${text.slice(0, 300)}`;

const skipAll = (targets, error) =>
  Object.fromEntries(targets.map((t) => [t, { ok: false, skipped: true, error }]));

const failAll = (targets, error) =>
  Object.fromEntries(targets.map((t) => [t, { ok: false, error }]));

/** A setting rather than "is the key present": switching back has to be
    a decision, not a side effect of deleting a secret. */
export async function postingRoute(db, getSetting) {
  const v = String((await getSetting(db, 'post.route')) ?? 'direct').toLowerCase();
  return v === 'ayrshare' ? 'ayrshare' : 'direct';
}

/**
 * platforms.js — the actual posting calls.
 *
 * Every shape here was read off the platform's own reference page. Both
 * of them fetch media by URL rather than accepting an upload, which is
 * why the masters are served from R2 through the site.
 *
 *   Instagram  https://developers.facebook.com/docs/instagram-platform/
 *                content-publishing
 *   TikTok     https://developers.tiktok.com/doc/
 *                content-posting-api-reference-photo-post
 *
 * Each returns the same shape, so one carousel's results read the same
 * whatever went wrong:
 *
 *   { ok: true,  id }                    it went out
 *   { ok: false, error }                 it did not
 *   { ok: false, skipped: true, error }  no credential; not a failure
 */

import { creatorInfo, choosePrivacy } from './tiktok.js';

const IG_VERSION = 'v21.0';

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* the message is the text */ }
  return { res, json, text };
};

/** Meta puts its real reason in error.message, not in the status line. */
const metaError = ({ res, json, text }) =>
  json?.error?.message
    ? `${json.error.message}${json.error.error_user_msg ? ` — ${json.error.error_user_msg}` : ''}`
    : `HTTP ${res.status}: ${text.slice(0, 300)}`;

/* ------------------------------------------------------------ instagram */

/**
 * Three calls and a wait. One container per picture, one container for
 * the carousel, then publish — and between the last two, a poll, because
 * a container that is still IN_PROGRESS cannot be published and the
 * error for trying says nothing useful.
 */
export async function toInstagram(env, { urls, caption, token, userId }) {
  const id = userId || env.IG_USER_ID;
  if (!id || !token) {
    return { ok: false, skipped: true, error: 'Instagram is not connected yet.' };
  }
  const base = `https://graph.instagram.com/${IG_VERSION}`;

  // one container per slide
  const children = [];
  for (const [i, image_url] of urls.entries()) {
    const out = await post(`${base}/${id}/media`, {
      image_url, is_carousel_item: true, access_token: token,
    });
    if (!out.json?.id) return { ok: false, error: `Slide ${i + 1}: ${metaError(out)}` };
    children.push(out.json.id);
  }

  // and one for the carousel itself
  const parent = await post(`${base}/${id}/media`, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
    access_token: token,
  });
  if (!parent.json?.id) return { ok: false, error: `Carousel container: ${metaError(parent)}` };

  // "Query once per minute for up to 5 minutes." A cron firing has a
  // budget, so this waits a shorter time more often and gives up cleanly.
  const ready = await waitForContainer(base, parent.json.id, token);
  if (!ready.ok) return ready;

  const done = await post(`${base}/${id}/media_publish`, {
    creation_id: parent.json.id, access_token: token,
  });
  if (!done.json?.id) return { ok: false, error: `Publish: ${metaError(done)}` };
  return { ok: true, id: done.json.id };
}

async function waitForContainer(base, container, token, tries = 10, gap = 3000) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(
      `${base}/${container}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const json = await res.json().catch(() => ({}));
    const code = json.status_code;
    if (code === 'FINISHED') return { ok: true };
    if (code === 'ERROR') return { ok: false, error: `Container failed: ${json.status || 'no reason given'}` };
    if (code === 'EXPIRED') return { ok: false, error: 'Container expired before it was published.' };
    await new Promise((r) => setTimeout(r, gap));
  }
  return { ok: false, error: 'Container was still processing after 30 seconds.' };
}

/* --------------------------------------------------------------- tiktok */

/**
 * Two calls, and the first one is not optional.
 *
 * The Content Sharing Guidelines require reading the creator's current
 * settings before every direct post — not caching them — because they
 * decide what the post is even allowed to say: which privacy levels this
 * account may use, and whether it has switched comments off since last
 * time. Sending a `privacy_level` that is not among the options that
 * query returns is refused outright.
 *
 * And the audit. An unaudited client "can only post contents in
 * SELF_ONLY viewership" — that is about the app, not the account, so a
 * public account still reports PUBLIC_TO_EVERYONE as an option and the
 * post is refused anyway. Nothing in the API says which side of the
 * audit an app is on, so it is a setting here, defaulting to the safe
 * answer: post privately, and say so in the result rather than reporting
 * a success that nobody can see.
 *
 *   https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 *   https://developers.tiktok.com/doc/content-sharing-guidelines
 */
export async function toTikTok(env, { urls, title, description, token, audited }) {
  if (!token) {
    return { ok: false, skipped: true, error: 'TikTok is not connected yet.' };
  }

  const who = await creatorInfo(token);
  if (who.error) {
    return { ok: false, error: `Could not read the creator settings: ${who.error}` };
  }

  const wanted = audited ? (env.TIKTOK_PRIVACY || 'PUBLIC_TO_EVERYONE') : 'SELF_ONLY';
  const privacy = choosePrivacy(who.info.privacy_level_options, wanted);

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      post_info: {
        // 90 UTF-16 runes, per the reference
        title: String(title || '').slice(0, 90),
        description: String(description || '').slice(0, 4000),
        privacy_level: privacy.level,
        // the guidelines say a creator who has turned comments off must
        // not have them turned back on by an integration
        disable_comment: Boolean(who.info.comment_disabled),
        auto_add_music: true,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_images: urls,
        photo_cover_index: 0,
      },
      is_aigc: true,   // the pictures are generated, and saying so is the rule
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (json?.error?.code && json.error.code !== 'ok') {
    return { ok: false, error: tiktokError(json.error) };
  }
  const publishId = json?.data?.publish_id;
  if (!publishId) return { ok: false, error: `HTTP ${res.status}: no publish_id came back.` };

  return {
    ok: true,
    id: publishId,
    privacy: privacy.level,
    ...(who.info.creator_username ? { as: who.info.creator_username } : {}),
    ...(privacy.level === 'SELF_ONLY'
      ? { note: audited
            ? 'Posted, but only you can see it — SELF_ONLY was the only privacy level this account offered.'
            : 'Posted privately. Until the app passes TikTok\'s audit, only you can see it.' }
      : {}),
  };
}

/**
 * The codes worth translating, because each one names a setup step that
 * is nowhere near the code and would otherwise be a shrug.
 */
function tiktokError(error) {
  const code = error.code || 'error';
  const said = error.message || 'no message';
  const explain = {
    url_ownership_unverified:
      'TikTok will not fetch pictures from a domain the app has not proved it owns. '
      + 'Add the site as a URL property under Manage apps and verify it.',
    scope_not_authorized:
      'The token does not carry video.publish. Reconnect TikTok from the studio '
      + 'once the Content Posting product is on the app.',
    access_token_invalid: 'The TikTok token is no longer valid. Reconnect it in the studio.',
    spam_risk_too_many_posts: 'TikTok\'s daily post cap for this account has been reached.',
    spam_risk_too_many_pending_share:
      'TikTok allows five uploads pending at a time; some are still processing.',
    rate_limit_exceeded: 'TikTok is rate limiting this app. It will work again shortly.',
    privacy_level_option_mismatch:
      'TikTok refused the privacy level. An unaudited app can only post SELF_ONLY.',
  }[code];
  return explain ? `${code}: ${said} — ${explain}` : `${code}: ${said}`;
}

/* ------------------------------------------------------------- facebook */

/**
 * Not implemented, deliberately.
 *
 * The multi-photo shape is not on the Pages API guide, and its reference
 * pages were erroring when this was written, so there was nothing to read
 * it off. A guessed call that posts the wrong thing to a real audience is
 * worse than one that says it did nothing — so this says it did nothing,
 * every time, in the results.
 */
export async function toFacebook() {
  return {
    ok: false,
    skipped: true,
    error: 'Facebook posting is not implemented — its multi-photo shape was never verified.',
  };
}

export const POSTERS = {
  instagram: toInstagram,
  tiktok: toTikTok,
  facebook: toFacebook,
};

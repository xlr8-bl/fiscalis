/**
 * tokens.js — keeping the platform tokens alive.
 *
 * Neither platform issues a token you can set once and forget:
 *
 *   Instagram  long-lived tokens last 60 days and can be refreshed once
 *              they are 24 hours old. One that goes 60 days without a
 *              refresh expires and cannot be refreshed at all — it has
 *              to be granted again by hand.
 *   TikTok     the access token lasts 24 hours. The refresh token lasts
 *              365 days and is what actually gets stored.
 *
 * A Cloudflare secret cannot be written by the Worker that reads it, so
 * a token in a secret is a token that dies on its own schedule with
 * nobody watching — which is the failure this whole pipeline is built to
 * avoid. They live in `settings` instead, where they can be rewritten,
 * and a secret is only ever a starting value.
 *
 * Refresh happens on use. Anything else needs a second schedule to go
 * wrong.
 *
 *   https://developers.facebook.com/docs/instagram-platform/
 *     instagram-api-with-instagram-login/business-login
 *   https://developers.tiktok.com/doc/oauth-user-access-token-management
 */

import { credentials } from './tiktok.js';

const now = () => Math.floor(Date.now() / 1000);

/* --------------------------------------------------------------- store */

export async function getSetting(db, key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?1').bind(key).first();
  return row?.value ?? null;
}

export async function putSetting(db, key, value) {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at, updated_by)
       VALUES (?1, ?2, datetime('now'), 'poster')
       ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now'),
                                      updated_by = 'poster'`
    )
    .bind(key, String(value ?? ''))
    .run();
}

/* ----------------------------------------------------------- instagram */

/**
 * Instagram's long-lived token, refreshed when it is over halfway
 * through its 60 days. Refreshing early is free; refreshing late is not
 * possible, so the margin is deliberately wide.
 */
export async function instagramToken(db, env) {
  let token = await getSetting(db, 'ig.token');
  let since = Number(await getSetting(db, 'ig.refreshed_at')) || 0;

  // a secret is only ever the starting value
  if (!token && env.IG_ACCESS_TOKEN) {
    token = env.IG_ACCESS_TOKEN;
    since = now();
    await putSetting(db, 'ig.token', token);
    await putSetting(db, 'ig.refreshed_at', String(since));
  }
  if (!token) return { token: null, error: 'Instagram is not connected yet.' };

  const age = now() - since;
  const HALFWAY = 30 * 24 * 60 * 60;
  const DAY = 24 * 60 * 60;
  // it must be at least a day old to be refreshable at all
  if (age < HALFWAY || age < DAY) return { token };

  try {
    const res = await fetch(
      'https://graph.instagram.com/refresh_access_token'
      + `?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    );
    const json = await res.json().catch(() => ({}));
    if (json.access_token) {
      await putSetting(db, 'ig.token', json.access_token);
      await putSetting(db, 'ig.refreshed_at', String(now()));
      return { token: json.access_token, refreshed: true };
    }
    // a failed refresh is not a failed post — the old token is still good
    // until it actually expires, so this reports and carries on
    return { token, warning: `Instagram token refresh failed: ${json?.error?.message || res.status}` };
  } catch (e) {
    return { token, warning: `Instagram token refresh failed: ${String(e.message || e)}` };
  }
}

/* -------------------------------------------------------------- tiktok */

/**
 * TikTok's access token is good for a day, so it is refreshed whenever
 * it is within an hour of expiring. What is actually kept is the refresh
 * token, which lasts a year — and which the refresh call replaces, so it
 * has to be written back or the chain breaks a day later.
 */
export async function tiktokToken(db, env) {
  let access = await getSetting(db, 'tiktok.token');
  let refresh = await getSetting(db, 'tiktok.refresh_token');
  let expires = Number(await getSetting(db, 'tiktok.expires_at')) || 0;

  if (!refresh && env.TIKTOK_REFRESH_TOKEN) {
    refresh = env.TIKTOK_REFRESH_TOKEN;
    await putSetting(db, 'tiktok.refresh_token', refresh);
  }
  if (!access && env.TIKTOK_ACCESS_TOKEN) {
    access = env.TIKTOK_ACCESS_TOKEN;
    expires = now() + 23 * 60 * 60;
    await putSetting(db, 'tiktok.token', access);
    await putSetting(db, 'tiktok.expires_at', String(expires));
  }

  const HOUR = 60 * 60;
  if (access && expires > now() + HOUR) return { token: access };

  if (!refresh) {
    return {
      token: access || null,
      error: access
        ? 'The TikTok token is about to expire and there is no refresh token to renew it.'
        : 'TikTok is not connected yet.',
    };
  }
  const app = await credentials(db, env, { getSetting });
  if (!app.key || !app.secret) {
    return {
      token: access || null,
      error: 'The TikTok client key and secret are needed to renew the token. '
        + 'Set them in the studio under Social, Accounts.',
    };
  }

  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: app.key,
        client_secret: app.secret,
        grant_type: 'refresh_token',
        refresh_token: refresh,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json.access_token) {
      return { token: access || null, error: `TikTok token refresh failed: ${json?.error_description || json?.error || res.status}` };
    }
    await putSetting(db, 'tiktok.token', json.access_token);
    await putSetting(db, 'tiktok.expires_at', String(now() + (Number(json.expires_in) || 86400) - 60));
    // the refresh token is replaced by this call; not writing it back is
    // a pipeline that works today and stops tomorrow
    if (json.refresh_token) await putSetting(db, 'tiktok.refresh_token', json.refresh_token);
    return { token: json.access_token, refreshed: true };
  } catch (e) {
    return { token: access || null, error: `TikTok token refresh failed: ${String(e.message || e)}` };
  }
}

/**
 * Whether TikTok has audited this app.
 *
 * Nothing in the API says. An unaudited client can only post SELF_ONLY,
 * and finding that out by having a week of posts land where nobody can
 * see them is an expensive way to learn it — so the default is the safe
 * answer and turning it on is a deliberate act, taken once, in the
 * studio, after the audit actually passes.
 */
export async function isAudited(db, env) {
  const stored = await getSetting(db, 'tiktok.audited');
  if (stored !== null) return stored === '1' || stored === 'true';
  return String(env.TIKTOK_AUDITED || '') === 'true';
}

/* --------------------------------------------------------------- state */

/** What the studio shows: connected or not, and how long is left. */
export async function accountState(db, env) {
  const igToken = (await getSetting(db, 'ig.token')) || env.IG_ACCESS_TOKEN || '';
  const igSince = Number(await getSetting(db, 'ig.refreshed_at')) || 0;
  const ttRefresh = (await getSetting(db, 'tiktok.refresh_token')) || env.TIKTOK_REFRESH_TOKEN || '';
  const ttExpires = Number(await getSetting(db, 'tiktok.expires_at')) || 0;
  const app = await credentials(db, env, { getSetting });
  const days = (s) => Math.max(0, Math.round(s / 86400));

  return {
    instagram: {
      connected: Boolean(igToken),
      user_id: (await getSetting(db, 'ig.user_id')) || env.IG_USER_ID || '',
      // 60 days from the last refresh, and it renews itself well before
      expires_in_days: igSince ? days(igSince + 60 * 86400 - now()) : null,
    },
    tiktok: {
      connected: Boolean(ttRefresh),
      // the access token is a day; the refresh token is the one that matters
      access_expires_in_hours: ttExpires ? Math.max(0, Math.round((ttExpires - now()) / 3600)) : null,
      can_renew: Boolean(app.key && app.secret),
      // the app is set up well enough to run the connect flow at all
      can_connect: Boolean(app.key && app.secret),
      // which client, and whether it came from the studio or the deployment
      client_key_ends: app.key ? app.key.slice(-4) : '',
      client_from: app.source,
      username: (await getSetting(db, 'tiktok.username')) || '',
      scopes: (await getSetting(db, 'tiktok.scopes')) || '',
      // until this is true every post lands where only you can see it
      audited: await isAudited(db, env),
    },
  };
}

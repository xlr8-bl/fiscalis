/**
 * instagram.js — connecting the account.
 *
 * Business Login for Instagram, which is the flow for "Instagram API with
 * Instagram Login" — the one that needs **no Facebook Page**. Meta says
 * so directly: "This API setup does not require a Facebook Page to be
 * linked to the Instagram professional account."
 *
 * Read off:
 *   https://developers.facebook.com/docs/instagram-platform/
 *     instagram-api-with-instagram-login/business-login
 *   https://developers.facebook.com/docs/instagram-platform/
 *     instagram-api-with-instagram-login
 *
 * Three hosts, which is the part that catches people out, because they
 * are not interchangeable and the errors do not say which one you wanted:
 *
 *   www.instagram.com     where the person approves
 *   api.instagram.com     code -> short-lived token          (POST)
 *   graph.instagram.com   short-lived -> long-lived, refresh, and every
 *                         call that actually posts something (GET)
 *
 * The token you finish with lasts 60 days and is refreshable; the one the
 * code buys lasts an hour. Storing the short one is a pipeline that works
 * this afternoon and not tomorrow, so the exchange is not optional and is
 * done here rather than left to the caller to remember.
 */

const AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const TOKEN = 'https://api.instagram.com/oauth/access_token';
const GRAPH = 'https://graph.instagram.com';

/**
 * What to ask for.
 *
 *   instagram_business_basic            who the account is. Nothing works
 *                                       without it.
 *   instagram_business_content_publish  posting. This is the whole point.
 *
 * Deliberately not asked for: manage_messages and manage_comments. They
 * are on offer and this never reads a DM or moderates a comment, and a
 * permission you do not use is one more thing to justify at App Review.
 */
export const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];

/** Reading likes and reach back needs this as well — see lib/insights.js. */
export const INSIGHTS_SCOPE = 'instagram_business_manage_insights';

export function scopes(env) {
  const extra = String(env.IG_SCOPES || '')
    .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return [...new Set([...SCOPES, ...extra])];
}

/* --------------------------------------------------------- credentials */

export const appId = (env) => String(env.IG_APP_ID || '').trim();
export const appSecret = (env) => String(env.IG_APP_SECRET || '').trim();

/**
 * Which app to act as. Stored in the studio for the same reason TikTok's
 * is: a value that lives in the deployment costs a dashboard edit and a
 * build to change, and this one gets changed while it is being set up.
 */
export async function credentials(db, env, { getSetting } = {}) {
  if (db && getSetting) {
    const id = (await getSetting(db, 'ig.app_id')) || '';
    const secret = (await getSetting(db, 'ig.app_secret')) || '';
    if (id.trim() && secret.trim()) {
      return { id: id.trim(), secret: secret.trim(), source: 'studio' };
    }
  }
  return { id: appId(env), secret: appSecret(env), source: 'environment' };
}

/* ------------------------------------------------------------- the flow */

/** Registered under the app's valid OAuth redirect URIs, matched exactly. */
export const redirectUri = (origin) => `${origin.replace(/\/$/, '')}/oauth/instagram/callback`;

export function authorizeUrl(env, { origin, state, id }) {
  const url = new URL(AUTHORIZE);
  url.searchParams.set('client_id', id ?? appId(env));
  url.searchParams.set('redirect_uri', redirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes(env).join(','));
  if (state) url.searchParams.set('state', state);
  // this is the Instagram-Login flow, so the Facebook Login button on the
  // approval screen is an offer to start the wrong one
  url.searchParams.set('enable_fb_login', '0');
  return url.toString();
}

/** Meta puts the real reason in error_message, not in the status line. */
const reason = (json, res) =>
  json?.error_message || json?.error?.message || json?.error_description
  || `HTTP ${res.status}`;

/**
 * The whole exchange: code, then straight on to the 60-day token.
 *
 * Two calls rather than one because Meta made them two, and stopping
 * after the first leaves you holding an hour-long token that looks
 * identical to a good one.
 */
export async function exchange(env, { origin, code, id, secret, fetcher = fetch } = {}) {
  const clientId = id ?? appId(env);
  const clientSecret = secret ?? appSecret(env);
  if (!clientId || !clientSecret) return { error: 'The app ID or secret is not set.' };

  let short;
  try {
    const res = await fetcher(TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(origin),
        // Meta hands the code back with #_ stuck on the end of the URL,
        // and sending that through is an invalid code with no clue why
        code: String(code).replace(/#_$/, ''),
      }),
    });
    short = await res.json().catch(() => ({}));
    if (!short.access_token) return { error: reason(short, res) };
  } catch (e) {
    return { error: String(e.message || e) };
  }

  let long;
  try {
    const res = await fetcher(
      `${GRAPH}/access_token?grant_type=ig_exchange_token`
      + `&client_secret=${encodeURIComponent(clientSecret)}`
      + `&access_token=${encodeURIComponent(short.access_token)}`
    );
    long = await res.json().catch(() => ({}));
    if (!long.access_token) {
      return { error: `The 60-day exchange failed: ${reason(long, res)}` };
    }
  } catch (e) {
    return { error: `The 60-day exchange failed: ${String(e.message || e)}` };
  }

  return {
    token: long.access_token,
    expiresIn: Number(long.expires_in) || 60 * 24 * 60 * 60,
    userId: String(short.user_id || ''),
    permissions: String(short.permissions || ''),
  };
}

/** Who this token belongs to — the first real proof it works. */
export async function whoAmI(token, { fetcher = fetch } = {}) {
  try {
    const res = await fetcher(
      `${GRAPH}/v21.0/me?fields=user_id,username,account_type`
      + `&access_token=${encodeURIComponent(token)}`
    );
    const json = await res.json().catch(() => ({}));
    if (json?.error) return { error: reason(json, res) };
    return { me: json };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

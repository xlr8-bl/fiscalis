/**
 * tiktok.js — connecting the account, and asking it what it will allow.
 *
 * TikTok will not let you paste a token out of a dashboard the way Meta
 * will. The only way to get one is to walk Login Kit's authorization
 * flow, which means the site has to host both ends of it — which is also
 * the right answer here, because the studio is run from a phone and
 * hand-assembling an OAuth redirect on a phone is not a thing anybody
 * should have to do.
 *
 * Read off:
 *   https://developers.tiktok.com/doc/login-kit-web
 *   https://developers.tiktok.com/doc/oauth-user-access-token-management
 *   https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
 *   https://developers.tiktok.com/doc/content-sharing-guidelines
 *
 * Three things about this flow that are not obvious and cost a day each
 * if assumed:
 *
 *   The redirect URI must be HTTPS, absolute, static, and carry no query
 *   string at all — so state cannot ride along in the URL the way it
 *   usually would. It is registered in the app dashboard and matched
 *   exactly; a trailing slash is a different URI.
 *
 *   `code_verifier` is "required for mobile and desktop app only". This
 *   is a web app, so PKCE is not part of the exchange.
 *
 *   Scopes are comma separated, not space separated, which is the
 *   opposite of every other OAuth server.
 */

const AUTHORIZE = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const CREATOR_INFO = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';

/**
 * What to ask for.
 *
 *   user.info.basic  Login Kit gives this; the exchange fails without it
 *   video.publish    the Content Posting API's direct-post scope
 *   video.list       reading likes and views back — but it belongs to the
 *                    Display API product, so an app that has not added
 *                    that product cannot be granted it, and asking for a
 *                    scope the app does not hold fails the whole
 *                    authorization rather than dropping that one. So it
 *                    is opt-in through the environment.
 */
export const BASE_SCOPES = ['user.info.basic', 'video.publish'];

export function scopes(env) {
  const extra = String(env.TIKTOK_SCOPES || '')
    .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return [...new Set([...BASE_SCOPES, ...extra])];
}

/** The one URI registered in the app dashboard. No query string allowed. */
export const redirectUri = (origin) => `${origin.replace(/\/$/, '')}/oauth/tiktok/callback`;

export function authorizeUrl(env, { origin, state }) {
  const url = new URL(AUTHORIZE);
  url.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY);
  url.searchParams.set('response_type', 'code');
  // comma separated, per the Login Kit reference
  url.searchParams.set('scope', scopes(env).join(','));
  url.searchParams.set('redirect_uri', redirectUri(origin));
  url.searchParams.set('state', state);
  return url.toString();
}

const form = (fields) => new URLSearchParams(fields).toString();

async function tokenCall(fields) {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form(fields),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.access_token) {
    return {
      error: json.error_description || json.error || json?.message || `HTTP ${res.status}`,
    };
  }
  return { token: json };
}

/** code -> tokens. `redirect_uri` has to be the same string as before. */
export function exchange(env, { origin, code }) {
  return tokenCall({
    client_key: env.TIKTOK_CLIENT_KEY,
    client_secret: env.TIKTOK_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(origin),
  });
}

/**
 * The creator's current settings, which the Content Sharing Guidelines
 * require reading before every direct post rather than caching: what
 * privacy levels this account may use, and whether it has switched off
 * comments since the last time.
 */
export async function creatorInfo(token, { fetcher = fetch } = {}) {
  try {
    const res = await fetcher(CREATOR_INFO, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
      },
    });
    const json = await res.json().catch(() => ({}));
    if (json?.error?.code && json.error.code !== 'ok') {
      return { error: `${json.error.code}: ${json.error.message || 'no message'}` };
    }
    return { info: json?.data || {} };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

/**
 * Which privacy level to post at.
 *
 * An unaudited client "can only post contents in SELF_ONLY viewership",
 * and sending anything else is refused outright — so the option list the
 * account actually reports is the only safe source. A preference that is
 * not on it is not an error to fail the post over; it is a fact about
 * the app's audit state, and the right move is to post at the most
 * private level available and say loudly which one was used.
 */
export function choosePrivacy(options, wanted) {
  const list = Array.isArray(options) ? options : [];
  if (!list.length) return { level: wanted || 'SELF_ONLY', assumed: true };
  if (wanted && list.includes(wanted)) return { level: wanted };
  // most private first: being quieter than intended is recoverable,
  // being louder than intended is not
  for (const fallback of ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS',
                          'FOLLOWER_OF_CREATOR', 'PUBLIC_TO_EVERYONE']) {
    if (list.includes(fallback)) {
      return { level: fallback, ...(wanted ? { insteadOf: wanted } : {}) };
    }
  }
  return { level: list[0], ...(wanted ? { insteadOf: wanted } : {}) };
}

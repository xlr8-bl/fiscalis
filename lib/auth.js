/**
 * auth.js — people and the agent, deliberately unequal.
 *
 *   a person  signs in by name. Can do anything, and their name is recorded
 *             against everything they save.
 *   the agent a bearer token (AGENT_TOKEN) for Gemini Spark. Can create and
 *             edit articles awaiting review and nothing else — it cannot
 *             publish, cannot delete, and cannot touch anything already live.
 *
 * The split is the point. The agent researches the open web, so anything it
 * reads can try to instruct it; the ceiling on that is what its credential
 * is allowed to do, not what it can be talked into asking for.
 *
 * Accounts come from STUDIO_USERS, a JSON object of name to password:
 *
 *     {"ashley":"…","sam":"…"}
 *
 * With only STUDIO_PASSWORD set there is one account called "studio", so a
 * single-person setup needs no extra configuration and adding a colleague is
 * one secret rather than a migration.
 */

const COOKIE = 'w3a_studio';
const SESSION_HOURS = 12;

/** Constant-time compare, so a wrong token cannot be found a byte at a time. */
export function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(String(a ?? ''));
  const y = new TextEncoder().encode(String(b ?? ''));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

/** The configured accounts, as name -> password. */
export function accounts(env) {
  if (env.STUDIO_USERS) {
    try {
      const parsed = JSON.parse(env.STUDIO_USERS);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed;
    } catch {
      // a malformed secret must not silently fall back to a weaker rule
      return {};
    }
  }
  return env.STUDIO_PASSWORD ? { studio: env.STUDIO_PASSWORD } : {};
}

/** The name whose password matches, or null. Constant time per account. */
export function authenticate(env, name, password) {
  const users = accounts(env);
  const candidate = String(name || '').trim().toLowerCase();
  let found = null;
  for (const [user, secret] of Object.entries(users)) {
    // every account is checked, so the work does not reveal which name exists
    const nameOk = candidate ? user.toLowerCase() === candidate : true;
    if (timingSafeEqual(password, secret) && nameOk && !found) found = user;
  }
  return found;
}

/** A signed, expiring cookie carrying the signed-in name. */
export async function createSession(env, user) {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  const payload = `${encodeURIComponent(user)}.${expires}`;
  const secret = env.SESSION_SECRET || env.STUDIO_PASSWORD;
  return `${payload}.${await sign(payload, secret)}`;
}

/** @returns {Promise<string|null>} the signed-in name */
export async function verifySession(token, env) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [user, expires, mac] = parts;
  if (!user || !Number(expires) || Number(expires) < Date.now()) return null;
  const secret = env.SESSION_SECRET || env.STUDIO_PASSWORD;
  if (!timingSafeEqual(mac, await sign(`${user}.${expires}`, secret))) return null;
  return decodeURIComponent(user);
}

/**
 * SameSite is `Lax`, and the difference matters.
 *
 * `Strict` withholds the cookie on *every* cross-site request, top-level
 * navigations included — which means the browser coming back from
 * TikTok's approval screen to /oauth/tiktok/callback arrives with no
 * session at all, and the callback can only say "sign in first". No OAuth
 * return can work under Strict. That is not a TikTok quirk; it is what
 * Strict is for.
 *
 * `Lax` sends it on a top-level GET navigation and withholds it from
 * cross-site POST, fetch and XHR. Everything here that changes anything
 * is a POST, PUT or DELETE, so the CSRF protection Strict was bought for
 * is still in place — and this flow has its own signed, short-lived state
 * on top of that.
 */
export function sessionCookie(value, { clear = false } = {}) {
  const age = clear ? 0 : SESSION_HOURS * 3600;
  return (
    `${COOKIE}=${clear ? '' : value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`
  );
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/**
 * @returns {Promise<{kind:'studio'|'agent', name:string}|null>}
 */
export async function identify(request, env) {
  const cookie = readCookie(request, COOKIE);
  if (cookie) {
    const user = await verifySession(cookie, env);
    if (user) return { kind: 'studio', name: user };
  }

  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (bearer && env.AGENT_TOKEN && timingSafeEqual(bearer, env.AGENT_TOKEN)) {
    return { kind: 'agent', name: 'Spark' };
  }

  return null;
}

/** What each identity may do. The agent's list is the whole security model. */
/**
 * What the agent token may do to an article.
 *
 * `publish` is in here, and `unpublish`, `delete` and `upload` are not.
 *
 * The token can now put a post on the site, which is a real change and
 * was asked for deliberately. It is bounded on three sides. It can only
 * publish something already in `review`, which is a state only it writes
 * into. The publish path re-runs every check against the stored row
 * rather than trusting whatever wrote it. And publishing is undone from
 * the studio in one tap, which is the difference between this and the
 * social pipeline — where the same token still cannot approve, schedule
 * or post, because a post on somebody else's platform cannot be pulled
 * back and this can.
 *
 * The list lives here rather than in the MCP endpoint so that the REST
 * API and MCP agree. They are the same credential, and a credential that
 * is refused down one road and allowed down another is not a ceiling,
 * it is a bug waiting for whoever finds the second road.
 */
export const AGENT_ALLOWED = new Set(['list', 'create', 'update', 'get', 'publish']);

export function agentMayTouch(row) {
  // never an article that is live, and never one a person is working on
  return !row || row.status === 'review';
}

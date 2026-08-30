/**
 * auth.js — two identities, deliberately unequal.
 *
 *   studio  a person signed in with STUDIO_PASSWORD. Can do anything.
 *   agent   a bearer token (AGENT_TOKEN) for Gemini Spark. Can create and
 *           edit drafts and nothing else — it cannot publish, cannot delete,
 *           and cannot touch anything already published.
 *
 * The split is the point. The agent researches the open web, so anything it
 * reads can try to instruct it; the ceiling on that is what its credential
 * is allowed to do, not what it can be talked into asking for.
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

/** A signed, expiring cookie value. No storage needed to validate it. */
export async function createSession(env) {
  const expires = Date.now() + SESSION_HOURS * 3600_000;
  const payload = `studio.${expires}`;
  const secret = env.SESSION_SECRET || env.STUDIO_PASSWORD;
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySession(token, env) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return false;
  const [role, expires, mac] = parts;
  if (role !== 'studio') return false;
  if (!Number(expires) || Number(expires) < Date.now()) return false;
  const secret = env.SESSION_SECRET || env.STUDIO_PASSWORD;
  return timingSafeEqual(mac, await sign(`${role}.${expires}`, secret));
}

export function sessionCookie(value, { clear = false } = {}) {
  const age = clear ? 0 : SESSION_HOURS * 3600;
  return (
    `${COOKIE}=${clear ? '' : value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`
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
 * @returns {Promise<'studio'|'agent'|null>}
 */
export async function identify(request, env) {
  const cookie = readCookie(request, COOKIE);
  if (cookie && (await verifySession(cookie, env))) return 'studio';

  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (bearer && env.AGENT_TOKEN && timingSafeEqual(bearer, env.AGENT_TOKEN)) return 'agent';

  return null;
}

/** What each identity may do. The agent's list is the whole security model. */
export const AGENT_ALLOWED = new Set(['list', 'create', 'update', 'get']);

export function agentMayTouch(row) {
  // never an article that is live, and never one a person is working on
  return !row || row.status === 'review';
}

/**
 * oauth.js — the authorization server the MCP spec requires.
 *
 * Gemini Spark will not accept a static bearer token. Its "custom
 * connected app" panel asks for an OAuth client ID and secret and hands
 * back a redirect URI, because the MCP authorization spec is OAuth 2.1:
 * an MCP server MUST publish Protected Resource Metadata (RFC 9728), and
 * its authorization server MUST implement OAuth 2.1 with PKCE.
 *
 * So this is a small OAuth 2.1 authorization server, hosted alongside the
 * resource it protects. It does exactly what is needed for one client and
 * one user, and nothing else:
 *
 *   /.well-known/oauth-protected-resource   where the auth server lives
 *   /.well-known/oauth-authorization-server what it can do
 *   /oauth/authorize                        a person approves, once
 *   /oauth/token                            code + verifier -> token
 *
 * Deliberately not implemented, because nothing here needs them: dynamic
 * client registration (the spec now calls it deprecated in favour of
 * Client ID Metadata Documents), and any grant other than
 * authorization_code and refresh_token.
 *
 * Written from:
 *   https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
 *   RFC 9728 (protected resource metadata), RFC 8414 (AS metadata),
 *   RFC 8707 (resource indicators), RFC 9207 (issuer identification)
 */

import { timingSafeEqual } from './auth.js';

/** One scope. The client either may drive the pipeline or it may not. */
export const SCOPE = 'carousels:write';

export const CODE_TTL = 120;          // seconds. Long enough to redirect.
export const TOKEN_TTL = 60 * 60 * 8; // a working day
export const REFRESH_TTL = 60 * 60 * 24 * 60;

const enc = new TextEncoder();

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (s) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(pad + '='.repeat((4 - pad.length % 4) % 4)), (c) => c.charCodeAt(0));
};

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

/**
 * A signed, self-describing access token. Stateless on purpose: a token
 * is checked on every MCP request, and a database read per request buys
 * nothing when the only revocation story is rotating the secret.
 *
 * The audience is in the token and checked on use, which is what stops a
 * token minted for this server being replayed at another (RFC 8707).
 */
export async function mintToken(env, { subject, scope, resource, kind = 'access', ttl }) {
  const body = {
    sub: subject,
    scope,
    aud: resource,
    kind,
    iss: issuer(env),
    exp: Math.floor(Date.now() / 1000) + (ttl ?? (kind === 'refresh' ? REFRESH_TTL : TOKEN_TTL)),
    jti: crypto.randomUUID(),
  };
  const payload = b64url(enc.encode(JSON.stringify(body)));
  return `${payload}.${await hmac(payload, env.SESSION_SECRET)}`;
}

/**
 * @returns {Promise<{sub,scope,aud,kind,exp}|null>} null for anything that
 * does not verify, is expired, or was issued for a different audience.
 */
export async function readToken(env, token, { resource, kind = 'access' } = {}) {
  if (!env.SESSION_SECRET) return null;
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  if (!timingSafeEqual(sig, await hmac(payload, env.SESSION_SECRET))) return null;

  let body;
  try { body = JSON.parse(new TextDecoder().decode(unb64url(payload))); } catch { return null; }
  if (body.kind !== kind) return null;
  if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
  // the audience check is the whole point of the resource parameter
  if (resource && body.aud && body.aud !== resource) return null;
  return body;
}

/** This deployment's own origin, from the request rather than a constant. */
export const originOf = (request) => new URL(request.url).origin;
export const issuer = (env) => (env.__origin || '').replace(/\/$/, '');

/** The canonical URI of the thing being protected. */
export const resourceUri = (origin) => `${origin}/mcp`;

/* ------------------------------------------------------------- metadata */

/** RFC 9728. What a 401 points at, so a client can find the auth server. */
export function protectedResourceMetadata(origin) {
  return {
    resource: resourceUri(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_documentation: `${origin}/`,
  };
}

/** RFC 8414. What the auth server supports. */
export function authorizationServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    scopes_supported: [SCOPE],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // OAuth 2.1 requires PKCE, and S256 is the only method worth offering
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    // RFC 8707, so a token is bound to the server it was asked for
    resource_indicators_supported: true,
    // RFC 9207, so a client can tell which server answered
    authorization_response_iss_parameter_supported: true,
  };
}

/* --------------------------------------------------------------- client */

/**
 * The one registered client. Spark's panel asks for an ID and a secret,
 * which means pre-registration — the spec's third path, and the only one
 * that needs no extra moving parts for a single known client.
 */
export function client(env) {
  const id = env.MCP_CLIENT_ID || '';
  const secret = env.MCP_CLIENT_SECRET || '';
  const redirects = String(env.MCP_REDIRECT_URIS || '')
    .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return { id, secret, redirects, configured: Boolean(id && secret && redirects.length) };
}

/** Exact match, per OAuth 2.1 — no prefix matching, no wildcards. */
export function redirectAllowed(env, uri) {
  return client(env).redirects.includes(String(uri || ''));
}

/* ----------------------------------------------------------------- PKCE */

export async function verifyChallenge(verifier, challenge, method = 'S256') {
  if (method !== 'S256') return false;
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(verifier || '')));
  return timingSafeEqual(b64url(digest), String(challenge || ''));
}

/* ---------------------------------------------------------------- codes */

/**
 * Authorization codes are rows, not signatures, because a code has to be
 * single use and a signed stateless code can be replayed inside its own
 * lifetime. Exchanging one deletes it; the same call sweeps whatever has
 * expired, so nothing has to run on a schedule.
 */
export async function issueCode(db, fields) {
  const code = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await db
    .prepare(
      `INSERT INTO oauth_codes
         (code, client_id, redirect_uri, code_challenge, method, resource,
          scope, subject, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      code, fields.client_id, fields.redirect_uri, fields.code_challenge,
      fields.method || 'S256', fields.resource || '', fields.scope || SCOPE,
      fields.subject || '', Math.floor(Date.now() / 1000) + CODE_TTL
    )
    .run();
  return code;
}

/** Take a code, and take it out of circulation in the same breath. */
export async function claimCode(db, code) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare('SELECT * FROM oauth_codes WHERE code = ?1')
    .bind(String(code || ''))
    .first();
  await db.prepare('DELETE FROM oauth_codes WHERE code = ?1 OR expires_at < ?2')
    .bind(String(code || ''), now).run();
  if (!row || row.expires_at < now) return null;
  return row;
}

/* --------------------------------------------------------------- errors */

export const oauthError = (error, description, status = 400) =>
  new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

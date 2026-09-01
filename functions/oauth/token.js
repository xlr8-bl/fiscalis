/**
 * /oauth/token — a code and its verifier, for a token.
 *
 * Two grants and no others: `authorization_code`, and `refresh_token` so
 * Spark does not have to send you back to a password box every eight
 * hours.
 *
 * The three things that make this safe rather than merely working:
 * the code is a row and is deleted the moment it is claimed, so it cannot
 * be replayed; the PKCE verifier has to hash to the challenge that came
 * with it; and the token carries the resource it was minted for, which is
 * checked again when it is used.
 */

import {
  SCOPE, TOKEN_TTL, client, claimCode, verifyChallenge, mintToken, readToken,
  resourceUri, originOf, oauthError,
} from '../../lib/oauth.js';
import { timingSafeEqual } from '../../lib/auth.js';

const noStore = { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache' };

const ok = (body) => new Response(JSON.stringify(body), { headers: noStore });

/** Either form the metadata advertises: post body, or basic auth. */
function credentials(request, form) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('basic ')) {
    try {
      const [id, ...rest] = atob(auth.slice(6)).split(':');
      return { id: decodeURIComponent(id), secret: decodeURIComponent(rest.join(':')) };
    } catch { /* fall through to the body */ }
  }
  return { id: form.get('client_id') || '', secret: form.get('client_secret') || '' };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
      },
    });
  }
  if (request.method !== 'POST') {
    return oauthError('invalid_request', 'The token endpoint takes POST.', 405);
  }
  if (!env.DB) return oauthError('temporarily_unavailable', 'No database is bound.', 503);

  const app = client(env);
  if (!app.configured) {
    return oauthError('invalid_client', 'This deployment has no OAuth client configured.', 503);
  }

  const form = new URLSearchParams(await request.text());
  const creds = credentials(request, form);
  if (!timingSafeEqual(creds.id, app.id) || !timingSafeEqual(creds.secret, app.secret)) {
    return new Response(
      JSON.stringify({ error: 'invalid_client', error_description: 'Client authentication failed.' }),
      { status: 401, headers: { ...noStore, 'www-authenticate': 'Basic realm="web3ashley-studio"' } }
    );
  }

  const origin = originOf(request);
  const grant = form.get('grant_type');

  /* ------------------------------------------------------ refresh_token */
  if (grant === 'refresh_token') {
    const wanted = form.get('resource') || resourceUri(origin);
    const claim = await readToken(env, form.get('refresh_token'), { kind: 'refresh' });
    if (!claim) return oauthError('invalid_grant', 'That refresh token is not valid.');
    if (claim.aud && claim.aud !== wanted) {
      return oauthError('invalid_target', 'That refresh token was issued for another resource.');
    }
    const common = { subject: claim.sub, scope: claim.scope, resource: claim.aud };
    return ok({
      access_token: await mintToken(env, { ...common, kind: 'access' }),
      token_type: 'Bearer',
      expires_in: TOKEN_TTL,
      scope: claim.scope,
      // rotated, per OAuth 2.1 guidance for public and confidential clients alike
      refresh_token: await mintToken(env, { ...common, kind: 'refresh' }),
    });
  }

  /* -------------------------------------------------- authorization_code */
  if (grant !== 'authorization_code') {
    return oauthError('unsupported_grant_type', `This server does not do ${grant || '(nothing)'}.`);
  }

  const row = await claimCode(env.DB, form.get('code'));
  if (!row) return oauthError('invalid_grant', 'That code is unknown, used, or expired.');

  if (row.client_id !== app.id) {
    return oauthError('invalid_grant', 'That code was issued to a different client.');
  }
  // exact match, per OAuth 2.1
  if (row.redirect_uri !== (form.get('redirect_uri') || '')) {
    return oauthError('invalid_grant', 'The redirect URI does not match the one the code was issued for.');
  }
  if (!await verifyChallenge(form.get('code_verifier'), row.code_challenge, row.method)) {
    return oauthError('invalid_grant', 'The code verifier does not match the challenge.');
  }

  // RFC 8707: if a resource is named again it has to be the same one
  const wanted = form.get('resource');
  if (wanted && row.resource && wanted !== row.resource) {
    return oauthError('invalid_target', 'That is not the resource the code was issued for.');
  }

  const common = {
    subject: row.subject,
    scope: row.scope || SCOPE,
    resource: row.resource || resourceUri(origin),
  };
  return ok({
    access_token: await mintToken(env, { ...common, kind: 'access' }),
    token_type: 'Bearer',
    expires_in: TOKEN_TTL,
    scope: common.scope,
    refresh_token: await mintToken(env, { ...common, kind: 'refresh' }),
  });
}

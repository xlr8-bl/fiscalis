/**
 * /oauth/authorize — where a person says yes, once.
 *
 * Spark sends the browser here with PKCE parameters and a resource. This
 * asks for the studio password, and on a correct one redirects back to
 * Gemini with a short-lived authorization code.
 *
 * The password is the whole check. There is one account holder, and the
 * thing being granted is "may drive the carousel pipeline" — so a consent
 * screen listing scopes would be ceremony over a single yes/no. What the
 * page does say plainly is what the token will and will not be able to do,
 * because that is the part worth reading before pressing a button.
 */

import {
  SCOPE, client, redirectAllowed, issueCode, resourceUri, originOf, oauthError,
} from '../../lib/oauth.js';
import { authenticate, accounts } from '../../lib/auth.js';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Errors before the redirect URI is validated must be shown, not
 * redirected — bouncing an error to an unvalidated URI is an open
 * redirector.
 */
const page = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} — Web3Ashley</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#080807; color:#e8e8e3;
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  main { width:min(30rem,90vw); padding:2rem 0; }
  h1 { font-size:1.5rem; margin:0 0 .6rem; font-weight:600; }
  p { color:#938f8a; margin:0 0 1.4rem; }
  ul { color:#938f8a; padding-left:1.1rem; margin:0 0 1.4rem; }
  li { margin-bottom:.3rem; }
  label { display:block; margin-bottom:.4rem; }
  input { width:100%; box-sizing:border-box; padding:.8rem .9rem;
          background:#14130f; color:inherit; border:0; font:inherit; }
  button { margin-top:1.2rem; padding:.8rem 1.4rem; border:0; cursor:pointer;
           background:#e8e8e3; color:#080807; font:inherit; font-weight:600; }
  .err { color:#e8b3a0; }
  code { color:#bfbfb1; font-size:.85em; word-break:break-all; }
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const origin = originOf(request);
  const q = url.searchParams;

  const app = client(env);
  if (!app.configured) {
    return page('Not set up', `<h1>Not set up</h1>
      <p>This deployment has no OAuth client configured. Set
      <code>MCP_CLIENT_ID</code>, <code>MCP_CLIENT_SECRET</code> and
      <code>MCP_REDIRECT_URIS</code>, then retry the deployment.</p>`, 503);
  }
  if (!Object.keys(accounts(env)).length) {
    return page('Not set up', `<h1>Not set up</h1>
      <p>No studio account on this deployment, so there is nobody to approve this.</p>`, 503);
  }

  const params = request.method === 'POST'
    ? new URLSearchParams(await request.text())
    : q;

  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const state = params.get('state') || '';
  const challenge = params.get('code_challenge') || '';
  const method = params.get('code_challenge_method') || 'S256';
  const resource = params.get('resource') || resourceUri(origin);
  const scope = params.get('scope') || SCOPE;

  // These four are shown rather than redirected: until the client and its
  // redirect are known good, sending anything to that URI is a redirector.
  if (clientId !== app.id) {
    return page('Unknown client', `<h1>Unknown client</h1>
      <p>That client ID is not the one this server is configured for.</p>`, 400);
  }
  if (!redirectAllowed(env, redirectUri)) {
    return page('Redirect not allowed', `<h1>Redirect not allowed</h1>
      <p>This server has not been told to trust <code>${esc(redirectUri)}</code>.
      Add it to <code>MCP_REDIRECT_URIS</code> and retry the deployment.</p>`, 400);
  }
  if (params.get('response_type') !== 'code') {
    return page('Unsupported', '<h1>Unsupported</h1><p>Only the authorization code flow.</p>', 400);
  }
  if (!challenge || method !== 'S256') {
    return page('PKCE required', `<h1>PKCE required</h1>
      <p>OAuth 2.1 requires a code challenge, and this server only accepts S256.</p>`, 400);
  }

  /* the redirect is known good from here, so errors can travel by it */
  const back = (extra) => {
    const to = new URL(redirectUri);
    for (const [k, v] of Object.entries(extra)) to.searchParams.set(k, v);
    if (state) to.searchParams.set('state', state);
    // RFC 9207, so the client can tell which server answered
    to.searchParams.set('iss', origin);
    return Response.redirect(to.toString(), 302);
  };

  const hidden = Object.entries({
    client_id: clientId, redirect_uri: redirectUri, state,
    code_challenge: challenge, code_challenge_method: method,
    resource, scope, response_type: 'code',
  }).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('');

  const form = (message = '') => page('Connect Gemini', `
    <h1>Connect Gemini to the studio</h1>
    <p>Gemini is asking to drive the carousel pipeline on this site. Signing
    in below gives it a token that can:</p>
    <ul>
      <li>read the brief, the pillars and the brand kit</li>
      <li>file carousel plans and deliver the pictures for them</li>
      <li>hand a batch to you for review, and send you the daily mail</li>
    </ul>
    <p>It cannot approve, schedule, post or delete anything. Those stay with
    you, and there is no tool here that would let it.</p>
    ${message ? `<p class="err">${esc(message)}</p>` : ''}
    <form method="post">
      ${hidden}
      <label for="pw">Studio password</label>
      <input id="pw" name="password" type="password" autocomplete="current-password"
             autofocus required>
      <button type="submit">Approve</button>
    </form>`);

  if (request.method === 'GET') return form();
  if (request.method !== 'POST') {
    return page('Method not allowed', '<h1>Method not allowed</h1>', 405);
  }

  const who = authenticate(env, params.get('name') || '', params.get('password') || '');
  if (!who) {
    // slow a wrong guess down a little, as the studio login does
    await new Promise((r) => setTimeout(r, 600));
    return form('That password does not match.');
  }

  const code = await issueCode(env.DB, {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    method,
    resource,
    scope,
    subject: who,
  });
  return back({ code });
}

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
import { page, esc } from '../../lib/plainpage.js';

/*
 * Errors before the redirect URI is validated must be shown, not
 * redirected — bouncing an error to an unvalidated URI is an open
 * redirector. `page` is the plain screen those are shown on.
 */

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

  /*
   * Everything from here can only fail on the database, and a throw at
   * this point is the worst possible moment for it: the password was
   * right, so from the outside the approval simply vanishes into a
   * Cloudflare error page with no way to tell what went wrong.
   *
   * The overwhelmingly likely cause is a deployment whose database
   * predates the oauth_codes table, so that case is named outright
   * rather than left as "an error occurred".
   */
  if (!env.DB) {
    return page('No database', `<h1>No database</h1>
      <p>This deployment has no D1 database bound, so there is nowhere to
      keep the authorization code. Add the binding and retry the
      deployment.</p>`, 503);
  }

  try {
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
  } catch (e) {
    const message = String(e?.message || e);
    if (/no such table/i.test(message)) {
      return page('One step missing', `<h1>One step missing</h1>
        <p>The password was right. This database does not have the table that
        holds authorization codes yet — it was added with the sign-in flow
        you are using now.</p>
        <p>Open <code>/studio</code>, press <b>Set up the database</b>, then
        come back and try connecting again. Setup is safe to run as many
        times as you like.</p>`, 503);
    }
    return page('Could not finish', `<h1>Could not finish</h1>
      <p>The password was right, but the authorization code could not be
      stored.</p><p><code>${esc(message)}</code></p>`, 500);
  }
}

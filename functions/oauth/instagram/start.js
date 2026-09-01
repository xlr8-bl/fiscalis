/**
 * /oauth/instagram/start — send the browser to Instagram to approve this app.
 *
 * The same shape as the TikTok one, for the same reason: pasting a
 * long-lived token by hand means generating it in a dashboard, and the
 * dashboards are miserable on a phone. Press a button, approve, come
 * back connected.
 */

import { identify } from '../../../lib/auth.js';
import { mintToken } from '../../../lib/oauth.js';
import { authorizeUrl, redirectUri, scopes, credentials } from '../../../lib/instagram.js';
import { getSetting } from '../../../lib/tokens.js';
import { page, esc } from '../../../lib/plainpage.js';

const STATE_TTL = 600;

const problem = (title, body) => page(title, `<h1>${title}</h1>${body}`, 503);

/** What is about to be sent, for when Meta answers with nothing useful. */
function report(app, origin, env) {
  const ends = app.id.length > 6 ? `${app.id.slice(0, 3)}…${app.id.slice(-4)}` : app.id;
  const notes = [];
  if (app.id && !/^\d+$/.test(app.id)) {
    notes.push('An Instagram app ID is all digits. This one is not, which usually means '
               + 'the Instagram app secret was pasted into the ID, or that this is the '
               + 'app ID from the wrong panel.');
  }
  if (app.id && app.id === app.secret) {
    notes.push('The ID and the secret are the same value. One of them is wrong.');
  }

  return page('What this site sends Instagram', `
    <h1>What this site sends Instagram</h1>
    <p>Compare these against the app's own page, under Instagram, API setup with
      Instagram login.</p>
    <ul>
      <li>client_id: <code>${esc(ends)}</code> &nbsp; (${app.id.length} characters)</li>
      <li>client_secret: ${app.secret ? `set, ${app.secret.length} characters` : '<strong>not set</strong>'}</li>
      <li>set in: <code>${esc(app.source === 'studio' ? 'the studio' : 'the deployment')}</code></li>
      <li>redirect_uri: <code>${esc(redirectUri(origin))}</code></li>
      <li>scope: <code>${esc(scopes(env).join(','))}</code></li>
      <li>this deployment: <code>${esc(origin)}</code></li>
    </ul>
    ${notes.length ? `<p class="err">${notes.map(esc).join('<br>')}</p>` : ''}
    <p>The redirect URI has to be in the app's <strong>valid OAuth redirect URIs</strong>
      exactly — Meta matches the whole string, so a trailing slash is a different URI.
      And the account approving has to be an Instagram <strong>professional</strong>
      account with a role on the app, or the permissions cannot be granted without
      App Review.</p>
    <p><a href="/oauth/instagram/start">Try connecting</a> &nbsp;·&nbsp;
       <a href="/studio#/kit/accounts">Back to the studio</a></p>`);
}

export async function onRequestGet({ request, env }) {
  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') {
    return Response.redirect(new URL('/studio', request.url).toString(), 302);
  }

  const app = await credentials(env.DB, env, { getSetting });
  if (!app.id || !app.secret) {
    return problem('Instagram is not set up yet', `
      <p>There is no Instagram app ID and secret. They are on the app's page at
      developers.facebook.com, under <strong>Instagram → API setup with Instagram
      login</strong> — the Instagram app ID, not the Meta app ID above it.</p>
      <p>Put them in the studio under Social, Accounts. Stored there they can be
      changed without waiting for a deployment.</p>`);
  }
  if (!env.SESSION_SECRET) {
    return problem('Instagram cannot be connected yet',
      '<p>This deployment has no <code>SESSION_SECRET</code>, so the round trip cannot be signed.</p>');
  }

  const origin = new URL(request.url).origin;
  if (new URL(request.url).searchParams.has('check')) return report(app, origin, env);

  const state = await mintToken(
    { ...env, __origin: origin },
    { subject: who.name || 'studio', scope: 'instagram', kind: 'ig-state', ttl: STATE_TTL }
  );

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(env, { origin, state, id: app.id }),
      'cache-control': 'no-store',
      'x-ig-scopes': scopes(env).join(','),
      'x-ig-redirect': redirectUri(origin),
    },
  });
}

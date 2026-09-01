/**
 * /oauth/tiktok/start — send the browser to TikTok to approve this app.
 *
 * Signed in at /studio, press Connect TikTok, land back with a token.
 * That is the whole point: TikTok has no token to paste out of a
 * dashboard, and the alternative to hosting this is hand-assembling an
 * authorization URL on a phone.
 *
 * The registered redirect URI may carry no query string, so the state
 * cannot be smuggled back in the URL. It rides as a signed, short-lived
 * token instead — the same minting the MCP flow uses — with its own kind
 * so it can never be replayed as an access token.
 */

import { identify } from '../../../lib/auth.js';
import { mintToken } from '../../../lib/oauth.js';
import {
  authorizeUrl, redirectUri, scopes, clientKey, clientSecret, testCredentials,
} from '../../../lib/tiktok.js';
import { page, esc } from '../../../lib/plainpage.js';

const STATE_TTL = 600;   // ten minutes is longer than any real approval

const problem = (title, body) => page(title, `<h1>${title}</h1>${body}`, 503);

/**
 * What TikTok is about to be sent, shown rather than guessed at.
 *
 * "Something went wrong — correct the following: client_key" is the
 * error for a key TikTok does not recognise, and it says nothing about
 * *which* key arrived. From a phone the value is invisible: it is in a
 * Cloudflare field, it renders as dots, and re-pasting it three times
 * proves nothing. So this prints enough of it to compare against the
 * dashboard by eye, and names the two things that are wrong when the
 * characters match.
 *
 * Never the whole key, and never the secret. A length, an end, and
 * whether anything invisible came along with it is all that is needed
 * to tell two keys apart.
 */
function report(env, origin, tested = null) {
  const key = clientKey(env);
  const raw = String(env.TIKTOK_CLIENT_KEY || '');
  const secret = clientSecret(env);
  const ends = key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : key;

  const notes = [];
  if (raw !== raw.trim()) {
    notes.push('The stored key had whitespace around it. That is stripped before it is sent, '
               + 'but it usually means the paste picked up a newline — worth fixing at the source.');
  }
  if (/^(sbaw|sb)/i.test(key)) {
    notes.push('This key looks like a sandbox key. A sandbox and the live app are different '
               + 'clients: the demo has to run against whichever one this key belongs to.');
  }
  if (key.length < 10) notes.push('That is shorter than any client key TikTok issues.');
  if (secret && key === secret) notes.push('The key and the secret are the same value. One of them is wrong.');

  return page('What this site sends TikTok', `
    <h1>What this site sends TikTok</h1>
    <p>Compare these against the app's own page. TikTok's "correct the following:
      <code>client_key</code>" means it did not recognise the key below — not that
      it is missing.</p>
    <ul>
      <li>client_key: <code>${esc(ends)}</code> &nbsp; (${key.length} characters)</li>
      <li>client_secret: ${secret ? `set, ${secret.length} characters` : '<strong>not set</strong>'}</li>
      <li>redirect_uri: <code>${esc(redirectUri(origin))}</code></li>
      <li>scope: <code>${esc(scopes(env).join(','))}</code></li>
      <li>this deployment: <code>${esc(origin)}</code></li>
    </ul>
    ${notes.length ? `<p class="err">${notes.map(esc).join('<br>')}</p>` : ''}
    ${tested ? verdict(tested, redirectUri(origin)) : `
      <form method="post">
        <button type="submit">Ask TikTok whether this key is real</button>
      </form>
      <p>That checks the key and the secret on their own — no redirect, no Login
        Kit, no account. It is the one question that splits "the value is wrong"
        from "the app is not set up for the web", and those two have completely
        different fixes.</p>`}
    <p><a href="/oauth/tiktok/start">Try connecting</a> &nbsp;·&nbsp;
       <a href="/studio#/social/accounts">Back to the studio</a></p>`);
}

/**
 * What TikTok's own answer means. The whole value of asking is that the
 * two directions have nothing in common: one is a wrong string in
 * Cloudflare, the other is a checkbox in a dashboard, and the
 * authorization page's "correct the following: client_key" is the same
 * words for both.
 */
const verdict = (t, redirect) =>
  t.ok
    ? `<p><strong>TikTok accepted this key and secret.</strong> The pair is real, so
       the value stored here is not the problem — the authorization page is
       refusing it for how the app is configured, not for what it is.</p>
       <ul>
         <li>Under <strong>Platforms</strong>, is <strong>Web</strong> ticked? Without it
           this key has no web client behind it and the authorization page has
           nothing to match it against. That is the usual answer.</li>
         <li>Under <strong>Login Kit</strong>, is <strong>Configure for Web</strong> turned
           on, with <code>${esc(redirect)}</code> registered on it exactly?</li>
         <li>Is this the client you are authorising against? A sandbox and the live
           app are separate clients with separate keys.</li>
       </ul>`
    : `<p class="err"><strong>TikTok refused this key and secret:</strong>
        <code>${esc(t.error)}</code></p>
       <p>So it is the value that is wrong, not the app's configuration. Copy both
         again from the Credentials panel of whichever client you are authorising
         against — a sandbox has its own — into the Pages project, and retry the
         deployment.</p>`;

export async function onRequestPost({ request, env }) {
  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') {
    return Response.redirect(new URL('/studio', request.url).toString(), 302);
  }
  const origin = new URL(request.url).origin;
  return report(env, origin, await testCredentials(env));
}

export async function onRequestGet({ request, env }) {
  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') {
    return Response.redirect(new URL('/studio', request.url).toString(), 302);
  }

  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
    return problem('TikTok is not set up yet', `
      <p>This deployment has no <code>TIKTOK_CLIENT_KEY</code> and
      <code>TIKTOK_CLIENT_SECRET</code>. They are on the app's page at
      TikTok for Developers, under Manage apps.</p>
      <p>Add both in the Cloudflare Pages project under Settings, Variables
      and Secrets — under <strong>both</strong> Production and Preview — and
      retry the deployment. A deployment carries the variables it was built
      with, so adding them is not enough on its own.</p>`);
  }
  if (!env.SESSION_SECRET) {
    return problem('TikTok cannot be connected yet', `
      <p>This deployment has no <code>SESSION_SECRET</code>, so the round trip
      to TikTok cannot be signed.</p>`);
  }

  const origin = new URL(request.url).origin;
  if (new URL(request.url).searchParams.has('check')) return report(env, origin);
  const state = await mintToken(
    { ...env, __origin: origin },
    { subject: who.name || 'studio', scope: 'tiktok', kind: 'tiktok-state', ttl: STATE_TTL }
  );

  return new Response(null, {
    status: 302,
    headers: {
      location: authorizeUrl(env, { origin, state }),
      'cache-control': 'no-store',
      // what was asked for, so a scope refused at the other end can be
      // told apart from one that was never requested
      'x-tiktok-scopes': scopes(env).join(','),
      'x-tiktok-redirect': redirectUri(origin),
    },
  });
}

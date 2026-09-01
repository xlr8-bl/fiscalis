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
import { authorizeUrl, redirectUri, scopes } from '../../../lib/tiktok.js';
import { page } from '../../../lib/plainpage.js';

const STATE_TTL = 600;   // ten minutes is longer than any real approval

const problem = (title, body) => page(title, `<h1>${title}</h1>${body}`, 503);

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

/**
 * /oauth/instagram/callback — where Instagram sends the browser back.
 *
 * This exact URL goes in the app's **valid OAuth redirect URIs**. Meta
 * matches the whole string, so a trailing slash is a different URI.
 *
 * What lands here is `code` and `state`. The code buys an hour-long
 * token, which is immediately traded for the 60-day one — see
 * lib/instagram.js for why that second step is not optional.
 */

import { identify } from '../../../lib/auth.js';
import { readToken } from '../../../lib/oauth.js';
import { exchange, whoAmI, redirectUri, credentials, INSIGHTS_SCOPE } from '../../../lib/instagram.js';
import { putSetting, getSetting } from '../../../lib/tokens.js';
import { page, esc } from '../../../lib/plainpage.js';

const back = '<p><a href="/studio#/kit/accounts">Back to the studio</a></p>';
const failed = (title, body, status = 400) =>
  page(title, `<h1>${title}</h1>${body}${back}`, status);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;

  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') {
    return failed('Sign in first', `
      <p>This finishes connecting Instagram, and it only works while you are signed
      in to the studio. Sign in and press Connect Instagram again.</p>`, 401);
  }

  const good = await readToken(
    { ...env, __origin: origin }, url.searchParams.get('state') || '', { kind: 'ig-state' }
  );
  if (!good) {
    return failed('That link has expired', `
      <p>The round trip is only good for ten minutes, and it has to be the one this
      studio started. Press Connect Instagram again.</p>`, 400);
  }

  const error = url.searchParams.get('error');
  if (error) {
    return failed('Instagram said no', `
      <p><code>${esc(error)}</code></p>
      <p>${esc(url.searchParams.get('error_description')
        || url.searchParams.get('error_reason') || 'No reason was given.')}</p>`, 400);
  }

  const code = url.searchParams.get('code');
  if (!code) return failed('No code came back', '<p>Instagram sent no authorization code.</p>', 400);

  const app = await credentials(env.DB, env, { getSetting });
  const out = await exchange(env, { origin, code, id: app.id, secret: app.secret });
  if (out.error) {
    return failed('The exchange failed', `
      <p><code>${esc(out.error)}</code></p>
      <p>The redirect URI registered on the app has to be exactly
      <code>${esc(redirectUri(origin))}</code>, and the secret has to be the current
      Instagram app secret — not the Meta app secret above it on the same page. It
      came from <strong>${esc(app.source === 'studio' ? 'the studio' : 'the deployment')}</strong>.</p>`, 502);
  }

  const now = Math.floor(Date.now() / 1000);
  await putSetting(env.DB, 'ig.token', out.token);
  await putSetting(env.DB, 'ig.refreshed_at', String(now));
  if (out.userId) await putSetting(env.DB, 'ig.user_id', out.userId);
  await putSetting(env.DB, 'ig.scopes', out.permissions);

  const me = await whoAmI(out.token);
  if (me.me?.username) await putSetting(env.DB, 'ig.username', me.me.username);

  const granted = out.permissions.split(/[,\s]+/).filter(Boolean);
  const canPost = granted.includes('instagram_business_content_publish');
  const days = Math.round(out.expiresIn / 86400);

  return page('Instagram is connected', `
    <h1>Instagram is connected</h1>
    <p>${me.me?.username
      ? `As <strong>@${esc(me.me.username)}</strong>${
          me.me.account_type ? ` — ${esc(String(me.me.account_type).toLowerCase())}` : ''}.`
      : 'The token is stored.'}</p>
    <ul>
      <li>Granted: <code>${esc(granted.join(', ') || 'nothing')}</code></li>
      <li>The token lasts ${days} days and refreshes itself on use, so it does not
        lapse while it is being used.</li>
      ${granted.includes(INSIGHTS_SCOPE)
        ? '<li>Reach, saves and views can be read back.</li>'
        : '<li>Likes and comments can be read back. Reach, saves and views cannot — '
          + `that needs <code>${INSIGHTS_SCOPE}</code>.</li>`}
    </ul>
    ${canPost ? '' : `<p class="err">Missing
      <code>instagram_business_content_publish</code>, so nothing can be posted with
      this token. Add it to the app's permissions and connect again — while the app
      is in development you can grant it to yourself, as long as the account has a
      role on the app.</p>`}
    ${back}`);
}

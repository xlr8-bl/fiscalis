/**
 * /oauth/tiktok/callback — where TikTok sends the browser back.
 *
 * This exact URL is what goes in the app's Redirect URI field at TikTok
 * for Developers. It has to be HTTPS, absolute and static, and match
 * character for character — a trailing slash is a different URI.
 *
 * What comes back is `code`, `scopes` and `state` on the query string.
 * The code is swapped for an access token and a refresh token, and both
 * are written into `settings` rather than anywhere they cannot be
 * rewritten: the access token lasts a day.
 */

import { identify } from '../../../lib/auth.js';
import { readToken } from '../../../lib/oauth.js';
import { exchange, creatorInfo, redirectUri } from '../../../lib/tiktok.js';
import { putSetting } from '../../../lib/tokens.js';
import { page, esc } from '../../../lib/plainpage.js';

const back = '<p><a href="/studio#/social/accounts">Back to the studio</a></p>';

const failed = (title, body, status = 400) =>
  page(title, `<h1>${title}</h1>${body}${back}`, status);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;

  /*
   * Two checks, and both matter. The studio session says a person is at
   * the keyboard; the signed state says this particular round trip is
   * the one that started here ten minutes ago, which is what stops a
   * link someone else made from attaching their account to this studio.
   */
  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') {
    return failed('Sign in first', `
      <p>This finishes connecting TikTok, and it only works while you are
      signed in to the studio. Sign in and press Connect TikTok again.</p>`, 401);
  }

  const state = url.searchParams.get('state') || '';
  const good = await readToken({ ...env, __origin: origin }, state, { kind: 'tiktok-state' });
  if (!good) {
    return failed('That link has expired', `
      <p>The round trip to TikTok is only good for ten minutes, and it has to
      be the one this studio started. Press Connect TikTok again.</p>`, 400);
  }

  const error = url.searchParams.get('error');
  if (error) {
    return failed('TikTok said no', `
      <p><code>${esc(error)}</code></p>
      <p>${esc(url.searchParams.get('error_description') || 'No reason was given.')}</p>`, 400);
  }

  const code = url.searchParams.get('code');
  if (!code) return failed('No code came back', '<p>TikTok sent no authorization code.</p>', 400);

  const out = await exchange(env, { origin, code });
  if (out.error) {
    // the two that actually happen, named, because the message TikTok
    // returns for both is the same unhelpful one
    return failed('The exchange failed', `
      <p><code>${esc(out.error)}</code></p>
      <p>Two things cause this. The redirect URI registered on the app has to
      be exactly <code>${esc(redirectUri(origin))}</code> — a trailing slash is
      a different URI. And <code>TIKTOK_CLIENT_SECRET</code> has to be the
      current one; regenerating it in the dashboard invalidates the old.</p>`, 502);
  }

  const t = out.token;
  const now = Math.floor(Date.now() / 1000);
  await putSetting(env.DB, 'tiktok.token', t.access_token);
  await putSetting(env.DB, 'tiktok.refresh_token', t.refresh_token || '');
  // a minute of margin, so a post never starts on a token that expires
  // halfway through the upload
  await putSetting(env.DB, 'tiktok.expires_at', String(now + (Number(t.expires_in) || 86400) - 60));
  await putSetting(env.DB, 'tiktok.open_id', t.open_id || '');
  await putSetting(env.DB, 'tiktok.scopes', t.scope || '');

  // the name to show, and the first real proof the token works
  const who2 = await creatorInfo(t.access_token);
  if (who2.info?.creator_username) {
    await putSetting(env.DB, 'tiktok.username', who2.info.creator_username);
  }

  const granted = String(t.scope || '').split(/[,\s]+/).filter(Boolean);
  const missing = ['video.publish'].filter((s) => !granted.includes(s));

  return page('TikTok is connected', `
    <h1>TikTok is connected</h1>
    <p>${who2.info?.creator_username
      ? `As <strong>${esc(who2.info.creator_username)}</strong>.`
      : 'The token is stored.'}</p>
    <ul>
      <li>Granted: <code>${esc(granted.join(', ') || 'nothing')}</code></li>
      <li>The access token lasts a day and renews itself on use. The refresh
        token lasts a year.</li>
      ${granted.includes('video.list')
        ? '<li>Likes and views can be read back.</li>'
        : '<li>Likes and views cannot be read back yet — that needs '
          + '<code>video.list</code>, which comes with the Display API product.</li>'}
    </ul>
    ${missing.length
      ? `<p class="err">Missing <code>${esc(missing.join(', '))}</code>, so nothing can
         be posted with this token. Add the Content Posting API product to the app,
         then connect again.</p>`
      : ''}
    ${back}`);
}

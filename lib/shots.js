/**
 * shots.js — capture a real page and keep it, so a slide can cite one.
 *
 * The gap this fills: every teaching slide was an assertion. A carousel
 * about what Search Console shows you had nothing on it from Search
 * Console, and the reader had only my word for it. A screenshot with its
 * own address bar on it is the cheapest evidence there is, and the
 * `shot` block draws the address as part of the frame precisely so the
 * picture and the citation cannot be separated.
 *
 * Cloudflare Browser Rendering's REST screenshot endpoint, not the
 * Workers binding: Pages Functions cannot take a `browser` binding, and
 * the REST road needs only an API token, which is the same shape the
 * paid image path already uses. It works on the free plan — 10 minutes
 * of browser time a day, one Quick Action every 10 seconds — which is a
 * few dozen captures and far more than a carousel needs.
 *
 *   https://developers.cloudflare.com/browser-rendering/rest-api/screenshot-endpoint/
 *   https://developers.cloudflare.com/browser-rendering/platform/limits/
 */

const ENDPOINT = (account) =>
  `https://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/screenshot`;

/* 16:10, which is what the `shot` block's frame draws. Capturing at the
   frame's own shape means the picture is never letterboxed or cropped by
   the renderer, and 1280 wide is a desktop layout rather than the mobile
   one a narrower viewport would trigger. */
export const VIEWPORT = { width: 1280, height: 800 };

const MAX_BYTES = 8 * 1024 * 1024;

/* One capture every 10 seconds on the free plan, so a set of four is 30
   seconds of waiting if they are fired together. They are not: Spark
   captures one page per call and the pause is between its own turns. */
export const RATE_NOTE = 'One capture every 10 seconds, and 10 minutes of '
  + 'browser time a day, on the free plan.';

/**
 * A URL that is safe to point a browser at.
 *
 * The agent chooses this address from what it read on the open web, so
 * it is the one input on this road that an outside page can influence.
 * Everything but public http(s) is refused, and so is anything that
 * resolves inside a private network: a capture of 169.254.169.254 is a
 * metadata endpoint, not a screenshot.
 */
export function checkUrl(raw) {
  let u;
  try { u = new URL(String(raw ?? '')); } catch { return { error: 'That is not a URL.' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { error: `${u.protocol} is not a page. Capture http or https.` };
  }
  const host = u.hostname.toLowerCase();
  const private_ = /^(localhost|\[?::1\]?|0\.0\.0\.0)$/.test(host)
    || /\.(local|internal|localhost)$/.test(host)
    || /^10\./.test(host)
    || /^127\./.test(host)
    || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (private_) {
    return { error: `${host} is a private address. Only pages anybody could open.` };
  }
  return { url: u.toString(), host };
}

/**
 * @returns {{ key, url, bytes, width, height } | { error }}
 *   `key` is what a slide's `shot.src` carries; `url` is what its
 *   address bar draws, and it is the address actually captured rather
 *   than the one that was asked for.
 */
export async function capture(env, args, { fetcher = fetch } = {}) {
  const account = env.CF_ACCOUNT_ID;
  const token = env.CF_BROWSER_TOKEN;
  if (!account || !token) {
    return {
      error: 'Capturing a page needs CF_ACCOUNT_ID and CF_BROWSER_TOKEN set in '
        + 'the Pages project, under Settings, Variables and Secrets. The token '
        + 'needs the Browser Rendering: Edit permission. Nothing else on this '
        + 'server uses them, so until they are there, write the slide without a '
        + 'screenshot rather than describing one.',
    };
  }
  if (!env.MEDIA) return { error: 'No R2 bucket is bound on this deployment.' };

  const checked = checkUrl(args.url);
  if (checked.error) return checked;

  const full = args.full_page === true;
  let res;
  try {
    res = await fetcher(ENDPOINT(account), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: checked.url,
        viewport: VIEWPORT,
        /* `networkidle0` waits for the page to stop fetching, which is
           what makes a screenshot of a dashboard show the dashboard
           rather than its loading state. */
        gotoOptions: { waitUntil: 'networkidle0', timeout: 25_000 },
        screenshotOptions: { fullPage: full, type: 'jpeg', quality: 88 },
      }),
    });
  } catch (err) {
    return { error: `Could not reach the rendering API: ${err.message}` };
  }

  if (!res.ok) {
    /* The body is JSON on a rejection and the image itself on success,
       so this only reads it when something went wrong. */
    let why = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      why = body?.errors?.map((e) => e.message).join('; ') || why;
    } catch { /* not JSON; the status is all there is */ }
    if (res.status === 429) {
      return { error: `Rate limited. ${RATE_NOTE} Wait and try the one page again.` };
    }
    return { error: `The page could not be captured: ${why}` };
  }

  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength) return { error: 'The capture came back empty.' };
  if (bytes.byteLength > MAX_BYTES) {
    return { error: 'The capture is over 8MB. Try it without full_page.' };
  }

  const key = `shots/${crypto.randomUUID().slice(0, 12)}.jpg`;
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
  });
  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO media (key, filename, content_type, bytes, width, height, alt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(key, `${checked.host}.jpg`, 'image/jpeg', bytes.byteLength,
          VIEWPORT.width, full ? 0 : VIEWPORT.height,
          `Screenshot of ${checked.url}`)
    .run()
    .catch(() => {});

  return {
    key,
    url: checked.url,
    bytes: bytes.byteLength,
    width: VIEWPORT.width,
    height: full ? null : VIEWPORT.height,
    /* Handed back in the shape the slide wants, so there is nothing to
       assemble and no chance of the address on the sheet drifting from
       the address that was actually captured. */
    put_on_the_slide: { src: key, url: checked.url },
    note: 'The address bar on the slide draws this URL. It is the citation, so '
      + 'it is drawn from what was captured rather than from anything retyped.',
  };
}

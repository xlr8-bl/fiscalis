/**
 * check_instagram.mjs — the connect flow, without an account.
 *
 *   node tools/check_instagram.mjs
 *
 * Business Login for Instagram has three different hosts and two token
 * exchanges, and getting either wrong fails in a way that looks like
 * success: stop after the first exchange and you are holding an
 * hour-long token that is indistinguishable from a good one until the
 * afternoon it stops working.
 *
 * Shapes from:
 *   https://developers.facebook.com/docs/instagram-platform/
 *     instagram-api-with-instagram-login/business-login
 */

const problems = [];
const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) {
    console.log('  FAIL ' + name + ' — ' + String(e.message).split('\n')[0]);
    problems.push(name);
  }
};
const is = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const ig = await import(new URL('../lib/instagram.js', import.meta.url).href);

const ENV = { IG_APP_ID: '1234567890', IG_APP_SECRET: 'appsecret' };
const ORIGIN = 'https://web3ashley.com';

/* ------------------------------------------------------- the connect URL */

await step('the redirect URI is https, absolute, and carries no query', () => {
  const uri = ig.redirectUri(ORIGIN);
  is(uri, 'https://web3ashley.com/oauth/instagram/callback', 'uri');
  if (uri.includes('?') || uri.includes('#')) throw new Error('query or fragment');
  is(ig.redirectUri('https://web3ashley.com/'), uri, 'a trailing slash is the same URI');
});

await step('the authorization URL is the Instagram-Login one', () => {
  const url = new URL(ig.authorizeUrl(ENV, { origin: ORIGIN, state: 'st' }));
  // www.instagram.com, not facebook.com — a different flow lives there
  is(url.origin + url.pathname, 'https://www.instagram.com/oauth/authorize', 'endpoint');
  is(url.searchParams.get('client_id'), '1234567890', 'client_id');
  is(url.searchParams.get('response_type'), 'code', 'response_type');
  is(url.searchParams.get('redirect_uri'), ig.redirectUri(ORIGIN), 'redirect_uri');
  is(url.searchParams.get('state'), 'st', 'state');
  // this is the no-Facebook-Page flow, so offering Facebook Login on the
  // approval screen is an offer to start the wrong one
  is(url.searchParams.get('enable_fb_login'), '0', 'enable_fb_login');
});

await step('it asks for what it uses and nothing else', () => {
  is(ig.scopes(ENV).join(','),
     'instagram_business_basic,instagram_business_content_publish', 'scope');
  // messages and comments are on offer and never used here
  const asked = ig.scopes(ENV).join(',');
  for (const no of ['manage_messages', 'manage_comments']) {
    if (asked.includes(no)) throw new Error(`asks for ${no}, which it never uses`);
  }
});

await step('insights is opt-in, since it is the one that needs review', () => {
  is(ig.scopes(ENV).includes(ig.INSIGHTS_SCOPE), false, 'by default');
  const more = ig.scopes({ ...ENV, IG_SCOPES: ig.INSIGHTS_SCOPE });
  is(more.includes(ig.INSIGHTS_SCOPE), true, 'when asked for');
  is(more.length, 3, 'no duplicates');
});

await step('the credentials are trimmed', () => {
  is(ig.appId({ IG_APP_ID: ' 1234567890\n' }), '1234567890', 'id');
  is(ig.appSecret({ IG_APP_SECRET: 'appsecret ' }), 'appsecret', 'secret');
  is(ig.appId({}), '', 'a missing id is empty, not "undefined"');
});

/* ------------------------------------------------ which app to act as */

const fake = (rows) => ({ db: {}, getSetting: async (_d, k) => rows[k] ?? null });

await step('a pair set in the studio wins over the deployment', async () => {
  const f = fake({ 'ig.app_id': '999', 'ig.app_secret': 'studio-secret' });
  const out = await ig.credentials(f.db, ENV, { getSetting: f.getSetting });
  is(out.id, '999', 'id');
  is(out.source, 'studio', 'source');
});

await step('half a pair falls back rather than mixing two apps', async () => {
  const f = fake({ 'ig.app_id': '999' });
  const out = await ig.credentials(f.db, ENV, { getSetting: f.getSetting });
  is(out.id, '1234567890', 'id');
  is(out.source, 'environment', 'source');
});

/* ------------------------------------------------------- the exchange */

const SHORT = { access_token: 'IGQV...short', user_id: '17841400000000000', permissions: 'instagram_business_basic,instagram_business_content_publish' };
const LONG = { access_token: 'IGQV...long', token_type: 'bearer', expires_in: 5184000 };

/** A fetcher built from [match, response] pairs, recording what was sent. */
const fetcher = (routes, sent = []) => async (url, init) => {
  const u = String(url);
  sent.push({ url: u, body: init?.body ? String(init.body) : null });
  for (const [match, body] of routes) {
    if (u.includes(match)) return { ok: true, status: 200, json: async () => body };
  }
  throw new Error(`nothing stubbed for ${u}`);
};

await step('the code is swapped, and then swapped again for the 60-day one', async () => {
  const sent = [];
  const out = await ig.exchange(ENV, {
    origin: ORIGIN, code: 'AQB123',
    fetcher: fetcher([['api.instagram.com', SHORT], ['graph.instagram.com', LONG]], sent),
  });
  is(out.token, 'IGQV...long', 'the token kept is the long one');
  is(out.userId, '17841400000000000', 'user id');
  is(out.expiresIn, 5184000, 'about 60 days');

  // the first call is a POST to api.instagram.com with the app's own pair
  const first = new URLSearchParams(sent[0].body);
  if (!sent[0].url.startsWith('https://api.instagram.com/oauth/access_token')) {
    throw new Error(`first call was ${sent[0].url}`);
  }
  is(first.get('grant_type'), 'authorization_code', 'grant type');
  is(first.get('redirect_uri'), ig.redirectUri(ORIGIN), 'redirect_uri matches the one approved');

  // the second is graph.instagram.com, and it is not optional
  if (!sent[1].url.includes('grant_type=ig_exchange_token')) {
    throw new Error(`second call was ${sent[1].url}`);
  }
});

await step("Meta's #_ on the end of the code is stripped", async () => {
  const sent = [];
  await ig.exchange(ENV, {
    origin: ORIGIN, code: 'AQB123#_',
    fetcher: fetcher([['api.instagram.com', SHORT], ['graph.instagram.com', LONG]], sent),
  });
  // it comes back on the URL and, sent through, is an invalid code with
  // no explanation of why
  is(new URLSearchParams(sent[0].body).get('code'), 'AQB123', 'code');
});

await step('a short-lived token is never what gets stored', async () => {
  const out = await ig.exchange(ENV, {
    origin: ORIGIN, code: 'AQB123',
    fetcher: fetcher([
      ['api.instagram.com', SHORT],
      ['graph.instagram.com', { error: { message: 'Invalid client secret' } }],
    ]),
  });
  // rather than quietly keeping the hour-long one
  if (out.token) throw new Error('kept a token from a failed 60-day exchange');
  if (!/60-day/.test(out.error)) throw new Error(out.error);
});

await step("a refused code says Meta's own reason", async () => {
  const out = await ig.exchange(ENV, {
    origin: ORIGIN, code: 'nope',
    fetcher: fetcher([['api.instagram.com', { error_message: 'Invalid platform app' }]]),
  });
  is(out.error, 'Invalid platform app', 'the reason');
});

await step('no app set is answered without calling out', async () => {
  const out = await ig.exchange({}, {
    origin: ORIGIN, code: 'x',
    fetcher: async () => { throw new Error('should not have been called'); },
  });
  if (!/not set/.test(out.error)) throw new Error(out.error);
});

await step('who it is comes back from the graph host', async () => {
  const sent = [];
  const out = await ig.whoAmI('tok', {
    fetcher: fetcher([['graph.instagram.com', { user_id: '178414', username: 'web3ashley', account_type: 'BUSINESS' }]], sent),
  });
  is(out.me.username, 'web3ashley', 'username');
  if (!sent[0].url.includes('fields=user_id,username,account_type')) throw new Error(sent[0].url);
});

/* ------------------------------------------------------------ targets */

const { problems: platformProblems } =
  await import(new URL('../assets/js/platforms.js', import.meta.url).href);

await step('Facebook is not a default target any more', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['schema.sql', 'functions/mcp.js', 'functions/api/studio/carousels/[[route]].js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    if (/instagram,facebook,tiktok/.test(src)) throw new Error(`${f} still defaults to Facebook`);
  }
});

await step('a carousel aimed at Instagram alone is checked against Instagram', () => {
  const said = platformProblems({
    title: 'x', caption: 'y', hashtags: '', targets: ['instagram'],
    slides: [0, 1].map((i) => ({
      position: i, media_key: 'k', width: 1080, height: 1350,
      content_type: 'image/jpeg', bytes: 2 * 1024 * 1024,
    })),
  });
  is(said.length, 0, `problems: ${said.join(' | ')}`);
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe connect URL is right, and what gets stored is the sixty-day token'
);
process.exit(problems.length ? 1 : 0);

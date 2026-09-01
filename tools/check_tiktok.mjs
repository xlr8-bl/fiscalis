/**
 * check_tiktok.mjs — the connect flow and the post, without an account.
 *
 *   node tools/check_tiktok.mjs
 *
 * TikTok is the platform where the expensive mistakes are silent. An
 * unaudited app may only post at SELF_ONLY; get that wrong and a week of
 * posts either bounce or land where nobody can see them, and neither
 * shows up as an error you would notice. The authorization URL is the
 * same kind of trap: comma-separated scopes, a redirect that must carry
 * no query string, and a failure that reports as "something went wrong"
 * on Google's side of the wire.
 *
 * So both are asserted here against stubbed platform calls, with the
 * shapes taken from:
 *   https://developers.tiktok.com/doc/login-kit-web
 *   https://developers.tiktok.com/doc/content-sharing-guidelines
 *   https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
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

const tiktok = await import(new URL('../lib/tiktok.js', import.meta.url).href);
const { toTikTok } = await import(new URL('../lib/publishers.js', import.meta.url).href);

const ENV = {
  TIKTOK_CLIENT_KEY: 'awx123',
  TIKTOK_CLIENT_SECRET: 'secret',
};
const ORIGIN = 'https://web3ashley.com';

/* ------------------------------------------------------- the connect URL */

await step('the redirect URI is https, absolute, and carries no query', () => {
  const uri = tiktok.redirectUri(ORIGIN);
  is(uri, 'https://web3ashley.com/oauth/tiktok/callback', 'uri');
  if (uri.includes('?') || uri.includes('#')) throw new Error('query or fragment');
});

await step('a trailing slash on the origin does not become a second URI', () => {
  is(tiktok.redirectUri('https://web3ashley.com/'), tiktok.redirectUri(ORIGIN), 'uri');
});

await step('scopes are comma separated, which is TikTok and nobody else', () => {
  const url = new URL(tiktok.authorizeUrl(ENV, { origin: ORIGIN, state: 'st' }));
  is(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/', 'endpoint');
  is(url.searchParams.get('scope'), 'user.info.basic,video.publish', 'scope');
  is(url.searchParams.get('response_type'), 'code', 'response_type');
  is(url.searchParams.get('client_key'), 'awx123', 'client_key');
  is(url.searchParams.get('state'), 'st', 'state');
  is(url.searchParams.get('redirect_uri'), tiktok.redirectUri(ORIGIN), 'redirect_uri');
});

await step('a key pasted with a newline on it does not go out with one', () => {
  // this is not hypothetical: a value pasted into a dashboard field can
  // carry a trailing newline, it renders as dots so nothing looks wrong,
  // and percent-encoded into the URL it becomes %0A — which TikTok
  // answers with "correct the following: client_key" and no further clue
  const dirty = { ...ENV, TIKTOK_CLIENT_KEY: '  awx1234567890abc\n', TIKTOK_CLIENT_SECRET: ' s3cret ' };
  is(tiktok.clientKey(dirty), 'awx1234567890abc', 'the key');
  is(tiktok.clientSecret(dirty), 's3cret', 'the secret');
  const url = tiktok.authorizeUrl(dirty, { origin: ORIGIN, state: 'st' });
  if (/%0A|%20/.test(url)) throw new Error(`the URL still carries it: ${url}`);
  is(new URL(url).searchParams.get('client_key'), 'awx1234567890abc', 'what TikTok receives');
});

await step('a missing key is empty rather than the string "undefined"', () => {
  is(tiktok.clientKey({}), '', 'the key');
});

await step('video.list is asked for only when the app actually has it', () => {
  is(tiktok.scopes(ENV).includes('video.list'), false, 'by default');
  const withList = tiktok.scopes({ ...ENV, TIKTOK_SCOPES: 'video.list' });
  is(withList.join(','), 'user.info.basic,video.publish,video.list', 'when set');
  // and asking twice does not send it twice
  is(tiktok.scopes({ ...ENV, TIKTOK_SCOPES: 'video.publish, video.list' }).length, 3, 'no duplicates');
});

/* ------------------------------------------------ which client to act as */

const fakeSettings = (rows) => ({
  db: {},
  getSetting: async (_db, key) => rows[key] ?? null,
});

await step('with nothing stored, the deployment is the client', async () => {
  const f = fakeSettings({});
  const out = await tiktok.credentials(f.db, ENV, { getSetting: f.getSetting });
  is(out.key, 'awx123', 'key');
  is(out.source, 'environment', 'source');
});

await step('a pair set in the studio wins, so a swap costs no deployment', async () => {
  const f = fakeSettings({ 'tiktok.client_key': 'sbaw999', 'tiktok.client_secret': 'sbsecret' });
  const out = await tiktok.credentials(f.db, ENV, { getSetting: f.getSetting });
  is(out.key, 'sbaw999', 'key');
  is(out.secret, 'sbsecret', 'secret');
  is(out.source, 'studio', 'source');
  // and it is what the authorize URL carries
  is(new URL(tiktok.authorizeUrl(ENV, { origin: ORIGIN, state: 's', key: out.key }))
       .searchParams.get('client_key'), 'sbaw999', 'client_key sent');
});

await step('half a pair is not a client — it falls back rather than mixing', async () => {
  // a key from the sandbox with the live app's secret is the worst of both,
  // and it would fail with an error about the secret, not the half-set pair
  const f = fakeSettings({ 'tiktok.client_key': 'sbaw999' });
  const out = await tiktok.credentials(f.db, ENV, { getSetting: f.getSetting });
  is(out.key, 'awx123', 'key');
  is(out.source, 'environment', 'source');
});

await step('a stored pair is trimmed too', async () => {
  const f = fakeSettings({ 'tiktok.client_key': ' sbaw999\n', 'tiktok.client_secret': 'sbsecret ' });
  const out = await tiktok.credentials(f.db, ENV, { getSetting: f.getSetting });
  is(out.key, 'sbaw999', 'key');
  is(out.secret, 'sbsecret', 'secret');
});

/* --------------------------------------------------- are the keys real */

await step('a valid pair comes back as valid', async () => {
  const out = await tiktok.testCredentials(ENV, {
    fetcher: async (url, init) => {
      const body = new URLSearchParams(init.body);
      is(body.get('grant_type'), 'client_credentials', 'grant type');
      is(body.get('client_key'), 'awx123', 'key');
      is(body.get('client_secret'), 'secret', 'secret');
      return { json: async () => ({ access_token: 'clt.x', expires_in: 7200, token_type: 'Bearer' }) };
    },
  });
  is(out.ok, true, 'ok');
  is(out.expiresIn, 7200, 'lifetime');
});

await step('a bad pair comes back with what TikTok said, not a shrug', async () => {
  const out = await tiktok.testCredentials(ENV, {
    fetcher: async () => ({
      json: async () => ({ error: 'invalid_client', error_description: 'Client info is illegal or malformed.' }),
    }),
  });
  is(out.ok, false, 'ok');
  is(out.error, 'Client info is illegal or malformed.', 'the reason');
  is(out.code, 'invalid_client', 'the code');
});

await step('nothing set is answered without calling out', async () => {
  const out = await tiktok.testCredentials({}, {
    fetcher: async () => { throw new Error('should not have been called'); },
  });
  is(out.ok, false, 'ok');
  if (!/not set/.test(out.error)) throw new Error(out.error);
});

await step('the credentials are trimmed on the way to this call too', async () => {
  let sent = null;
  await tiktok.testCredentials(
    { TIKTOK_CLIENT_KEY: ' awx123\n', TIKTOK_CLIENT_SECRET: 'secret ' },
    { fetcher: async (url, init) => { sent = new URLSearchParams(init.body); return { json: async () => ({}) }; } }
  );
  is(sent.get('client_key'), 'awx123', 'key');
  is(sent.get('client_secret'), 'secret', 'secret');
});

/* ------------------------------------------------------- privacy choice */

const PUBLIC_ACCOUNT = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'];
const PRIVATE_ACCOUNT = ['FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'];

await step('what was asked for is used when the account offers it', () => {
  is(tiktok.choosePrivacy(PUBLIC_ACCOUNT, 'PUBLIC_TO_EVERYONE').level, 'PUBLIC_TO_EVERYONE', 'level');
});

await step('a level the account does not offer falls back to the quietest', () => {
  const out = tiktok.choosePrivacy(PRIVATE_ACCOUNT, 'PUBLIC_TO_EVERYONE');
  is(out.level, 'SELF_ONLY', 'level');
  is(out.insteadOf, 'PUBLIC_TO_EVERYONE', 'what it was instead of');
});

await step('no option list at all is not a reason to guess loudly', () => {
  is(tiktok.choosePrivacy(undefined).level, 'SELF_ONLY', 'level');
  is(tiktok.choosePrivacy([], 'PUBLIC_TO_EVERYONE').assumed, true, 'says it assumed');
});

/* ------------------------------------------------------------- the post */

const CREATOR = {
  data: {
    creator_username: 'web3ashley',
    privacy_level_options: PUBLIC_ACCOUNT,
    comment_disabled: false,
  },
  error: { code: 'ok' },
};

/** Stub global fetch, and keep every request body for inspection. */
function stub(routes) {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    sent.push({ url: u, body: init?.body ? JSON.parse(init.body) : null });
    for (const [match, body] of routes) {
      if (u.includes(match)) {
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
      }
    }
    throw new Error(`nothing stubbed for ${u}`);
  };
  return sent;
}
const realFetch = globalThis.fetch;

const OK_INIT = { data: { publish_id: 'v_pub_1' }, error: { code: 'ok' } };
const post = (over = {}) => toTikTok(ENV, {
  urls: ['https://web3ashley.com/media/a.jpg', 'https://web3ashley.com/media/b.jpg'],
  title: 'Eleven seconds',
  description: 'Eleven seconds. #webdesign',
  token: 'tok',
  ...over,
});

await step('the creator is asked before anything is posted', async () => {
  const sent = stub([['creator_info/query', CREATOR], ['content/init', OK_INIT]]);
  const out = await post({ audited: true });
  is(out.ok, true, 'ok');
  if (!sent[0].url.includes('creator_info/query')) {
    throw new Error(`first call was ${sent[0].url}`);
  }
  is(out.as, 'web3ashley', 'the account it posted as');
  is(out.id, 'v_pub_1', 'publish id');
});

await step('an audited app posts at the level it was told to', async () => {
  const sent = stub([['creator_info/query', CREATOR], ['content/init', OK_INIT]]);
  await post({ audited: true });
  is(sent[1].body.post_info.privacy_level, 'PUBLIC_TO_EVERYONE', 'privacy level');
});

await step('an unaudited app says the post is private, in the result', async () => {
  const priv = { ...CREATOR, data: { ...CREATOR.data, privacy_level_options: PRIVATE_ACCOUNT } };
  const out = await post({ audited: false, ...(stub([['creator_info/query', priv], ['content/init', OK_INIT]]), {}) });
  is(out.privacy, 'SELF_ONLY', 'reported back');
  if (!/only you can see it/.test(out.note)) throw new Error(out.note);
});

await step('an unaudited app will not post to a public account', async () => {
  // "All user accounts using the API client to post must be set to
  // private at the time of posting." SELF_ONLY on the post is not
  // enough; TikTok answers unaudited_client_can_only_post_to_private_accounts
  // and the code alone does not say what to go and change.
  const sent = stub([['creator_info/query', CREATOR], ['content/init', OK_INIT]]);
  const out = await post({ audited: false });
  is(out.ok, false, 'ok');
  if (!/private/i.test(out.error)) throw new Error(out.error);
  if (!/Settings and privacy/.test(out.error)) throw new Error(`no fix named: ${out.error}`);
  // and it never spent the posting call to find out
  is(sent.length, 1, 'calls made');
});

await step('a private account is posted to, at SELF_ONLY', async () => {
  const priv = { ...CREATOR, data: { ...CREATOR.data, privacy_level_options: PRIVATE_ACCOUNT } };
  const sent = stub([['creator_info/query', priv], ['content/init', OK_INIT]]);
  const out = await post({ audited: false });
  is(out.ok, true, 'ok');
  is(sent[1].body.post_info.privacy_level, 'SELF_ONLY', 'privacy level');
});

await step('an audited app is not held to the private-account rule', async () => {
  const sent = stub([['creator_info/query', CREATOR], ['content/init', OK_INIT]]);
  const out = await post({ audited: true });
  is(out.ok, true, 'ok');
  is(sent[1].body.post_info.privacy_level, 'PUBLIC_TO_EVERYONE', 'privacy level');
});

await step('a creator who turned comments off keeps them off', async () => {
  const off = { ...CREATOR, data: { ...CREATOR.data, comment_disabled: true } };
  const sent = stub([['creator_info/query', off], ['content/init', OK_INIT]]);
  await post({ audited: true });
  is(sent[1].body.post_info.disable_comment, true, 'disable_comment');
});

await step('the pictures go as PULL_FROM_URL, and it says they are generated', async () => {
  const sent = stub([['creator_info/query', CREATOR], ['content/init', OK_INIT]]);
  await post({ audited: true });
  const body = sent[1].body;
  is(body.media_type, 'PHOTO', 'media_type');
  is(body.post_mode, 'DIRECT_POST', 'post_mode');
  is(body.source_info.source, 'PULL_FROM_URL', 'source');
  is(body.source_info.photo_images.length, 2, 'photos');
  is(body.is_aigc, true, 'declared as generated');
});

await step('the title is cut to 90 runes rather than refused by TikTok', async () => {
  const sent = stub([['creator_info/query', CREATOR], ['content/init', OK_INIT]]);
  await post({ audited: true, title: 'x'.repeat(200) });
  is(sent[1].body.post_info.title.length, 90, 'title length');
});

await step('an unverified domain is explained, not just echoed', async () => {
  stub([
    ['creator_info/query', CREATOR],
    ['content/init', { error: { code: 'url_ownership_unverified', message: 'unverified' } }],
  ]);
  const out = await post({ audited: true });
  is(out.ok, false, 'ok');
  if (!/URL property/i.test(out.error)) throw new Error(out.error);
});

await step('a missing scope points at the product that grants it', async () => {
  stub([
    ['creator_info/query', CREATOR],
    ['content/init', { error: { code: 'scope_not_authorized', message: 'no' } }],
  ]);
  const out = await post({ audited: true });
  if (!/Content Posting/.test(out.error)) throw new Error(out.error);
});

await step('a creator_info that fails stops the post rather than guessing', async () => {
  stub([['creator_info/query', { error: { code: 'access_token_invalid', message: 'expired' } }]]);
  const out = await post({ audited: true });
  is(out.ok, false, 'ok');
  if (!/creator settings/.test(out.error)) throw new Error(out.error);
});

await step('no token is skipped, and never reaches the network', async () => {
  globalThis.fetch = async () => { throw new Error('should not have been called'); };
  const out = await post({ token: '' });
  is(out.skipped, true, 'skipped');
});

globalThis.fetch = realFetch;

/* --------------------------------------------------- what a slide may be */

const { problems: platformProblems, TIKTOK } =
  await import(new URL('../assets/js/platforms.js', import.meta.url).href);

const carousel = (slides) => ({
  title: 'x', caption: 'y', hashtags: '', targets: ['tiktok'],
  slides: slides.map((s, i) => ({ position: i, media_key: 'k', ...s })),
});

await step('a 4K master is caught before it reaches TikTok', () => {
  const said = platformProblems(carousel([
    { width: 2160, height: 2700, content_type: 'image/jpeg' },
    { width: 1080, height: 1350, content_type: 'image/jpeg' },
  ]));
  if (!said.some((s) => /1080p/.test(s))) throw new Error(said.join(' | ') || 'nothing said');
  // and the one that is the right size is not complained about
  is(said.filter((s) => /Slide 2/.test(s)).length, 0, 'complaints about the good slide');
});

await step('PNG is refused for TikTok too, not only for Instagram', () => {
  const said = platformProblems(carousel([
    { width: 1080, height: 1350, content_type: 'image/png' },
    { width: 1080, height: 1350, content_type: 'image/jpeg' },
  ]));
  if (!said.some((s) => /TikTok takes JPEG and WebP/.test(s))) throw new Error(said.join(' | '));
});

await step('the size the brief asks for is a size both platforms accept', () => {
  const said = platformProblems({
    title: 'x', caption: 'y', hashtags: '', targets: ['instagram', 'tiktok'],
    slides: [0, 1].map((i) => ({
      position: i, media_key: 'k', width: 1080, height: 1350,
      content_type: 'image/jpeg', bytes: 2 * 1024 * 1024,
    })),
  });
  is(said.length, 0, `problems: ${said.join(' | ')}`);
  is(TIKTOK.maxWidth, 1080, 'the cap this is checked against');
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe connect URL is right, and nothing posts louder than it is allowed to'
);
process.exit(problems.length ? 1 : 0);

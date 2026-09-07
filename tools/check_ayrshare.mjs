/**
 * check_ayrshare.mjs — the broker road, without posting anything.
 *
 * The failure worth catching is the quiet one: Ayrshare answers 200 for
 * a call in which one network did not go out, and reading only the
 * status line records all three as posted. Nobody is watching when this
 * runs, so that failure would be discovered by a carousel simply never
 * appearing.
 */
import assert from 'node:assert';
import { toAyrshare, postingRoute } from '../lib/ayrshare.js';
import { AGENT_STATES } from '../lib/carousels.js';

let pass = 0;
const ok = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};
const okAsync = async (name, fn) => {
  try { await fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

const URLS = ['https://s/1.png', 'https://s/2.png', 'https://s/3.png'];
const ALL = ['instagram', 'tiktok', 'facebook'];

/** A fetch that answers with whatever this test wants, and records the call. */
function fakeFetch(status, payload) {
  const seen = {};
  global.fetch = async (url, init) => {
    seen.url = url;
    seen.body = JSON.parse(init.body);
    seen.auth = init.headers.authorization;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) };
  };
  return seen;
}

console.log('\nthe broker road:\n');

await okAsync('no key is skipped, not failed — there is nothing wrong yet', async () => {
  const r = await toAyrshare({}, { urls: URLS, caption: 'x', targets: ALL });
  for (const t of ALL) {
    assert.equal(r[t].skipped, true, `${t} should be skipped`);
    assert.match(r[t].error, /AYRSHARE_API_KEY/);
  }
});

await okAsync('one call carries every platform, and the slides are the carousel', async () => {
  const seen = fakeFetch(200, {
    postIds: ALL.map((p) => ({ platform: p, status: 'success', id: `${p}-1` })),
  });
  const r = await toAyrshare({ AYRSHARE_API_KEY: 'k' },
    { urls: URLS, caption: 'hello', targets: ALL });
  assert.equal(seen.body.platforms.length, 3, 'all three in one call');
  assert.deepEqual(seen.body.mediaUrls, URLS, 'every slide, in order');
  assert.equal(seen.body.post, 'hello');
  assert.equal(seen.auth, 'Bearer k');
  assert.ok(!('scheduleDate' in seen.body), 'no schedule means post now');
  for (const t of ALL) assert.equal(r[t].ok, true, `${t} posted`);
});

await okAsync('a platform that failed inside a 200 is NOT recorded as posted', async () => {
  fakeFetch(200, {
    postIds: [
      { platform: 'instagram', status: 'success', id: 'ig-1' },
      { platform: 'tiktok', status: 'error', message: 'account is private' },
    ],
  });
  const r = await toAyrshare({ AYRSHARE_API_KEY: 'k' },
    { urls: URLS, caption: 'x', targets: ALL });
  assert.equal(r.instagram.ok, true, 'instagram went out');
  assert.equal(r.tiktok.ok, false, 'tiktok did not');
  assert.match(r.tiktok.error, /private/);
  // facebook was asked for and never mentioned: that is not a success
  assert.equal(r.facebook.ok, false, 'a platform they said nothing about is not posted');
});

await okAsync('eleven slides is refused, never trimmed to ten', async () => {
  fakeFetch(200, { postIds: [] });
  const many = Array.from({ length: 11 }, (_, i) => `https://s/${i}.png`);
  const r = await toAyrshare({ AYRSHARE_API_KEY: 'k' },
    { urls: many, caption: 'x', targets: ['instagram'] });
  assert.equal(r.instagram.skipped, true);
  assert.match(r.instagram.error, /11 slides/);
});

await okAsync('a future time is scheduled; a past one is not sent at all', async () => {
  const soon = new Date(Date.now() + 3600e3).toISOString();
  let seen = fakeFetch(200, { postIds: [{ platform: 'instagram', status: 'success', id: '1' }] });
  await toAyrshare({ AYRSHARE_API_KEY: 'k' },
    { urls: URLS, caption: 'x', targets: ['instagram'], scheduleFor: soon });
  assert.match(seen.body.scheduleDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    'their format, to the second, no milliseconds');

  seen = fakeFetch(200, { postIds: [{ platform: 'instagram', status: 'success', id: '1' }] });
  await toAyrshare({ AYRSHARE_API_KEY: 'k' }, {
    urls: URLS, caption: 'x', targets: ['instagram'],
    scheduleFor: new Date(Date.now() - 60e3).toISOString(),
  });
  assert.ok(!('scheduleDate' in seen.body),
    'a past date would post immediately, so it is never sent by accident');
});

await okAsync('their reason is reported, not the status line', async () => {
  fakeFetch(402, { message: 'Free plan discontinued', code: 189 });
  const r = await toAyrshare({ AYRSHARE_API_KEY: 'k' },
    { urls: URLS, caption: 'x', targets: ALL });
  assert.match(r.instagram.error, /Free plan discontinued.*189/);
  assert.equal(r.instagram.skipped, undefined, 'a refusal is a failure, not a skip');
});

await okAsync('the route is a setting, and direct is the default', async () => {
  const get = async (_db, k) => ({ 'post.route': undefined }[k]);
  assert.equal(await postingRoute({}, get), 'direct');
  assert.equal(await postingRoute({}, async () => 'ayrshare'), 'ayrshare');
  assert.equal(await postingRoute({}, async () => 'AYRSHARE'), 'ayrshare');
  assert.equal(await postingRoute({}, async () => 'nonsense'), 'direct',
    'anything unrecognised falls back to our own apps, never to a broker');
});

ok('the agent still cannot reach posting', () => {
  /* The real set, imported rather than restated. A new road to the
     platforms is exactly the change that could quietly widen what the
     agent can reach, and a test that asserts against its own copy of the
     constant would pass while the real one drifted. */
  for (const state of ['approved', 'scheduled', 'posted']) {
    assert.ok(!AGENT_STATES.has(state), `the agent must not reach ${state}`);
  }
  assert.ok(AGENT_STATES.has('review'), 'and it must still reach review');
});

console.log(`\n${pass} checks passed\n`);

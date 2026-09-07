/**
 * check_buffer.mjs — the broker road, without posting anything.
 *
 *   node tools/check_buffer.mjs
 *
 * Every call is stubbed. What is checked is the reading: Buffer answers
 * on one endpoint with one status code whatever happened, so the failures
 * that matter all arrive inside a 200 and have to be dug out.
 */

import assert from 'node:assert/strict';
import { toBuffer, channelsOf, postingRoute } from '../lib/buffer.js';

const problems = [];
const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + ' — ' + String(e.message).split('\n')[0]); problems.push(name); }
};

/** Answers keyed off the operation name in the body, and records the sends. */
function net(answers) {
  const sent = [];
  const f = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ url: String(url), auth: init.headers.authorization, ...body });
    for (const [op, r] of answers) {
      if (body.query.includes(op)) {
        return {
          ok: (r.status ?? 200) < 400,
          status: r.status ?? 200,
          text: async () => JSON.stringify(r.json ?? {}),
        };
      }
    }
    throw new Error(`no stub for ${body.query.slice(0, 40)}`);
  };
  f.sent = sent;
  return f;
}

const ORG = ['GetOrganizations', { json: { data: { account: { organizations: [{ id: 'org1' }] } } } }];
const CHANS = ['GetChannels', { json: { data: { channels: [
  { id: 'ch1', service: 'instagram', name: 'web3ashley', isDisconnected: false },
  { id: 'ch2', service: 'tiktok', name: 'web3ashley', isDisconnected: false },
] } } }];
const MADE = ['CreatePost', { json: { data: { createPost: { post: { id: 'p1' } } } } }];

const ENV = { BUFFER_API_KEY: 'bf-key', DB: {} };
const CAROUSEL = {
  urls: ['https://web3ashley.com/media/a.jpg', 'https://web3ashley.com/media/b.jpg'],
  caption: 'A carousel.',
  targets: ['instagram', 'tiktok'],
};

await step('it posts to every target, one call each', async () => {
  const f = net([ORG, CHANS, MADE]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, true);
  assert.equal(out.tiktok.ok, true);
  assert.equal(out.instagram.via, 'buffer');
  const posts = f.sent.filter((s) => s.query.includes('CreatePost'));
  assert.equal(posts.length, 2, 'one createPost per channel');
  assert.deepEqual(posts.map((p) => p.variables.input.channelId), ['ch1', 'ch2']);
});

await step('the key travels as a bearer token and nowhere else', async () => {
  const f = net([ORG, CHANS, MADE]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(f.sent[0].auth, 'Bearer bf-key');
  assert.ok(!JSON.stringify(out).includes('bf-key'), 'the key is not in the results');
});

await step('every slide goes, in order, as an image asset', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  const { assets } = f.sent.find((s) => s.query.includes('CreatePost')).variables.input;
  assert.deepEqual(assets, CAROUSEL.urls.map((url) => ({ image: { url } })));
});

await step('a slot that has come round goes now, not into the queue', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f, scheduleFor: '2020-01-01T00:00:00Z' });
  const { input } = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  /* A past dueAt would sit until Buffer's next sweep. Our own queue has
     already decided this is due, so it goes. */
  assert.equal(input.mode, 'shareNow');
  assert.equal(input.dueAt, undefined);
});

await step('and a future one is handed over as a time', async () => {
  const at = new Date(Date.now() + 86_400_000).toISOString();
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f, scheduleFor: at });
  const { input } = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  assert.equal(input.mode, 'customScheduled');
  assert.equal(input.dueAt, at);
});

await step('it publishes rather than reminding somebody to', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  const { input } = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  // `notification` would send a phone reminder and post nothing
  assert.equal(input.schedulingType, 'automatic');
});

await step('a refusal inside a 200 is a failure, not a success', async () => {
  const f = net([ORG, CHANS, ['CreatePost', { json: { errors: [{ message: 'Rate limited' }] } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
  assert.match(out.instagram.error, /Rate limited/);
});

await step('the error half of the union is read too', async () => {
  const f = net([ORG, CHANS,
    ['CreatePost', { json: { data: { createPost: { message: 'Channel needs reconnecting' } } } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
  assert.match(out.instagram.error, /reconnecting/);
});

await step('a success with no post id is not called a success', async () => {
  const f = net([ORG, CHANS, ['CreatePost', { json: { data: { createPost: {} } } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
});

await step('one platform failing does not stop the other', async () => {
  let n = 0;
  const f = net([ORG, CHANS, ['CreatePost', { json: {} }]]);
  const wrapped = async (u, i) => {
    const body = JSON.parse(i.body);
    if (body.query.includes('CreatePost') && n++ === 0) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ errors: [{ message: 'nope' }] }) };
    }
    if (body.query.includes('CreatePost')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: { createPost: { post: { id: 'p2' } } } }) };
    }
    return f(u, i);
  };
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: wrapped });
  assert.equal(out.instagram.ok, false);
  assert.equal(out.tiktok.ok, true);
});

await step('a channel that is not connected is skipped, not failed', async () => {
  const f = net([ORG, ['GetChannels', { json: { data: { channels: [
    { id: 'ch1', service: 'instagram', name: 'a', isDisconnected: false },
  ] } } }], MADE]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.tiktok.skipped, true);
  assert.match(out.tiktok.error, /Connect it in Buffer/);
  assert.equal(out.instagram.ok, true, 'the connected one still went');
});

await step('a disconnected channel counts as absent', async () => {
  const f = net([ORG, ['GetChannels', { json: { data: { channels: [
    { id: 'ch1', service: 'instagram', name: 'a', isDisconnected: false },
    { id: 'ch2', service: 'tiktok', name: 'a', isDisconnected: true },
  ] } } }], MADE]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.tiktok.skipped, true);
});

await step('PNG is refused before it is sent, because TikTok will not fetch it', async () => {
  const f = net([ORG, CHANS, MADE]);
  const out = await toBuffer(ENV, {
    ...CAROUSEL, urls: ['https://web3ashley.com/media/a.png'], fetcher: f,
  });
  assert.equal(out.tiktok.skipped, true);
  assert.match(out.tiktok.error, /JPEG/);
  assert.equal(f.sent.length, 0, 'nothing was sent at all');
});

await step('too many slides is refused per channel, not for all of them', async () => {
  const f = net([ORG, CHANS, MADE]);
  const eleven = Array.from({ length: 11 }, (_, i) => `https://web3ashley.com/media/${i}.jpg`);
  const out = await toBuffer(ENV, { ...CAROUSEL, urls: eleven, fetcher: f });
  // Instagram takes ten and TikTok takes thirty-five, so only one is refused
  assert.equal(out.instagram.skipped, true);
  assert.match(out.instagram.error, /takes 10/);
  assert.equal(out.tiktok.ok, true);
});

await step('no key is a refusal that names the setting', async () => {
  const out = await toBuffer({ DB: {} }, { ...CAROUSEL, fetcher: net([]) });
  assert.equal(out.instagram.skipped, true);
  assert.match(out.instagram.error, /BUFFER_API_KEY/);
});

await step('a dead key fails every target with the reason', async () => {
  const f = net([['GetOrganizations', { status: 401, json: { errors: [{ message: 'Unauthorized' }] } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
  assert.match(out.instagram.error, /Unauthorized/);
});

await step('the organization is looked up once and remembered', async () => {
  const store = {};
  const f = net([ORG, CHANS, MADE]);
  const opts = {
    fetcher: f,
    getSetting: async (_db, k) => store[k] ?? null,
    putSetting: async (_db, k, v) => { store[k] = v; },
  };
  await channelsOf(ENV, opts);
  await channelsOf(ENV, opts);
  assert.equal(store['buffer.org_id'], 'org1');
  assert.equal(f.sent.filter((s) => s.query.includes('GetOrganizations')).length, 1);
});

await step('the road is a setting, not the presence of a key', async () => {
  assert.equal(await postingRoute({}, async () => 'buffer'), 'buffer');
  assert.equal(await postingRoute({}, async () => 'BUFFER'), 'buffer');
  assert.equal(await postingRoute({}, async () => null), 'direct');
  // the old broker's name must not quietly select the new one
  assert.equal(await postingRoute({}, async () => 'ayrshare'), 'direct');
});

console.log(problems.length
  ? `\n${problems.length} failed: ${problems.join(', ')}`
  : '\nthe broker posts per channel, and reads a refusal inside a 200');
process.exit(problems.length ? 1 : 0);

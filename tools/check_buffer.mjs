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
const MADE = ['CreatePost', { json: { data: { p0: { post: { id: 'p1' } }, p1: { post: { id: 'p2' } } } } }];

const ENV = { BUFFER_API_KEY: 'bf-key', DB: {} };
const CAROUSEL = {
  urls: ['https://web3ashley.com/media/a.jpg', 'https://web3ashley.com/media/b.jpg'],
  caption: 'A carousel.',
  targets: ['instagram', 'tiktok'],
};

/*
 * The Instagram metadata, which is where a story lives on this road.
 *
 * `InstagramPostMetadataInput.type` is a non-null PostType and it is
 * what decides between the feed and a story, so a story is not a
 * follow-on call here — it is a second post to the same channel with a
 * different type. TikTok has no privacy field at all in its metadata,
 * which is why a private test cannot go through Buffer.
 */
await step('every Instagram post says which kind it is', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  const vars = f.sent.find((b) => /CreatePost/.test(b.query))?.variables ?? {};
  const ig = Object.values(vars).find((v) => v.channelId === 'ch1');
  assert.equal(ig.metadata.instagram.type, 'post', 'the carousel is not typed');
  const tt = Object.values(vars).find((v) => v.channelId === 'ch2');
  assert.equal(tt.metadata, undefined, 'TikTok was sent metadata it has no field for');
});

await step('a story is a SECOND post, and the carousel keeps its own result', async () => {
  const three = ['CreatePost', { json: { data: {
    p0: { post: { id: 'p1' } }, p1: { post: { id: 'p2' } }, p2: { post: { id: 'p3' } },
  } } }];
  const f = net([ORG, CHANS, three]);
  const out = await toBuffer(ENV, { ...CAROUSEL, story: true, fetcher: f });

  const vars = Object.values(
    f.sent.find((b) => /CreatePost/.test(b.query))?.variables ?? {});
  const igs = vars.filter((v) => v.channelId === 'ch1');
  assert.equal(igs.length, 2, `${igs.length} Instagram posts, not 2`);
  assert.deepEqual(igs.map((v) => v.metadata.instagram.type).sort(), ['post', 'story']);

  // the story carries slide one alone: the hook sheet, which is the cover
  const story = igs.find((v) => v.metadata.instagram.type === 'story');
  assert.equal(story.assets.length, 1);
  assert.match(story.assets[0].image.url, /a\.jpg$/);

  /* Reported apart. Keyed on `instagram` both would overwrite, and the
     carousel would be reported as whatever the story did. */
  assert.equal(out.instagram.ok, true);
  assert.equal(out.story.ok, true);
  assert.notEqual(out.instagram.id, out.story.id);
});

await step('it posts to every target', async () => {
  const f = net([ORG, CHANS, MADE]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, true);
  assert.equal(out.tiktok.ok, true);
  assert.equal(out.instagram.via, 'buffer');
  const post = f.sent.find((s) => s.query.includes('CreatePost'));
  assert.deepEqual([post.variables.i0.channelId, post.variables.i1.channelId], ['ch1', 'ch2']);
});

await step('every channel goes in ONE request, by alias', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  const posts = f.sent.filter((s) => s.query.includes('createPost'));
  assert.equal(posts.length, 1, 'two platforms, one round trip');
  assert.match(posts[0].query, /p0: createPost/);
  assert.match(posts[0].query, /p1: createPost/);
});

await step('and with the channels known, a post is a single request', async () => {
  const store = {};
  const opts = {
    getSetting: async (_d, k) => store[k] ?? null,
    putSetting: async (_d, k, v) => { store[k] = v; },
  };
  const warm = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: warm, ...opts });

  const again = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: again, ...opts });
  assert.equal(again.sent.length, 1, `second post cost ${again.sent.length} requests`);
  assert.match(again.sent[0].query, /createPost/);
});

await step('a failure drops the remembered channels, so a stale id is not kept', async () => {
  const store = {};
  const opts = {
    getSetting: async (_d, k) => store[k] ?? null,
    putSetting: async (_d, k, v) => { store[k] = v; },
  };
  await toBuffer(ENV, { ...CAROUSEL, fetcher: net([ORG, CHANS, MADE]), ...opts });
  assert.ok(store['buffer.channels'], 'they were remembered');

  await toBuffer(ENV, { ...CAROUSEL, ...opts, fetcher: net([ORG, CHANS,
    ['CreatePost', { json: { data: { p0: { message: 'Channel not found' }, p1: { message: 'Channel not found' } } } }]]) });
  assert.ok(!store['buffer.channels'], 'and forgotten after a failure');
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
  const { assets } = f.sent.find((s) => s.query.includes('CreatePost')).variables.i0;
  assert.deepEqual(assets, CAROUSEL.urls.map((url) => ({ image: { url } })));
});

await step('a slot that has come round goes now, not into the queue', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f, scheduleFor: '2020-01-01T00:00:00Z' });
  const input = f.sent.find((s) => s.query.includes('CreatePost')).variables.i0;
  /* A past dueAt would sit until Buffer's next sweep. Our own queue has
     already decided this is due, so it goes. */
  assert.equal(input.mode, 'shareNow');
  assert.equal(input.dueAt, undefined);
});

await step('and a future one is handed over as a time', async () => {
  const at = new Date(Date.now() + 86_400_000).toISOString();
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f, scheduleFor: at });
  const v = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  assert.equal(v.i0.mode, 'customScheduled');
  assert.equal(v.i0.dueAt, at);
  // the gap runs from the slot, not from now
  assert.equal(Date.parse(v.i1.dueAt) - Date.parse(at), 30 * 60_000);
});

await step('it publishes rather than reminding somebody to', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  const input = f.sent.find((s) => s.query.includes('CreatePost')).variables.i0;
  // `notification` would send a phone reminder and post nothing
  assert.equal(input.schedulingType, 'automatic');
});

await step('two platforms are spaced, not fired at the same second', async () => {
  const f = net([ORG, CHANS, MADE]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  const v = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  assert.equal(v.i0.mode, 'shareNow', 'the first goes at the slot');
  assert.equal(v.i1.mode, 'customScheduled', 'the second waits');
  const later = Date.parse(v.i1.dueAt) - Date.now();
  assert.ok(later > 25 * 60_000 && later < 35 * 60_000, `${Math.round(later / 60000)} minutes later`);
  assert.equal(out.tiktok.at, v.i1.dueAt, 'and the result says when');
});

await step('the gap is a setting, and zero means together', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, {
    ...CAROUSEL, fetcher: f,
    getSetting: async (_d, k) => (k === 'post.gap_minutes' ? '0' : null),
  });
  const v = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  assert.equal(v.i1.mode, 'shareNow');
});

await step('a single platform is never made to wait', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, targets: ['instagram'], fetcher: f });
  const v = f.sent.find((s) => s.query.includes('CreatePost')).variables;
  assert.equal(v.i0.mode, 'shareNow');
  assert.equal(v.i1, undefined);
});

await step('and the spacing still costs one request', async () => {
  const f = net([ORG, CHANS, MADE]);
  await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(f.sent.filter((s) => s.query.includes('createPost')).length, 1);
});

await step('a refusal inside a 200 is a failure, not a success', async () => {
  const f = net([ORG, CHANS, ['CreatePost', { json: { errors: [{ message: 'Rate limited' }] } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
  assert.match(out.instagram.error, /Rate limited/);
});

await step('the error half of the union is read too', async () => {
  const f = net([ORG, CHANS,
    ['CreatePost', { json: { data: { p0: { message: 'Channel needs reconnecting' }, p1: { post: { id: 'p2' } } } } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
  assert.match(out.instagram.error, /reconnecting/);
});

await step('a success with no post id is not called a success', async () => {
  const f = net([ORG, CHANS, ['CreatePost', { json: { data: { p0: {}, p1: {} } } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
  assert.equal(out.instagram.ok, false);
});

await step('one platform failing does not stop the other', async () => {
  /* The reason each alias is read on its own rather than the request
     being called a success: they share a round trip, not a fate. */
  const f = net([ORG, CHANS, ['CreatePost', { json: { data: {
    p0: { message: 'nope' }, p1: { post: { id: 'p2' } },
  } } }]]);
  const out = await toBuffer(ENV, { ...CAROUSEL, fetcher: f });
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
  await channelsOf(ENV, { ...opts, fresh: true });
  assert.equal(store['buffer.org_id'], 'org1');
  assert.equal(f.sent.filter((s) => s.query.includes('GetOrganizations')).length, 1);
});

await step('the rehearsal reads them live rather than trusting the cache', async () => {
  const store = { 'buffer.channels': JSON.stringify({ at: Date.now(), org: 'org1', channels: { instagram: { id: 'gone' } } }) };
  const f = net([ORG, CHANS, MADE]);
  const got = await channelsOf(ENV, {
    fetcher: f, fresh: true,
    getSetting: async (_d, k) => store[k] ?? null,
    putSetting: async (_d, k, v) => { store[k] = v; },
  });
  assert.equal(got.cached, undefined);
  assert.equal(got.channels.instagram.id, 'ch1');
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

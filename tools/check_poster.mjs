/**
 * check_poster.mjs — the scheduler, without touching a real account.
 *
 *   node tools/check_poster.mjs
 *
 * The posting Worker is the one piece nobody watches: it runs at 07:00
 * against live accounts, and its failures are invisible until a post is
 * missing. So its logic is exercised here against a fake database and
 * fake platforms — what it claims, what it puts back, what it says.
 *
 * The platform calls themselves are stubbed. Their request shapes came
 * off the reference pages (see poster/platforms.js) and cannot be
 * verified without credentials; what is verified here is everything
 * around them, which is where the damage would be.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

/* ------------------------------------------------------------ fake D1 */

/**
 * Enough of D1 to run the Worker: the four statements it issues, and a
 * changed-row count, which is the thing the claim depends on.
 */
function fakeDb(state) {
  return {
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async all() {
          if (/FROM carousels/.test(sql)) {
            const now = args[0];
            return { results: state.carousels.filter(
              (c) => c.status === 'scheduled' && (!c.scheduled_for || c.scheduled_for <= now)
            ) };
          }
          if (/FROM slides/.test(sql)) {
            return { results: state.slides.filter((s) => s.carousel_id === args[0] && s.media_key) };
          }
          return { results: [] };
        },
        async run() {
          const row = state.carousels.find((c) => c.id === args[0]);
          if (/status = 'posted'/.test(sql)) {
            // the conditional claim
            if (!row || row.status !== 'scheduled') return { meta: { changes: 0 } };
            row.status = 'posted'; row.posted_at = args[1];
            state.claims = (state.claims || 0) + 1;
            return { meta: { changes: 1 } };
          }
          if (/status = 'approved'/.test(sql)) {
            row.status = 'approved'; row.posted_at = null; row.results = args[1];
            return { meta: { changes: 1 } };
          }
          if (/SET results/.test(sql)) {
            row.results = args[1];
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return api;
    },
  };
}

const carousel = (over = {}) => ({
  id: 1, slug: 'the-eleven-second-booking-page', title: 'The eleven second booking page',
  caption: 'Eleven seconds.', hashtags: '#webdesign', targets: 'instagram,tiktok',
  slot: 1, scheduled_for: '2020-01-01T00:00:00Z', status: 'scheduled', ...over,
});
const slides = (n, id = 1) =>
  Array.from({ length: n }, (_, i) => ({ carousel_id: id, position: i, media_key: `k/${i}.jpg`, copy: `c${i}` }));

/* --------------------------------------------------- load with stubs */

/**
 * The Worker imports its platform calls, so they are replaced on the
 * module before it runs. Importing the real file first means a rename
 * there breaks this rather than being silently missed.
 */
const platformsUrl = new URL('../lib/publishers.js', import.meta.url).href;
const real = await import(platformsUrl);
if (!real.POSTERS.instagram || !real.POSTERS.tiktok || !real.POSTERS.facebook) {
  console.error('lib/publishers.js does not export the three posters');
  process.exit(1);
}

const sent = [];
const stub = (outcome) => async (env, payload) => {
  sent.push(payload);
  return outcome;
};

/** Swap POSTERS in place — the Worker holds a reference to the object. */
const setPosters = (map) => {
  for (const k of Object.keys(real.POSTERS)) delete real.POSTERS[k];
  Object.assign(real.POSTERS, map);
};

const worker = (await import(new URL('../lib/publish.js', import.meta.url).href));

const ENV = (db, over = {}) => ({
  DB: db, SITE: 'https://web3ashley.com', ...over,
});

const runOnce = (state, over = {}) => worker.runDue(ENV(fakeDb(state), over));

/* ------------------------------------------------------------------ run */

await step('it posts what is due, to every target', async () => {
  sent.length = 0;
  setPosters({
    instagram: stub({ ok: true, id: 'ig_1' }),
    tiktok: stub({ ok: true, id: 'tt_1' }),
    facebook: stub({ ok: false, skipped: true, error: 'not implemented' }),
  });
  const state = { carousels: [carousel()], slides: slides(3) };
  const out = await runOnce(state);
  is(out.ran, 1, 'carousels handled');
  is(state.carousels[0].status, 'posted', 'status');
  is(sent.length, 2, 'platforms called');
  const results = JSON.parse(state.carousels[0].results);
  is(results.instagram.id, 'ig_1', 'instagram id recorded');
  is(results.tiktok.id, 'tt_1', 'tiktok id recorded');
});

await step('it sends absolute public URLs, which is what they fetch', async () => {
  const payload = sent[0];
  is(payload.urls.length, 3, 'urls');
  for (const u of payload.urls) {
    if (!u.startsWith('https://web3ashley.com/media/')) throw new Error(`not public: ${u}`);
  }
});

await step('the caption carries the hashtags', async () => {
  if (!sent[0].caption.includes('#webdesign')) throw new Error(sent[0].caption);
  if (!sent[0].caption.includes('Eleven seconds.')) throw new Error(sent[0].caption);
});

await step('nothing that is not scheduled is ever touched', async () => {
  for (const status of ['review', 'approved', 'changes', 'planned', 'posted', 'rejected']) {
    const state = { carousels: [carousel({ status })], slides: slides(3) };
    const out = await runOnce(state);
    is(out.ran, 0, `a carousel in ${status}`);
    is(state.carousels[0].status, status, `${status} unchanged`);
  }
});

await step('a slot in the future is left alone', async () => {
  const state = {
    carousels: [carousel({ scheduled_for: '2999-01-01T00:00:00Z' })],
    slides: slides(3),
  };
  const out = await runOnce(state);
  is(out.ran, 0, 'carousels handled');
  is(state.carousels[0].status, 'scheduled', 'status');
});

await step('two overlapping runs cannot post the same thing twice', async () => {
  setPosters({ instagram: stub({ ok: true, id: 'ig_x' }), tiktok: stub({ ok: true, id: 'tt_x' }) });
  const state = { carousels: [carousel()], slides: slides(3), claims: 0 };
  await Promise.all([runOnce(state), runOnce(state)]);
  is(state.claims, 1, 'times the row was claimed');
});

await step('a total failure puts it back in approved, with the reason', async () => {
  setPosters({
    instagram: stub({ ok: false, error: 'Slide 1: media is not JPEG' }),
    tiktok: stub({ ok: false, error: 'spam_risk_too_many_posts' }),
  });
  const state = { carousels: [carousel()], slides: slides(3) };
  await runOnce(state);
  is(state.carousels[0].status, 'approved', 'status');
  is(state.carousels[0].posted_at, null, 'posted_at cleared');
  const results = JSON.parse(state.carousels[0].results);
  if (!/not JPEG/.test(results.instagram.error)) throw new Error('the reason was lost');
  if (!/spam_risk/.test(results.tiktok.error)) throw new Error('the reason was lost');
});

await step('a partial failure stays posted — a live post cannot be unsent', async () => {
  setPosters({
    instagram: stub({ ok: true, id: 'ig_2' }),
    tiktok: stub({ ok: false, error: 'audit pending' }),
  });
  const state = { carousels: [carousel()], slides: slides(3) };
  await runOnce(state);
  is(state.carousels[0].status, 'posted', 'status');
  const results = JSON.parse(state.carousels[0].results);
  is(results.instagram.ok, true, 'instagram');
  is(results.tiktok.ok, false, 'tiktok');
});

await step('a platform that throws does not take the others down', async () => {
  setPosters({
    instagram: async () => { throw new Error('socket hang up'); },
    tiktok: stub({ ok: true, id: 'tt_3' }),
  });
  const state = { carousels: [carousel()], slides: slides(3) };
  await runOnce(state);
  is(state.carousels[0].status, 'posted', 'status');
  const results = JSON.parse(state.carousels[0].results);
  if (!/socket hang up/.test(results.instagram.error)) throw new Error('the throw was swallowed');
  is(results.tiktok.ok, true, 'the other platform still went');
});

await step('missing credentials are skipped, not failed', async () => {
  setPosters({
    instagram: stub({ ok: false, skipped: true, error: 'No IG_ACCESS_TOKEN' }),
    tiktok: stub({ ok: true, id: 'tt_4' }),
  });
  const state = { carousels: [carousel()], slides: slides(3) };
  await runOnce(state);
  // tiktok went, so it stays posted rather than being put back
  is(state.carousels[0].status, 'posted', 'status');
});

await step('a carousel with too few pictures is put back, not posted', async () => {
  setPosters({ instagram: stub({ ok: true, id: 'x' }) });
  const state = { carousels: [carousel()], slides: slides(1) };
  await runOnce(state);
  is(state.carousels[0].status, 'approved', 'status');
  if (!/slide/i.test(JSON.parse(state.carousels[0].results).error)) throw new Error('no reason');
});

await step('the optional cron Worker is a shell over the same code', async () => {
  const shell = readFileSync(join(ROOT, 'poster/index.js'), 'utf8');
  if (!/from '\.\.\/lib\/publish\.js'/.test(shell)) {
    throw new Error('the Worker does not import the shared run — two copies would drift');
  }
  const w = (await import(new URL('../poster/index.js', import.meta.url).href)).default;
  const res = await w.fetch(new Request('https://poster/run', { method: 'POST' }),
                            { AGENT_TOKEN: 't' });
  is(res.status, 401, '/run without the token');
});

await step('the real Facebook poster refuses rather than guessing', async () => {
  const out = await real.toFacebook();
  is(out.ok, false, 'ok');
  is(out.skipped, true, 'skipped');
  if (!/never verified/i.test(out.error)) throw new Error(out.error);
});

await step('the cron lines are five, and valid', async () => {
  const toml = readFileSync(join(ROOT, 'poster/wrangler.toml'), 'utf8');
  const block = /crons\s*=\s*\[([\s\S]*?)\]/.exec(toml);
  if (!block) throw new Error('no crons');
  const lines = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  is(lines.length, 5, 'slots');
  for (const c of lines) {
    if (c.trim().split(/\s+/).length !== 5) throw new Error(`not a 5-field cron: ${c}`);
  }
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe scheduler posts what was approved, once, and says so when it cannot'
);
process.exit(problems.length ? 1 : 0);

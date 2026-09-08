/**
 * check_preflight.mjs — the rehearsal, and the gate it shares with the run.
 *
 *   node tools/check_preflight.mjs
 *
 * Every network call is a stub, so this proves the reading and the
 * verdicts rather than the platforms. What it is really for is the two
 * things that used to be impossible to test at all: that a carousel the
 * platform will refuse is stopped before the post, and that a token which
 * resolves but no longer works is caught by spending it rather than by
 * finding it.
 */

import { preflight, preflightAccounts } from '../lib/preflight.js';
import { runDue } from '../lib/publish.js';
import { POSTERS } from '../lib/publishers.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

const verdict = (out, what) => out.checks.find((c) => c.what === what);
const said = (out) => out.checks.map((c) => `${c.verdict}: ${c.what}`).join(' | ');
const stops = (out) => out.checks.filter((c) => c.verdict === 'stop');

/* ---------------------------------------------------------------- fakes */

/** Slides carry what the media table knows, because that is what is judged. */
const slide = (i, over = {}) => ({
  carousel_id: 1, position: i, media_key: `k/${i}.jpg`, copy: `c${i}`,
  width: 1080, height: 1350, content_type: 'image/jpeg', bytes: 400_000, ...over,
});

const row = (over = {}) => ({
  id: 1, slug: 'the-contact-form-nobody-reads', title: 'The contact form nobody reads',
  caption: 'Nobody reads it.', hashtags: '#webdesign', targets: 'instagram,tiktok',
  status: 'scheduled', scheduled_for: '2020-01-01T00:00:00Z', ...over,
});

function fakeDb(state) {
  return {
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() {
          if (/FROM settings/.test(sql)) {
            const v = (state.settings || {})[args[0]];
            return v === undefined ? null : { value: v };
          }
          return null;
        },
        async all() {
          if (/FROM carousels/.test(sql)) {
            return { results: state.carousels.filter((c) => c.status === 'scheduled') };
          }
          if (/FROM slides/.test(sql)) {
            return { results: state.slides.filter((s) => s.carousel_id === args[0]) };
          }
          return { results: [] };
        },
        async run() {
          if (/INTO settings/.test(sql)) {
            state.settings = state.settings || {};
            state.settings[args[0]] = args[1];
            return { meta: { changes: 1 } };
          }
          const r = state.carousels?.find((c) => c.id === args[0]);
          if (!r) return { meta: { changes: 0 } };
          if (/status = 'posted'/.test(sql)) {
            if (r.status !== 'scheduled') return { meta: { changes: 0 } };
            r.status = 'posted'; return { meta: { changes: 1 } };
          }
          if (/status = 'approved'/.test(sql)) {
            r.status = 'approved'; r.results = args[1]; return { meta: { changes: 1 } };
          }
          if (/SET results/.test(sql)) { r.results = args[1]; return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        },
      };
      return api;
    },
  };
}

/**
 * A network that answers from a table and records what it was asked, so a
 * test can say "and it never called the posting endpoint" and mean it.
 */
function fakeNet(routes) {
  const calls = [];
  const fetcher = async (url, init = {}) => {
    const u = String(url);
    calls.push(`${init.method || 'GET'} ${u}`);
    for (const [pattern, answer] of routes) {
      if (u.includes(pattern)) {
        const r = typeof answer === 'function' ? answer(u, init) : answer;
        return {
          ok: r.status ? r.status < 400 : true,
          status: r.status ?? 200,
          headers: new Headers(r.headers || {}),
          json: async () => r.json ?? {},
          text: async () => JSON.stringify(r.json ?? {}),
        };
      }
    }
    return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' };
  };
  fetcher.calls = calls;
  return fetcher;
}

/** Enough of R2 to answer head(). */
const bucket = (type = 'image/jpeg', size = 400_000, missing = false) => ({
  head: async () => (missing ? null : { httpMetadata: { contentType: type }, size }),
});
const MEDIA_OK = ['/media/', { headers: { 'content-type': 'image/jpeg', 'content-length': '400000' } }];
const IG_OK = ['graph.instagram.com', { json: { id: '178', username: 'web3ashley' } }];
const TT_OK = ['creator_info', {
  json: { data: { creator_username: 'web3ashley', privacy_level_options: ['SELF_ONLY'], comment_disabled: false } },
}];

const ENV = (state, over = {}) => ({
  DB: fakeDb(state),
  MEDIA: bucket(),
  SITE: 'https://web3ashley.com',
  IG_USER_ID: '178',
  IG_ACCESS_TOKEN: 'ig-token',
  TIKTOK_ACCESS_TOKEN: 'tt-token',
  TIKTOK_REFRESH_TOKEN: 'tt-refresh',
  ...over,
});

/* ------------------------------------------------------------ the happy */

console.log('\na carousel that is ready');
{
  const state = { carousels: [row()], slides: [slide(0), slide(1), slide(2)] };
  const net = fakeNet([MEDIA_OK, IG_OK, TT_OK]);
  const out = await preflight(ENV(state), row(), { fetcher: net });

  ok('it says it is ready', out.ready === true, said(out));
  ok('and names the road it would take', out.route === 'direct', out.route);
  ok('it proved the pictures are in the bucket',
     verdict(out, 'the pictures are there')?.verdict === 'ok');
  /* The bug this replaced: it fetched SITE/media/... which, inside the
     Worker, is the Worker calling its own hostname. Error 1101. */
  ok('and it never calls the site it is running on',
     !net.calls.some((c) => c.includes('web3ashley.com')), net.calls.join(', '));
  ok('it spent the Instagram token rather than only finding it',
     net.calls.some((c) => /graph\.instagram\.com.*fields=id,username/.test(c)));
  ok('and it named the account it would post as',
     /web3ashley/.test(verdict(out, 'the Instagram token works')?.detail || ''));
  ok('it read the TikTok creator settings, which is required before every post',
     net.calls.some((c) => /creator_info/.test(c)));

  /* The whole point: it stops before the post. */
  ok('it never called a posting endpoint',
     !net.calls.some((c) => /media_publish|content\/init|api\/post\b/.test(c)),
     net.calls.join(', '));
  ok('and it wrote nothing to the carousel', state.carousels[0].status === 'scheduled');
}

console.log('\nnever, ever a token in the answer');
{
  const state = { carousels: [row()], slides: [slide(0), slide(1)] };
  const out = await preflight(ENV(state), row(), { fetcher: fakeNet([MEDIA_OK, IG_OK, TT_OK]) });
  const text = JSON.stringify(out);
  for (const secret of ['ig-token', 'tt-token', 'tt-refresh']) {
    ok(`${secret} is nowhere in what comes back`, !text.includes(secret));
  }
}

/* ----------------------------------------------------------- the faults */

console.log('\nwhat it catches before the slot burns');
{
  const png = { carousels: [row()], slides: [slide(0, { content_type: 'image/png' }), slide(1)] };
  const out = await preflight(ENV(png), row(), { fetcher: fakeNet([MEDIA_OK, IG_OK, TT_OK]) });
  /* The served type wins over the recorded one, and the fake serves JPEG,
     so this is the check that the HEAD is actually believed. */
  ok('a row that disagrees with what is served is a warning, not a verdict',
     verdict(out, 'the recorded type matches what is served')?.verdict === 'warn', said(out));

  const bad2 = await preflight({ ...ENV(png), MEDIA: bucket('image/png') }, row(),
                               { fetcher: fakeNet([IG_OK, TT_OK]) });
  ok('a PNG actually being served stops it',
     bad2.ready === false && /PNG|png/i.test(stops(bad2).map((s) => s.detail).join(' ')),
     stops(bad2).map((s) => s.detail).join(' '));

  const missing = await preflight(
    { ...ENV({ carousels: [row()], slides: [slide(0), slide(1)] }), MEDIA: bucket('image/jpeg', 0, true) },
    row(), { fetcher: fakeNet([IG_OK, TT_OK]) });
  ok('a picture the bucket does not have stops it',
     missing.ready === false
     && verdict(missing, 'the pictures are there').verdict === 'stop');

  const noBucket = await preflight(
    { ...ENV({ carousels: [row()], slides: [slide(0), slide(1)] }), MEDIA: null },
    row(), { fetcher: fakeNet([IG_OK, TT_OK]) });
  ok('and no bucket at all is said out loud rather than passing quietly',
     verdict(noBucket, 'the pictures are there').verdict === 'warn');

  const one = await preflight(ENV({ carousels: [row()], slides: [slide(0)] }), row(),
                              { fetcher: fakeNet([MEDIA_OK, IG_OK, TT_OK]) });
  ok('one picture is not a carousel', one.ready === false);

  const dead = fakeNet([MEDIA_OK, TT_OK,
    ['graph.instagram.com', { json: { error: { message: 'Session has been invalidated' } } }]]);
  const revoked = await preflight(ENV({ carousels: [row()], slides: [slide(0), slide(1)] }),
                                  row(), { fetcher: dead });
  ok('a token that resolves but no longer works is caught',
     revoked.ready === false
     && /invalidated/.test(verdict(revoked, 'the Instagram token works').detail));

  const publicTt = fakeNet([MEDIA_OK, IG_OK, ['creator_info', {
    json: { data: { creator_username: 'a', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'] } },
  }]]);
  const audit = await preflight(ENV({ carousels: [row()], slides: [slide(0), slide(1)] }),
                                row(), { fetcher: publicTt });
  ok('a public account under an unaudited app is caught before TikTok refuses it',
     audit.ready === false
     && /Private account/.test(verdict(audit, 'the account suits an unaudited app').detail));

  const long = row({ caption: 'x'.repeat(2300) });
  const wordy = await preflight(ENV({ carousels: [long], slides: [slide(0), slide(1)] }), long,
                                { fetcher: fakeNet([MEDIA_OK, IG_OK, TT_OK]) });
  ok('a caption over the limit stops it',
     wordy.ready === false && verdict(wordy, 'the words fit').verdict === 'stop');
}

console.log('\nthe broker road');
{
  /* Buffer answers everything on one GraphQL endpoint, so the fake keys
     off the operation in the body rather than off the URL. */
  const gql = (answers) => (u, init) => {
    const q = String(init?.body || '');
    for (const [op, json] of answers) if (q.includes(op)) return { json };
    return { status: 400, json: { errors: [{ message: `no stub for ${q.slice(0, 40)}` }] } };
  };
  const BOTH = [
    ['GetOrganizations', { data: { account: { organizations: [{ id: 'org1' }] } } }],
    ['channels', { data: { channels: [
      { id: 'ch1', service: 'instagram', name: 'web3ashley', isDisconnected: false },
      { id: 'ch2', service: 'tiktok', name: 'web3ashley', isDisconnected: false },
    ] } }],
  ];

  const state = {
    carousels: [row()], slides: [slide(0), slide(1)],
    settings: { 'post.route': 'buffer' },
  };
  const net = fakeNet([MEDIA_OK, ['api.buffer.com', gql(BOTH)]]);
  const out = await preflight(ENV(state, { BUFFER_API_KEY: 'bf-key' }), row(), { fetcher: net });
  ok('it checks the broker instead of the three platform apps',
     out.route === 'buffer' && out.ready === true, said(out));
  ok('and it does not touch Instagram or TikTok directly',
     !net.calls.some((c) => /graph\.instagram|tiktokapis/.test(c)));
  ok('the key is not in the answer', !JSON.stringify(out).includes('bf-key'));

  const half = fakeNet([MEDIA_OK, ['api.buffer.com', gql([
    BOTH[0],
    ['channels', { data: { channels: [
      { id: 'ch1', service: 'instagram', name: 'a', isDisconnected: false },
    ] } }],
  ])]]);
  const gap = await preflight(ENV({ ...state, settings: { 'post.route': 'buffer' } },
                                  { BUFFER_API_KEY: 'bf-key' }), row(), { fetcher: half });
  ok('a target that is not connected at the broker stops it',
     gap.ready === false && /tiktok/.test(verdict(gap, 'every target is connected at Buffer').detail));

  /* A disconnected channel is worse than a missing one: it is listed, so
     anything reading the length of the array calls it connected. */
  const dead = fakeNet([MEDIA_OK, ['api.buffer.com', gql([
    BOTH[0],
    ['channels', { data: { channels: [
      { id: 'ch1', service: 'instagram', name: 'a', isDisconnected: false },
      { id: 'ch2', service: 'tiktok', name: 'a', isDisconnected: true },
    ] } }],
  ])]]);
  const off = await preflight(ENV({ ...state, settings: { 'post.route': 'buffer' } },
                                  { BUFFER_API_KEY: 'bf-key' }), row(), { fetcher: dead });
  ok('a channel Buffer has lost is not counted as connected', off.ready === false);

  /* GraphQL says no with a 200 and an errors array. Reading the status
     line alone reports a dead key as a working one. */
  const bad = fakeNet([MEDIA_OK, ['api.buffer.com',
    { json: { errors: [{ message: 'Unauthorized' }] } }]]);
  const revoked = await preflight(ENV({ ...state, settings: { 'post.route': 'buffer' } },
                                       { BUFFER_API_KEY: 'bf-key' }), row(), { fetcher: bad });
  ok('a refusal inside a 200 is read as a refusal',
     revoked.ready === false && /Unauthorized/.test(verdict(revoked, 'the Buffer key works').detail));

  const noKey = await preflight(ENV(state), row(), { fetcher: fakeNet([MEDIA_OK]) });
  ok('the route selected with no key stops it, rather than falling back quietly',
     noKey.ready === false);
}

console.log('\nthe accounts on their own, with no carousel in hand');
{
  const net = fakeNet([IG_OK, TT_OK]);
  const out = await preflightAccounts(ENV({ carousels: [], slides: [] }), { fetcher: net });
  ok('it answers without a carousel', out.ready === true, said(out));
  ok('and still never posts',
     !net.calls.some((c) => /media_publish|content\/init/.test(c)));
}

/* --------------------------------------------------- the gate in the run */

console.log('\nthe same rules, in the run that actually posts');
{
  /* This is the failure the gate exists for. It shipped: Ayrshare refused
     a PNG and the direct road did not, so TikTok was handed a format its
     media transfer guide says it will not fetch, and the error that came
     back named a transfer problem. */
  const sent = [];
  for (const k of Object.keys(POSTERS)) delete POSTERS[k];
  Object.assign(POSTERS, {
    instagram: async (env, p) => { sent.push(p); return { ok: true, id: 'ig' }; },
    tiktok: async (env, p) => { sent.push(p); return { ok: true, id: 'tt' }; },
  });

  const state = {
    carousels: [row()],
    slides: [slide(0, { content_type: 'image/png' }), slide(1), slide(2)],
  };
  const out = await runDue(ENV(state));
  ok('a PNG never reaches a platform', sent.length === 0, `${sent.length} calls`);
  ok('and the carousel goes back where a person can see it',
     state.carousels[0].status === 'approved', state.carousels[0].status);
  ok('with the reason in the words needed to fix it',
     /JPEG/.test(state.carousels[0].results || ''), state.carousels[0].results);

  const wide = {
    carousels: [row()],
    slides: [slide(0, { width: 2160, height: 2700 }), slide(1), slide(2)],
  };
  await runDue(ENV(wide));
  ok('a 4K master is refused for TikTok, which does not downscale',
     wide.carousels[0].status === 'approved'
     && /1080/.test(wide.carousels[0].results || ''), wide.carousels[0].results);

  const good = { carousels: [row()], slides: [slide(0), slide(1), slide(2)] };
  sent.length = 0;
  await runDue(ENV(good));
  ok('and a carousel that suits every target still goes',
     good.carousels[0].status === 'posted' && sent.length === 2);
}

console.log(bad
  ? `\n${bad} failed`
  : '\nthe rehearsal proves the tokens and the pictures, and posts nothing');
process.exit(bad ? 1 : 0);

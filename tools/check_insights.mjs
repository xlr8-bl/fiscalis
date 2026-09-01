/**
 * check_insights.mjs — the numbers, without a real account.
 *
 *   node tools/check_insights.mjs
 *
 * The reason this is worth a suite of its own: every failure here is a
 * quiet one. A metric read wrong does not throw, it just shows a number
 * that is not true, and a wrong number is worse than no number because
 * it gets acted on — a pillar dropped for being flat when the truth was
 * that the token could not read reach.
 *
 * So what is asserted is mostly about honesty: that a count nobody was
 * allowed to read stays null, that a TikTok post with no public id says
 * so instead of reporting zero likes, and that a missing insights
 * permission does not cost the likes that were readable.
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

const { readInstagram, readTikTok, total, refreshStats } =
  await import(new URL('../lib/insights.js', import.meta.url).href);

/* ------------------------------------------------------- fake platforms */

/** A fetcher built from a list of [matcher, response] pairs. */
const fetcher = (routes) => async (url, init) => {
  const u = String(url);
  for (const [match, body] of routes) {
    if (u.includes(match)) {
      const payload = typeof body === 'function' ? body(init) : body;
      return { ok: true, status: 200, json: async () => payload };
    }
  }
  throw new Error(`nothing stubbed for ${u}`);
};

const IG_MEDIA = {
  id: '17895695668004550',
  media_type: 'CAROUSEL_ALBUM',
  permalink: 'https://www.instagram.com/p/abc/',
  timestamp: '2026-08-30T09:00:00+0000',
  like_count: 84,
  comments_count: 7,
};

const IG_INSIGHTS = {
  data: [
    { name: 'reach', period: 'lifetime', values: [{ value: 1902 }] },
    { name: 'saved', period: 'lifetime', values: [{ value: 41 }] },
    { name: 'shares', period: 'lifetime', values: [{ value: 12 }] },
    { name: 'views', period: 'lifetime', values: [{ value: 2400 }] },
  ],
};

/* ---------------------------------------------------------------- run */

await step('Instagram gives back the counts and the insights together', async () => {
  const out = await readInstagram('17895695668004550', 'tok', {
    fetcher: fetcher([['/insights', IG_INSIGHTS], ['graph.instagram.com', IG_MEDIA]]),
  });
  is(out.state, 'ok', 'state');
  is(out.likes, 84, 'likes');
  is(out.comments, 7, 'comments');
  is(out.reach, 1902, 'reach');
  is(out.saves, 41, 'saves');
  is(out.views, 2400, 'views');
  is(out.permalink, 'https://www.instagram.com/p/abc/', 'permalink');
});

await step('a missing insights permission does not cost the likes', async () => {
  const out = await readInstagram('1', 'tok', {
    fetcher: fetcher([
      ['/insights', { error: { message: '(#10) Application does not have permission' } }],
      ['graph.instagram.com', IG_MEDIA],
    ]),
  });
  is(out.state, 'ok', 'state');
  is(out.likes, 84, 'likes survive');
  is(out.reach, null, 'reach is unknown, not zero');
  if (!/instagram_business_manage_insights/.test(out.note)) throw new Error(out.note);
});

await step('an unsupported metric is retried with the one every surface has', async () => {
  let asked = [];
  const out = await readInstagram('1', 'tok', {
    fetcher: async (url) => {
      const u = String(url);
      if (u.includes('/insights')) {
        asked.push(u);
        // the first, batched ask fails on one deprecated name
        return {
          json: async () => (asked.length === 1
            ? { error: { message: 'metric[0] must be one of the following' } }
            : { data: [{ name: 'reach', values: [{ value: 500 }] }] }),
        };
      }
      return { json: async () => IG_MEDIA };
    },
  });
  is(asked.length, 2, 'times insights was asked');
  is(out.reach, 500, 'reach from the retry');
});

await step('a hidden like count is said out loud, not shown as zero', async () => {
  const { like_count, ...hidden } = IG_MEDIA;
  const out = await readInstagram('1', 'tok', {
    fetcher: fetcher([['/insights', IG_INSIGHTS], ['graph.instagram.com', hidden]]),
  });
  is(out.likes, null, 'likes');
  if (!/hiding them/.test(out.note)) throw new Error(out.note);
});

await step('an Instagram error is reported, not swallowed', async () => {
  const out = await readInstagram('1', 'tok', {
    fetcher: fetcher([['graph.instagram.com', { error: { message: 'Invalid OAuth access token' } }]]),
  });
  is(out.state, 'unavailable', 'state');
  is(out.likes, null, 'likes');
  if (!/Invalid OAuth/.test(out.note)) throw new Error(out.note);
});

await step('a TikTok post with no public id is pending, and says why', async () => {
  const out = await readTikTok('publish-1', 'tok', {
    fetcher: fetcher([
      ['/status/fetch/', { data: { status: 'PUBLISH_COMPLETE' }, error: { code: 'ok' } }],
    ]),
  });
  is(out.state, 'pending', 'state');
  is(out.likes, null, 'likes');
  if (!/private/.test(out.note)) throw new Error(out.note);
});

await step('TikTok numbers come back once there is a public id', async () => {
  const out = await readTikTok('publish-1', 'tok', {
    fetcher: fetcher([
      ['/status/fetch/', {
        data: { status: 'PUBLISH_COMPLETE', publicly_available_post_id: ['70123'] },
        error: { code: 'ok' },
      }],
      ['/video/query/', {
        data: { videos: [{ id: '70123', like_count: 210, comment_count: 9,
                           share_count: 4, view_count: 5200,
                           share_url: 'https://www.tiktok.com/@a/video/70123' }] },
        error: { code: 'ok' },
      }],
    ]),
  });
  is(out.state, 'ok', 'state');
  is(out.likes, 210, 'likes');
  is(out.views, 5200, 'views');
  is(out.shares, 4, 'shares');
  is(out.post_id, '70123', 'post id');
});

await step('the misspelled field on TikTok\'s own page is accepted too', async () => {
  const out = await readTikTok('publish-1', 'tok', {
    fetcher: fetcher([
      ['/status/fetch/', {
        data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['70124'] },
        error: { code: 'ok' },
      }],
      ['/video/query/', { data: { videos: [{ id: '70124', like_count: 1 }] }, error: { code: 'ok' } }],
    ]),
  });
  is(out.post_id, '70124', 'post id');
  is(out.likes, 1, 'likes');
});

await step('a TikTok post that failed moderation says what it said', async () => {
  const out = await readTikTok('publish-1', 'tok', {
    fetcher: fetcher([
      ['/status/fetch/', {
        data: { status: 'FAILED', fail_reason: 'picture_size_check_failed' },
        error: { code: 'ok' },
      }],
    ]),
  });
  is(out.state, 'unavailable', 'state');
  if (!/picture_size_check_failed/.test(out.note)) throw new Error(out.note);
});

await step('a missing video.list scope is pending with the scope named', async () => {
  const out = await readTikTok('publish-1', 'tok', {
    fetcher: fetcher([
      ['/status/fetch/', {
        data: { status: 'PUBLISH_COMPLETE', publicly_available_post_id: ['70125'] },
        error: { code: 'ok' },
      }],
      ['/video/query/', { error: { code: 'scope_not_authorized', message: 'no' } }],
    ]),
  });
  is(out.state, 'pending', 'state');
  if (!/video\.list/.test(out.note)) throw new Error(out.note);
});

await step('a post nothing is connected for is not a crash', async () => {
  is((await readInstagram('1', '')).state, 'unavailable', 'instagram');
  is((await readTikTok('1', '')).state, 'unavailable', 'tiktok');
  is((await readInstagram('', 'tok')).note.includes('No Instagram media id'), true, 'no id');
});

await step('totals add what is known and leave unknown alone', async () => {
  const t = total({
    instagram: { likes: 84, comments: 7, reach: 1902, saves: 41, shares: null, views: null },
    tiktok: { likes: 210, comments: 9, reach: null, saves: null, shares: 4, views: 5200 },
  });
  is(t.likes, 294, 'likes');
  is(t.comments, 16, 'comments');
  is(t.reach, 1902, 'reach, from the one platform that knew');
  is(t.shares, 4, 'shares');
  is(total({ instagram: { likes: null }, tiktok: { likes: null } }).likes, null,
     'no platform knew, so the total is unknown');
});

/* ------------------------------------------------------- the whole pass */

/** Enough D1 to run refreshStats: carousels, post_stats and settings. */
function fakeDb(state) {
  state.stats = state.stats || {};
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
          if (/FROM carousels/.test(sql)) return { results: state.carousels };
          if (/FROM post_stats/.test(sql)) {
            return { results: Object.values(state.stats) };
          }
          return { results: [] };
        },
        async run() {
          if (/INTO post_stats/.test(sql)) {
            state.stats[`${args[0]}:${args[1]}`] = {
              carousel_id: args[0], platform: args[1], post_id: args[2], permalink: args[3],
              likes: args[4], comments: args[5], shares: args[6], saves: args[7],
              views: args[8], reach: args[9], state: args[10], note: args[11],
              checked_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            };
            state.writes = (state.writes || 0) + 1;
          }
          if (/INTO settings/.test(sql)) {
            state.settings = state.settings || {};
            state.settings[args[0]] = args[1];
          }
          return { meta: { changes: 1 } };
        },
      };
      return api;
    },
  };
}

const posted = (over = {}) => ({
  id: 1, slug: 'the-eleven-second-booking-page', title: 'The eleven second booking page',
  pillar: 'teardowns', posted_at: '2026-08-30T09:00:00Z',
  results: JSON.stringify({ instagram: { ok: true, id: '17895695668004550' } }),
  ...over,
});

const ENV = (db) => ({
  DB: db,
  SITE: 'https://web3ashley.com',
  IG_ACCESS_TOKEN: 'ig-token',
  TIKTOK_ACCESS_TOKEN: 'tt-token',
  TIKTOK_REFRESH_TOKEN: 'tt-refresh',
});

await step('a refresh reads what went out and writes the numbers down', async () => {
  const state = { carousels: [posted()] };
  const out = await refreshStats(ENV(fakeDb(state)), {
    fetcher: fetcher([['/insights', IG_INSIGHTS], ['graph.instagram.com', IG_MEDIA]]),
  });
  is(out.checked, 1, 'platforms asked');
  is(out.posts[0].totals.likes, 84, 'likes');
  is(state.writes, 1, 'rows written');
  is(state.stats['1:instagram'].reach, 1902, 'reach stored');
});

await step('a platform that was skipped is never asked about', async () => {
  const state = {
    carousels: [posted({
      results: JSON.stringify({
        instagram: { ok: true, id: 'ig1' },
        facebook: { ok: false, skipped: true, error: 'not implemented' },
        tiktok: { ok: false, error: 'spam_risk' },
      }),
    })],
  };
  const out = await refreshStats(ENV(fakeDb(state)), {
    fetcher: fetcher([['/insights', IG_INSIGHTS], ['graph.instagram.com', IG_MEDIA]]),
  });
  is(out.checked, 1, 'only the one that actually posted');
  is(Object.keys(out.posts[0].platforms).join(','), 'instagram', 'platforms');
});

await step('a number read a minute ago is not asked for again', async () => {
  const state = { carousels: [posted()] };
  const db = fakeDb(state);
  const stub = fetcher([['/insights', IG_INSIGHTS], ['graph.instagram.com', IG_MEDIA]]);
  await refreshStats(ENV(db), { fetcher: stub });
  const out = await refreshStats(ENV(db), { fetcher: stub, stale: 3600 });
  is(out.checked, 0, 'platforms asked the second time');
  is(out.posts[0].totals.likes, 84, 'the stored number is still handed back');
});

await step('refresh: true asks again anyway', async () => {
  const state = { carousels: [posted()] };
  const db = fakeDb(state);
  const stub = fetcher([['/insights', IG_INSIGHTS], ['graph.instagram.com', IG_MEDIA]]);
  await refreshStats(ENV(db), { fetcher: stub });
  const out = await refreshStats(ENV(db), { fetcher: stub, stale: 0 });
  is(out.checked, 1, 'platforms asked');
});

await step('a carousel that never posted anywhere has nothing to ask about', async () => {
  const state = { carousels: [] };
  const out = await refreshStats(ENV(fakeDb(state)), { fetcher: fetcher([]) });
  is(out.checked, 0, 'asked');
  is(out.posts.length, 0, 'posts');
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe numbers are real, and what could not be read says so'
);
process.exit(problems.length ? 1 : 0);

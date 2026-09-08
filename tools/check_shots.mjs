/**
 * check_shots.mjs — capturing a page, without a Cloudflare token.
 *
 *   node tools/check_shots.mjs
 *
 * The screenshot road is the only one where the agent hands an address
 * it read on the open web to something that opens it. So the checks that
 * matter here are not "does the picture come back" — a fake fetcher
 * covers that — but what happens with an address that should never be
 * opened, and whether the slide's citation can drift from what was
 * actually captured.
 */

import assert from 'node:assert';
import { capture, checkUrl, VIEWPORT } from '../lib/shots.js';
import { TOOLS, CAROUSEL_TOOLS } from '../lib/mcp.js';
import { validateSlides } from '../lib/slides/spec.js';

let bad = 0;
const ok = (what, fn) => {
  try { fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};
const okAsync = async (what, fn) => {
  try { await fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};

/* A bucket and a database that remember what they were handed, so the
   test can assert on what was stored rather than on what was returned. */
const fakeEnv = (over = {}) => {
  const put = [];
  return {
    CF_ACCOUNT_ID: 'acct', CF_BROWSER_TOKEN: 'tok',
    MEDIA: { put: async (key, bytes, opts) => { put.push({ key, bytes, opts }); } },
    DB: { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) },
    _put: put,
    ...over,
  };
};

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).buffer;
const okFetch = (seen) => async (url, init) => {
  seen.push({ url, body: JSON.parse(init.body) });
  return { ok: true, status: 200, arrayBuffer: async () => jpeg };
};

console.log('\nwhat may be opened at all\n');

ok('a private address is refused, whatever shape it arrives in', () => {
  /* The one input on this road an outside page can steer. A capture of
     169.254.169.254 is a metadata endpoint, not a screenshot. */
  for (const u of ['http://localhost:8788/studio', 'http://127.0.0.1/',
                   'https://169.254.169.254/latest/meta-data/',
                   'http://10.0.0.5/admin', 'http://192.168.1.1/',
                   'https://172.16.4.4/', 'http://box.internal/keys',
                   'http://0.0.0.0:80/']) {
    const r = checkUrl(u);
    assert.ok(r.error, `${u} was allowed`);
    assert.match(r.error, /private address/);
  }
});

ok('and so is anything that is not a page', () => {
  for (const u of ['file:///etc/passwd', 'data:text/html,<b>hi', 'not a url',
                   'ftp://example.com/x']) {
    assert.ok(checkUrl(u).error, `${u} was allowed`);
  }
});

ok('a public page passes and comes back normalised', () => {
  const r = checkUrl('https://example.com/contact?utm_source=x');
  assert.ok(!r.error, r.error);
  assert.equal(r.host, 'example.com');
});

console.log('\nwhat it asks the rendering API for\n');

await okAsync('the capture is the shape the slide frame draws', async () => {
  const seen = [];
  const out = await capture(fakeEnv(), { url: 'https://example.com/' },
                            { fetcher: okFetch(seen) });
  assert.ok(!out.error, out.error);
  const body = seen[0].body;
  assert.deepEqual(body.viewport, VIEWPORT);
  // 16:10, which is what the `shot` block's frame is, so nothing is cropped
  assert.equal(VIEWPORT.width / VIEWPORT.height, 1.6);
  assert.equal(body.screenshotOptions.type, 'jpeg');
  assert.equal(body.screenshotOptions.fullPage, false);
  // a dashboard screenshotted before it loads is a picture of a spinner
  assert.equal(body.gotoOptions.waitUntil, 'networkidle0');
});

await okAsync('the token goes in the header and never into the result', async () => {
  const seen = [];
  const out = await capture(fakeEnv(), { url: 'https://example.com/' },
                            { fetcher: okFetch(seen) });
  assert.match(seen[0].url, /browser-rendering\/screenshot$/);
  assert.ok(!JSON.stringify(out).includes('tok'), 'the token is in the result');
});

await okAsync('with no token it says exactly what to set, and captures nothing', async () => {
  const seen = [];
  const out = await capture({ MEDIA: {}, DB: {} }, { url: 'https://example.com/' },
                            { fetcher: okFetch(seen) });
  assert.ok(out.error);
  assert.match(out.error, /CF_ACCOUNT_ID/);
  assert.match(out.error, /Browser Rendering: Edit/);
  assert.equal(seen.length, 0, 'it called out anyway');
  // and it says what to do instead, rather than inviting an invented screenshot
  assert.match(out.error, /without a screenshot rather than describing one/);
});

await okAsync('a rate limit says how long the budget actually is', async () => {
  const out = await capture(fakeEnv(), { url: 'https://example.com/' }, {
    fetcher: async () => ({ ok: false, status: 429, json: async () => ({}) }),
  });
  assert.match(out.error, /Rate limited/);
  assert.match(out.error, /every 10 seconds/);
});

console.log('\nthe citation cannot drift from the capture\n');

await okAsync('what comes back is already the shape the slide wants', async () => {
  const out = await capture(fakeEnv(), { url: 'https://example.com/contact' },
                            { fetcher: okFetch([]) });
  assert.deepEqual(Object.keys(out.put_on_the_slide).sort(), ['src', 'url']);
  assert.equal(out.put_on_the_slide.src, out.key);
  assert.equal(out.put_on_the_slide.url, 'https://example.com/contact');
  assert.match(out.key, /^shots\/[0-9a-f-]{12}\.jpg$/);
});

await okAsync('the stored key is what the slide references', async () => {
  const env = fakeEnv();
  const out = await capture(env, { url: 'https://example.com/' }, { fetcher: okFetch([]) });
  assert.equal(env._put[0].key, out.key);
  assert.equal(env._put[0].opts.httpMetadata.contentType, 'image/jpeg');
});

ok('a slide carrying a screenshot with no address is refused', () => {
  /* The whole reason the address is drawn in the frame: without it the
     slide is an assertion with a picture on it. */
  const slide = (shot) => ({
    template: 'shot', ground: 'paper', handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'What the page says', say: 'One line about it.', shot,
  });
  const two = (shot) => ({ slides: [slide(shot), slide(shot)] });
  const noUrl = validateSlides(two({ src: 'shots/abc' }), { opener: false });
  assert.ok(!noUrl.ok);
  assert.match(noUrl.problems.join(' '), /address bar IS the citation/);

  const noSrc = validateSlides(two({ url: 'example.com' }), { opener: false });
  assert.ok(!noSrc.ok);
  assert.match(noSrc.problems.join(' '), /capture_page/);

  const both = validateSlides(two({ src: 'shots/abc', url: 'example.com/contact' }),
                              { opener: false });
  assert.ok(both.ok, both.problems.join('; '));
});

console.log('\nwhat the agent is told\n');

ok('the tool is in the scope Spark actually gets, and does not interrupt', () => {
  const tool = TOOLS.find((t) => t.name === 'capture_page');
  assert.ok(tool, 'capture_page is not registered');
  assert.ok(CAROUSEL_TOOLS.includes('capture_page'), 'not in the carousel scope');
  assert.equal(tool.annotations.destructiveHint, false);
  // it opens somebody else's page, which is the definition of open-world
  assert.equal(tool.annotations.openWorldHint, true);
});

ok('and it is told the one thing that would be a real mistake', () => {
  const tool = TOOLS.find((t) => t.name === 'capture_page');
  /* A screenshot of a client dashboard or a logged-in account goes out
     to strangers, and it is the easiest thing here to do by accident. */
  assert.match(tool.description, /behind a login/);
  assert.match(tool.description, /personal data/);
  assert.match(tool.description, /client/);
});

console.log(bad ? `\n${bad} failed` : '\ncapturing a page is bounded and cites itself');
process.exit(bad ? 1 : 0);

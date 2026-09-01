/**
 * check_studio.mjs — drive the studio in a real browser.
 *
 *   npx wrangler pages dev --port 8801 \
 *     --binding STUDIO_PASSWORD=hunter2 SESSION_SECRET=any-long-string \
 *     --d1 DB --r2 MEDIA
 *   node tools/check_studio.mjs
 *
 * Formatting is the kind of thing that reads fine and behaves wrongly —
 * a toggle that stacks markers, a list that renumbers from the wrong
 * line — so the toolbar is checked by pressing the buttons and reading
 * the text back, not by looking at it.
 *
 *   BASE       where the site is            (default http://127.0.0.1:8801)
 *   PASSWORD   the studio password          (default hunter2)
 *   SHOTS      where to write screenshots   (default ./.check-shots)
 *   CHROME     path to a Chromium binary
 *
 * Exits non-zero if any step fails, or on a console error or a failed
 * request. The 401 from /me before signing in is expected and ignored:
 * boot() has to throw there so the sign-in gate appears.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const PASSWORD = process.env.PASSWORD || 'hunter2';
const SHOTS = process.env.SHOTS || './.check-shots';
mkdirSync(SHOTS, { recursive: true });
const shot = (n) => `${SHOTS}/${n}.png`;
/** The key goes inside a quoted attribute selector, so only quotes and
 *  backslashes need escaping — slashes and dots are ordinary there. */
const CSS_escape = (v) => String(v).replace(/(["\\])/g, '\\$1');

const CHROME = process.env.CHROME ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: CHROME,
  // the container has no user namespaces, and nothing here loads a page
  // that did not come from this repo
  args: ['--no-proxy-server', '--no-sandbox', '--disable-dev-shm-usage'],
  chromiumSandbox: false,
  timeout: 60000,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

const problems = [];
const IGNORE = /401 \(Unauthorized\)/;   // /me before sign-in, by design
/* A prompt gets whatever the step queued for it, and OK otherwise. One
   handler, because a second one racing the first throws "already
   handled" rather than answering. */
const answers = [];
page.on('dialog', (d) => d.accept(answers.length ? answers.shift() : ''));
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.test(m.text())) problems.push('console: ' + m.text());
});
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  // a reload cancels whatever was in flight; that is not a broken request
  const why = r.failure()?.errorText || '';
  if (!/ERR_ABORTED/.test(why)) problems.push('requestfailed: ' + r.url() + ' ' + why);
});

const byHand = {};

const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) { console.log('  FAIL ' + name + ' \u2014 ' + e.message.split('\n')[0]); problems.push(name + ': ' + e.message.split('\n')[0]); }
};

await page.goto(BASE + '/studio', { waitUntil: 'domcontentloaded' });

await step('sign in', async () => {
  await page.fill('#st-pw', PASSWORD);
  await page.click('.st-gate__form button[type=submit]');
  await page.waitForSelector('[data-view="home"]:not([hidden])', { timeout: 10000 });
});
await page.screenshot({ path: shot('01-overview'), fullPage: true });

await step('overview lists sections', async () => {
  const rows = await page.$$eval('[data-view="home"] .st-row__title', (n) => n.map((x) => x.textContent));
  if (!rows.includes('Articles')) throw new Error('no Articles row; got ' + rows.join(', '));
  if (!rows.includes('Work')) throw new Error('no Work row; got ' + rows.join(', '));
});

await step('journal list + search', async () => {
  await page.click('.st-nav__link[href="#/journal"]');
  await page.waitForSelector('[data-view="list"]:not([hidden])');
  const before = await page.$$eval('[data-list-body] .st-row', (n) => n.length);
  await page.fill('[data-list-search]', 'mobile');
  await page.waitForTimeout(120);
  const after = await page.$$eval('[data-list-body] .st-row', (n) => n.length);
  if (!(after < before && after > 0)) throw new Error(`search did not narrow: ${before} -> ${after}`);
  await page.fill('[data-list-search]', '');
});
await page.screenshot({ path: shot('02-journal'), fullPage: true });

await step('status tabs', async () => {
  await page.click('[data-filter="published"]');
  await page.waitForTimeout(100);
  const n = await page.$$eval('[data-list-body] .st-row', (x) => x.length);
  if (n === 0) throw new Error('no live articles under the Live tab');
  await page.click('[data-filter="all"]');
});

await step('open an article', async () => {
  await page.click('[data-list-body] .st-row');
  await page.waitForSelector('[data-view="article"]:not([hidden])');
  await page.waitForSelector('.st-tools .st-tool');
});
await page.screenshot({ path: shot('03-article'), fullPage: false });

await step('the headline box fits the whole headline', async () => {
  const { scrollH, clientH, text } = await page.evaluate(() => {
    const t = document.querySelector('[data-f="title"]');
    return { scrollH: t.scrollHeight, clientH: t.clientHeight, text: t.value };
  });
  if (scrollH > clientH + 2) throw new Error(`headline clipped: ${clientH}px shown of ${scrollH}px, "${text}"`);
});

await step('toolbar: bold wraps the selection', async () => {
  await page.fill('#st-body', 'hello world');
  await page.evaluate(() => {
    const ta = document.querySelector('#st-body');
    ta.focus(); ta.setSelectionRange(0, 5);
  });
  await page.click('.st-tool[data-tool="bold"]');
  const v = await page.inputValue('#st-body');
  if (v !== '**hello** world') throw new Error('got ' + JSON.stringify(v));
});

await step('bold again unwraps it', async () => {
  await page.evaluate(() => {
    const ta = document.querySelector('#st-body');
    ta.focus(); ta.setSelectionRange(2, 7);
  });
  await page.click('.st-tool[data-tool="bold"]');
  const v = await page.inputValue('#st-body');
  if (v !== 'hello world') throw new Error('got ' + JSON.stringify(v));
});

await step('H2 prefixes the line, and toggles off', async () => {
  await page.fill('#st-body', 'A heading');
  await page.evaluate(() => { const t = document.querySelector('#st-body'); t.focus(); t.setSelectionRange(2, 2); });
  await page.click('.st-tool[data-tool="h2"]');
  let v = await page.inputValue('#st-body');
  if (v !== '## A heading') throw new Error('on: ' + JSON.stringify(v));
  await page.click('.st-tool[data-tool="h2"]');
  v = await page.inputValue('#st-body');
  if (v !== 'A heading') throw new Error('off: ' + JSON.stringify(v));
});

await step('H3 replaces H2 rather than stacking', async () => {
  await page.fill('#st-body', 'Title');
  await page.evaluate(() => { const t = document.querySelector('#st-body'); t.focus(); t.setSelectionRange(1, 1); });
  await page.click('.st-tool[data-tool="h2"]');
  await page.click('.st-tool[data-tool="h3"]');
  const v = await page.inputValue('#st-body');
  if (v !== '### Title') throw new Error('got ' + JSON.stringify(v));
});

await step('bullets across several lines', async () => {
  await page.fill('#st-body', 'one\ntwo\nthree');
  await page.evaluate(() => { const t = document.querySelector('#st-body'); t.focus(); t.setSelectionRange(0, 13); });
  await page.click('.st-tool[data-tool="bullet"]');
  const v = await page.inputValue('#st-body');
  if (v !== '- one\n- two\n- three') throw new Error('got ' + JSON.stringify(v));
});

await step('numbered list renumbers', async () => {
  await page.evaluate(() => { const t = document.querySelector('#st-body'); t.focus(); t.select(); });
  await page.click('.st-tool[data-tool="number"]');
  const v = await page.inputValue('#st-body');
  if (v !== '1. one\n2. two\n3. three') throw new Error('got ' + JSON.stringify(v));
});

await step('Enter continues a list and empty Enter ends it', async () => {
  await page.fill('#st-body', '- one');
  await page.evaluate(() => { const t = document.querySelector('#st-body'); t.focus(); t.setSelectionRange(5, 5); });
  await page.keyboard.press('Enter');
  let v = await page.inputValue('#st-body');
  if (v !== '- one\n- ') throw new Error('continue: ' + JSON.stringify(v));
  await page.keyboard.press('Enter');
  v = await page.inputValue('#st-body');
  if (v !== '- one\n') throw new Error('end: ' + JSON.stringify(v));
});

await step('Ctrl+B shortcut', async () => {
  await page.fill('#st-body', 'shortcut');
  await page.evaluate(() => { const t = document.querySelector('#st-body'); t.focus(); t.select(); });
  await page.keyboard.press('Control+b');
  const v = await page.inputValue('#st-body');
  if (v !== '**shortcut**') throw new Error('got ' + JSON.stringify(v));
});

await step('preview renders the markdown', async () => {
  await page.fill('#st-body', '## A section\n\nSome **bold** text.\n\n> A pulled line');
  await page.click('[data-tab="preview"]');
  await page.waitForSelector('.st-preview__h2');
  const h = await page.textContent('.st-preview__h2');
  if (h.trim() !== 'A section') throw new Error('heading: ' + h);
  const strong = await page.$('.st-preview__prose strong');
  if (!strong) throw new Error('no <strong> in the preview');
  await page.click('[data-tab="write"]');
});
await page.screenshot({ path: shot('04-preview'), fullPage: false });

await step('history panel opens', async () => {
  await page.click('[data-history-toggle]');
  await page.waitForSelector('[data-history]:not([hidden])');
  await page.waitForTimeout(400);
});
await page.screenshot({ path: shot('05-history'), fullPage: false });

await step('collection list has reorder controls', async () => {
  await page.evaluate(() => { location.hash = '#/site/services'; });
  await page.waitForSelector('[data-view="list"]:not([hidden])');
  await page.waitForTimeout(300);
  const up = await page.$$('[data-act="up"]');
  if (!up.length) throw new Error('no move-up buttons');
  const first = await page.$eval('[data-list-body] .st-row__title', (n) => n.textContent);
  await page.click('[data-list-body] .st-row-wrap:nth-child(2) [data-act="up"]');
  await page.waitForTimeout(500);
  const now = await page.$eval('[data-list-body] .st-row__title', (n) => n.textContent);
  if (now === first) throw new Error('order did not change: still ' + now);
});
await page.screenshot({ path: shot('06-collection'), fullPage: true });

await step('an entry form builds, with a toolbar and a picker', async () => {
  await page.click('[data-list-body] .st-row');
  await page.waitForSelector('[data-view="entry"]:not([hidden])');
  const bars = await page.$$('[data-entry-form] .st-tools');
  if (!bars.length) throw new Error('no formatting bar on the entry form');
});
await page.screenshot({ path: shot('07-entry'), fullPage: true });

await step('media field offers a picker', async () => {
  await page.evaluate(() => { location.hash = '#/site/projects'; });
  await page.waitForSelector('[data-view="list"]:not([hidden])');
  await page.waitForTimeout(300);
  await page.click('[data-list-body] .st-row');
  await page.waitForSelector('[data-view="entry"]:not([hidden])');
  const choose = await page.$('[data-choose]');
  if (!choose) throw new Error('no Choose button on the image field');
  await choose.click();
  await page.waitForSelector('.st-picker[open]');
  await page.waitForTimeout(400);
});
await page.screenshot({ path: shot('08-picker'), fullPage: false });

await step('picker closes', async () => {
  await page.click('.st-picker__head button[value="cancel"]');
  // a closed <dialog> is not visible, and waitForSelector waits for visibility
  await page.waitForFunction(() => !document.querySelector('.st-picker')?.open);
});

await step('settings form', async () => {
  await page.evaluate(() => { location.hash = '#/settings/Hero'; });
  await page.waitForSelector('[data-view="entry"]:not([hidden])');
  await page.waitForTimeout(300);
  const inputs = await page.$$('[data-entry-form] [data-field]');
  if (!inputs.length) throw new Error('no fields');
});
await page.screenshot({ path: shot('09-settings'), fullPage: true });

await step('media library', async () => {
  await page.evaluate(() => { location.hash = '#/media'; });
  await page.waitForSelector('[data-view="media"]:not([hidden])');
  await page.waitForTimeout(300);
});
await page.screenshot({ path: shot('10-media'), fullPage: true });


/* ---------------------------------------------------------------- pictures
   The one path that used to be impossible: get a picture into an article
   and out the other end onto the public page, at a known size. */

let picKey = null;
await step('a picture goes in through the library', async () => {
  await page.evaluate(() => { location.hash = '#/media'; });
  await page.waitForSelector('[data-view="media"]:not([hidden])');
  const before = await page.evaluate(async () =>
    (await (await fetch('/api/studio/media', { credentials: 'same-origin' })).json())
      .media.map((m) => m.key));

  // a real 2x1 PNG, so the browser reports honest natural dimensions
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP8z8Dwn4mBgYEBAA' +
    'x2AwFvsCkYAAAAAElFTkSuQmCC', 'base64');
  writeFileSync('/tmp/check-pic.png', png);
  await page.setInputFiles('[data-upload]', '/tmp/check-pic.png');

  // wait for the row this run created, not for "a row" — the library may
  // already hold pictures from an earlier run. A plain loop rather than
  // waitForFunction: that does not await an async predicate under a custom
  // polling interval, and hands back a handle to the pending promise.
  const keysNow = async () => page.evaluate(async () =>
    (await (await fetch('/api/studio/media', { credentials: 'same-origin' })).json())
      .media.map((m) => m.key));
  for (let i = 0; i < 40 && !picKey; i++) {
    picKey = (await keysNow()).find((k) => !before.includes(k)) || null;
    if (!picKey) await page.waitForTimeout(500);
  }
  if (!picKey) throw new Error('no new picture appeared in the library');
  await page.waitForSelector(`[data-key="${CSS_escape(picKey)}"]`, { timeout: 10000 });
});

await step('its pixel size was measured in the browser', async () => {
  const text = await page.textContent(`[data-key="${CSS_escape(picKey)}"] .st-note`);
  if (!/2\u00d71/.test(text)) throw new Error('no 2x1 in "' + text.trim() + '"');
});

await step('a description saves', async () => {
  const box = `[data-key="${CSS_escape(picKey)}"] [data-alt]`;
  await page.fill(box, 'A tiny test picture');
  await page.locator(box).blur();
  await page.waitForTimeout(700);
  await page.reload();
  await page.waitForSelector(`[data-key="${CSS_escape(picKey)}"]`, { timeout: 15000 });
  const v = await page.inputValue(box);
  if (v !== 'A tiny test picture') throw new Error('came back as ' + JSON.stringify(v));
});

let picSlug = null;
await step('the picture button puts it in an article', async () => {
  await page.evaluate(() => { location.hash = '#/journal/new'; });
  await page.waitForSelector('[data-view="article"]:not([hidden])');
  await page.fill('[data-f="title"]', 'A picture test');
  await page.fill('[data-f="description"]', 'Proving an image survives the round trip.');
  await page.fill('#st-body', 'Before the picture.');
  await page.evaluate(() => {
    const t = document.querySelector('#st-body');
    t.focus(); t.setSelectionRange(t.value.length, t.value.length);
  });
  await page.click('.st-tool[data-tool="image"]');
  await page.waitForSelector('.st-picker[open]');
  await page.click(`.st-picker__cell[data-key="${CSS_escape(picKey)}"]`);
  await page.fill('[data-caption]', 'The caption');
  await page.click('[data-insert]');
  // the dialog closes first and the text lands a microtask later, so wait
  // for the text rather than for the dialog
  await page.waitForFunction(
    () => /!\[[^\]]*\]\(\/media\//.test(document.querySelector('#st-body').value),
    null, { timeout: 5000 });

  const body = await page.inputValue('#st-body');
  if (!/^!\[A tiny test picture\]\(\/media\/\S+ "The caption"\)$/m.test(body)) {
    throw new Error('markdown is ' + JSON.stringify(body));
  }
});

await step('it saves and publishes', async () => {
  await page.click('[data-save]');
  await page.waitForTimeout(1200);
  picSlug = await page.inputValue('[data-f="slug"]');
  if (!picSlug) throw new Error('no slug after save');
  await page.click('[data-publish]');
  await page.waitForTimeout(1500);
});

await step('the public page renders a figure with width and height', async () => {
  const res = await page.request.get(`${BASE}/journal/${picSlug}`);
  const html = await res.text();
  const fig = /<figure class="jr_figure">(.*?)<\/figure>/s.exec(html);
  if (!fig) throw new Error('no <figure> on the page');
  if (!/width="2" height="1"/.test(fig[1])) throw new Error('no dimensions: ' + fig[1].slice(0, 160));
  if (!/<figcaption>The caption<\/figcaption>/.test(fig[1])) throw new Error('no caption: ' + fig[1].slice(0, 160));
  if (!/alt="A tiny test picture"/.test(fig[1])) throw new Error('no alt: ' + fig[1].slice(0, 160));
});

/* ------------------------------------------------------- guards and drafts */

await step('a required field blocks the save and says which', async () => {
  await page.evaluate(() => { location.hash = '#/site/testimonials/new'; });
  await page.waitForSelector('[data-view="entry"]:not([hidden])');
  await page.waitForTimeout(300);
  await page.click('[data-entry-save]');
  await page.waitForTimeout(300);
  const wrong = await page.$$('[data-field-wrap].is-wrong');
  if (!wrong.length) throw new Error('nothing was marked');
  const said = await page.textContent('[data-status]');
  if (!/Still needs/.test(said)) throw new Error('status said "' + said + '"');
});

await step('unsaved typing is offered back after a reload', async () => {
  await page.evaluate(() => { location.hash = '#/journal/new'; });
  await page.waitForSelector('[data-view="article"]:not([hidden])');
  await page.fill('[data-f="title"]', 'Half a thought');
  await page.waitForTimeout(1000);            // past the debounce
  await page.reload();
  // the hash survives the reload, so the article view is what comes back
  await page.waitForSelector('[data-view="article"]:not([hidden])', { timeout: 15000 });

  // a view built inside a still-hidden container measures zero, which used
  // to collapse the headline box to nothing on every reload
  const h = await page.evaluate(() =>
    Math.round(document.querySelector('[data-f="title"]').getBoundingClientRect().height));
  if (h < 20) throw new Error(`the headline box is ${h}px tall after a reload`);

  await page.waitForSelector('[data-recover]', { timeout: 5000 });
  await page.click('[data-recover]');
  const v = await page.inputValue('[data-f="title"]');
  if (v !== 'Half a thought') throw new Error('came back as ' + JSON.stringify(v));
});
await page.screenshot({ path: shot('13-recover'), fullPage: false });

await step('and discarding it clears the offer', async () => {
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForSelector('[data-view="home"]:not([hidden])');
  await page.evaluate(() => { location.hash = '#/journal/new'; });
  await page.waitForSelector('[data-view="article"]:not([hidden])');
  const btn = await page.$('[data-discard]');
  if (btn) await btn.click();
});

/*
 * A post made by hand, end to end.
 *
 * Everything about the carousel pipeline assumed Spark would fill it,
 * which left a person no way to put a single post out on their own — and
 * a platform review wants to watch exactly that happen. It is also the
 * thing you need before trusting a day of automation: one post, all the
 * way through, by your own hand.
 */
await step('a carousel can be started by hand', async () => {
  answers.push('Eleven seconds');
  await page.goto(BASE + '/studio#/social', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-board-new]');
  await page.click('[data-board-new]');
  await page.waitForSelector('[data-view="carousel"]:not([hidden])', { timeout: 15000 });
  byHand.slug = decodeURIComponent(new URL(page.url()).hash.split('/').pop());
  if (!byHand.slug) throw new Error('no slug in the hash');
  const slides = await page.$$eval('.st-slide', (n) => n.length);
  if (slides !== 2) throw new Error(`${slides} slides, expected the two-slide floor`);
});

await step('a picture goes onto a slide, measured in the browser', async () => {
  // a real JPEG at the size the brief asks for, drawn in the page
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    const x = c.getContext('2d');
    x.fillStyle = '#080807'; x.fillRect(0, 0, 1080, 1350);
    x.fillStyle = '#e8e8e3'; x.font = '90px sans-serif'; x.fillText('11 SECONDS', 90, 700);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  for (const pos of [0, 1]) {
    await page.setInputFiles(`[data-slide-file="${pos}"]`, {
      name: `slide-${pos}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(jpeg),
    });
    await page.waitForFunction(
      (i) => document.querySelectorAll('.st-slide img').length > i, pos, { timeout: 20000 }
    );
  }
  const facts = await page.textContent('.st-facts');
  if (!/2 of 2 drawn/.test(facts)) throw new Error(facts.replace(/\s+/g, ' '));
});

await step('and it can be approved without going through review', async () => {
  // review is where the agent hands work over. Work you made yourself has
  // nobody to hand it to, so the studio approves straight out of making.
  await page.fill('[data-car-caption]', 'Eleven seconds. Most people are gone before it finishes.');
  await page.click('[data-car-save]');
  await page.waitForTimeout(800);
  const acts = await page.$$eval('[data-car-acts] .st-link', (n) => n.map((x) => x.textContent.trim()));
  if (!acts.includes('Approve it')) throw new Error(`offered: ${acts.join(', ')}`);
  await page.click('[data-car-acts] .st-link');
  await page.waitForFunction(
    () => /Approved/.test(document.querySelector('.st-facts')?.textContent || ''), null, { timeout: 15000 }
  );
});

await step('a slot puts it in the poster\'s way', async () => {
  answers.push('1', '2020-01-01T00:00:00Z');
  await page.click('[data-car-acts] .st-link');
  await page.waitForFunction(
    () => /Scheduled/.test(document.querySelector('.st-facts')?.textContent || ''), null, { timeout: 15000 }
  );
});

await step('what this run made is cleaned up', async () => {
  if (picKey) {
    await page.evaluate((k) => fetch(`/api/studio/media/${k}`,
      { method: 'DELETE', credentials: 'same-origin' }), picKey);
  }
  if (byHand.slug) {
    await page.evaluate((slug) => fetch(`/api/studio/carousels/${slug}`,
      { method: 'DELETE', credentials: 'same-origin' }), byHand.slug);
  }
  if (!picSlug) return;
  const status = await page.evaluate(async (slug) => {
    const r = await fetch(`/api/studio/articles/${slug}`,
                          { method: 'DELETE', credentials: 'same-origin' });
    return r.status;
  }, picSlug);
  if (status !== 200) throw new Error('delete returned ' + status);
});

// phone
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
phone.on('dialog', (d) => d.accept());
await phone.goto(BASE + '/studio', { waitUntil: 'domcontentloaded' });
await phone.fill('#st-pw', PASSWORD);
await phone.click('.st-gate__form button[type=submit]');
await phone.waitForSelector('[data-view="home"]:not([hidden])');
await phone.screenshot({ path: shot('11-phone-home'), fullPage: false });
await phone.evaluate(() => { location.hash = '#/journal'; });
await phone.waitForTimeout(500);
await phone.click('[data-list-body] .st-row');
await phone.waitForSelector('[data-view="article"]:not([hidden])');
await phone.waitForTimeout(300);
await phone.screenshot({ path: shot('12-phone-article'), fullPage: false });

await step('no horizontal overflow on a phone', async () => {
  const over = await phone.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) throw new Error(`page scrolls ${over}px sideways`);
});

await browser.close();
console.log('\n' + (problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'no console errors, no failed requests'));
process.exit(problems.length ? 1 : 0);

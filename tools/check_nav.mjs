/**
 * check_nav.mjs — the site's navigation, on every page and both widths.
 *
 *   npx wrangler pages dev --port 8801 --d1 DB --r2 MEDIA
 *   node tools/check_nav.mjs
 *
 * There are four kinds of page (home, journal index, article, booking) and
 * three places the navigation is written (index.html, book.html, and
 * lib/templates.js). They drifted: the booking page had a menu button with
 * no menu behind it, the journal pages had no button at all, and the home
 * page's menu was missing the journal. So this checks that every page
 * offers the same things, and that the menu actually behaves.
 *
 *   BASE     where the site is        (default http://127.0.0.1:8801)
 *   SHOTS    screenshot directory     (default ./.check-shots)
 *   CHROME   path to a Chromium binary
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const SHOTS = process.env.SHOTS || './.check-shots';
mkdirSync(SHOTS, { recursive: true });
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** Every page must offer these, in this order, in both navigations. */
const ITEMS = ['About', 'Work', 'Services', 'Process', 'Journal'];

const PAGES = [
  ['home', '/'],
  ['journal', '/journal/'],
  ['article', '/journal/why-your-website-is-slow-on-mobile'],
  ['book', '/book'],
];

const problems = [];
const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) {
    console.log('  FAIL ' + name + ' — ' + e.message.split('\n')[0]);
    problems.push(name + ': ' + e.message.split('\n')[0]);
  }
};

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-proxy-server', '--no-sandbox', '--disable-dev-shm-usage'],
  chromiumSandbox: false, timeout: 60000,
});

const labels = (nodes) => nodes.map((n) => n.textContent.replace(/\s+/g, ' ').trim());

/* --------------------------------------------------------------- desktop */

const wide = await browser.newPage({ viewport: { width: 1280, height: 900 } });
wide.on('pageerror', (e) => problems.push('pageerror: ' + e.message));

for (const [name, path] of PAGES) {
  await wide.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await wide.waitForTimeout(1200);

  await step(`${name}: the bar carries every item`, async () => {
    const got = await wide.$$eval('.navbar_link',
      (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    if (got.join('|') !== ITEMS.join('|')) throw new Error(`got ${got.join(', ') || '(none)'}`);
  });

  await step(`${name}: the bar has no leftover markers`, async () => {
    const html = await wide.$eval('.navbar_links', (n) => n.innerHTML);
    if (/SOON/i.test(html)) throw new Error('a (SOON) span is still in the bar');
  });

  await step(`${name}: it says where you are`, async () => {
    const here = await wide.$$eval('[aria-current="page"]',
      (ns) => ns.map((n) => n.textContent.replace(/\s+/g, ' ').trim()));
    const want = path.startsWith('/journal') ? 'Journal' : null;
    if (want && !here.some((t) => t.includes(want))) {
      throw new Error(`expected ${want} marked, got ${here.join(', ') || '(nothing)'}`);
    }
    if (!want && here.length) throw new Error(`nothing should be marked, got ${here.join(', ')}`);
  });

  await step(`${name}: the menu is not in the way on a wide screen`, async () => {
    const shown = await wide.$eval('[data-nav-menu]',
      (n) => getComputedStyle(n).display !== 'none');
    if (shown) throw new Error('the menu panel is displayed at 1280px');
  });
}

/* ----------------------------------------------------------------- phone */

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
phone.on('pageerror', (e) => problems.push('pageerror: ' + e.message));

for (const [name, path] of PAGES) {
  await phone.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await phone.waitForTimeout(1400);

  await step(`phone ${name}: there is a way in`, async () => {
    const btn = await phone.$('[data-nav-toggle]');
    if (!btn) throw new Error('no menu button');
    const box = await btn.boundingBox();
    if (!box || box.width < 20 || box.height < 20) {
      throw new Error(`the button is ${box ? `${box.width}x${box.height}` : 'not visible'}`);
    }
  });

  await step(`phone ${name}: it opens, with every item`, async () => {
    await phone.click('[data-nav-toggle]');
    await phone.waitForTimeout(600);
    const open = await phone.$eval('[data-nav-menu]', (n) => n.classList.contains('is-open'));
    if (!open) throw new Error('the panel did not open');
    const got = await phone.$$eval('.nav_menu_link span:first-child', (ns) =>
      ns.map((n) => n.textContent.trim()));
    if (got.join('|') !== ITEMS.join('|')) throw new Error(`got ${got.join(', ') || '(none)'}`);
    const cta = await phone.$('.nav_menu_foot a[href="/book"]');
    if (!cta) throw new Error('no way to start a project from the menu');
  });

  if (name === 'home') await phone.screenshot({ path: `${SHOTS}/nav-menu-${name}.png` });

  await step(`phone ${name}: choosing something closes it`, async () => {
    // pick an item that stays on this page where possible, otherwise the
    // first one; either way the panel must not be left sitting open
    const link = await phone.$('.nav_menu_link[href*="#work"]') ||
                 await phone.$('.nav_menu_link');
    await link.click();
    await phone.waitForTimeout(900);
    const state = await phone.evaluate(() => ({
      open: document.querySelector('[data-nav-menu]')?.classList.contains('is-open'),
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      lenis: document.body.hasAttribute('data-lenis-prevent'),
    }));
    if (state.open) throw new Error('the panel stayed open');
    if (state.htmlOverflow === 'hidden' || state.bodyOverflow === 'hidden' || state.lenis) {
      throw new Error(`the page is still scroll-locked: ${JSON.stringify(state)}`);
    }
  });
}

/* ---------------------------------------------------------- the details */

await phone.goto(BASE + '/journal/', { waitUntil: 'domcontentloaded' });
await phone.waitForTimeout(1200);

await step('phone: Escape closes it', async () => {
  await phone.click('[data-nav-toggle]');
  await phone.waitForTimeout(500);
  await phone.keyboard.press('Escape');
  await phone.waitForTimeout(500);
  const open = await phone.$eval('[data-nav-menu]', (n) => n.classList.contains('is-open'));
  if (open) throw new Error('still open');
});

await step('phone: the backdrop closes it', async () => {
  await phone.click('[data-nav-toggle]');
  await phone.waitForTimeout(500);
  await phone.click('[data-nav-close]', { force: true });
  await phone.waitForTimeout(500);
  const open = await phone.$eval('[data-nav-menu]', (n) => n.classList.contains('is-open'));
  if (open) throw new Error('still open');
});

await step('phone: closed, it is out of reach of the keyboard', async () => {
  const inert = await phone.$eval('[data-nav-menu]', (n) => n.hasAttribute('inert'));
  if (!inert) throw new Error('the closed panel is still focusable');
});

await step('phone: the button says whether it is open', async () => {
  const shut = await phone.$eval('[data-nav-toggle]', (n) => n.getAttribute('aria-expanded'));
  await phone.click('[data-nav-toggle]');
  await phone.waitForTimeout(400);
  const open = await phone.$eval('[data-nav-toggle]', (n) => n.getAttribute('aria-expanded'));
  if (shut !== 'false' || open !== 'true') throw new Error(`${shut} then ${open}`);
  await phone.keyboard.press('Escape');
  await phone.waitForTimeout(400);
});

await step('phone: the button reads Menu, then Close', async () => {
  await phone.goto(BASE + '/journal/', { waitUntil: 'domcontentloaded' });
  await phone.waitForTimeout(1200);
  const read = () => phone.evaluate(() => {
    const shown = [...document.querySelectorAll('[data-nav-toggle] .navbar_menu_span')]
      .filter((s) => Number(getComputedStyle(s).opacity) > 0.5)
      .map((s) => s.textContent.trim());
    return shown;
  });
  const shut = await read();
  if (shut.join(',') !== 'Menu') throw new Error(`closed, it shows ${JSON.stringify(shut)}`);
  await phone.click('[data-nav-toggle]');
  await phone.waitForTimeout(600);
  const open = await read();
  if (open.join(',') !== 'Close') throw new Error(`open, it shows ${JSON.stringify(open)}`);
});

await step('phone: the bar does not repeat the panel\'s button', async () => {
  const both = await phone.evaluate(() => {
    const bar = document.querySelector('.navbar_cta_wrap');
    return { bar: bar ? Number(getComputedStyle(bar).opacity) : null,
             panel: !!document.querySelector('.nav_menu_foot a[href="/book"]') };
  });
  if (!both.panel) throw new Error('the panel lost its button');
  if (both.bar > 0.05) throw new Error(`the bar's copy is still at opacity ${both.bar}`);
  await phone.keyboard.press('Escape');
  await phone.waitForTimeout(500);
});

await step('About reaches the panel from another page', async () => {
  await phone.goto(BASE + '/journal/', { waitUntil: 'domcontentloaded' });
  await phone.waitForTimeout(1000);
  const href = await phone.$eval('.nav_menu_link[href*="about"]', (n) => n.getAttribute('href'));
  if (href !== '/#about') throw new Error(`About points at ${href}`);
  await phone.goto(BASE + '/#about', { waitUntil: 'domcontentloaded' });
  await phone.waitForTimeout(2600);
  const open = await phone.evaluate(() => document.body.dataset.aboutStatus);
  if (open !== 'is-open') throw new Error(`the about panel is ${open}`);
});

await browser.close();
console.log('\n' + (problems.length
  ? 'PROBLEMS:\n  ' + problems.join('\n  ')
  : 'the navigation is the same on every page, and the menu behaves'));
process.exit(problems.length ? 1 : 0);

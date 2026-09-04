/**
 * check_theme.mjs — the light switch, on every page that has one.
 *
 * What is tested is the two things that break silently: the choice not
 * surviving a navigation, and a colour that did not come with the swap.
 * A theme that half-applies looks like a rendering bug rather than a
 * missing token, so the contrast assertions name the element.
 *
 *   node tools/check_theme.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log(`  ok    ${name}`); return; }
  failed++;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
const ratio = (a, b) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

console.log('\nthe switch');
await p.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
ok('the button is there', await p.locator('[data-theme-toggle]').count() > 0);
ok('the page starts dark', await p.evaluate(() => !document.documentElement.getAttribute('data-theme')));

await p.locator('[data-theme-toggle]').first().click();
await p.waitForTimeout(200);
ok('pressing it turns the page light',
   await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light'));
ok('the button says which way it goes now',
   (await p.locator('[data-theme-toggle]').first().getAttribute('aria-label')) === 'Switch to dark');

console.log('\nit survives a navigation');
await p.goto(`${BASE}/book`, { waitUntil: 'networkidle' });
ok('the booking page comes up light',
   await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light'));
// the head script runs before paint, so the ground is right on the first
// frame rather than flashing black and then correcting
ok('and the ground is paper, not ink',
   lum(rgb(await p.evaluate(() => getComputedStyle(document.body).backgroundColor))) > 0.6);

console.log('\nnothing came through unswapped');
const cases = [
  ['the wordmark', '.navbar_home svg text', 'color'],
  ['a form label', '.bk__label', 'color'],
  ['the standfirst', '.bk__lede', 'color'],
  ['the footer heading', '.site_footer_head', 'color'],
];
const ground = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
for (const [name, sel, prop] of cases) {
  const got = await p.evaluate(([s, q]) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el)[q] : null;
  }, [sel, prop]);
  if (!got) { ok(`${name} is on the page`, false, `no ${sel}`); continue; }
  const r = ratio(got, ground);
  ok(`${name} reads on the paper`, r >= 4.5, `${r.toFixed(2)}:1 (${got})`);
}

console.log('\nand back');
await p.locator('[data-theme-toggle]').first().click();
await p.waitForTimeout(200);
ok('pressing it again returns to dark',
   await p.evaluate(() => !document.documentElement.getAttribute('data-theme')));
await p.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
ok('and dark survives a navigation too',
   await p.evaluate(() => !document.documentElement.getAttribute('data-theme')));

await b.close();
console.log(failed ? `\n${failed} failed\n` : '\nthe switch works, and holds\n');
process.exit(failed ? 1 : 0);

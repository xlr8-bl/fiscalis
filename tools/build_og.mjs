/**
 * build_og.mjs — draw the share card the site links to.
 *
 * /assets/social/og.jpg was referenced by the home page meta, the seo
 * settings and the seed, and did not exist. Every share of the site on
 * any platform showed no preview image, which for a site whose whole
 * point is social is not a small thing.
 *
 * Drawn with the site's own type and palette rather than exported from
 * a design tool, so it cannot drift from everything else.
 *
 *   node tools/build_og.mjs [--base http://127.0.0.1:8801]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://127.0.0.1:8801';

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 1240, height: 700 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(`${base}/tools/preview/og.html`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__og, null, { timeout: 15000 });
const data = await p.evaluate(() => window.__og);
await b.close();

if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
fs.mkdirSync('assets/social', { recursive: true });
fs.writeFileSync('assets/social/og.jpg', Buffer.from(data.split(',')[1], 'base64'));
const { size } = fs.statSync('assets/social/og.jpg');
console.log(`assets/social/og.jpg — 1200x630, ${(size / 1024).toFixed(0)}KB`);

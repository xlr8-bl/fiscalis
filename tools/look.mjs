/**
 * look.mjs — draw the slides and write the PNGs out, so they can be seen.
 *
 *   npx wrangler pages dev . --port 8801 --ip 127.0.0.1 --d1 DB --r2 MEDIA
 *   node tools/look.mjs [outdir]
 *
 * Every check in this repo asserts something measurable: a character
 * count, a contrast ratio, whether a name resolves. None of them can say
 * a slide is ugly, and one was — a saturated band across the top, a
 * centred paragraph, chips in a blue that is not in the palette — while
 * thirty-four suites reported green.
 *
 * So this renders the real templates through the real renderer and
 * leaves the files somewhere they can be opened. It asserts nothing. It
 * is for looking.
 *
 * The preview harness lives under tools/, which Pages does not serve, so
 * it is copied to the site root for the run and removed afterwards. A
 * file left there would deploy.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const CHROME = process.env.CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* tools/ is not served, so the harness is borrowed into the root for
   the length of the run and taken out again in the finally below. */
copyFileSync('tools/preview/slides.html', '_looks.html');
const OUT = process.argv[2] || './.looks';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-proxy-server', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 700, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/_looks.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.READY === true, null, { timeout: 30000 });

const PANEL = {
  template: 'reasons', ground: 'paper', handle: '@web3ashley', series: 'SITE CHECKS',
  title: 'The empty space is doing work',
  say: 'When an owner commissions a site, blank canvas feels like wasted money. '
     + 'The temptation is to fill every gutter with another badge or banner.',
  chips: ['Cramped', 'Spaced'], icons: ['target', 'idea'],
};
const SIGNOFF = {
  template: 'signoff', ground: 'amber', handle: '@web3ashley', series: 'SITE CHECKS',
  portrait: 'phone-chair', context: 'signoff', anchor: 'top',
  title: 'Check margins on a phone.',
  say: 'Open your site and look at the edges.',
  action: 'Keep this. It is the rule to check before a rebuild.',
};
const CALLING = {
  template: 'calling', ground: 'amber', handle: '@web3ashley', series: 'SITE CHECKS',
  calling: 'web3ashley.com',
  say: 'Nobody could reach them for a year.',
  prompt: { ask: 'Which of yours is it?', options: ['no number', 'wrong hours'] },
  line: 'Whether you are putting your first one up or fixing the one you have.',
  action: 'Send me your home page and I will tell you what to take off.',
};

const shot = async (slide, name) => {
  const r = await page.evaluate((s) => window.render(s), slide);
  if (r.over?.length) console.log(name, 'OVER:', JSON.stringify(r.over).slice(0, 160));
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
};

for (const style of ['band', 'quiet', 'tab']) {
  await page.evaluate((s) => window.setRailStyle(s), style);
  await shot(PANEL, `rail-${style}`);
}
await page.evaluate(() => window.setRailStyle('band'));
await shot(SIGNOFF, 'outro-signoff');
await shot(CALLING, 'outro-calling');
console.log('rendered to', OUT);
await browser.close();
rmSync('_looks.html', { force: true });

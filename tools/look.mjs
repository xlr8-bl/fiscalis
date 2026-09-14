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
const PANEL_CLOSE = {
  title: 'Take one thing off today', ground: 'ink',
  say: 'The badge in your header. Nobody has ever clicked it.',
  icons: ['target'],
  action: 'Open your home page and delete the first thing you skip past.',
};
const CALLING = {
  template: 'calling', ground: 'amber', handle: '@web3ashley', series: 'SITE CHECKS',
  calling: 'web3ashley.com',
  say: 'Nobody could reach them for a year.',
  prompt: { question: 'Which of yours is it?', options: ['no number', 'wrong hours'] },
  line: 'Whether you are putting your first one up or fixing the one you have.',
  action: 'Send me your home page and I will tell you what to take off.',
};

const shot = async (slide, name) => {
  const r = await page.evaluate((s) => window.render(s), slide);
  if (r.over?.length) console.log(name, 'OVER:', JSON.stringify(r.over).slice(0, 160));
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
};

/* Every template, with copy the length a real one gets. One template
   looked at on its own is how the card came out right on `reasons` and
   over the top of a screenshot on `shot`. */
const COMMON = { ground: 'paper', handle: '@web3ashley', series: 'SITE CHECKS' };
const EVERY = {
  open:      { title: 'Your home page has one job', say: 'Somebody lands, and in two seconds decides whether you are the person they were looking for.', icons: ['target', 'idea'] },
  reasons:   PANEL,
  steps:     { title: 'Three passes over the edges', say: 'Open it on the phone you actually carry.', chips: ['Read it', 'Scroll it', 'Tap it'], say2: 'Anything you had to pinch to read is a fault.', icons: ['target'] },
  compare:   { title: 'One of these is a site', say: 'Same business, same week.', duo: [{ head: 'A page', tail: 'Says what you do' }, { head: 'A card', tail: 'Says your name' }], say2: 'The second one is a business card that happens to be online.', icons: ['idea'] },
  proof:     { title: 'What an owner notices first', say: 'Not the colours.', chips: ['Speed', 'The phone number', 'Whether it fits'], icons: ['target', 'idea'] },
  portrait:  { title: 'I build these on my own', say: 'One person, start to finish, so nothing gets handed over half explained.', portrait: 'phone-chair', context: 'portrait' },
  roundup:   { title: 'Four I checked this week', say: 'Same fault on three of them.', stack: [{ name: 'A bakery', url: 'no hours on the page', line: 'Hours live on a photo nobody can read' }, { name: 'A garage', url: 'number is an image', line: 'Cannot tap it, cannot copy it' }], source: 'Checked by hand' },
  numbers:   { title: 'What a slow page costs', trio: [{ figure: '3s', of: 'to first paint' }, { figure: '1 in 4', of: 'leave' }, { figure: '0', of: 'come back' }], say: 'The page was fine. It was the header image.', source: 'Measured on the site' },
  myth:      { title: 'More pages is not more site', swap: { head: 'Twelve thin pages', tail: 'Three that answer something' }, say: 'A page nobody finishes is a page nobody read.', icons: ['idea'] },
  checklist: { title: 'Before you call it done', say: 'Five minutes, on a phone.', chips: ['Number taps', 'Hours readable', 'Nothing cut off'], say2: 'If one fails, the rest do not matter yet.', icons: ['target'], source: 'My own list' },
  shot:      { title: 'This is the whole fault', say: 'The button is under the fold on every phone sold since 2019.', shot: { url: 'a real page', caption: 'The call button, off screen' } },
  annotated: { title: 'Where the eye actually goes', shot: { url: 'a real page', caption: 'First three seconds' }, swap: { head: 'Logo, big', tail: 'What you do, bigger' } },
  chart:     { title: 'Where the seconds go', say: 'One image is most of it.', bars: [{ label: 'Hero image', value: 62 }, { label: 'Fonts', value: 21 }, { label: 'Everything else', value: 17 }], unit: '%', source: 'One page, measured' },
  figure:    { title: 'The number that matters', stat: { figure: '2.1s', of: 'before anything is readable' }, say: 'Past three and the page is being closed as it loads.', source: 'Measured on the site' },
  define:    { term: 'Above the fold', say: 'What is on screen before anybody scrolls. On a phone that is about a postcard.', chips: ['Name it', 'Say it', 'Let them tap'], icons: ['idea'] },
  quote:     { quote: 'I did not know you could tap the number.', who: 'An owner, about his own site', say: 'He had had it for two years.', icons: ['target'], source: 'Said to me' },
  tools:     { title: 'What I actually build with', say: 'Nothing exotic.', apps: ['figma', 'github'], say2: 'The stack matters less than whether the page loads.', icons: ['idea'] },
  swap:      { title: 'Swap one line', swap: { head: 'We deliver solutions', tail: 'I fix slow websites' }, action: 'Rewrite your first line as one sentence a stranger would repeat.' },
  close:     PANEL_CLOSE,
  signoff:   SIGNOFF,
  recap:     { title: 'What to take away', recap: ['Open it on a phone', 'Tap the number', 'Read the hours'], prompt: { question: 'Which one failed?', options: ['the number', 'the hours'] }, line: 'Whether it is your first or your fourth.', action: 'Send me the page and I will tell you what to take off.' },
  calling:   CALLING,
  bookend:   { echo: 'Where we started', title: 'The empty space was doing work', say: 'Every gutter you filled was a place the eye could have rested.', icons: ['idea'], line: 'Whether you are putting your first one up or fixing the one you have.', action: 'Send me your home page.' },
};

for (const style of ['band', 'quiet', 'tab']) {
  await page.evaluate((s) => window.setRailStyle(s), style);
  await shot(PANEL, `rail-${style}`);
}
await page.evaluate(() => window.setRailStyle('band'));
for (const [name, slide] of Object.entries(EVERY)) {
  await shot({ ...COMMON, template: name, ...slide }, `t-${name}`);
}
console.log('rendered to', OUT);
await browser.close();
rmSync('_looks.html', { force: true });

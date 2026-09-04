/**
 * shoot.mjs — screenshots of the site, for looking at it.
 *
 *   node tools/shoot.mjs /journal/ journal-index
 *   node tools/shoot.mjs /journal/ journal-index --width 430
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [path, name] = process.argv.slice(2);
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i === -1 ? d : process.argv[i + 1];
};
const width = Number(arg('width', 1440));
const base = arg('base', 'http://127.0.0.1:8801');
const full = process.argv.includes('--full');

fs.mkdirSync('.check-shots', { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width, height: Number(arg('height', 1100)) } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('requestfailed', (r) => errs.push(`${r.failure()?.errorText} ${r.url()}`));
await p.goto(base + path, { waitUntil: 'networkidle' });
await p.waitForTimeout(Number(arg('wait', 900)));
const out = `.check-shots/${name}.png`;
await p.screenshot({ path: out, fullPage: full });
await b.close();
console.log(out);
if (errs.length) console.log('errors:\n  ' + errs.join('\n  '));

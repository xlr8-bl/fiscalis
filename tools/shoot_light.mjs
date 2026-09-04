/**
 * shoot_light.mjs — the same page in light mode.
 *
 * Sets the stored preference first, then loads, so what is captured is
 * what a reader who pressed the switch actually sees — including the
 * head script running before paint.
 *
 *   node tools/shoot_light.mjs /journal/ journal-light
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [path, name] = process.argv.slice(2);
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i === -1 ? d : process.argv[i + 1];
};
const base = arg('base', 'http://127.0.0.1:8801');

fs.mkdirSync('.check-shots', { recursive: true });
const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext({
  viewport: { width: Number(arg('width', 1440)), height: Number(arg('height', 1100)) },
});
await ctx.addInitScript(() => {
  try { localStorage.setItem('theme', 'light'); } catch (e) {}
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(base + path, { waitUntil: 'networkidle' });
await p.waitForTimeout(Number(arg('wait', 900)));
const out = `.check-shots/${name}.png`;
await p.screenshot({ path: out, fullPage: process.argv.includes('--full') });
await b.close();
console.log(out);
if (errs.length) console.log('errors:\n  ' + errs.join('\n  '));

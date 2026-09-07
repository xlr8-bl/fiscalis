/**
 * build_slides.mjs — draw the content-carousel templates, one example each.
 *
 *   node tools/build_slides.mjs
 *
 * Reports any slide whose copy overflowed past the instruction, because
 * that is a copy problem the format cannot fix and the one failure that
 * ships silently.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { EXAMPLE_SLIDES } from '../lib/slides/examples.js';

const base = process.env.BASE || 'http://127.0.0.1:8899';
const OUT = '.refs/slides';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto(`${base}/tools/preview/slides.html`, { waitUntil: 'networkidle' });
if (errs.length) { console.error('page failed:\n  ' + errs.join('\n  ')); await b.close(); process.exit(1); }

let bad = 0;
for (const slide of EXAMPLE_SLIDES) {
  const r = await p.evaluate(async (s) => {
    try { return await window.render(s); } catch (e) { return { error: String(e.message || e) }; }
  }, slide);
  if (r.error) { console.log(`  ${slide._name.padEnd(22)} FAILED  ${r.error}`); bad++; continue; }
  writeFileSync(`${OUT}/${slide._name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  const note = r.over ? `  OVER by ${r.over} of the frame` : '';
  if (r.over) bad++;
  console.log(`  ${slide._name.padEnd(22)} ${slide.template.padEnd(9)} ${slide.ground}${note}`);
}
if (errs.length) console.error('\nconsole errors:\n  ' + errs.join('\n  '));
console.log(`\n${EXAMPLE_SLIDES.length - bad} of ${EXAMPLE_SLIDES.length} fit, in ${OUT}`);
await b.close();
process.exit(bad ? 1 : 0);

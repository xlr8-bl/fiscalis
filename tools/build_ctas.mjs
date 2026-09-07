/**
 * build_ctas.mjs — the four closing designs, side by side.
 *
 * Four rather than one because the photographs are four different
 * compositions, and the point of building them together is seeing
 * whether they read as a set or as four unrelated posts.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CTAS, CTA_NAMES } from '../lib/slides/ctas.js';
import { validateSlides } from '../lib/slides/spec.js';

const base = process.env.BASE || 'http://127.0.0.1:8899';
const OUT = '.refs/ctas';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
await p.goto(`${base}/tools/preview/slides.html`, { waitUntil: 'networkidle' });

let bad = 0;
for (const name of CTA_NAMES) {
  const { slide, photo, close } = CTAS[name];
  const v = validateSlides({ slides: [slide, slide] });
  if (!v.ok) { console.log(`  ${name.padEnd(18)} REFUSED  ${v.problems.join('; ')}`); bad++; continue; }
  const r = await p.evaluate(async (s) => {
    try { return await window.render(s); } catch (e) { return { error: String(e.message || e) }; }
  }, slide);
  if (r.error) { console.log(`  ${name.padEnd(18)} FAILED  ${r.error}`); bad++; continue; }
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  if (r.over) bad++;
  console.log(`  ${name.padEnd(18)} ${photo.padEnd(12)} ${slide.ground.padEnd(6)} ${close}`
    + (r.over ? `   OVER by ${r.over}` : ''));
}
if (errs.length) console.error('\nconsole errors:\n  ' + errs.join('\n  '));
console.log(`\n${CTA_NAMES.length - bad} of ${CTA_NAMES.length} drawn, in ${OUT}`);
await b.close();
process.exit(bad ? 1 : 0);

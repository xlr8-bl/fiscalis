/**
 * build_carousel.mjs — draw one whole carousel, in order.
 *
 *   node tools/build_carousel.mjs
 *
 * The set is the deliverable, not the slide: a carousel is judged on
 * whether six sheets read as one thing, which is a question no
 * single-slide preview can answer.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { CAROUSEL } from '../lib/slides/carousel-one.js';
import { validateSlides } from '../lib/slides/spec.js';

const base = process.env.BASE || 'http://127.0.0.1:8899';
const OUT = '.refs/carousel-one';
mkdirSync(OUT, { recursive: true });

const checked = validateSlides({ slides: CAROUSEL.slides });
if (!checked.ok) {
  console.error('this carousel does not validate:\n- ' + checked.problems.join('\n- '));
  process.exit(1);
}

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
await p.goto(`${base}/tools/preview/slides.html`, { waitUntil: 'networkidle' });

let bad = 0;
for (const [i, slide] of CAROUSEL.slides.entries()) {
  const r = await p.evaluate(async (s) => {
    try { return await window.render(s); } catch (e) { return { error: String(e.message || e) }; }
  }, slide);
  const n = String(i + 1).padStart(2, '0');
  if (r.error) { console.log(`  ${n} FAILED  ${r.error}`); bad++; continue; }
  writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  if (r.over) bad++;
  console.log(`  ${n}  ${slide.template.padEnd(9)} ${slide.ground.padEnd(6)}`
    + `${r.over ? `OVER by ${r.over}` : ''}`);
}
if (errs.length) console.error('\nconsole errors:\n  ' + errs.join('\n  '));
console.log(`\n"${CAROUSEL.title}" — ${CAROUSEL.slides.length - bad} of ${CAROUSEL.slides.length} drawn, in ${OUT}`);
await b.close();
process.exit(bad ? 1 : 0);

/**
 * build_compose.mjs — draw the measured layouts.
 *
 *   node tools/build_compose.mjs            everything measured so far
 *   node tools/build_compose.mjs h051
 *
 * Reports which slots had to shrink past their reference size and which
 * pictures are missing, because both are things to fix rather than
 * things to discover on a phone screen later.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.env.BASE || 'http://127.0.0.1:8899';
const want = process.argv.slice(2).filter((a) => /^h\d{3}$/.test(a));
const OUT = '.refs/comp';
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto(`${base}/tools/preview/compose.html`, { waitUntil: 'networkidle' });
if (errs.length) { console.error('page failed:\n  ' + errs.join('\n  ')); await b.close(); process.exit(1); }

const ids = want.length ? want : await p.evaluate(() => window.IDS);
let bad = 0;
for (const id of ids) {
  const r = await p.evaluate(async (x) => {
    try { return await window.render(x); } catch (e) { return { error: String(e.message || e) }; }
  }, id);
  if (r.error) { console.log(`  ${id}  FAILED  ${r.error}`); bad++; continue; }
  writeFileSync(`${OUT}/${id}.jpg`, Buffer.from(r.url.split(',')[1], 'base64'));
  const notes = [];
  if (r.tight?.length) notes.push(`tight: ${r.tight.join(',')}`);
  if (r.missing?.length) notes.push(`no art: ${r.missing.join(',')}`);
  console.log(`  ${id}  ${(r.coverage * 100).toFixed(1)}% ${notes.join('  ')}`);
}
await b.close();
console.log(`\n${ids.length - bad} composed into ${OUT}`);
process.exit(bad ? 1 : 0);

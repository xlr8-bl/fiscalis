/**
 * build_decks.mjs — render the carousels.
 *
 *   node tools/build_decks.mjs              all of them
 *   node tools/build_decks.mjs findable     one
 *
 * Writes .refs/decks/<id>/01.jpg .. and a contact strip per deck, so a
 * deck can be judged as a run rather than as a pile of slides. Reports
 * any slot that had to shrink past its size, because a shrunk slide is
 * a slide with too much copy on it and that is a writing fix.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = process.env.BASE || 'http://127.0.0.1:8899';
const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const OUT = '.refs/decks';

const b = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const p = await b.newPage({ viewport: { width: 900, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto(`${base}/tools/preview/deck.html`, { waitUntil: 'networkidle' });
if (errs.length) { console.error('page failed:\n  ' + errs.join('\n  ')); await b.close(); process.exit(1); }

const ids = want.length ? want : await p.evaluate(() => window.DECK_IDS);
const lengths = await p.evaluate(() => window.LENGTHS);
let bad = 0;

for (const id of ids) {
  mkdirSync(`${OUT}/${id}`, { recursive: true });
  const notes = [];
  for (let i = 0; i < lengths[id]; i++) {
    const r = await p.evaluate(async ([d, n]) => {
      try { return await window.slide(d, n); } catch (e) { return { error: String(e.message || e) }; }
    }, [id, i]);
    if (r.error) { console.log(`  ${id} ${i + 1}  FAILED  ${r.error}`); bad++; continue; }
    writeFileSync(`${OUT}/${id}/${String(i + 1).padStart(2, '0')}.jpg`,
                  Buffer.from(r.url.split(',')[1], 'base64'));
    if (r.tight?.length) notes.push(`${i + 1}:${r.layout} tight ${r.tight.join(',')}`);
    if (r.missing?.length) notes.push(`${i + 1}:${r.layout} no art ${r.missing.join(',')}`);
  }
  console.log(`  ${id.padEnd(12)} ${lengths[id]} slides${notes.length ? '  ' + notes.join('  ') : ''}`);
}
await b.close();
console.log(`\n${ids.length - bad ? ids.length : 0} decks into ${OUT}`);
process.exit(bad ? 1 : 0);

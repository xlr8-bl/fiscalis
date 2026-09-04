/**
 * fetch_stock.mjs — cache a few real photographs per role.
 *
 * The layouts describe kinds of picture, not files. Until Ashley has
 * shot his own, something has to stand in, and a dashed box is fine for
 * judging geometry and useless for judging whether the sheet works.
 *
 * So: a handful of CC0 photographs per role, cached in
 * assets/stock/roles, chosen against the role's own search terms. They
 * are placeholders in intent and real in appearance, which means the
 * composition can be judged now.
 *
 * Several per role on purpose. A layout that always draws the same
 * photograph produces the same post; the seed picks which one, so a spec
 * is stable across renders without two specs being twins.
 *
 * They are dropped the moment his own arrive: resolveArt() prefers his,
 * always, and nothing else has to change.
 *
 *   node tools/fetch_stock.mjs                 every role, 3 each
 *   node tools/fetch_stock.mjs figure scene    just those
 *   node tools/fetch_stock.mjs --per 5
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { ROLES, ROLE_NAMES } from '../lib/hooks/art.js';
import { findPhotos } from '../lib/photos.js';

const args = process.argv.slice(2);
const wanted = args.filter((a) => ROLE_NAMES.includes(a));
const per = Number(args[args.indexOf('--per') + 1]) || 3;
const OUT = 'assets/stock/roles';

mkdirSync(OUT, { recursive: true });

// findPhotos and keepPhoto want a Worker env; from Node the search half
// works as-is and the download half is a plain fetch, so it is done here
const UA = 'web3ashley/1.0 (https://web3ashley.com; ashleymbaht@gmail.com)';

const credits = [];
// a cut-out role is not fetched even when it is asked for by name: a
// rectangular photograph is not a stand-in for a cut-out, and caching one
// only means resolveArt has something wrong to find
const roles = (wanted.length ? wanted : ROLE_NAMES).filter((r) => {
  if (ROLES[r].fill !== 'box') return true;
  console.log(`  ${r}: skipped — it is a cut-out, and the box is the honest answer`);
  return false;
});

for (const role of roles) {
  // clear the role first, so a re-run replaces rather than accumulating
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`${role}-`)) rmSync(`${OUT}/${f}`);
  }

  const found = [];
  for (const query of ROLES[role].search) {
    if (found.length >= per) break;
    // the shape is the role's, not the journal's. Without this the search
    // scores for a 1200x630 blog cover and throws away every upright
    // photograph before ranking, which is how the portrait role ended up
    // holding three landscape scenes
    const got = await findPhotos({}, query, per, { shape: ROLES[role].shape ?? 'wide' })
      .catch(() => ({ photos: [] }));
    for (const p of got.photos) {
      if (found.length >= per) break;
      if (found.some((f) => f.id === p.id)) continue;
      // an archive matches words, so the obvious misses are rejected by
      // name: "portrait" finds a wolf, "flat lay" finds a wheat field
      if (ROLES[role].reject?.test(p.alt)) {
        console.log(`    skipped: ${p.alt.slice(0, 44)}`);
        continue;
      }
      found.push(p);
    }
  }

  if (!found.length) { console.log(`  ${role}: nothing came back`); continue; }

  let n = 0;
  for (const p of found) {
    const res = await fetch(p.url, { headers: { 'user-agent': UA } }).catch(() => null);
    if (!res?.ok) continue;
    const type = res.headers.get('content-type') || '';
    if (!/^image\/(jpeg|png|webp)/.test(type)) continue;
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(`${OUT}/${role}-${n}.jpg`, bytes);
    credits.push({ file: `${role}-${n}.jpg`, role, by: p.by, licence: p.licence, page: p.page });
    console.log(`  ${role}-${n}.jpg  ${p.alt.slice(0, 46)}  (${p.licence})`);
    n++;
  }
}

/*
 * A manifest, counted from the DISK rather than from this run.
 *
 * Counting from `credits` meant that fetching one role rewrote the
 * manifest as though the other roles had no files, and every layout
 * using them silently fell back to a drawn box. Reading the directory
 * is the only count that is true regardless of what was asked for.
 *
 * It also records where every file came from. The licence does not require attribution for CC0; recording it
 * anyway is the rule assets/stock/scene/SOURCES.md already set, and a
 * source that cannot be traced is a source that cannot be defended.
 */
const onDisk = new Set(readdirSync(OUT));
const counts = {};
for (const f of onDisk) {
  const m = /^([a-z]+)-\d+\.jpg$/.exec(f);
  if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
}

// Credits accumulate across runs for the same reason, minus anything whose
// file has since gone — a role can stop taking stock, and a credit for a
// picture that is not there claims a source the sheet never used.
const before = existsSync('lib/hooks/stock.js')
  ? (await import('../lib/hooks/stock.js')).CREDITS ?? []
  : [];
const kept = before.filter((c) => !roles.includes(c.role) && onDisk.has(c.file));
const all = [...kept, ...credits].sort((a, b) => a.file.localeCompare(b.file));

writeFileSync('lib/hooks/stock.js',
  '/**\n * stock.js — generated by tools/fetch_stock.mjs. Do not edit.\n *\n'
  + ' * How many cached photographs exist per role, and where each came\n'
  + ' * from. Placeholders: resolveArt() prefers Ashley\'s own the moment\n'
  + ' * one is tagged for the role, and these are then unused.\n */\n\n'
  + `export const STOCK = ${JSON.stringify(counts, null, 2)};\n\n`
  + `export const CREDITS = ${JSON.stringify(all, null, 2)};\n`);

console.log(`\n${credits.length} fetched; ${all.length} cached in ${OUT}`);
console.log(Object.entries(counts).map(([k, v]) => `${k}:${v}`).join('  '));

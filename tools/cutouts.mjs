/**
 * cutouts.mjs — build a library of real keyed cut-outs, per role.
 *
 * Fetches candidates from Commons, keys them with tools/extract_objects.py,
 * throws away anything whose edge did not resolve, and writes the survivors
 * to assets/cutouts/<role>/ with a manifest in lib/hooks/cutouts.js.
 *
 * Two sources of a clean edge, in order:
 *   a PNG that already carries alpha — Commons has thousands, and a real
 *   alpha channel beats anything a keyer can infer
 *   a photograph on a plain even ground, keyed here
 *
 *   node tools/cutouts.mjs                 every cut-out role
 *   node tools/cutouts.mjs objects --per 8
 */
import { writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROLES, ROLE_NAMES } from '../lib/hooks/art.js';

const UA = 'web3ashley/1.0 (https://web3ashley.com; ashleymbaht@gmail.com)';
const OUT = 'assets/cutouts';
const TMP = '/tmp/cutout-src';
const args = process.argv.slice(2);
const per = Number(args[args.indexOf('--per') + 1]) || 6;
const wanted = args.filter((a) => ROLE_NAMES.includes(a));

async function commons(query, limit) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}`
    + '&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1100';
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Commons said ${res.status}`);
  const data = await res.json();
  return Object.values(data?.query?.pages ?? {})
    .map((p) => ({ page: p, info: p.imageinfo?.[0] }))
    .filter((x) => x.info?.thumburl)
    .map(({ page, info }) => ({
      id: String(page.pageid),
      title: String(page.title).replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
      // the ORIGINAL for a PNG: a Commons thumbnail of a PNG keeps alpha,
      // but the original keeps it at full quality and these are small files
      url: info.mime === 'image/png' ? info.url : info.thumburl,
      mime: info.mime,
      by: String(info.extmetadata?.Artist?.value ?? '').replace(/<[^>]*>/g, '').trim(),
      licence: String(info.extmetadata?.LicenseShortName?.value ?? '').trim(),
      pageUrl: info.descriptionurl ?? '',
      bytes: info.size ?? 0,
    }));
}

const roles = (wanted.length ? wanted : ROLE_NAMES).filter((r) => ROLES[r].cut?.length);
const manifest = existsSync('lib/hooks/cutouts.js')
  ? (await import('../lib/hooks/cutouts.js')).CUTOUTS ?? {}
  : {};

for (const role of roles) {
  const dir = `${OUT}/${role}`;
  mkdirSync(dir, { recursive: true });
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });

  const seen = new Set();
  const meta = {};
  let n = 0;
  for (const q of ROLES[role].cut) {
    if (n >= per * 4) break;
    let batch = [];
    try { batch = await commons(q, 14); } catch { continue; }
    for (const c of batch) {
      if (n >= per * 4 || seen.has(c.id)) continue;
      if (ROLES[role].reject?.test(c.title)) continue;
      if (c.bytes > 12e6) continue;
      seen.add(c.id);
      const res = await fetch(c.url, { headers: { 'user-agent': UA } }).catch(() => null);
      if (!res?.ok) continue;
      const type = res.headers.get('content-type') || '';
      if (!/^image\/(png|jpeg|webp)/.test(type)) continue;
      const ext = type.includes('png') ? 'png' : 'jpg';
      const stem = `${role}${String(n).padStart(2, '0')}`;
      writeFileSync(`${TMP}/${stem}.${ext}`, Buffer.from(await res.arrayBuffer()));
      meta[stem] = c;
      n++;
    }
  }
  if (!n) { console.log(`${role}: nothing came back`); continue; }

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync('python3', [
    'tools/extract_objects.py', TMP, '-o', dir,
    '--min-keyability', String(ROLES[role].minKey ?? 0.78),
    '--min-photographic', '0.40',
    '--min-area', '0.03', '--max-objects', '2',
  ], { stdio: 'inherit' });

  // rank by edge quality, keep the best `per`, renumber
  const rows = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
  rows.sort((a, b) => (b.keyability - a.keyability) || (b.photographic - a.photographic));
  const kept = rows.slice(0, per);
  for (const r of rows.slice(per)) rmSync(`${dir}/${r.file}`, { force: true });
  manifest[role] = kept.map((r, i) => {
    const to = `${role}-${i}.png`;
    execFileSync('mv', [`${dir}/${r.file}`, `${dir}/${to}`]);
    const src = meta[r.source.replace(/\.[a-z0-9]+$/i, '')] ?? {};
    return {
      file: to, w: r.bbox[2], h: r.bbox[3], aspect: r.aspect,
      key: r.keyability, photo: r.photographic,
      alt: src.title ?? '', by: src.by ?? '', licence: src.licence ?? '',
      page: src.pageUrl ?? '',
    };
  });
  rmSync(`${dir}/manifest.json`, { force: true });
  console.log(`  ${role}: ${manifest[role].length} kept`);
  for (const c of manifest[role]) console.log(`    ${c.file}  ${c.key}  ${c.alt.slice(0, 46)}`);
}

writeFileSync('lib/hooks/cutouts.js',
  '/** Generated by tools/cutouts.mjs. Keyed cut-outs, by role. */\n\n'
  + `export const CUTOUTS = ${JSON.stringify(manifest, null, 2)};\n\n`
  + 'export const cutPath = (role, n) => `/assets/cutouts/${role}/${role}-${n}.png`;\n');

console.log('\n' + Object.entries(manifest).map(([k, v]) => `${k}:${v.length}`).join('  '));

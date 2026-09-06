/**
 * ai_tells.mjs — find the signs of AI writing in the site's own words.
 *
 * The patterns live in assets/js/tells.js, which the Worker also uses to
 * refuse a draft, so what this reports and what the server enforces
 * cannot drift apart. That was the reason for moving this off Python:
 * two lists in two languages is one list plus a disagreement.
 *
 *   node tools/ai_tells.mjs            the articles
 *   node tools/ai_tells.mjs --all      the site's own copy too
 */
import { readFileSync, readdirSync } from 'node:fs';
import { judge, findTells } from '../assets/js/tells.js';

const all = process.argv.includes('--all');

/*
 * Page titles were the one piece of the site's writing nothing scanned.
 * The detector ran on articles and on the copy in seed.js, and the site
 * shipped with an em dash in the <title> of the home page, the 404 and
 * the booking page for months. A title is the most-read sentence on a
 * page — it is what a search result and a browser tab show — so it goes
 * first, and it is checked on every run rather than only under --all.
 */
const TITLED = [
  'index.html', '404.html', 'book.html', 'studio.html',
  'lib/templates.js', 'lib/plainpage.js',
];

/* \u2014 in a source file is the same character to a reader and a
   different one to a regex, which is exactly how the 404's title kept its
   em dash through the first pass of this. */
const unescape = (t) => t.replace(/\\u([0-9a-fA-F]{4})/g,
  (_, h) => String.fromCharCode(parseInt(h, 16)));

export function pageTitles() {
  const out = [];
  for (const f of TITLED) {
    let src = '';
    try { src = unescape(readFileSync(f, 'utf8')); } catch { continue; }
    for (const m of src.matchAll(/<title>([^<]+)<\/title>/g)) out.push([f, m[1]]);
    for (const m of src.matchAll(/(?:og:title|twitter:title)"\s+content="([^"]+)"/g)) out.push([f, m[1]]);
    for (const m of src.matchAll(/content="([^"]+)"\s+property="og:title"/g)) out.push([f, m[1]]);
    // the ones built in JS: title: `...`
    for (const m of src.matchAll(/title:\s*`([^`]+)`/g)) out.push([f, m[1]]);
  }
  return out;
}

const files = readdirSync('content/articles')
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => [`content/articles/${f}`, readFileSync(`content/articles/${f}`, 'utf8')]);

if (all) {
  // The articles are files; the rest of the site's words are rows in D1,
  // baked into lib/seed.js as INSERTs. Scanning the .js as text would
  // flag the code around them, so the literals come out first.
  const src = readFileSync('lib/seed.js', 'utf8');
  const words = [...src.matchAll(/'((?:[^'\\]|\\.|'')+)'/g)]
    .map((m) => m[1].replaceAll("''", "'").replaceAll('\\n', '\n'))
    .filter((w) => w.includes(' ') && /[a-z]{4}/.test(w));
  files.push(['lib/seed.js (the site\'s own copy)', words.join('\n\n')]);
  for (const f of ['lib/legal.js', 'book.html']) {
    files.push([f, readFileSync(f, 'utf8')]);
  }
}

const titles = pageTitles();
const titleFaults = titles
  .map(([f, t]) => [f, t, findTells(t).filter((x) => x.weight === 'hard')])
  .filter(([, , bad]) => bad.length);

let hard = titleFaults.length, soft = 0;
if (titleFaults.length) {
  console.log('\npage titles');
  for (const [f, t, bad] of titleFaults) {
    console.log(`  ${f}\n    ${t}\n    ${bad.map((b) => b.say).join(' ')}`);
  }
} else {
  console.log(`\n${titles.length} page titles, all clean`);
}

for (const [name, text] of files) {
  const found = findTells(text);
  if (!found.length) continue;
  hard += found.filter((f) => f.weight === 'hard').length;
  soft += found.filter((f) => f.weight === 'soft').length;
  console.log(`\n${name}  (${found.length})`);
  for (const f of found) {
    console.log(`  ${String(f.line).padStart(4)}  ${f.weight === 'hard' ? 'REFUSE' : 'read  '}  ${f.id.padEnd(20)} ${f.context}`);
  }
}

console.log(`\n${hard} would be refused, ${soft} to read.`);
console.log('The second number is a reading list, not a verdict: most words on');
console.log('those lists are ordinary English, and one of anything proves nothing.');

/*
 * A title fault is the only thing here that fails the run.
 *
 * Everything else is a reading list on purpose: prose written by a person
 * trips these patterns all the time and a scanner that blocks a commit
 * over one "however" is a scanner people delete. A title is different. It
 * is short, there are sixteen of them, every one was written deliberately,
 * and it is the sentence a search result shows. There is no honest reason
 * for an em dash to be in one.
 */
process.exit(titleFaults.length ? 1 : 0);

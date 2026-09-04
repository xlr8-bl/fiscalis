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

let hard = 0, soft = 0;
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
process.exit(0);

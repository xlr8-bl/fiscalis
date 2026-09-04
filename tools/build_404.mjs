/**
 * build_404.mjs — write 404.html from the site's own shell.
 *
 * Cloudflare Pages needs a real top-level file: a project without one is
 * treated as a single-page application and every unmatched path is
 * served the root document with a 200. Generating it rather than writing
 * it by hand is what stops it drifting from the pages around it.
 *
 *   node tools/build_404.mjs            write it
 *   node tools/build_404.mjs --check    fail if it is out of date
 */
import fs from 'node:fs';
import { render404 } from '../lib/templates.js';

const out = '404.html';
const want = render404();
const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';

if (process.argv.includes('--check')) {
  if (have !== want) {
    console.error('404.html is out of date — run: node tools/build_404.mjs');
    process.exit(1);
  }
  console.log('404.html is current');
} else {
  fs.writeFileSync(out, want);
  console.log(`404.html — ${want.length} bytes`);
}

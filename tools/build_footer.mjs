/**
 * build_footer.mjs — put the site footer on the static pages too.
 *
 * The journal, the legal pages and the 404 are rendered by
 * lib/templates.js, so they have had the footer since it was written.
 * index.html and book.html are static files: the home page has its own
 * large footer and the booking page had none at all — the page a
 * visitor is most likely to arrive on cold ended at the submit button,
 * with no way to Privacy, Terms, or anything else.
 *
 * Rather than paste the markup in and let the two copies drift, this
 * renders legalFooter() from the same module the server uses and writes
 * it between markers. Running it again replaces what is between them.
 *
 *   node tools/build_footer.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { legalFooter } from '../lib/templates.js';

const OPEN = '<!-- footer:start (tools/build_footer.mjs) -->';
const CLOSE = '<!-- footer:end -->';

// index.html has its own footer, with the canvas wordmark and the
// parallax. This is not for that page.
const PAGES = ['book.html'];

const block = `${OPEN}\n${legalFooter()}\n${CLOSE}`;

for (const page of PAGES) {
  const src = readFileSync(page, 'utf8');
  let out;

  if (src.includes(OPEN)) {
    const a = src.indexOf(OPEN);
    const b = src.indexOf(CLOSE) + CLOSE.length;
    out = src.slice(0, a) + block + src.slice(b);
  } else {
    // before the scripts, after the content: a footer that loads after
    // the page it belongs to is still a footer
    const at = src.lastIndexOf('</main>');
    if (at === -1) throw new Error(`${page} has no </main> to sit after`);
    out = src.slice(0, at + 7) + '\n' + block + src.slice(at + 7);
  }

  writeFileSync(page, out);
  console.log(`  ${page}`);
}

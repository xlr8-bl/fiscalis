/**
 * check_footer.mjs — one footer, on every page that has one.
 *
 *   node tools/check_footer.mjs
 *
 * There were two: the home page's, and a plain four-column text footer
 * on everything else, which is a different site's footer on the same
 * domain. This guards the single one, and guards the three things that
 * quietly stop working when markup is copied between pages.
 */
import { readFileSync } from 'node:fs';
import { siteFooter } from '../lib/footer.js';
import { renderLegalPage } from '../lib/templates.js';
import { PRIVACY, UPDATED } from '../lib/legal.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

const foot = siteFooter();
const legal = await (async () => {
  const r = renderLegalPage(PRIVACY, UPDATED);
  return typeof r === 'string' ? r : r.text();
})();

const PAGES = {
  'index.html': readFileSync('index.html', 'utf8'),
  'book.html': readFileSync('book.html', 'utf8'),
  '404.html': readFileSync('404.html', 'utf8'),
  '/privacy (rendered)': legal,
};

console.log('\nthe same footer, everywhere');
for (const [name, html] of Object.entries(PAGES)) {
  ok(`${name} has it`, /class="footer_wrap_main"/.test(html));
}
ok('and the old text footer is gone from all of them',
   !Object.values(PAGES).some((h) => /site_footer_grid/.test(h)));

console.log('\nwhat has to survive being copied between pages');
{
  /* The clock is site.js, which every page loads. The shader is app.js
     and three.js, which only the home page carries: the canvas sits
     transparent over the ground the CSS paints, and the wordmark and the
     line beside it are siblings of the canvas rather than children, so
     they draw either way. */
  ok('the clock has something to fill it', /data-clock=""/.test(foot));
  ok('and the date beside it', /data-today=""/.test(foot));
  ok('the wordmark is not inside the canvas',
     /<\/canvas>\s*<div class="footer_canvas_content"/.test(foot.replace(/\n/g, '')));
  ok('the line beside it is not either', /Systems that keep working/.test(foot));

  /* #to-top lives here, and app.js dereferenced it without a guard: on a
     page with no footer that threw, took the whole init chain with it,
     and served a black screen. It has a guard now, and it also has a
     footer on every page. */
  ok('the back-to-top button is present', /id="to-top"/.test(foot));

  /* "#process" from the booking page scrolls to nothing. The shared copy
     is absolute; the home page's own copy stays relative, because there
     it is already on the right page. */
  const away = [...foot.matchAll(/href="(#[^"]*)"/g)].map((m) => m[1]);
  ok('no same-page anchors in the shared copy', away.length === 0, away.join(' '));
  ok('the section links go home first', /href="\/#process"/.test(foot));
  ok('and the home page keeps its own relative ones',
     /href="#process"/.test(PAGES['index.html']));
}

console.log('\none email, not two');
{
  /* The address was printed from the setting and linked from a string
     typed into the markup, so changing it in the studio changed the text
     and not the link. Nobody clicks their own mailto, so nobody finds
     that. */
  const worker = readFileSync('functions/index.js', 'utf8');
  for (const [name, html] of Object.entries(PAGES)) {
    const shown = /data-cms="contact.email"[^>]*>([^<]+)/.exec(html)?.[1];
    const linked = /href="mailto:([^?"]+)/.exec(html)?.[1];
    ok(`${name} links the address it prints`, !shown || !linked || shown === linked,
       `${shown} vs ${linked}`);
  }
  ok('and the home page keeps the link in step with the setting',
     /data-cms-attr="href:contact.mailto"/.test(foot)
     && /values\['contact\.mailto'\]/.test(worker));
}

console.log('\nwhere it deliberately does not go');
{
  /* The studio is the back of house and the OAuth screens exist to
     explain a failure, so they carry nothing that can fail. */
  ok('not the studio', !/footer_wrap_main/.test(readFileSync('studio.html', 'utf8')));
  ok('not the pages that load no stylesheet',
     !/footer_wrap_main/.test(readFileSync('lib/plainpage.js', 'utf8')));
}

console.log(bad ? `\n${bad} failed` : '\none footer, and it is the home page\'s');
process.exit(bad ? 1 : 0);

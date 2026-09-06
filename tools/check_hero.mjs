/**
 * check_hero.mjs — one screen, and the whole of it.
 *
 *   node tools/check_hero.mjs
 *
 * Static: the markup and the injected CSS, without a server. What it is
 * guarding is the pair of silent failures, both of which look like the
 * feature working until somebody opens it on a phone.
 */
import { readFileSync } from 'node:fs';
import { isHeroOnly, isBookingOnly, bookingOnlyRedirect } from '../lib/content.js';
import { SETTINGS } from '../lib/collections.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

const index = readFileSync('index.html', 'utf8');
const worker = readFileSync('functions/index.js', 'utf8');

console.log('\nthe switch');
{
  ok('hero only reads the setting', isHeroOnly({ 'site.heroOnly': 'on' }) === true);
  ok('and is off by default', isHeroOnly({}) === false);
  ok('it is a field in the studio',
     SETTINGS.flatMap((g) => g.fields).some((f) => f.name === 'site.heroOnly'));
  ok('the worker turns it into a mode', /modes\.add\('heroOnly'\)/.test(worker));
  ok('and it implies booking only, so the journal redirects rather than 404s',
     /isBookingOnly\(settings\) \|\| hero/.test(worker));
}

console.log('\nwhat a visitor is left with');
{
  const tagged = [...index.matchAll(/<[a-z]+\s[^>]*data-off-when="heroOnly"[^>]*>/g)]
    .map((m) => (/(?:id|class)="([^"]{0,40})/.exec(m[0]) || [])[1] || '?');
  ok('the navbar goes', tagged.some((t) => /navbar/.test(t)), tagged.join(' | '));
  ok('the questions go', tagged.some((t) => /faq/.test(t)));
  ok('the closing call goes', tagged.some((t) => /cta_home/.test(t)));
  ok('the footer goes', tagged.some((t) => /footer/.test(t)));

  const heroTag = /<section[^>]*class="[^"]*hero_home_wrap/.exec(index);
  ok('the hero itself is not tagged, or nothing would be left',
     !!heroTag && !/data-off-when/.test(heroTag[0]));
}

console.log('\nthe two things that break it on a phone');
{
  /* 100vh is the LARGEST viewport: on iOS the page is that tall from the
     moment it loads, so the bottom of the hero sits behind the address
     bar, and a page with nothing to scroll never gets it out of the way. */
  ok('the height is svh, not vh', /min-height: 100svh/.test(worker));
  ok('with dvh behind it as the fallback', /min-height: 100dvh/.test(worker));
  ok('and plain 100vh is not used anywhere in the injected CSS',
     !/min-height:\s*100vh/.test(worker));

  /* env(safe-area-inset-*) reports 0 unless the viewport meta opts in, so
     without viewport-fit=cover every one of these rules silently does
     nothing and the wordmark stays under the notch. */
  ok('the wordmark clears the top inset', /env\(safe-area-inset-top\)/.test(worker));
  ok('and the bottom one', /env\(safe-area-inset-bottom\)/.test(worker));
  ok('and the sides, for a landscape notch', /env\(safe-area-inset-left\)/.test(worker));
  ok('there is headroom past the bottom inset for Safari\'s floating bar',
     /env\(safe-area-inset-bottom\) \+ 3rem/.test(worker));

  for (const f of ['index.html', '404.html', 'book.html', 'studio.html']) {
    const html = readFileSync(f, 'utf8');
    const meta = /content="width=device-width[^"]*"/.exec(html);
    ok(`${f} opts into the safe area`, !!meta && /viewport-fit=cover/.test(meta[0]),
       meta ? meta[0] : 'no viewport meta');
  }
  for (const f of ['lib/plainpage.js', 'lib/templates.js']) {
    const src = readFileSync(f, 'utf8');
    const metas = [...src.matchAll(/content="width=device-width[^"]*"/g)];
    ok(`${f} does too, on every page it renders`,
       metas.length > 0 && metas.every((m) => /viewport-fit=cover/.test(m[0])),
       metas.map((m) => m[0]).join(' | '));
  }
}

console.log('\nthe page does not need JavaScript to be visible');
{
  /* This is the one that actually shipped broken. Every [data-animate]
     section is visibility:hidden in the stylesheet and revealed by the
     intro timeline, and the whole init chain is a single barba once()
     hook. #to-top lives in the footer, hero only removes the footer, and
     document.querySelector("#to-top") came back null: the hook threw, the
     reveal never ran, and the site served a page that was entirely
     present and entirely invisible. */
  const app = readFileSync('assets/js/app.js', 'utf8');
  ok('the back-to-top button is looked up safely',
     /querySelector\("#to-top"\)\?\.addEventListener/.test(app));
  ok('and nothing else in app.js dereferences a querySelector unguarded',
     !/querySelector\([^)]*\)\.(addEventListener|classList|style|setAttribute|textContent)/
       .test(app));

  ok('there is a net under it', /HERO_ONLY_FAILSAFE/.test(worker));
  ok('which is injected, not merely defined', /HERO_ONLY_CSS \+ HERO_ONLY_FAILSAFE/.test(worker));
  ok('it only acts when the hero is still hidden',
     /getComputedStyle\(hero\)\.visibility !== 'hidden'\) return/.test(worker));
  ok('and it reveals what is inside the hero too, not just the section',
     /\[data-animate\], \.split-line/.test(worker));
}

console.log('\nnothing suggests there is more below');
{
  ok('the scroll cue is hidden', /data-scroll-cue\][^}]*display: none/.test(worker));
}

console.log('\nthe journal still redirects rather than disappearing');
{
  const db = (settings) => ({
    prepare: () => ({ all: async () => ({ results: Object.entries(settings)
      .map(([key, value]) => ({ key, value })) }) }),
  });
  const away = await bookingOnlyRedirect(db({ 'site.heroOnly': 'on' }));
  ok('hero only sends a visitor to the booking page', !!away && away.status === 302,
     away ? String(away.status) : 'nothing');
  const stay = await bookingOnlyRedirect(db({}));
  ok('and an ordinary site is left alone', stay === null);
}

console.log(bad ? `\n${bad} failed` : '\none screen, full height, and the name clear of everything');
process.exit(bad ? 1 : 0);

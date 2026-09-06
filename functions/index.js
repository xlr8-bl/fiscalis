/**
 * GET / — the home page, with its content filled in from D1.
 *
 * The page is still the static index.html. Rather than rewriting 170KB of
 * Webflow markup into a template, the slots in it carry `data-cms`
 * attributes and this fills them on the way out.
 *
 * Three consequences worth knowing:
 *
 *   - The design cannot drift. No layout lives here, so a content edit
 *     cannot break it.
 *   - It degrades to the file. A slot with no row in D1 keeps whatever the
 *     markup already says, so the page is correct before anything is seeded
 *     and correct again if D1 is unreachable.
 *   - Two mechanisms, because they are two different problems.
 *
 * Repeating sections are marked in the markup like this:
 *
 *     <div data-cms-list="projects">
 *       <!--cms:item-->
 *       <div class="works_home_item">
 *         <h2 data-cms="projects.0.title">The eleven second booking page</h2>
 *         ...
 *       </div>
 *       <!--/cms:item-->
 *     </div>
 *
 * The delimited block is the pattern *and* the fallback: it is real markup
 * with real content, so the page is right with no database at all. To repeat
 * it, the block is copied once per entry with its `.0.` keys renumbered, and
 * HTMLRewriter then fills every slot by key. Nothing is duplicated between
 * the markup and this file.
 */

import {
  getSettings, listAllEntries, isBookingOnly, isHeroOnly, hiddenSections,
} from '../lib/content.js';
import { COLLECTIONS } from '../lib/collections.js';
import { escapeHtml } from '../assets/js/markdown.js';

/** Fills the text of any element carrying data-cms. */
class TextSlot {
  constructor(values) { this.values = values; }
  element(el) {
    const key = el.getAttribute('data-cms');
    const value = this.values[key];
    // undefined means nothing in the database has anything to say about this
    // slot, so the markup stands. An empty string is a decision — the field
    // exists and was left blank — and clears the slot. Without that split, a
    // repeated row with a blank field would keep the first row's copy of it.
    if (value === undefined) return;
    el.setInnerContent(escapeHtml(String(value)), { html: true });
  }
}

/** data-cms-attr="src:projects.0.image, alt:projects.0.title" */
class AttrSlot {
  constructor(values) { this.values = values; }
  element(el) {
    const spec = el.getAttribute('data-cms-attr');
    if (!spec) return;
    for (const pair of spec.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      const value = this.values[key];
      if (attr && value) el.setAttribute(attr, value);
    }
  }
}

/** Hides a row the data does not reach, so a short list does not leave stubs. */
class HideEmpty {
  constructor(values) { this.values = values; }
  element(el) {
    const key = el.getAttribute('data-cms-if');
    if (key && !this.values[key]) el.remove();
  }
}

/**
 * Takes out anything marked for a mode the site is not in.
 *
 * `data-off-when="bookingOnly"` sits on the five sections a booking-only
 * site does not need and on every link that points at one. Removing the
 * link is not tidiness: a nav that scrolls to a section which is no longer
 * there is a dead control, and the visitor reads a dead control as a
 * broken site rather than as a deliberate one.
 *
 * A link is removed with its list item where it has one, so the nav closes
 * up instead of leaving gaps in a flex row. The markup ships complete and
 * the removal happens on the way out, which means the switch is a setting
 * he can throw from his phone and not a deploy.
 */
/*
 * One screen, and the whole of it.
 *
 * THREE THINGS GO WRONG ON A PHONE and all three are about the viewport.
 *
 * 100vh is the LARGEST viewport, the one you get after the browser bars
 * have retracted. On iOS Safari the page is that tall from the moment it
 * loads, so the bottom of the hero sits behind the address bar until you
 * scroll, and a page with nothing to scroll never gets the chance. 100svh
 * is the smallest viewport, the one with every bar showing, which is what
 * "fits on screen without scrolling" actually means. It is the one to
 * design to; 100dvh is here only as the fallback for a browser that has
 * svh but is mid-transition.
 *
 * The wordmark then has to clear whatever the browser is drawing over the
 * page: the notch and the status bar at the top, the home indicator and
 * Safari's floating address bar at the bottom. env(safe-area-inset-*)
 * reports those, and it reports 0 where there are none, so the same rule
 * is correct on a desktop. viewport-fit=cover is what makes the browser
 * report them at all, and without it the insets are all zero and this
 * silently does nothing.
 *
 * The extra 3rem at the bottom is not padding for its own sake. Safari's
 * floating bar is not part of the safe-area inset while it is showing, so
 * the inset alone leaves the last line under it.
 */
const HERO_ONLY_CSS = `<style>
  html, body { overflow-x: hidden; }
  .page_main { min-height: 100svh; min-height: 100dvh; display: flex; }
  .hero_home_wrap {
    min-height: 100svh; min-height: 100dvh;
    display: flex; flex-direction: column; justify-content: center;
    width: 100%;
    padding-top: max(1.5rem, env(safe-area-inset-top));
    padding-bottom: max(3rem, calc(env(safe-area-inset-bottom) + 3rem));
    padding-left: max(1.25rem, env(safe-area-inset-left));
    padding-right: max(1.25rem, env(safe-area-inset-right));
    box-sizing: border-box;
  }
  /* nothing below it, so nothing should suggest there is */
  .hero_home_wrap [data-scroll-cue], .hero_home_wrap .hero_scroll { display: none; }
</style>`;

/**
 * The last line of defence, and the reason it exists.
 *
 * Every [data-animate] section is `visibility: hidden` in the stylesheet
 * and is revealed by the intro timeline. That is fine while the timeline
 * always runs. It stops being fine the moment a mode removes sections,
 * because the whole init chain is one barba `once()` hook: one null
 * dereference anywhere in it and nothing after it runs, including the
 * reveal. The site then serves a page that is entirely present, entirely
 * correct, and entirely invisible. A black screen.
 *
 * That is exactly what shipped: `#to-top` lives in the footer, hero only
 * takes the footer, and `document.querySelector("#to-top")` came back
 * null. The guard is in app.js now, but the shape of the failure is what
 * matters, not that one instance of it: hiding the page until JavaScript
 * says otherwise means any future slip blanks the site.
 *
 * So this reveals the hero if nothing else has after two seconds. It does
 * nothing at all in the ordinary case, where the intro has already set an
 * inline visibility long before the timer fires.
 */
const HERO_ONLY_FAILSAFE = `<script>
addEventListener('load', function () {
  setTimeout(function () {
    var hero = document.querySelector('.hero_home_wrap');
    if (!hero || getComputedStyle(hero).visibility !== 'hidden') return;
    hero.style.visibility = 'visible';
    hero.style.opacity = '1';
    var inside = hero.querySelectorAll('[data-animate], .split-line');
    for (var i = 0; i < inside.length; i++) {
      inside[i].style.visibility = 'visible';
      inside[i].style.opacity = '1';
      inside[i].style.transform = 'none';
    }
  }, 2000);
});
</script>`;

/*
 * An element can be removed for more than one reason.
 *
 * The nav link to #work goes when the site is booking only AND when the
 * work section itself is switched off, and those are two different
 * settings. One attribute, several modes, any of them enough: that is
 * what makes a per-section switch expressible without inventing a second
 * attribute or tagging the same link twice.
 */
class OffWhen {
  constructor(modes) { this.modes = modes; }
  element(el) {
    const on = String(el.getAttribute('data-off-when') || '').trim().split(/\s+/);
    if (on.some((m) => this.modes.has(m))) el.remove();
  }
}

const ITEM = /<!--cms:item-->([\s\S]*?)<!--\/cms:item-->/;

/**
 * The span between a container's opening tag and its matching close.
 *
 * Every list container in the markup is a <div>, so this counts div depth
 * rather than trusting a regex to find the right closing tag — the rows
 * inside are themselves several divs deep.
 */
function innerRange(html, tagStart) {
  const openEnd = html.indexOf('>', tagStart) + 1;
  if (openEnd === 0) return null;
  const re = /<(\/?)div\b[^>]*?(\/?)>/gi;
  re.lastIndex = openEnd;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[2] === '/') continue;              // self-closing, no depth change
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return [openEnd, m.index];
  }
  return null;
}

/**
 * Replace each list container's contents with one copy of its pattern per
 * entry, renumbering the keys.
 *
 * The whole container is replaced, not appended to: the markup ships a full
 * set of rows so the page is complete with no database, and those rows are
 * exactly what has to go when the database does have something to say.
 */
function expandLists(html, entries) {
  for (const [name, rows] of Object.entries(entries)) {
    if (!rows.length) continue;

    const at = html.indexOf(`data-cms-list="${name}"`);
    if (at === -1) continue;
    const tagStart = html.lastIndexOf('<', at);
    const range = innerRange(html, tagStart);
    if (!range) continue;

    const [from, to] = range;
    const inner = html.slice(from, to);
    const match = ITEM.exec(inner);
    if (!match) continue;

    const pattern = match[1];
    const copies = rows
      .map((_, i) => (i === 0 ? pattern : pattern.split(`${name}.0.`).join(`${name}.${i}.`)))
      .join('');

    html = html.slice(0, from) + copies + html.slice(to);
  }
  return html;
}

/** Flatten settings and entries into the dotted keys the slots reference. */
function flatten(settings, entries) {
  const values = { ...settings };
  for (const [name, rows] of Object.entries(entries)) {
    // every field the collection defines gets a key for every row that
    // exists, so a blank field reads as blank rather than as absent
    const fields = COLLECTIONS[name]?.fields?.map((f) => f.name) ?? [];
    rows.forEach((row, i) => {
      for (const field of fields) {
        values[`${name}.${i}.${field}`] = row.data[field] ?? '';
      }
      for (const [field, value] of Object.entries(row.data)) {
        values[`${name}.${i}.${field}`] = value;
      }
    });
  }
  return values;
}

/**
 * The FAQ section, again, as structured data.
 *
 * The questions are already on the page and already come from D1. This
 * says the same thing in the form Google reads, which is what makes them
 * eligible to appear under the result rather than only on the page.
 *
 * Built from the same rows the section is built from, so a question
 * edited in the studio cannot end up answered differently in the markup
 * and in the schema — which is the failure mode of writing FAQ schema
 * out by hand, and the one Google penalises.
 */
function faqLd(entries) {
  const rows = (entries.faqs ?? [])
    .map((r) => r.data)
    .filter((d) => d?.question && d?.answer);
  if (rows.length < 2) return '';
  return (
    '<script type="application/ld+json">' +
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: rows.map((d) => ({
        '@type': 'Question',
        name: d.question,
        acceptedAnswer: { '@type': 'Answer', text: d.answer },
      })),
    }).replace(/</g, '\\u003c') +
    '</script>'
  );
}

/** Puts a block of markup in just before </head>. */
class HeadTail {
  constructor(markup) { this.markup = markup; }
  element(el) { if (this.markup) el.append(this.markup, { html: true }); }
}

export async function onRequestGet(context) {
  const { env, next } = context;
  const response = await next();

  const type = response.headers.get('content-type') || '';
  if (!env.DB || !type.includes('text/html')) return response;

  let settings, entries;
  try {
    [settings, entries] = await Promise.all([getSettings(env.DB), listAllEntries(env.DB)]);
  } catch {
    // the site matters more than the edit; serve what is on disk
    return response;
  }
  if (!Object.keys(settings).length && !Object.keys(entries).length) return response;

  const html = expandLists(await response.text(), entries);
  const values = flatten(settings, entries);

  const modes = new Set();
  let head = faqLd(entries);
  const hero = isHeroOnly(settings);
  if (isBookingOnly(settings) || hero) {
    modes.add('bookingOnly');
    // the anchor goes, and the list item it sat in is then empty. Closing
    // the gap in CSS rather than in the rewriter avoids having to know
    // which of the three navs wraps its links in what
    head += '<style>li:empty{display:none}</style>';
  }
  if (hero) {
    modes.add('heroOnly');
    head += HERO_ONLY_CSS + HERO_ONLY_FAILSAFE;
  }
  // and whatever has been switched off one section at a time
  for (const mode of hiddenSections(settings)) modes.add(mode);

  const filled = new HTMLRewriter()
    .on('[data-cms]', new TextSlot(values))
    .on('[data-cms-attr]', new AttrSlot(values))
    .on('[data-cms-if]', new HideEmpty(values))
    .on('[data-off-when]', new OffWhen(modes))
    .on('head', new HeadTail(head))
    .transform(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // content can change at any moment, so revalidate rather than hold; the
  // assets the page references are still immutable and cached hard
  headers.set('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  headers.delete('content-length');

  return new Response(filled.body, { status: response.status, headers });
}

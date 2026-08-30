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

import { getSettings, listAllEntries } from '../lib/content.js';
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

  const filled = new HTMLRewriter()
    .on('[data-cms]', new TextSlot(values))
    .on('[data-cms-attr]', new AttrSlot(values))
    .on('[data-cms-if]', new HideEmpty(values))
    .transform(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }));

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // content can change at any moment, so revalidate rather than hold; the
  // assets the page references are still immutable and cached hard
  headers.set('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  headers.delete('content-length');

  return new Response(filled.body, { status: response.status, headers });
}

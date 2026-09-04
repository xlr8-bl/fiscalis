/**
 * content.js — reading and writing everything that is not an article.
 */

import { collection, sanitiseEntry } from './collections.js';

/* ---------------------------------------------------------------- settings */

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const row of results ?? []) out[row.key] = row.value;
  return out;
}

export async function setSetting(db, key, value, who) {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES (?1, ?2, ?3, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_by = excluded.updated_by,
         updated_at = datetime('now')`
    )
    .bind(key, String(value ?? '').slice(0, 4000), who)
    .run();
}

/**
 * Is the site currently showing one page with one thing to do?
 *
 * Asked in four places — the home page, the journal index, an article and
 * the sitemap — so it is answered once. A setting stores a string, and
 * every honest way of writing "no" has to mean no: an unset key, an empty
 * string, and the word `off` left behind by a toggle that has been turned
 * back off all have to read the same, or the site hides itself and nobody
 * can tell why.
 */
export const isBookingOnly = (settings) => settings?.['site.bookingOnly'] === 'on';

/**
 * The journal's answer while the site is showing one thing only.
 *
 * A 302 rather than a 404 or a noindex, because this is temporary and
 * search engines treat those three very differently: a 404 drops the URL
 * and loses whatever it had earned, a noindex on a page that still renders
 * is a page a visitor can still wander into, and a temporary redirect says
 * exactly what is true — this is somewhere else for now, keep the address.
 *
 * Never cached. The whole point of the setting is that it takes effect
 * when he throws it, and a cached redirect would outlive the mode.
 *
 * Returns null when the site is showing normally, so a route reads:
 *
 *     const away = await bookingOnlyRedirect(env);
 *     if (away) return away;
 */
export async function bookingOnlyRedirect(db, { unless = false } = {}) {
  // the studio's preview link has to keep working while the mode is on,
  // or he cannot see what he is about to publish
  if (unless || !db) return null;
  const settings = await getSettings(db).catch(() => null);
  if (!settings || !isBookingOnly(settings)) return null;
  return new Response(null, {
    status: 302,
    headers: { location: '/book', 'cache-control': 'no-store' },
  });
}

/* ----------------------------------------------------------------- entries */

const parse = (row) => ({
  ...row,
  data: (() => {
    try { return JSON.parse(row.data); } catch { return {}; }
  })(),
});

/** Published entries of one collection, in order — what the site renders. */
export async function listEntries(db, name, { includeDrafts = false } = {}) {
  const sql = includeDrafts
    ? `SELECT * FROM entries WHERE collection = ?1 ORDER BY position, id`
    : `SELECT * FROM entries WHERE collection = ?1 AND status = 'published'
       ORDER BY position, id`;
  const { results } = await db.prepare(sql).bind(name).all();
  return (results ?? []).map(parse);
}

/** Every collection at once, for rendering the home page in one round trip. */
export async function listAllEntries(db) {
  const { results } = await db
    .prepare(
      `SELECT * FROM entries WHERE status = 'published' ORDER BY collection, position, id`
    )
    .all();
  const out = {};
  for (const row of results ?? []) {
    (out[row.collection] ||= []).push(parse(row));
  }
  return out;
}

export async function getEntry(db, name, slug) {
  const row = await db
    .prepare('SELECT * FROM entries WHERE collection = ?1 AND slug = ?2')
    .bind(name, slug)
    .first();
  return row ? parse(row) : null;
}

const slugify = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

async function uniqueSlug(db, name, base, ignoreId = null) {
  const root = slugify(base) || 'item';
  let slug = root;
  let n = 2;
  for (;;) {
    const row = await db
      .prepare('SELECT id FROM entries WHERE collection = ?1 AND slug = ?2')
      .bind(name, slug)
      .first();
    if (!row || (ignoreId != null && row.id === ignoreId)) return slug;
    slug = `${root}-${n++}`;
  }
}

export async function createEntry(db, name, input, who, status = 'published') {
  const def = collection(name);
  if (!def) return null;
  const data = sanitiseEntry(name, input);
  const slug = await uniqueSlug(db, name, input?.slug || data[def.titleField]);

  const { position } = (await db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM entries WHERE collection = ?1')
    .bind(name)
    .first()) ?? { position: 0 };

  await db
    .prepare(
      `INSERT INTO entries (collection, slug, position, status, data, author, last_editor)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`
    )
    .bind(name, slug, position, status, JSON.stringify(data), who)
    .run();

  return { collection: name, slug, position, status };
}

export async function updateEntry(db, name, slug, input, who) {
  const existing = await getEntry(db, name, slug);
  if (!existing) return null;
  // merge, so a caller sending one field does not wipe the rest
  const data = { ...existing.data, ...sanitiseEntry(name, input) };

  await db
    .prepare(
      `UPDATE entries SET data = ?1, last_editor = ?2, updated_at = datetime('now')
       WHERE collection = ?3 AND slug = ?4`
    )
    .bind(JSON.stringify(data), who, name, slug)
    .run();

  return { collection: name, slug, data };
}

export async function setEntryStatus(db, name, slug, status, who) {
  await db
    .prepare(
      `UPDATE entries SET status = ?1, last_editor = ?2, updated_at = datetime('now')
       WHERE collection = ?3 AND slug = ?4`
    )
    .bind(status, who, name, slug)
    .run();
}

export async function deleteEntry(db, name, slug) {
  await db
    .prepare('DELETE FROM entries WHERE collection = ?1 AND slug = ?2')
    .bind(name, slug)
    .run();
}

/** Reorder a whole collection from an array of slugs. */
export async function reorder(db, name, slugs) {
  const statements = slugs.map((slug, i) =>
    db
      .prepare('UPDATE entries SET position = ?1 WHERE collection = ?2 AND slug = ?3')
      .bind(i, name, slug)
  );
  if (statements.length) await db.batch(statements);
}

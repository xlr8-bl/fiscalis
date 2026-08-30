/**
 * articles.js — every query the journal makes, in one place.
 *
 * All of them are parameterised. Nothing here interpolates a value into
 * SQL, including the slug, which arrives from the URL.
 */

const LIST_COLUMNS =
  'slug, title, description, tags, status, source, published_at, created_at, updated_at';

/** Published, newest first — the index, the sitemap and the feed. */
export async function listPublished(db, limit = 200) {
  const { results } = await db
    .prepare(
      `SELECT ${LIST_COLUMNS}, body FROM articles
       WHERE status = 'published' AND published_at IS NOT NULL
       ORDER BY published_at DESC, id DESC LIMIT ?1`
    )
    .bind(limit)
    .all();
  return results ?? [];
}

/** Everything, for the studio. */
export async function listAll(db, limit = 500) {
  const { results } = await db
    .prepare(
      `SELECT id, ${LIST_COLUMNS} FROM articles
       ORDER BY (status = 'review') DESC, updated_at DESC LIMIT ?1`
    )
    .bind(limit)
    .all();
  return results ?? [];
}

export async function getBySlug(db, slug, { publishedOnly = true } = {}) {
  const sql = publishedOnly
    ? `SELECT id, ${LIST_COLUMNS}, body FROM articles WHERE slug = ?1 AND status = 'published'`
    : `SELECT id, ${LIST_COLUMNS}, body FROM articles WHERE slug = ?1`;
  return await db.prepare(sql).bind(slug).first();
}

/**
 * Up to `limit` others, shared tags first then newest. Done in JS because
 * tags are a comma list and scoring them in SQLite would cost more clarity
 * than the query saves at this size.
 */
export async function related(db, article, limit = 3) {
  const { results } = await db
    .prepare(
      `SELECT slug, title, tags, published_at FROM articles
       WHERE status = 'published' AND slug != ?1
       ORDER BY published_at DESC LIMIT 40`
    )
    .bind(article.slug)
    .all();

  const mine = new Set(String(article.tags || '').split(',').map((t) => t.trim()).filter(Boolean));
  const overlap = (row) =>
    String(row.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t && mine.has(t)).length;

  // already newest-first from SQL; a stable sort by overlap keeps that order
  // inside each group
  return (results ?? []).sort((a, b) => overlap(b) - overlap(a)).slice(0, limit);
}

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

/** A slug not already taken, by appending -2, -3, … */
export async function uniqueSlug(db, base, ignoreId = null) {
  const root = slugify(base) || 'article';
  let slug = root;
  let n = 2;
  for (;;) {
    const row = await db.prepare('SELECT id FROM articles WHERE slug = ?1').bind(slug).first();
    if (!row || (ignoreId != null && row.id === ignoreId)) return slug;
    slug = `${root}-${n++}`;
  }
}

/**
 * articles.js — every query the journal makes, in one place.
 *
 * All of them are parameterised. Nothing here interpolates a value into
 * SQL, including the slug, which arrives from the URL.
 */

/*
 * `cover` is selected everywhere rather than only where it is drawn.
 *
 * The index needs it for the card, the article page for the picture at
 * the top, the sitemap and the feed for the image entry — and every one
 * of those goes through one of the three queries below. A column added
 * to only some of them is how an article gets a photograph on its own
 * page and the generated cover on the card beside it.
 */
const COLUMNS =
  'slug, title, description, tags, status, source, published_at, ' +
  'author, last_editor, created_at, updated_at';

const WITH_COVER = `${COLUMNS}, cover`;

/**
 * Run a query that wants `cover`, and survive a database that has not
 * got it yet.
 *
 * A deployment is code first and schema second: this ships, and the
 * column arrives when somebody presses Set up. In between, every page of
 * the journal was a 500 — the index, every article, the sitemap and the
 * feed, all at once, on a site that was working a minute earlier.
 *
 * So the column is asked for, and if SQLite says there is no such
 * column the same query runs without it. One wasted round trip on an
 * out-of-date database, none on a current one, and the journal stays up
 * either way. `cover` comes back as '' in the fallback, which is what
 * coverFor() already reads as "use the one drawn from the headline".
 *
 * This is the third time the same shape has been needed here — the
 * design columns, the bookings table, and now this — which is why it is
 * a helper rather than another try/catch.
 */
const noSuchColumn = (err) => /no such column|has no column named/i.test(String(err?.message ?? err));

async function selecting(db, build, bind, { one = false } = {}) {
  const run = async (cols) => {
    const stmt = db.prepare(build(cols)).bind(...bind);
    return one ? await stmt.first() : ((await stmt.all()).results ?? []);
  };
  try {
    return await run(WITH_COVER);
  } catch (err) {
    if (!noSuchColumn(err)) throw err;
    const got = await run(COLUMNS);
    if (!got) return got;
    return one ? { ...got, cover: '' } : got.map((r) => ({ ...r, cover: '' }));
  }
}

/** Published, newest first — the index, the sitemap and the feed. */
export async function listPublished(db, limit = 200) {
  return selecting(
    db,
    (cols) =>
      `SELECT ${cols}, body FROM articles
       WHERE status = 'published' AND published_at IS NOT NULL
       ORDER BY published_at DESC, id DESC LIMIT ?1`,
    [limit]
  );
}

/** Everything, for the studio. */
export async function listAll(db, limit = 500) {
  return selecting(
    db,
    (cols) =>
      `SELECT id, ${cols} FROM articles
       ORDER BY (status = 'review') DESC, updated_at DESC LIMIT ?1`,
    [limit]
  );
}

export async function getBySlug(db, slug, { publishedOnly = true } = {}) {
  return selecting(
    db,
    (cols) =>
      publishedOnly
        ? `SELECT id, ${cols}, body FROM articles WHERE slug = ?1 AND status = 'published'`
        : `SELECT id, ${cols}, body FROM articles WHERE slug = ?1`,
    [slug],
    { one: true }
  );
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

/**
 * Drop the edge cache for the pages an article change affects.
 *
 * The index, the sitemap and the feed all list every published article,
 * so any change to one of them is a change to all three. Without this a
 * post is live in the database and invisible on the site until the
 * cache expires, which reads as "publish did not work".
 *
 * Lives here rather than in the studio route because the MCP endpoint
 * publishes too now, and two copies of a cache-invalidation list is one
 * copy plus a page that goes stale.
 */
export async function purgeArticle(site, slug) {
  const cache = caches.default;
  const urls = [`${site}/journal/`, `${site}/sitemap.xml`, `${site}/feed.xml`];
  if (slug) urls.push(`${site}/journal/${slug}`);
  await Promise.allSettled(urls.map((u) => cache.delete(new Request(u))));
}

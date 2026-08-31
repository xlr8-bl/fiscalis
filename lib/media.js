/**
 * media.js — the uploaded images.
 *
 * The bytes live in R2. This table is the index: what was uploaded, how
 * big it is in pixels, and what it shows.
 */

/** `/media/<key>` is the public path; `key` is what R2 and this table use. */
export const PREFIX = '/media/';
export const keyFromPath = (path) =>
  String(path ?? '').startsWith(PREFIX) ? String(path).slice(PREFIX.length) : null;

/** Every image the body actually references, as R2 keys. */
export function referenced(body) {
  const out = new Set();
  for (const m of String(body ?? '').matchAll(/!\[[^\]]*\]\(\s*([^)\s"]+)/g)) {
    const key = keyFromPath(m[1]);
    if (key) out.add(key);
  }
  return [...out];
}

/**
 * Pixel sizes for the images one article uses, as `{ '/media/x.png': {width,
 * height} }` — the shape renderMarkdown wants.
 *
 * Only the images that article references are fetched, so a library of a
 * thousand pictures costs the same as a library of three.
 *
 * A database predating the width column returns null rather than throwing:
 * the images still render, they just reflow as they load, which is a worse
 * page and not a broken one.
 */
export async function sizesFor(db, body) {
  const keys = referenced(body);
  if (!db || !keys.length) return null;

  const holes = keys.map((_, i) => `?${i + 1}`).join(', ');
  try {
    const { results } = await db
      .prepare(`SELECT key, width, height FROM media WHERE key IN (${holes})`)
      .bind(...keys)
      .all();
    const out = {};
    for (const r of results ?? []) {
      if (r.width > 0 && r.height > 0) out[PREFIX + r.key] = { width: r.width, height: r.height };
    }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    if (/no such column|no such table/i.test(String(e?.message ?? e))) return null;
    throw e;
  }
}

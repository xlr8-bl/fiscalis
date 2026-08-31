/**
 * revisions.js — what a thing looked like before the last save.
 *
 * A row is written *before* each change, holding the previous state. So the
 * newest revision is what you would get back by undoing once, and an item
 * that has never been edited has no revisions at all.
 *
 * This matters more here than in most content stores, because an agent
 * writes into the same tables a person does. Restoring is what makes that
 * an acceptable arrangement.
 */

/** How many to keep per item. Enough to undo a bad afternoon. */
const KEEP = 40;

export const articleRef = (slug) => String(slug);
export const entryRef = (collection, slug) => `${collection}/${slug}`;

const parse = (row) => ({
  ...row,
  data: (() => {
    try { return JSON.parse(row.data); } catch { return {}; }
  })(),
});

/**
 * Store the state something is in *now*, before it is overwritten.
 *
 * Never lets a history failure fail the save: an edit that goes through
 * without being recorded is a smaller problem than an edit refused because
 * the history table is missing.
 */
export async function record(db, kind, ref, data, editor, note = 'saved') {
  try {
    await db
      .prepare(
        `INSERT INTO revisions (kind, ref, data, editor, note) VALUES (?1, ?2, ?3, ?4, ?5)`
      )
      .bind(kind, ref, JSON.stringify(data ?? {}), String(editor ?? ''), String(note).slice(0, 40))
      .run();

    // keep the tail bounded, so a page edited daily for a year is still
    // one short list rather than a scroll
    await db
      .prepare(
        `DELETE FROM revisions WHERE kind = ?1 AND ref = ?2 AND id NOT IN (
           SELECT id FROM revisions WHERE kind = ?1 AND ref = ?2 ORDER BY id DESC LIMIT ?3
         )`
      )
      .bind(kind, ref, KEEP)
      .run();
    return true;
  } catch (e) {
    if (/no such table/i.test(String(e?.message ?? e))) return false;
    throw e;
  }
}

/** Newest first. Without the payload — the list only needs the labels. */
export async function list(db, kind, ref, limit = KEEP) {
  try {
    const { results } = await db
      .prepare(
        `SELECT id, editor, note, created_at, length(data) AS size
         FROM revisions WHERE kind = ?1 AND ref = ?2 ORDER BY id DESC LIMIT ?3`
      )
      .bind(kind, ref, limit)
      .all();
    return results ?? [];
  } catch (e) {
    if (/no such table/i.test(String(e?.message ?? e))) return [];
    throw e;
  }
}

/** One revision, with its payload, scoped to the thing it belongs to. */
export async function get(db, kind, ref, id) {
  const row = await db
    .prepare('SELECT * FROM revisions WHERE id = ?1 AND kind = ?2 AND ref = ?3')
    .bind(Number(id), kind, ref)
    .first();
  return row ? parse(row) : null;
}

/** Move a whole history when something is renamed, so it is not orphaned. */
export async function rename(db, kind, from, to) {
  if (from === to) return;
  try {
    await db
      .prepare('UPDATE revisions SET ref = ?1 WHERE kind = ?2 AND ref = ?3')
      .bind(to, kind, from)
      .run();
  } catch (e) {
    if (!/no such table/i.test(String(e?.message ?? e))) throw e;
  }
}

export async function drop(db, kind, ref) {
  try {
    await db.prepare('DELETE FROM revisions WHERE kind = ?1 AND ref = ?2').bind(kind, ref).run();
  } catch (e) {
    if (!/no such table/i.test(String(e?.message ?? e))) throw e;
  }
}

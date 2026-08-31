/**
 * corrections.js — settings that were seeded wrong.
 *
 * The seed inserts with WHERE NOT EXISTS, so it never overwrites anything.
 * That is right: it must not walk over an edit. But it also means a value
 * that was seeded from a mistake in the markup stays wrong for good, in
 * every database that was set up before the mistake was found.
 *
 * A correction is narrower than a re-seed. It writes only where the stored
 * value is still, byte for byte, the wrong one — so it repairs a value
 * nobody chose, and leaves alone any value someone has since edited, even
 * back to the same words.
 *
 * Applied by the setup endpoint, which is safe to run again at any time.
 */

/**
 * The statement as it should read. The break is a real newline because the
 * seed is built by reading the markup, where it was a <br>.
 */
const GAP_HEADING =
  'Most business websites are not broken in ways anybody notices. They leak, ' +
  'quietly, in the gap between what a customer wants and what the site lets ' +
  'them do. \n\nI find the leak first. Then I build the thing that closes it.';

/**
 * And the run that had been pasted in front of it. Writing the wrong value
 * as the right one plus the stray text keeps the two from drifting apart,
 * and says what the mistake actually was.
 */
const GAP_STRAY =
  'Most business websites are not broken in ways anybody notices. They leak, ' +
  'quietly, in the gap between what a customer wants and what the site lets ' +
  'them do. I find the leak first. Then I build the thing that closes it. ';

export const CORRECTIONS = [
  {
    key: 'gap.heading',
    // The passage was pasted twice into index.html, and the seed is built by
    // reading index.html, so the duplicate reached every database.
    was: GAP_STRAY + GAP_HEADING,
    now: GAP_HEADING,
  },
];

/**
 * @returns {Promise<string[]>} the keys actually put right
 */
export async function applyCorrections(db) {
  const fixed = [];
  for (const { key, was, now } of CORRECTIONS) {
    try {
      const result = await db
        .prepare('UPDATE settings SET value = ?1 WHERE key = ?2 AND value = ?3')
        .bind(now, key, was)
        .run();
      // D1 reports the row count differently between versions; either shape
      // is fine, and a correction that matched nothing is the normal case
      const changed = result?.meta?.changes ?? result?.changes ?? 0;
      if (changed > 0) fixed.push(key);
    } catch {
      // a database without the settings table yet has nothing to correct
    }
  }
  return fixed;
}

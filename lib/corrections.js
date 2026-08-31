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
 * Entries whose slug moved because their text changed.
 *
 * A settings correction is a value; this is a row that has to be renamed.
 * The seed inserts WHERE NOT EXISTS on (collection, slug), so a question
 * that was reworded arrives as a *second* row rather than replacing the
 * first — leaving the old wording on the page beside the new one. Renaming
 * it here, before the seed runs, is what stops that.
 *
 * The match is on both fields, not on the row: if either the question or
 * the answer has been edited since, nothing happens and the seed adds the
 * new one alongside. That is the same bargain the settings corrections
 * make — never walk over an edit, even at the cost of leaving a duplicate
 * for a person to delete.
 */
export const ENTRY_CORRECTIONS = [
  {
    collection: 'faqs',
    from: 'is-there-a-cheaper-package',
    to: 'can-this-be-scoped-smaller',
    // "package" is price language, which the brand spec bans outright
    wasQuestion: 'Is there a cheaper package?',
    wasAnswer:
      'No. There is no basic tier and no template option, because I do not sell one.'
      + '\n\nEvery build is written for the business it belongs to.',
    now: {
      question: 'Can this be scoped smaller?',
      answer:
        'Yes. The scope is whatever the problem turns out to need, and a single '
        + 'system can be fixed on its own.\n\nWhat there is no smaller version of '
        + 'is the build itself. Nothing here sits on a template.',
    },
  },
  {
    collection: 'faqs',
    from: 'how-do-we-communicate',
    to: 'how-do-you-keep-me-updated',
    // "we" reads as a team, and there is not one
    wasQuestion: 'How do we communicate?',
    wasAnswer:
      'A shared space for timelines and deliverables, async updates through the '
      + 'week, and calls kept for decisions that need them.\n\nEvery message '
      + 'reaches me directly.',
    now: {
      question: 'How do you keep me updated?',
      answer:
        'A shared space for timelines and deliverables, async updates through the '
        + 'week, and calls kept for decisions that need them.\n\nEvery message '
        + 'reaches me directly.',
    },
  },
];

/**
 * Rename and rewrite the entries above, where neither field has been
 * touched. Must run before the seed, or the seed has already inserted the
 * new slug and the old row is orphaned rather than renamed.
 *
 * @returns {Promise<string[]>} the slugs actually moved
 */
export async function applyEntryCorrections(db) {
  const moved = [];
  for (const c of ENTRY_CORRECTIONS) {
    try {
      const result = await db
        .prepare(
          `UPDATE entries SET slug = ?1, data = ?2, updated_at = datetime('now')
           WHERE collection = ?3 AND slug = ?4
             AND json_extract(data, '$.question') = ?5
             AND json_extract(data, '$.answer')   = ?6`
        )
        .bind(c.to, JSON.stringify(c.now), c.collection, c.from, c.wasQuestion, c.wasAnswer)
        .run();
      const changed = result?.meta?.changes ?? result?.changes ?? 0;
      if (changed > 0) moved.push(`${c.collection}/${c.from}`);
    } catch {
      // no entries table yet, or a build of SQLite without json_extract
    }
  }
  return moved;
}

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

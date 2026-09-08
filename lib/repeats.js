/**
 * repeats.js — refusing the two things a model with no memory repeats.
 *
 * next_carousel already rotates the hook sheet and hands over the last
 * twenty topics as `do_not_repeat`. That is an instruction, and the
 * pattern here has been established twice already: instructions do not
 * work, refusals do. The hook sheet was asked for three times before it
 * became a refusal, and the outro twice.
 *
 * So both are checked at the point of filing, against what is actually
 * in the database rather than against what an agent remembers being
 * told one call ago.
 */

/** The most recent carousels, whatever state they are in. */
export async function recent(db, limit = 20) {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.slug, c.topic, c.title, c.pillar, s.design
       FROM carousels c LEFT JOIN slides s ON s.carousel_id = c.id AND s.position = 0
       WHERE c.status != 'rejected'
       ORDER BY COALESCE(c.posted_at, c.scheduled_for, c.updated_at) DESC
       LIMIT ?1`
    )
    .bind(limit)
    .all()
    .catch(() => ({ results: [] }));

  return (results ?? []).map((r) => {
    let hook = null;
    try { hook = JSON.parse(r.design || '{}').hook ?? null; } catch { /* unparseable */ }
    return { ...r, hook };
  });
}

/**
 * How many carousels back a sheet is blocked for.
 *
 * Twelve sheets are CHOSEN, so five leaves seven to pick from and the
 * rotation never paints itself into a corner. It also means a reader
 * scrolling a profile does not meet the same poster twice in a week.
 */
export const HOOK_COOLDOWN = 5;

/* Words that carry no subject. Two topics sharing "the", "your" and
   "site" are not the same topic; two sharing "contact", "form" and
   "enquiries" are. */
const EMPTY = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does',
  'for', 'from', 'has', 'have', 'how', 'i', 'in', 'is', 'it', 'its', 'me',
  'my', 'no', 'not', 'of', 'on', 'one', 'or', 'that', 'the', 'their', 'them',
  'then', 'they', 'this', 'to', 'up', 'was', 'what', 'when', 'why', 'will',
  'with', 'you', 'your', 'yours', 'about', 'into', 'out', 'own', 'more',
  'most', 'some', 'any', 'every', 'all', 'nobody', 'anybody', 'somebody',
  'site', 'sites', 'website', 'websites', 'page', 'pages', 'web',
]);

/* Crude singularising, because "forms" against "form" shared nothing
   and the two topics were the same topic. Not a stemmer: a stemmer
   would collapse words a person can see are different, and a refusal
   nobody understands gets worked around rather than learned from. */
const stem = (w) => {
  const s = w
    .replace(/(ss|us|is)$/, '$1')
    .replace(/ies$/, 'y')
    .replace(/(ch|sh|s|x|z)es$/, '$1')
    .replace(/([^s])s$/, '$1');
  /* Gerunds too: he writes "the form emailing nobody" one week and "the
     form that emails nobody" the next, and those are one subject. Only
     when four letters survive, so "thing" and "spring" are left alone. */
  const m = /^(.{4,})(ing|ed)$/.exec(s);
  return m ? m[1] : s;
};

const significant = (text) => new Set(
  (String(text ?? '').toLowerCase().match(/[a-z']{3,}/g) ?? [])
    .filter((w) => !EMPTY.has(w))
    .map(stem)
    .filter((w) => w.length >= 3 && !EMPTY.has(w))
);

/**
 * Two topics that are the same topic.
 *
 * Deliberately crude and deliberately explainable: the words that carry
 * the subject, overlapping. A cleverer measure would refuse things a
 * person could not see the reason for, and a refusal nobody understands
 * gets worked around rather than learned from.
 *
 * Both thresholds have to trip. The proportion alone refuses a
 * three-word topic that happens to share two words; the count alone
 * refuses a long topic that shares three words out of twenty.
 */
export function tooClose(topic, before) {
  const mine = significant(topic);
  if (mine.size < 3) return null;
  for (const row of before) {
    const theirs = significant(`${row.topic ?? ''} ${row.title ?? ''}`);
    if (!theirs.size) continue;
    const shared = [...mine].filter((w) => theirs.has(w));
    if (shared.length >= 3 && shared.length / mine.size >= 0.6) {
      return { row, shared };
    }
  }
  return null;
}

/**
 * @returns {string[]} refusals, each naming what was repeated and what
 *   is free instead. Empty means nothing was repeated.
 */
export function repeats({ hook, topic }, before, allHooks) {
  const out = [];

  if (hook) {
    const lately = before.slice(0, HOOK_COOLDOWN).map((r) => r.hook).filter(Boolean);
    if (lately.includes(hook)) {
      const free = allHooks.filter((h) => !lately.includes(h));
      out.push(
        `Slide 1 uses ${hook} and so did one of the last ${HOOK_COOLDOWN} carousels. `
        + 'A reader scrolling the profile meets the same poster twice, which is the '
        + 'one thing that makes a run of posts look automated. next_carousel names '
        + `the sheet that has gone longest without being used. Free right now: `
        + `${free.join(', ') || 'none — every sheet is in the last five, which cannot '
        + 'happen with twelve of them and means something is wrong'}.`
      );
    }
  }

  if (topic) {
    const hit = tooClose(topic, before);
    if (hit) {
      out.push(
        `This topic is the one in "${hit.row.slug}" again — both are about `
        + `${hit.shared.join(', ')}. Write about something else, or come at THIS `
        + 'from an angle that changes what the reader does differently by the end. '
        + 'next_carousel returns do_not_repeat and an angle for exactly this.'
      );
    }
  }

  return out;
}

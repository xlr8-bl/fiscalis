/**
 * pillars.js — which subjects actually land, from his own posts.
 *
 * I went looking for research on what converts for a service business
 * and found nothing worth putting in the code. Every result was a
 * marketing blog asserting that educational content outperforms
 * promotional, with no method, no sample and no number — several of them
 * citing each other. HOW_TO_CLOSE already says this about the closing
 * research: the sources in this area cite no primary source and two of
 * them give save rates differing by a factor of four.
 *
 * So the rotation is not going to be weighted by somebody's blog. It is
 * weighted by his own account, which is the only sample that is about
 * his audience and the only one whose method can be said out loud:
 * post_stats holds what each carousel did, carousels holds which pillar
 * it came from, and joining them says which subjects his readers keep.
 *
 * WHAT IS MEASURED, AND WHAT IS NOT. There is no line from a post to a
 * booking, so nothing here can say a pillar converts. What it can say is
 * which subjects get SAVED, and a save is the strongest intent signal in
 * the data: it is a reader saying they will come back to this. Likes are
 * noise and reach is distribution rather than response, so neither
 * ranks anything.
 */

/** Below this a rate is one post having a good day, not a pattern. */
export const ENOUGH = 3;

/**
 * Per pillar: how many carousels went out, and what they did.
 *
 * Rates are per thousand reached rather than raw totals, because a
 * pillar posted six times has six times the raw saves of one posted
 * once and is not necessarily better.
 */
export async function pillarPerformance(db) {
  const { results } = await db
    .prepare(
      `SELECT c.pillar AS pillar,
              count(DISTINCT c.id) AS posts,
              sum(s.saves)  AS saves,
              sum(s.shares) AS shares,
              sum(s.reach)  AS reach
       FROM carousels c JOIN post_stats s ON s.carousel_id = c.id
       WHERE c.pillar IS NOT NULL AND c.pillar != ''
       GROUP BY c.pillar`
    )
    .all()
    .catch(() => ({ results: [] }));

  return (results ?? []).map((r) => {
    const reach = Number(r.reach) || 0;
    const per = (n) => (reach >= 1000 ? (Number(n) || 0) / (reach / 1000) : null);
    return {
      pillar: r.pillar,
      posts: Number(r.posts) || 0,
      reach,
      saves: Number(r.saves) || 0,
      shares: Number(r.shares) || 0,
      saves_per_1k: per(r.saves),
      shares_per_1k: per(r.shares),
      /* Said out loud rather than left for a reader to work out, because
         a figure with no sample behind it is the thing this file exists
         to avoid producing. */
      enough_to_judge: (Number(r.posts) || 0) >= ENOUGH && reach >= 1000,
    };
  }).sort((a, b) => (b.saves_per_1k ?? -1) - (a.saves_per_1k ?? -1));
}

/**
 * The pillar to write next.
 *
 * Recency first, always: a pillar not used in the last twenty carousels
 * wins outright whatever it has done, because a feed of one subject is
 * worse than a feed of a middling one. Performance only breaks the tie
 * between pillars that are equally due, and only using rows with enough
 * behind them to mean anything.
 *
 * @returns {{ pillar, why }} the choice and the reason, which goes back
 *   to Spark so the rotation is legible rather than magic.
 */
export function pickPillar(all, recentPillars, stats = []) {
  if (!all.length) return { pillar: null, why: 'No pillars are active.' };

  const unused = all.filter((p) => !recentPillars.includes(p.slug));
  const pool = unused.length ? unused : all;

  const judged = new Map(
    stats.filter((s) => s.enough_to_judge).map((s) => [s.pillar, s]),
  );
  const scored = pool
    .map((p) => ({ p, s: judged.get(p.slug) }))
    .filter((x) => x.s)
    .sort((a, b) => b.s.saves_per_1k - a.s.saves_per_1k);

  if (scored.length) {
    const best = scored[0];
    return {
      pillar: best.p,
      why: `Due for rotation, and of the pillars that are due this one is saved `
        + `most: ${best.s.saves_per_1k.toFixed(1)} saves per thousand reached over `
        + `${best.s.posts} posts. Saves rank it because a save is a reader saying `
        + 'they will come back to it; likes are noise and reach is distribution.',
    };
  }

  return {
    pillar: pool[0],
    why: unused.length
      ? 'It has gone longest without being written. Nothing has been posted often '
        + `enough yet to rank pillars by how they do — that needs ${ENOUGH} posts and `
        + 'a thousand reached before a rate means anything.'
      : 'Every pillar has been used lately, so this is the one at the top of the '
        + 'list. Rotation has wrapped around.',
  };
}

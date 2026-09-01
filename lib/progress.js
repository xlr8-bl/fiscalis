/**
 * progress.js — where everything stands, in one call.
 *
 * Spark runs the pipeline but does not remember it: each scheduled task
 * wakes with no idea what yesterday did or whether the thing it filed
 * this morning was approved. Asking it to piece that together out of
 * list_carousels and queue means five round trips and a guess.
 *
 * So this is the answer to "how is it going" written once — the counts,
 * what is stuck on a person, what goes out next, what went out already,
 * what failed, and whether the accounts and the kit are actually in a
 * state that can produce a post at all.
 *
 * It reads. It changes nothing.
 */

import { statsFor, total } from './insights.js';
import { accountState } from './tokens.js';

const STATUSES = [
  'planned', 'generating', 'review', 'changes',
  'approved', 'scheduled', 'posted', 'rejected',
];

export async function progress(db, env, { site = '' } = {}) {
  const { results: counts } = await db
    .prepare('SELECT status, count(*) AS n FROM carousels GROUP BY status')
    .all();
  const board = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of counts ?? []) board[r.status] = r.n;

  // what is stuck on a person, oldest first — this is the only queue that
  // an agent cannot clear itself, so it goes first
  const { results: waiting } = await db
    .prepare(
      `SELECT slug, title, pillar, updated_at FROM carousels
       WHERE status = 'review' ORDER BY updated_at LIMIT 25`
    )
    .all();

  const { results: next } = await db
    .prepare(
      `SELECT slug, title, slot, scheduled_for, targets FROM carousels
       WHERE status = 'scheduled' ORDER BY scheduled_for IS NULL, scheduled_for LIMIT 25`
    )
    .all();

  // approved but with no slot: ready and going nowhere, which is the
  // failure mode that looks like everything is fine
  const { results: idle } = await db
    .prepare(
      `SELECT slug, title, updated_at FROM carousels
       WHERE status = 'approved' ORDER BY updated_at LIMIT 25`
    )
    .all();

  const { results: recent } = await db
    .prepare(
      `SELECT id, slug, title, pillar, posted_at, targets, results FROM carousels
       WHERE status = 'posted' AND posted_at IS NOT NULL
       ORDER BY posted_at DESC LIMIT 25`
    )
    .all();

  const stats = await statsFor(db, (recent ?? []).map((r) => r.id));

  const posted = (recent ?? []).map((r) => {
    let out = {};
    try { out = JSON.parse(r.results || '{}'); } catch { /* it stays empty */ }
    const failed = Object.entries(out)
      .filter(([, v]) => v && !v.ok && !v.skipped)
      .map(([name, v]) => `${name}: ${v.error}`);
    const numbers = stats[r.id] || {};
    return {
      slug: r.slug,
      title: r.title,
      pillar: r.pillar,
      posted_at: r.posted_at,
      went_to: Object.entries(out).filter(([, v]) => v?.ok).map(([name]) => name),
      ...(failed.length ? { did_not_go_to: failed } : {}),
      ...(Object.keys(numbers).length
        ? { numbers: total(numbers), by_platform: numbers }
        : {}),
      url: site ? `${site}/studio#/social/${encodeURIComponent(r.slug)}` : '',
    };
  });

  // slides the agent still owes, and slides a person sent back
  const { results: work } = await db
    .prepare(
      `SELECT sum(CASE WHEN s.state = 'pending' THEN 1 ELSE 0 END) AS pending,
              sum(CASE WHEN s.state = 'redo'    THEN 1 ELSE 0 END) AS redo,
              sum(CASE WHEN s.state = 'failed'  THEN 1 ELSE 0 END) AS failed
       FROM slides s JOIN carousels c ON c.id = s.carousel_id
       WHERE c.status IN ('planned', 'generating', 'changes')`
    )
    .all();
  const slides = work?.[0] ?? {};

  const kit = await db
    .prepare(
      `SELECT sum(CASE WHEN role = 'likeness'  THEN 1 ELSE 0 END) AS likeness,
              sum(CASE WHEN role = 'aesthetic' THEN 1 ELSE 0 END) AS aesthetic
       FROM brand_refs WHERE active = 1`
    )
    .first();
  const pillarCount = await db
    .prepare('SELECT count(*) AS n FROM pillars WHERE active = 1')
    .first();

  const accounts = await accountState(db, env);

  /*
   * The blockers. Everything above is a number; this is the part that
   * says what to do about it, because a status board nobody can act on
   * is just a status board.
   */
  const blocking = [];
  if (!(pillarCount?.n ?? 0)) {
    blocking.push('No pillars are set, so there is nothing to plan against. They are set in the studio.');
  }
  if (!(kit?.likeness ?? 0) && !(kit?.aesthetic ?? 0)) {
    blocking.push('The brand kit is empty. Use add_reference to put the likeness and aesthetic images in.');
  } else if (!(kit?.likeness ?? 0)) {
    blocking.push('There are no likeness references, so the image model has no face to work from. Use add_reference with role "likeness".');
  }
  if (!accounts.instagram.connected && !accounts.tiktok.connected) {
    blocking.push('No account is connected, so nothing can be posted. They are connected in the studio under Social, Accounts.');
  }
  if (board.review) {
    blocking.push(
      `${board.review} carousel${board.review === 1 ? ' is' : 's are'} waiting on a person. `
      + 'Nothing goes out until they are approved.'
    );
  }
  if (board.approved) {
    blocking.push(
      `${board.approved} approved carousel${board.approved === 1 ? ' has' : 's have'} no slot, `
      + 'so nothing will post them.'
    );
  }
  if (accounts.instagram.connected
      && accounts.instagram.expires_in_days !== null
      && accounts.instagram.expires_in_days < 7) {
    blocking.push(`The Instagram token expires in ${accounts.instagram.expires_in_days} day(s) and could not be renewed.`);
  }
  if (accounts.tiktok.connected && !accounts.tiktok.can_renew) {
    blocking.push('TikTok has no client key and secret set, so its token cannot be renewed and will die within a day.');
  }

  return {
    board,
    slides: {
      to_draw: slides.pending ?? 0,
      asked_again: slides.redo ?? 0,
      failed: slides.failed ?? 0,
    },
    waiting_on_a_person: waiting ?? [],
    scheduled: next ?? [],
    approved_with_no_slot: idle ?? [],
    posted,
    kit: { likeness: kit?.likeness ?? 0, aesthetic: kit?.aesthetic ?? 0 },
    pillars: pillarCount?.n ?? 0,
    accounts,
    blocking,
    next_step: nextStep({ board, slides, blocking }),
  };
}

/** One sentence, so a scheduled task does not have to reason it out. */
function nextStep({ board, slides, blocking }) {
  if (blocking.some((b) => b.startsWith('No pillars'))) return 'Nothing can be planned yet.';
  if ((slides.redo ?? 0) > 0) return 'Call queue — a person has asked for slides again.';
  if ((slides.pending ?? 0) > 0) return 'Call queue, then deliver_slide for what it names.';
  if (board.generating || board.planned) return 'Finish the slides that are already planned, then hand_over.';
  if (board.review) return 'Everything is with a person. Call send_digest if the mail has not gone yet.';
  return 'Nothing is in flight. Call brief and plan the day.';
}

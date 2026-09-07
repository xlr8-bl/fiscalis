/**
 * schedule.js — articles that publish themselves later.
 *
 * "Write me a bunch and put them out over the next three days" is one
 * instruction and it used to be a dozen calls, each needing a person to
 * be awake at the right minute. This turns it into: write the drafts,
 * then one call that hands back a timetable.
 *
 * HOW A SCHEDULED ARTICLE IS STORED. It stays in `review` and gets a
 * `publish_at`. There is no fourth status, because adding one to a
 * SQLite CHECK means rebuilding the table on a live database, and
 * because "in review, with a time on it" is exactly what it is. Nothing
 * renders it until the run publishes it, and clearing the time puts it
 * straight back to an ordinary draft awaiting a person.
 *
 * THE SAME THREE RULES AS THE CAROUSEL RUN, for the same reason — it
 * fires with nobody looking:
 *
 *   Only what was scheduled. It reads `review` rows with a time that has
 *   passed, and nothing else.
 *   Never twice. The row is claimed with a conditional UPDATE before the
 *   publish, so two overlapping pokes cannot both run it.
 *   Never silently. A failure clears the time and leaves the reason on
 *   the row, so it lands back in front of a person rather than retrying
 *   into the same wall every five minutes.
 */

import { publishArticle } from './writing.js';

const iso = (d) => d.toISOString().slice(0, 19) + 'Z';

/* Times land on a five minute grid, so five minutes is also the closest
   two posts can be and the smallest the gap can ever bend to. */
const GRAIN = 5;

/* The most that can be timetabled in one call. It is the cap on the whole
   request, not per day: fifty articles over a fortnight is one call, and
   so is fifty in one afternoon, which the window will refuse. */
const MAX_AT_ONCE = 50;

/** How many a window of this shape can actually hold, at best. */
export function capacity({ days = 3, from = 8, to = 20, minGap = 75, perDay = null } = {}) {
  const span = Math.max(1, Math.min(60, Math.floor(days)));
  const lo = Math.max(0, Math.min(23, from));
  const hi = Math.max(lo + 1, Math.min(24, to));
  const minutes = (hi - lo) * 60;
  // the gap bends down to GRAIN, so the true ceiling is the grid itself
  const perDayMax = Math.floor(minutes / GRAIN);
  const capped = perDay ? Math.min(perDayMax, Math.max(1, Math.floor(perDay))) : perDayMax;
  /* `comfortable` has to respect perDay too. Without that cap it
     reported the natural spacing of the WHOLE window and ignored the
     ceiling asked for, so a request for one a day came back "it holds 9
     at a natural spacing and 1 at the absolute limit" — which reads
     backwards, because comfortable can never exceed the total. */
  const natural = Math.floor(minutes / minGap);
  return {
    perDay: capped, total: Math.min(MAX_AT_ONCE, capped * span),
    // what it holds while still looking like a person posted it
    comfortable: Math.min(MAX_AT_ONCE, Math.min(capped, natural) * span),
  };
}

/** Deterministic from a seed, so the same request twice is the same plan. */
function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a ^= a << 13; a >>>= 0;
    a ^= a >> 17;
    a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
}

/**
 * Times to publish `count` things, spread over `days` days starting
 * `startIn` days from now.
 *
 * WHY NOT EVENLY SPACED. A run of posts at 09:00, 12:00, 15:00 on the
 * dot reads as a machine, and it is a machine, but the point of a
 * journal is that a person keeps it. So each slot is placed inside a
 * band and then jittered, with two constraints that matter more than the
 * randomness: no two posts within `minGap` minutes of each other, and
 * nothing outside the daily window.
 *
 * `offset` is the hours the local clock is ahead of UTC, because the
 * window is a human one — nobody means 08:00 UTC when they say morning.
 * Everything returned is UTC.
 */
export function spread({
  count, startIn = 0, days = 3, from = 8, to = 20,
  perDay = null, minGap = 75, offset = 1, seed = Date.now(), now = new Date(),
} = {}) {
  const n = Math.max(1, Math.min(MAX_AT_ONCE, Math.floor(count)));
  const span = Math.max(1, Math.min(60, Math.floor(days)));
  const lo = Math.max(0, Math.min(23, from));
  const hi = Math.max(lo + 1, Math.min(24, to));
  const rnd = rng(seed);

  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);

  /* WHICH DAYS ARE ACTUALLY OPEN, before anything is shared out.
     The first day's window cannot open before now, so asked at half past
     eight in the evening today is shut. Sharing the count out first and
     discovering that afterwards LOST that day's slots: "two across two
     days" came back with one, because day zero's share was dropped
     rather than moved to day one. The caller then refused a request that
     was perfectly satisfiable, and it did it only after about six in the
     evening, which is the worst kind of bug to be told about. */
  const day = (d) => {
    const dayStart = new Date(midnight);
    dayStart.setUTCDate(dayStart.getUTCDate() + startIn + d);
    // fifteen minutes of headroom, or the first one fires as it is read
    const soonest = Math.round((now - dayStart) / 60000) + offset * 60 + 15;
    const openM = Math.max(lo * 60, d === 0 && startIn === 0 ? soonest : 0);
    return { dayStart, openM, closeM: hi * 60 };
  };
  const open = [];
  for (let d = 0; d < span; d++) {
    const w = day(d);
    if (w.openM < w.closeM - 5) open.push({ d, ...w });
  }
  if (!open.length) return [];

  // how many land on each OPEN day: as even as it goes, remainder to the front
  const cap = perDay ? Math.max(1, Math.floor(perDay)) : Infinity;
  const perDayCount = new Array(open.length).fill(0);
  for (let i = 0; i < n; i++) {
    const d = i % open.length;
    if (perDayCount[d] < cap) perDayCount[d]++;
    else {
      const room = perDayCount.findIndex((c) => c < cap);
      if (room === -1) break;           // perDay x days is less than count
      perDayCount[room]++;
    }
  }

  const out = [];

  for (let k = 0; k < open.length; k++) {
    const onThisDay = perDayCount[k];
    if (!onThisDay) continue;
    const { dayStart, openM, closeM } = open[k];
    const band = (closeM - openM) / onThisDay;

    /* The gap has to bend, or it stacks.
       75 minutes is right for three or four posts in a working day and
       arithmetically impossible for forty: twelve hours holds ten of
       them and no more. The old code kept the gap and clamped whatever
       would not fit to the last minute of the window, so asking for
       forty in a day returned forty timestamps of which eleven were
       distinct and twenty-nine were the same evening minute. It looked
       like it had worked.
       So the gap is now whatever the day can actually give, never below
       GRAIN, and a run that still cannot be spread comes back SHORT.
       Short is honest and the caller refuses; stacked is a lie.
       Three fifths of the band rather than all of it, because a gap
       equal to the band eats the jitter: every correction fires, every
       post lands exactly one gap after the last, and forty articles go
       out at a metronomic twenty minute beat. Leaving room under the
       band is what keeps the times looking chosen. */
    const gap = Math.max(GRAIN, Math.min(minGap, Math.floor(band * 0.6)));
    let last = -Infinity;

    for (let i = 0; i < onThisDay; i++) {
      const bandStart = openM + band * i;
      // a fifth of the band is kept clear at each end so a jitter cannot
      // put two adjacent posts back to back across a boundary
      let m = Math.round(bandStart + band * (0.2 + rnd() * 0.6));
      if (m - last < gap) m = last + gap;

      // to the nearest five minutes: a timetable of 14:07 and 16:43 reads
      // as generated, which is the one thing the jitter is avoiding.
      // Rounded before the window test, or a time that rounds up past the
      // close would be kept and then sit outside it.
      m = Math.round(m / GRAIN) * GRAIN;
      if (m <= last) m = last + GRAIN;         // rounding collapsed two into one
      if (m > closeM - 5) break;               // the day is full; do not stack
      last = m;

      const t = new Date(dayStart);
      t.setUTCMinutes(m - offset * 60, 0, 0);  // local window -> UTC
      if (t > now) out.push(iso(t));
    }
  }
  // distinct and in order. The slice is the cap, not a repair: anything
  // duplicated by now would be a bug, and returning fewer is the contract.
  return [...new Set(out)].sort().slice(0, n);
}

/**
 * Put a timetable against a list of slugs.
 *
 * Refuses anything already published rather than skipping it quietly: a
 * schedule that silently dropped one article is worse than one that
 * failed, because you find out three days later.
 */
export async function scheduleArticles(db, { slugs = [], ...opts } = {}) {
  const want = slugs.map((s) => String(s).trim()).filter(Boolean);
  if (!want.length) return { ok: false, reason: 'No slugs given.' };

  const marks = want.map((_, i) => `?${i + 1}`).join(',');
  const { results } = await db
    .prepare(`SELECT slug, title, status, cover FROM articles WHERE slug IN (${marks})`)
    .bind(...want)
    .all();
  const found = results ?? [];

  const missing = want.filter((s) => !found.some((r) => r.slug === s));
  if (missing.length) return { ok: false, reason: `No article with slug: ${missing.join(', ')}` };

  const live = found.filter((r) => r.status === 'published').map((r) => r.slug);
  if (live.length) return { ok: false, reason: `Already published: ${live.join(', ')}` };

  const bare = found.filter((r) => !r.cover).map((r) => r.slug);
  if (bare.length) {
    return { ok: false, reason: `No cover picture: ${bare.join(', ')}. `
      + 'Publishing refuses an article without one, so scheduling it would only '
      + 'fail later with nobody watching.' };
  }

  const times = spread({ count: want.length, ...opts });

  /* Short is the honest answer and it is checked here rather than
     patched: spread would rather return nine times than forty of which
     thirty-one are the same minute. The reason says what the window
     actually holds, because "it does not fit" without a number is a
     message you cannot act on. */
  if (times.length < want.length) {
    const room = capacity(opts);
    return { ok: false, reason: `The window fits ${times.length} of ${want.length}. `
      + `Between ${opts.from ?? 8}:00 and ${opts.to ?? 20}:00 over `
      + `${opts.days ?? 3} day${(opts.days ?? 3) === 1 ? '' : 's'} it holds `
      + `${room.comfortable} at a natural spacing and ${room.total} at the `
      + 'absolute limit. Widen the days, open the hours, or write fewer.' };
  }

  const order = want.slice();
  const now = new Date().toISOString();
  await db.batch(order.map((slug, i) => db
    .prepare(`UPDATE articles SET publish_at = ?1, status = 'review', updated_at = ?3
              WHERE slug = ?2 AND status != 'published'`)
    .bind(times[i], slug, now)));

  return {
    ok: true,
    scheduled: order.map((slug, i) => ({
      slug, at: times[i],
      title: found.find((r) => r.slug === slug)?.title ?? '',
    })),
    note: 'Times are UTC. Nothing is visible until each one comes round, and '
        + 'clearing the time from the studio puts it back to an ordinary draft.',
  };
}

/** Clear a time. The article stays exactly where it was. */
export async function unscheduleArticle(db, slug) {
  const r = await db
    .prepare(`UPDATE articles SET publish_at = '', updated_at = ?2 WHERE slug = ?1`)
    .bind(String(slug), new Date().toISOString())
    .run();
  return { ok: (r.meta?.changes ?? 0) > 0, slug };
}

/*
 * Both reads run on a database that may not have had the migration yet —
 * the column arrives when somebody presses Set up in the studio, and in
 * between the cron fires and the studio renders. An empty queue is the
 * truthful answer there, and a 500 in a cron is one nobody sees.
 * scheduleArticles deliberately does NOT swallow it: a write that cannot
 * happen has to say so.
 */
const noQueue = (e) => {
  if (/no such column|no such table/i.test(String(e?.message || e))) return [];
  throw e;
};

/** The whole timetable, soonest first. */
export async function timetable(db) {
  try {
    const { results } = await db
      .prepare(`SELECT slug, title, publish_at, status FROM articles
                WHERE publish_at != '' AND status != 'published'
                ORDER BY publish_at LIMIT 100`)
      .all();
    return results ?? [];
  } catch (e) { return noQueue(e); }
}

/** Everything past its slot and still waiting. */
export async function dueArticles(db) {
  try {
    const { results } = await db
      .prepare(`SELECT slug, title, publish_at FROM articles
                WHERE status = 'review' AND publish_at != '' AND publish_at <= ?1
                ORDER BY publish_at LIMIT 10`)
      .bind(new Date().toISOString())
      .all();
    return results ?? [];
  } catch (e) { return noQueue(e); }
}

/**
 * Publish whatever is due.
 *
 * The claim is the `publish_at = ''` in the same UPDATE that checks it is
 * still set: whichever poke wins the write is the one that publishes, and
 * the loser sees zero rows changed and moves on. publishArticle re-runs
 * every check against the stored row, so a draft that was edited into a
 * refusal between scheduling and firing is refused here too.
 */
export async function runDueArticles(env) {
  const db = env.DB;
  const rows = await dueArticles(db);
  if (!rows.length) return { ran: false, published: [], failed: [] };

  const published = [];
  const failed = [];
  for (const row of rows) {
    const claim = await db
      .prepare(`UPDATE articles SET publish_at = '' WHERE slug = ?1 AND publish_at != ''`)
      .bind(row.slug)
      .run();
    if ((claim.meta?.changes ?? 0) === 0) continue;   // somebody else has it

    try {
      const out = await publishArticle(env, row.slug);
      if (out?.ok === false) failed.push({ slug: row.slug, reason: out.error, problems: out.problems });
      else published.push({ slug: row.slug, at: row.publish_at });
    } catch (e) {
      failed.push({ slug: row.slug, reason: String(e?.message || e) });
    }
  }
  return { ran: true, published, failed };
}

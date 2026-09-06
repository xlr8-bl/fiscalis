/**
 * routine.js — the standing order for writing, so nobody has to ask.
 *
 * "Write me an article" every week is a chore you forget. This stores
 * the cadence once and turns it into one call Spark makes on its own
 * recurring task: `writing_run` says which subject is next, what to go
 * and find out about it, how many to write, and what to do with them
 * when they are written.
 *
 * WHERE THE CLOCK LIVES. Not here. Spark schedules its own recurring
 * tasks and this deployment has no cron of its own for the journal, so
 * the honest division is: the plan says WHAT and HOW OFTEN in words,
 * Spark's own task fires it. `set_writing_schedule` hands back the exact
 * recurrence to set, because a plan stored here that nobody ever fires
 * is worse than no plan at all — it looks like it is working.
 *
 * The same seven keys are fields in the studio's settings, so the
 * cadence can be changed from a phone without going through Spark.
 */

import { getSetting, putSetting } from './tokens.js';

const KEYS = {
  every: 'writing.every',        // off | daily | weekdays | weekly | fortnightly
  day: 'writing.day',            // mon..sun, for weekly and fortnightly
  at: 'writing.at',              // HH:MM, local
  count: 'writing.count',        // how many per run
  then: 'writing.then',          // review | schedule | publish
  across: 'writing.across',      // days to spread over, when `then` is schedule
  last: 'writing.last',          // ISO of the last run, written by writing_run
};

const EVERY = ['off', 'daily', 'weekdays', 'weekly', 'fortnightly'];
const THEN = ['review', 'schedule', 'publish'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const one = (v, allowed, fallback) =>
  (allowed.includes(String(v ?? '').toLowerCase()) ? String(v).toLowerCase() : fallback);
const num = (v, lo, hi, fallback) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
const time = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v ?? '')) ? String(v) : '09:00');

/** The plan as stored, with every gap filled by a default. */
export async function writingPlan(db) {
  const get = async (k, d) => (await getSetting(db, k)) ?? d;
  return {
    every: one(await get(KEYS.every, 'off'), EVERY, 'off'),
    day: one(await get(KEYS.day, 'tue'), DAYS, 'tue'),
    at: time(await get(KEYS.at, '09:00')),
    count: num(await get(KEYS.count, 1), 1, 12, 1),
    then: one(await get(KEYS.then, 'review'), THEN, 'review'),
    across: num(await get(KEYS.across, 3), 1, 30, 3),
    last: (await get(KEYS.last, '')) || null,
  };
}

/** Said the way a person would say it, for reading back. */
export function inWords(p) {
  if (p.every === 'off') return 'Nothing is scheduled. Writing happens when you ask for it.';
  const when = p.every === 'daily' ? 'every day'
    : p.every === 'weekdays' ? 'every weekday'
      : p.every === 'weekly' ? `every ${p.day}`
        : `every other ${p.day}`;
  const many = p.count === 1 ? 'one article' : `${p.count} articles`;
  const after = p.then === 'publish' ? 'and publish them straight away'
    : p.then === 'schedule' ? `and spread them over the next ${p.across} days`
      : 'and leave them for you to read';
  return `${many} ${when} at ${p.at}, ${after}.`;
}

/**
 * The recurrence to set on Spark's side.
 *
 * Returned as words AND as cron, because Spark takes the words and a
 * person setting this up by hand takes the cron. Both are UTC-agnostic
 * on purpose: the hour is the local one, and whatever fires it applies
 * its own offset.
 */
export function recurrence(p) {
  if (p.every === 'off') return null;
  const [h, m] = p.at.split(':');
  const dow = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }[p.day];
  const cron = p.every === 'daily' ? `${+m} ${+h} * * *`
    : p.every === 'weekdays' ? `${+m} ${+h} * * 1-5`
      : `${+m} ${+h} * * ${dow}`;
  return {
    say: `${inWords(p)} Set a recurring task that calls writing_run at that time.`,
    cron,
    note: p.every === 'fortnightly'
      ? 'Cron has no fortnightly, so this fires weekly. writing_run refuses a '
        + 'second run inside seven days, so the odd weeks come back "not due".'
      : '',
  };
}

/** Store it. Anything not given keeps what it had. */
export async function setWritingPlan(db, patch = {}, who = 'spark') {
  const now = await writingPlan(db);
  const next = {
    every: patch.every !== undefined ? one(patch.every, EVERY, now.every) : now.every,
    day: patch.day !== undefined ? one(patch.day, DAYS, now.day) : now.day,
    at: patch.at !== undefined ? time(patch.at) : now.at,
    count: patch.count !== undefined ? num(patch.count, 1, 12, now.count) : now.count,
    then: patch.then !== undefined ? one(patch.then, THEN, now.then) : now.then,
    across: patch.across !== undefined ? num(patch.across, 1, 30, now.across) : now.across,
  };
  for (const [k, v] of Object.entries(next)) await putSetting(db, KEYS[k], String(v), who);
  return { ...next, last: now.last };
}

/**
 * Is a run due, and what should it do?
 *
 * The guard is `last`, not the clock. Whatever fires this may fire twice
 * (a retried task, a person testing it, a fortnightly plan on a weekly
 * cron), and two runs in one morning is two articles nobody asked for.
 * So a run inside the cadence's own gap is refused, and `force` is there
 * for the one case that is legitimate: a person asking for it now.
 */
export function isDue(p, { now = new Date(), force = false } = {}) {
  if (force) return { due: true, why: 'asked for' };
  if (p.every === 'off') return { due: false, why: 'No writing schedule is set.' };
  if (!p.last) return { due: true, why: 'first run' };
  const gapHours = { daily: 20, weekdays: 20, weekly: 6 * 24, fortnightly: 13 * 24 }[p.every];
  const since = (now - new Date(p.last)) / 3600000;
  return since >= gapHours
    ? { due: true, why: `${Math.floor(since / 24)} days since the last one` }
    : { due: false, why: `The last run was ${Math.round(since)} hours ago; this plan writes `
        + `no more often than every ${Math.round(gapHours / 24)} days.` };
}

/**
 * Finish a scheduled run: publish or queue the drafts it produced.
 *
 * WHY THIS EXISTS AND WHY IT DOES NOT ASK.
 *
 * publish_articles and schedule_articles both stop and ask the account
 * holder, which is right when a person is sitting there. It is useless at
 * six in the morning: an unattended run writes its drafts, reaches the
 * publish step, and waits forever on a confirmation nobody is awake to
 * give. Articles a day old then arrive in a heap when somebody next opens
 * the app.
 *
 * So the consent moves. set_writing_schedule DOES ask, once, and what it
 * asks is the real question: "from now on, may articles go live without
 * me reading them first?" This tool is what that yes authorises. It is
 * deliberately narrow:
 *
 *   It refuses unless a standing order exists. No plan, no publishing.
 *   It does only what the plan says. `review` refuses outright; the other
 *   two are read from the plan, never from the caller, so nothing can ask
 *   it to publish when the plan says schedule.
 *   Every article still passes the full check at its own moment.
 *   The plan is changeable from the studio, in one tap, with no agent
 *   involved. Turning it to `review`, or `off`, ends this immediately.
 */
export async function finishRun(env, slugs = []) {
  const db = env.DB;
  const plan = await writingPlan(db);

  if (plan.every === 'off') {
    return { ok: false, reason: 'There is no writing schedule. Nothing here is '
      + 'authorised to publish on its own. Use publish_articles or '
      + 'schedule_articles, which ask a person.' };
  }
  if (plan.then === 'review') {
    return { ok: false, reason: 'This plan leaves drafts for a person to read. '
      + 'They are in review, which is where they should be. Change `then` to '
      + 'schedule or publish if you want them to go out on their own.' };
  }
  const want = [...new Set(slugs.map((x) => String(x).trim()).filter(Boolean))];
  if (!want.length) return { ok: false, reason: 'No slugs given.' };

  if (plan.then === 'publish') {
    const { publishArticles } = await import('./writing.js');
    const out = await publishArticles(env, want);
    return { ok: out.ok, did: 'published', ...out, under: inWords(plan) };
  }

  const { scheduleArticles } = await import('./schedule.js');
  const out = await scheduleArticles(db, { slugs: want, days: plan.across, startIn: 0 });
  return { ok: out.ok, did: 'scheduled', ...out, under: inWords(plan) };
}

export async function markRun(db, when = new Date()) {
  await putSetting(db, KEYS.last, when.toISOString(), 'spark');
}

/**
 * check_routine.mjs — the standing writing order, and publishing in bulk.
 *
 *   node tools/check_routine.mjs
 *
 * No database and no network. The plan is settings rows, so the stub is
 * a map; publishing in bulk is checked against a stub that refuses one
 * of them, because the interesting question is what happens to the rest.
 */
import {
  writingPlan, setWritingPlan, inWords, recurrence, isDue, markRun,
} from '../lib/routine.js';
import { publishArticles } from '../lib/writing.js';
import { TOOLS } from '../lib/mcp.js';
import { SETTINGS } from '../lib/collections.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

/** settings as a map, which is all routine.js needs of a database. */
function settings(seed = {}) {
  const store = { ...seed };
  return {
    store,
    prepare(q) {
      const stmt = {
        bind(...b) { stmt.b = b; return stmt; },
        first: async () => (q.includes('SELECT value')
          ? (store[stmt.b[0]] !== undefined ? { value: store[stmt.b[0]] } : null)
          : null),
        run: async () => { store[stmt.b[0]] = stmt.b[1]; return { meta: { changes: 1 } }; },
        all: async () => ({ results: [] }),
      };
      return stmt;
    },
  };
}

console.log('\nan unset plan is off, not broken');
{
  const p = await writingPlan(settings());
  ok('every defaults to off', p.every === 'off');
  ok('and the rest have sane defaults',
     p.at === '09:00' && p.count === 1 && p.then === 'review' && p.across === 3);
  ok('it reads as nothing scheduled', /Nothing is scheduled/.test(inWords(p)));
  ok('and there is no recurrence to set', recurrence(p) === null);
}

console.log('\nsetting one');
{
  const db = settings();
  const p = await setWritingPlan(db, { every: 'weekly', day: 'tue', at: '09:30', count: 2, then: 'schedule', across: 5 });
  ok('it comes back as asked',
     p.every === 'weekly' && p.day === 'tue' && p.at === '09:30' && p.count === 2);
  ok('and it is stored under the same keys the studio edits',
     db.store['writing.every'] === 'weekly' && db.store['writing.count'] === '2');

  const said = inWords(p);
  ok('it reads like a person said it', said === '2 articles every tue at 09:30, and spread them over the next 5 days.', said);

  const r = recurrence(p);
  ok('the cron is Tuesday at 09:30', r.cron === '30 9 * * 2', r.cron);
  ok('and it says to point it at writing_run', /writing_run/.test(r.say));

  const half = await setWritingPlan(db, { count: 3 });
  ok('a partial change keeps everything else', half.every === 'weekly' && half.at === '09:30');
  ok('and changes what it was given', half.count === 3);
}

console.log('\nrubbish in is a default, not a crash');
{
  const db = settings();
  const p = await setWritingPlan(db, { every: 'hourly', day: 'someday', at: '25:99', count: 900, then: 'delete' });
  ok('an unknown cadence falls back', p.every === 'off');
  ok('a bad day falls back', p.day === 'tue');
  ok('a bad time falls back', p.at === '09:00');
  ok('a silly count is clamped', p.count === 8, String(p.count));
  ok('an unknown "then" falls back to leaving it for a person', p.then === 'review');
}

console.log('\nthe guard is the last run, not the clock');
{
  const weekly = { every: 'weekly', day: 'tue', at: '09:00', count: 1, then: 'review', across: 3, last: null };
  ok('a plan that has never run is due', isDue(weekly).due === true);

  const NOW = new Date('2026-09-08T09:00:00Z');
  const justRan = { ...weekly, last: '2026-09-08T08:00:00Z' };
  ok('an hour after a run it is not due', isDue(justRan, { now: NOW }).due === false);
  ok('and it says why', /no more often than/.test(isDue(justRan, { now: NOW }).why));
  ok('unless a person asks', isDue(justRan, { now: NOW, force: true }).due === true);

  const lastWeek = { ...weekly, last: '2026-09-01T09:00:00Z' };
  ok('a week later it is due again', isDue(lastWeek, { now: NOW }).due === true);

  // The failure this catches: cron has no fortnightly, so a fortnightly
  // plan runs on a weekly trigger and would write twice as much as asked.
  const fort = { ...weekly, every: 'fortnightly', last: '2026-09-01T09:00:00Z' };
  ok('a fortnightly plan on a weekly trigger skips the odd week',
     isDue(fort, { now: NOW }).due === false);
  ok('and its recurrence says so', /fortnightly/.test(recurrence(fort).note));

  const off = { ...weekly, every: 'off' };
  ok('an off plan is never due', isDue(off).due === false);
  ok('even so, a person can still force one', isDue(off, { force: true }).due === true);

  const db = settings();
  await markRun(db, new Date('2026-09-08T09:00:00Z'));
  ok('a run is written down', db.store['writing.last'] === '2026-09-08T09:00:00.000Z');
}

console.log('\npublishing in bulk');
{
  /* An env whose publishArticle refuses exactly one slug, so the answer
     can be checked for the thing that matters: the others still went. */
  const seen = [];
  const env = {
    DB: {
      prepare(q) {
        const stmt = {
          bind(...b) { stmt.b = b; return stmt; },
          first: async () => {
            const slug = stmt.b[0];
            seen.push(slug);
            return slug === 'nocover'
              ? { id: 2, slug, title: 'T', description: 'd'.repeat(150), body: '## h\n' + 'word '.repeat(600), tags: '', status: 'review', cover: '' }
              : { id: 1, slug, title: 'T', description: 'd'.repeat(150), body: '## h\n' + 'word '.repeat(600), tags: '', status: 'review', cover: '/media/x.jpg' };
          },
          run: async () => ({ meta: { changes: 1 } }),
          all: async () => ({ results: [] }),
        };
        return stmt;
      },
    },
  };

  ok('no slugs is a refusal', (await publishArticles(env, [])).ok === false);
  ok('too many is a refusal',
     (await publishArticles(env, Array.from({ length: 26 }, (_, i) => `a${i}`))).ok === false);

  const out = await publishArticles(env, ['one', 'nocover', 'two']);
  ok('the good ones go live', out.published.map((x) => x.slug).sort().join() === 'one,two');
  ok('the bad one is refused', out.refused.length === 1 && out.refused[0].slug === 'nocover');
  ok('and it says why', /cover/i.test(out.refused[0].why), out.refused[0].why);
  ok('ok is false when any refused', out.ok === false);
  ok('the note tells you what to do next', /call it again/.test(out.note));

  const clean = await publishArticles(env, ['one', 'two']);
  ok('all good is ok', clean.ok === true && clean.refused.length === 0);

  const dupes = await publishArticles(env, ['one', 'one', 'one']);
  ok('the same slug three times publishes once', dupes.published.length === 1);
}

console.log('\nthe tools, and what asks');
{
  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
  for (const n of ['publish_articles', 'set_writing_schedule', 'writing_schedule', 'writing_run']) {
    ok(`${n} exists`, !!byName[n]);
  }
  ok('publishing a batch asks, like publishing one',
     byName.publish_articles.annotations.readOnlyHint === false);
  ok('and it asks once, for a list',
     byName.publish_articles.inputSchema.properties.slugs.type === 'array');
  ok('setting the plan asks, because "publish" in it means unread articles go live',
     byName.set_writing_schedule.annotations.readOnlyHint === false);
  ok('reading the plan does not ask',
     byName.writing_schedule.annotations.readOnlyHint === true);
  ok('a scheduled run does not ask, or it could never run unattended',
     byName.writing_run.annotations.readOnlyHint === true);

  const prompts = TOOLS.filter((t) => t.annotations.readOnlyHint !== true)
    .map((t) => t.name).sort().join(',');
  ok('everything that interrupts a person publishes something or decides that it will',
     prompts === 'post_due,publish_article,publish_articles,schedule_articles,set_writing_schedule',
     prompts);
}

console.log('\nthe cadence is editable from the studio too');
{
  const fields = SETTINGS.flatMap((g) => g.fields ?? []);
  const names = fields.map((f) => f.name);
  for (const k of ['writing.every', 'writing.day', 'writing.at', 'writing.count', 'writing.then']) {
    ok(`${k} is a field`, names.includes(k));
  }
  const every = fields.find((f) => f.name === 'writing.every');
  ok('and the cadences offered are the ones the code accepts',
     every?.options?.map((o) => o[0]).join() === 'off,daily,weekdays,weekly,fortnightly');
}

console.log(bad ? `\n${bad} failed` : '\nthe routine holds, and a batch publishes what it can');
process.exit(bad ? 1 : 0);

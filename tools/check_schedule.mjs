/**
 * check_schedule.mjs — the article queue, without a database or a clock.
 *
 *   node tools/check_schedule.mjs
 *
 * The spread is pure, so it is tested against a fixed `now` and a fixed
 * seed. The queue functions are tested against a stub that records every
 * statement, because what matters about them is not the answer, it is
 * that the claim happens before the publish and that a second poke gets
 * nothing.
 */
import {
  spread, capacity, scheduleArticles, unscheduleArticle, timetable, dueArticles, runDueArticles,
} from '../lib/schedule.js';
import { TOOLS } from '../lib/mcp.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

const NOW = new Date('2026-09-06T09:12:00Z');   // 10:12 local at GMT+1
const local = (iso) => new Date(new Date(iso).getTime() + 3600000);

console.log('\nthe spread');
{
  const t = spread({ count: 9, startIn: 1, days: 3, now: NOW, seed: 1 });
  ok('nine asked for, nine given', t.length === 9);
  ok('all of them in the future', t.every((x) => new Date(x) > NOW));
  ok('sorted', t.join() === [...t].sort().join());

  const days = new Set(t.map((x) => x.slice(0, 10)));
  ok('spread over three days, not stacked', days.size === 3, [...days].join(' '));
  ok('none of them today', !days.has('2026-09-06'));

  const hours = t.map((x) => local(x).getUTCHours());
  ok('nothing before 8 local', hours.every((h) => h >= 8), hours.join(','));
  ok('nothing after 20 local', hours.every((h) => h < 20), hours.join(','));

  for (let i = 1; i < t.length; i++) {
    if (t[i].slice(0, 10) !== t[i - 1].slice(0, 10)) continue;
    const gap = (new Date(t[i]) - new Date(t[i - 1])) / 60000;
    ok(`at least 75 minutes between ${t[i - 1].slice(11, 16)} and ${t[i].slice(11, 16)}`, gap >= 75);
  }

  ok('every time lands on a five', t.every((x) => new Date(x).getUTCMinutes() % 5 === 0));
  ok('the same seed gives the same plan',
     spread({ count: 9, startIn: 1, days: 3, now: NOW, seed: 1 }).join() === t.join());
  ok('a different seed does not',
     spread({ count: 9, startIn: 1, days: 3, now: NOW, seed: 2 }).join() !== t.join());
}

console.log('\nforty in a day, which is what the gap used to quietly refuse');
{
  /* The failure this catches, exactly as it shipped: the 75 minute gap
     was fixed, twelve hours holds ten posts at that spacing, and
     everything past the tenth was clamped to the last minute of the
     window. spread returned forty timestamps, eleven of them distinct
     and twenty-nine of them the same evening minute, and the caller's
     "did I get enough?" check passed because it counted rather than
     looked. Forty articles then published in one lump at 18:55. */
  const t = spread({ count: 40, days: 1, from: 0, to: 24, startIn: 1, now: NOW, seed: 7 });
  ok('forty asked for, forty given', t.length === 40, String(t.length));
  ok('and forty different times', new Set(t).size === 40, String(new Set(t).size));
  ok('none of them stacked on the last minute of the window',
     new Set(t.map((x) => x.slice(11, 16))).size === 40);

  const gaps = t.slice(1).map((x, i) => (new Date(x) - new Date(t[i])) / 60000);
  ok('the gap bent to fit rather than breaking', Math.min(...gaps) >= 5,
     `smallest ${Math.min(...gaps)} minutes`);
  ok('and it is still irregular, not a metronome',
     new Set(gaps).size > 3, `${new Set(gaps).size} different gaps`);
  ok('they run across the whole day, not one corner of it',
     new Set(t.map((x) => x.slice(11, 13))).size >= 15);

  ok('what the window holds is answerable without trying it',
     capacity({ days: 1, from: 0, to: 24 }).comfortable === 19);
  ok('and a working day holds far less, which is the honest number',
     capacity({ days: 1, from: 8, to: 20 }).comfortable === 9);

  /* The cap is on the call, not the day. Fifty is the most one
     schedule_articles can place however wide the window is opened. */
  ok('fifty is the ceiling on one call',
     spread({ count: 80, days: 7, from: 0, to: 24, now: NOW, seed: 3 }).length === 50);

  /* Asked for today, at ten past nine, there are only fifteen hours of
     day left. It still has to fit and it still has to be distinct: what
     it cannot be is as leisurely as a whole day. */
  const today = spread({ count: 40, days: 1, from: 0, to: 24, startIn: 0, now: NOW, seed: 7 });
  ok('forty today, from the middle of the morning, still fits',
     today.length === 40 && new Set(today).size === 40, String(today.length));
  ok('and none of them are in the past', today.every((x) => new Date(x) > NOW));
}

console.log('\nasking for today, at ten past ten');
{
  // The failure this catches: the first day's window opened at 08:00
  // local whatever the time was, every slot before now was dropped, and
  // a batch asked for at lunchtime came back short with no explanation.
  const t = spread({ count: 5, startIn: 0, days: 1, now: NOW, seed: 7 });
  ok('five asked for, five given', t.length === 5, t.map((x) => x.slice(11, 16)).join(' '));
  ok('the first one is at least ten minutes away',
     (new Date(t[0]) - NOW) / 60000 >= 10, t[0]);
}

console.log('\nthe window can be too small');
{
  const t = spread({ count: 12, startIn: 1, days: 3, perDay: 3, now: NOW, seed: 3 });
  ok('three a day for three days fits nine, not twelve', t.length === 9);
}

/* A database that records what it was asked, answers what it is told to,
   and can be made to lose a race. */
function stub({ rows = [], changes = 1 } = {}) {
  const sql = [];
  const db = {
    sql,
    prepare(q) {
      sql.push(q.replace(/\s+/g, ' ').trim());
      const stmt = {
        bind: (...b) => { stmt.bound = b; return stmt; },
        all: async () => ({ results: rows }),
        first: async () => rows[0] ?? null,
        run: async () => ({ meta: { changes } }),
      };
      return stmt;
    },
    batch: async (stmts) => stmts.map(() => ({ meta: { changes: 1 } })),
  };
  return db;
}

console.log('\nscheduling refuses rather than dropping');
{
  const two = [
    { slug: 'a', title: 'A', status: 'review', cover: '/media/a.jpg' },
    { slug: 'b', title: 'B', status: 'review', cover: '/media/b.jpg' },
  ];
  ok('no slugs is a refusal, not an empty success',
     (await scheduleArticles(stub(), { slugs: [] })).ok === false);

  const missing = await scheduleArticles(stub({ rows: two }), { slugs: ['a', 'b', 'c'] });
  ok('an unknown slug refuses the whole batch', missing.ok === false);
  ok('and it names which one', /c/.test(missing.reason), missing.reason);

  const live = await scheduleArticles(
    stub({ rows: [{ ...two[0], status: 'published' }] }), { slugs: ['a'] });
  ok('one already published refuses', live.ok === false && /Already published/.test(live.reason));

  const bare = await scheduleArticles(
    stub({ rows: [{ ...two[0], cover: '' }] }), { slugs: ['a'] });
  ok('one with no cover refuses now rather than failing later',
     bare.ok === false && /cover/i.test(bare.reason));

  const tight = await scheduleArticles(stub({ rows: two }),
    { slugs: ['a', 'b'], days: 1, perDay: 1 });
  ok('a window too small refuses and says so',
     tight.ok === false && /fits 1 of 2/.test(tight.reason), tight.reason);
  ok('and says what the window does hold, which is the actionable part',
     /at a natural spacing/.test(tight.reason) && /absolute limit/.test(tight.reason));

  const db = stub({ rows: two });
  const good = await scheduleArticles(db, { slugs: ['a', 'b'], startIn: 1 });
  ok('a workable batch is scheduled', good.ok === true);
  ok('and comes back with a time against each slug',
     good.scheduled.length === 2 && good.scheduled.every((x) => x.at && x.slug));
  ok('in the order they were given', good.scheduled.map((x) => x.slug).join() === 'a,b');
  const writes = db.sql.filter((q) => q.startsWith('UPDATE articles SET publish_at ='));
  ok('one write per article', writes.length === 2);
  ok('and every write guards against a published row',
     writes.every((q) => /status != 'published'/.test(q)), writes[0]);
}

console.log('\nthe run claims before it publishes');
{
  const rowsDue = [{ slug: 'a', title: 'A', publish_at: '2026-09-06T08:00:00Z' }];

  const lost = stub({ rows: rowsDue, changes: 0 });
  const out = await runDueArticles({ DB: lost });
  ok('a poke that loses the claim publishes nothing',
     out.ran === true && out.published.length === 0 && out.failed.length === 0);

  const claim = lost.sql.find((q) => q.startsWith('UPDATE articles SET publish_at'));
  ok('the claim clears the time in the same statement that checks it',
     !!claim && /publish_at != ''/.test(claim), claim);
  ok('nothing was published after a lost claim',
     !lost.sql.some((q) => /status = 'published'/.test(q)));

  const empty = await runDueArticles({ DB: stub({ rows: [] }) });
  ok('nothing due is not an error', empty.ran === false);
}

console.log('\na database without the column');
{
  const missing = {
    prepare: () => ({
      bind() { return this; },
      all: async () => { throw new Error('D1_ERROR: no such column: publish_at'); },
    }),
  };
  ok('the timetable reads empty rather than throwing',
     (await timetable(missing)).length === 0);
  ok('and so does the due query', (await dueArticles(missing)).length === 0);

  const broken = {
    prepare: () => ({
      bind() { return this; },
      all: async () => { throw new Error('D1_ERROR: near "SLECT": syntax error'); },
    }),
  };
  let threw = false;
  try { await timetable(broken); } catch { threw = true; }
  ok('a real error still throws rather than being hidden', threw);
}

console.log('\nunscheduling');
{
  ok('a row that was queued comes off', (await unscheduleArticle(stub(), 'a')).ok === true);
  ok('one that was not says so', (await unscheduleArticle(stub({ changes: 0 }), 'a')).ok === false);
}

console.log('\nwhat asks');
{
  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
  ok('schedule_articles exists', !!byName.schedule_articles);
  ok('scheduling asks, because it is publishing with a delay',
     byName.schedule_articles.annotations.readOnlyHint === false);
  ok('it asks once for the whole batch, not once per article',
     byName.schedule_articles.inputSchema.properties.slugs.type === 'array');
  ok('reading the queue does not ask',
     byName.scheduled_articles.annotations.readOnlyHint === true);
  ok('taking one off the queue does not ask',
     byName.unschedule_article.annotations.readOnlyHint === true);

  const prompts = TOOLS.filter((t) => t.annotations.readOnlyHint !== true)
    .map((t) => t.name).sort();
  ok('everything that interrupts a person publishes, or decides that it will',
     prompts.join(',') === 'post_due,publish_article,publish_articles,schedule_articles,set_writing_schedule', prompts.join(', '));
}

console.log(bad ? `\n${bad} failed` : '\nthe queue spreads, refuses, claims once and publishes itself');
process.exit(bad ? 1 : 0);

/**
 * check_booking.mjs — slots, holds, spam and the decide link.
 *
 *   node tools/check_booking.mjs
 *
 * No database and no clock: `now` is injected everywhere, and the
 * database is a stub that can be told to behave like a real one under a
 * race. The four things worth guarding are the four that are silent when
 * they break: an hour offered twice, an hour held forever, a diary
 * reserved by a script, and a booking confirmed by a mail scanner.
 */
import { readFileSync } from 'node:fs';
import { shape, dayTimes, availability, releaseStale } from '../lib/booking.js';
import { requestBooking, decide, byToken } from '../lib/request.js';
import { SCHEMA } from '../lib/seed.js';
import { SETTINGS } from '../lib/collections.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

const NOW = new Date('2026-09-07T09:00:00Z');    // a Monday, 10:00 local

/**
 * settings + appointments, enough for the code under test. `rows` is the
 * live diary; `insert` can be told to fail the way the unique index does.
 */
function db({ set = {}, rows = [], insertFails = false } = {}) {
  const sql = [];
  return {
    sql, rows,
    prepare(q) {
      sql.push(q.replace(/\s+/g, ' ').trim());
      const st = {
        bind(...b) { st.b = b; return st; },
        first: async () => {
          if (/SELECT value/.test(q)) {
            return set[st.b[0]] !== undefined ? { value: set[st.b[0]] } : null;
          }
          if (/SUM\(CASE/.test(q)) return { live: 0, today: 0 };
          if (/FROM appointments WHERE token/.test(q)) {
            return rows.find((r) => r.token && r.token === st.b[0]) ?? null;
          }
          return null;
        },
        all: async () => ({ results: /FROM appointments/.test(q) ? rows : [] }),
        run: async () => {
          if (/INSERT INTO appointments/.test(q) && insertFails) {
            throw new Error('D1_ERROR: UNIQUE constraint failed: appointments.day');
          }
          return { meta: { changes: 1 } };
        },
      };
      return st;
    },
  };
}

console.log('\nthe working pattern');
{
  const s = await shape(db());
  ok('defaults to weekdays', s.days.join() === 'mon,tue,wed,thu,fri', s.days.join());
  ok('a short window, which is what books best', s.window === 5, String(s.window));
  ok('and a hold that lets go by itself', s.holdHours > 0 && s.holdHours <= 168);

  const custom = await shape(db({ set: { 'book.hours': '09:00-12:00', 'book.minutes': '30', 'book.gap': '0' } }));
  const times = dayTimes(custom);
  ok('three hours at half an hour each with no gap is six times',
     times.length === 6, times.join(' '));
  ok('and none of them runs past closing',
     times[times.length - 1] === '11:30', times[times.length - 1]);

  const junk = await shape(db({ set: { 'book.hours': 'nonsense', 'book.minutes': '9999' } }));
  ok('rubbish hours fall back rather than throwing', junk.from === '10:00');
  ok('and a silly length is clamped', junk.minutes === 240, String(junk.minutes));
}

console.log('\nwhat is offered');
{
  const { days } = await availability(db(), { now: NOW });
  ok('some days come back', days.length > 0);
  ok('no more than the window', days.length <= 5, String(days.length));
  ok('nothing today, because the lead time is a day',
     !days.some((d) => d.day === '2026-09-07'), days.map((d) => d.day).join(' '));
  ok('and no weekends', !days.some((d) => ['sat', 'sun'].includes(d.weekday)),
     days.map((d) => d.weekday).join(' '));
  ok('every day offered has at least one time', days.every((d) => d.times.length));

  const taken = await availability(
    db({ rows: [{ day: days[0].day, start: days[0].times[0], state: 'pending' }] }),
    { now: NOW });
  ok('an hour somebody is holding is not offered again',
     !taken.days[0] || taken.days[0].times[0] !== days[0].times[0],
     `${days[0].times[0]} then ${taken.days[0] && taken.days[0].times[0]}`);

  const full = await availability(
    db({ set: { 'book.perDay': '1' },
         rows: [{ day: days[0].day, start: days[0].times[0], state: 'confirmed' }] }),
    { now: NOW });
  ok('a day at its limit disappears rather than showing as empty',
     !full.days.some((d) => d.day === days[0].day));

  const late = await availability(db({ set: { 'book.lead': '0' } }),
                                 { now: new Date('2026-09-08T14:30:00Z') });
  const today = late.days.find((d) => d.day === '2026-09-08');
  ok('an hour that has already started today is not on offer',
     !today || today.times.every((t) => t > '15:30'), today ? today.times.join(' ') : 'none');
}

console.log('\nasking for one');
{
  const free = await availability(db(), { now: NOW });
  const day = free.days[0].day, start = free.days[0].times[0];
  const good = { day, start, name: 'A Person', email: 'a@example.com', about: 'Hello' };

  const out = await requestBooking({ DB: db() }, good, { now: NOW });
  ok('a real request is held', out.ok === true && out.state === 'pending');
  ok('and comes back with a token to decide on', (out.token || '').length >= 64);

  const noName = await requestBooking({ DB: db() }, { ...good, name: '' }, { now: NOW });
  ok('no name is refused', noName.ok === false && /name/i.test(noName.problems[0]));

  const badMail = await requestBooking({ DB: db() }, { ...good, email: 'nope' }, { now: NOW });
  ok('a bad address is refused', badMail.ok === false);

  const offPattern = await requestBooking({ DB: db() },
    { ...good, day: '2026-09-12', start: '03:00' }, { now: NOW });
  ok('a time that is not on offer is refused, not written',
     offPattern.ok === false && offPattern.taken === true);

  const raced = await requestBooking({ DB: db({ insertFails: true }) }, good, { now: NOW });
  ok('losing the race on the unique index reads as taken, not as a crash',
     raced.ok === false && raced.taken === true, raced.problems && raced.problems[0]);
}

console.log('\nwhat stops a script reserving the week');
{
  const free = await availability(db(), { now: NOW });
  const good = { day: free.days[0].day, start: free.days[0].times[0],
                 name: 'A', email: 'a@example.com' };

  const pot = await requestBooking({ DB: db() }, { ...good, company: 'Acme' }, { now: NOW });
  ok('a filled honeypot is accepted and written nowhere',
     pot.ok === true && pot.quiet === true && pot.state === 'ignored');

  const fast = await requestBooking({ DB: db() },
    { ...good, opened_at: NOW.getTime() - 500 }, { now: NOW });
  ok('a form filled in half a second is too', fast.quiet === true);

  const human = await requestBooking({ DB: db() },
    { ...good, opened_at: NOW.getTime() - 40000 }, { now: NOW });
  ok('forty seconds is a person', human.ok === true && !human.quiet);

  const busy = {
    ...db(),
    prepare(q) {
      const base = db().prepare(q);
      if (/SUM\(CASE/.test(q)) {
        return { bind: () => ({ first: async () => ({ live: 2, today: 2 }) }) };
      }
      return base;
    },
  };
  const limited = await requestBooking({ DB: busy }, good, { now: NOW });
  ok('two held already from one place is refused',
     limited.ok === false && /already have a time held/i.test(limited.problems[0]));

  const table = readFileSync('lib/seed.js', 'utf8')
    .split('CREATE TABLE IF NOT EXISTS appointments')[1].split('\");')[0];
  ok('the address is stored as a hash', /ip_hash/.test(table));
  ok('and the address itself has no column to go in',
     !/\bip\s+TEXT|\bip_address|\bremote_ip/.test(table));

  const src = readFileSync('lib/request.js', 'utf8');
  ok('Turnstile is checked when a secret is set', /TURNSTILE_SECRET/.test(src));
  ok('and skipped when it is not, so an unconfigured deployment still works',
     /if \(!env\.TURNSTILE_SECRET\) return \{ ok: true/.test(src));
}

console.log('\na hold lets go on its own');
{
  const d = db();
  await releaseStale(d, { now: NOW });
  const stmt = d.sql.find((q) => /UPDATE appointments SET state = 'expired'/.test(q));
  ok('stale pendings are expired', !!stmt, stmt);
  ok('only the pending ones', /state = 'pending'/.test(stmt || ''));
  ok('and only the ones past their time', /expires_at <= /.test(stmt || ''));

  const api = readFileSync('functions/api/slots.js', 'utf8');
  ok('and it runs before availability is read', /releaseStale/.test(api));
}

console.log('\nthe database is what stops a double booking');
{
  const idx = SCHEMA.find((s) => /one_live_per_slot/.test(s));
  ok('there is a unique index on the slot', !!idx);
  ok('and it only counts the two states that hold an hour',
     /WHERE state IN \('pending','confirmed'\)/.test(idx || ''), idx);
  ok('a declined or expired row does not block the slot',
     !/declined|expired/.test((idx || '').split('WHERE')[1] || ''));
}

console.log('\ndeciding by email');
{
  const row = { id: 1, day: '2026-09-09', start: '10:00', minutes: 45, name: 'A',
                email: 'a@example.com', about: '', phone: '', state: 'pending',
                token: 'x'.repeat(64) };

  const found = await byToken(db({ rows: [row] }), row.token);
  ok('a live token finds its request', !!found);
  ok('a short one does not even look', (await byToken(db({ rows: [row] }), 'abc')) === null);

  const yes = await decide({ DB: db({ rows: [row] }) }, row.token, 'confirm', { now: NOW });
  ok('confirming works', yes.ok === true && yes.state === 'confirmed');

  const no = await decide({ DB: db({ rows: [row] }) }, row.token, 'decline', { now: NOW });
  ok('declining works', no.ok === true && no.state === 'declined');

  const gone = await decide({ DB: db({ rows: [] }) }, row.token, 'confirm', { now: NOW });
  ok('a used link decides nothing', gone.ok === false && gone.gone === true);

  const done = await decide({ DB: db({ rows: [{ ...row, state: 'confirmed' }] }) },
                            row.token, 'decline', { now: NOW });
  ok('and one already decided is not undone', done.ok === false);

  const upd = db({ rows: [row] });
  await decide({ DB: upd }, row.token, 'confirm', { now: NOW });
  const write = upd.sql.find((q) => /UPDATE appointments/.test(q));
  ok('the token is cleared in the same statement that acts on it',
     /token = ''/.test(write || '') && /AND token = /.test(write || ''), write);

  /* The one that matters. Mail scanners, link previewers and corporate
     proxies fetch every URL in an inbound message, so a GET that confirms
     is a booking confirmed at four in the morning by a virus scanner. */
  const decidePage = readFileSync('functions/book/decide.js', 'utf8');
  ok('the emailed link only SHOWS the decision', /export async function onRequestGet/.test(decidePage));
  ok('and a POST is what makes it', /export async function onRequestPost/.test(decidePage));
  ok('the GET does not call decide()',
     !/onRequestGet[\s\S]*?await decide\(/.test(decidePage.split('onRequestPost')[0]));
  ok('the page says why there is a button rather than a link',
     /mail scanners\s+follow\s+links/i.test(decidePage), 'wording changed?');

  const mail = readFileSync('functions/api/request.js', 'utf8');
  ok('the notification carries both links', /do=confirm/.test(mail) && /do=decline/.test(mail));
  ok('and the person who asked is told when it is decided',
     /send\(env, \{\s*to: a\.email/.test(decidePage));
}

console.log('\nthe page offers what is free, and says so');
{
  const html = readFileSync('book.html', 'utf8');
  const js = readFileSync('assets/js/book.js', 'utf8');
  ok('the form posts to the holding endpoint', /data-endpoint="\/api\/request"/.test(html));
  ok('there is a day picker', /data-days/.test(html) && /data-days/.test(js));
  ok('and a time picker fed from the server', /\/api\/slots/.test(js));
  ok('the honeypot is still there', /name="company"/.test(html));
  ok('and the page records when it was opened', /name="opened_at"/.test(html));
  ok('a day shows how many times are left, which is scarcity that is true',
     /bk__day-n/.test(js));
  ok('no more than eight times at once', /SHOW_TIMES = 8/.test(js));
  ok('a slot taken while the page was open reloads rather than scolds',
     /out\.s === 409/.test(js));

  const fields = SETTINGS.flatMap((g) => g.fields).map((f) => f.name);
  for (const k of ['book.days', 'book.hours', 'book.minutes', 'book.window', 'book.hold']) {
    ok(`${k} is editable in the studio`, fields.includes(k));
  }
}

console.log(bad ? `\n${bad} failed` : '\nreal slots, held once, decided by a person');
process.exit(bad ? 1 : 0);

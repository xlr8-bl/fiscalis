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
  /* Both doors into the decision have to tell them. The wording lives in
     one place so the second door cannot quietly grow a different one, or
     none: a booking confirmed in the studio that the person never hears
     about is the same failure as one confirmed by email and never sent. */
  const shared = readFileSync('lib/request.js', 'utf8');
  const studioApi = readFileSync('functions/api/studio/[[route]].js', 'utf8');
  ok('the wording lives in one place', /export async function tellThem/.test(shared));
  ok('and it does send', /await send\(env, \{ to: a\.email/.test(shared));
  ok('the email link tells them', /await tellThem\(send, env/.test(decidePage));
  ok('and so does deciding it in the studio', /await tellThem\(send, env/.test(studioApi));
  ok('a decline and a cancellation are both written, not just the confirmation',
     /declined:/.test(shared) && /cancelled:/.test(shared));

  /* The email link can confirm and decline. Only the studio can give back
     an hour that is already confirmed, and that asymmetry is deliberate:
     a forwarded email should not be able to unbook somebody. */
  ok('only the studio can cancel a confirmed hour',
     /cancel: 'cancelled'/.test(shared)
     && /want === 'cancelled' \? \['pending', 'confirmed'\]/.test(shared)
     && !/cancel/.test(decidePage));

  /* Reading the row and then writing it is two statements with a gap, and
     the email link can decide in the gap. The state read has to be a
     condition of the write. */
  ok('deciding twice at once cannot both win',
     /WHERE id = \?1 AND state = \?5/.test(shared));
}

console.log('\nthe page reads as three steps, and nothing runs together');
{
  const js = readFileSync('assets/js/book.js', 'utf8');
  const css = readFileSync('assets/css/book.css', 'utf8');
  const html = readFileSync('book.html', 'utf8');

  /* THE ROOT CAUSE, not the symptom. book.js invented bk__day and
     bk__day-n and book.css had never heard of either, so the day picker
     rendered with no rules at all: the date and the count sat in one
     span with nothing between them and every row read "Mon, Sep 76
     times", a number that does not exist. A class the script writes and
     the stylesheet has never seen is the shape of that bug, so this
     checks for the shape. */
  const emitted = new Set(
    [...js.matchAll(/class="((?:bk__|st-)[^"]*)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter((c) => c.startsWith('bk__'))
  );
  const unstyled = [...emitted].filter((c) => !new RegExp(`\\.${c}\\b`).test(css));
  ok('every class the script writes has a rule in the stylesheet',
     unstyled.length === 0, unstyled.join(', ') || 'all styled');

  ok('the date and the count are separate elements, not one string',
     /bk__day-when"[^]*?<\/span>[^]*?bk__day-n/.test(js));
  ok('and the row lays them out at opposite ends',
     /\.bk__day-in\s*\{[^}]*justify-content:\s*space-between/.test(css));

  /* Same fault, one line further down: the timezone hint sat hard
     against the label and read as "Pick a timeGMT+1". */
  ok('a step heading keeps its hint away from its label',
     /\.bk__label:has\(\.bk__step\)[^{]*\{[^}]*gap:/.test(css)
     && /\.bk__label:has\(\.bk__step\) \.bk__hint[^{]*\{[^}]*auto/.test(css));

  ok('the steps are numbered', (html.match(/class="bk__step"/g) || []).length === 3);
  ok('and the second one is on the page from the start, so it never reads 1 then 3',
     !/data-times-field[^>]*\bhidden\b/.test(html)
     && /bk__waiting/.test(html));

  /* A day picked, on a phone, puts the times below the fold. Without
     this the control appears to do nothing at all. */
  ok('picking a day brings the times onto the screen', /reveal\(timesField\)/.test(js));
  ok('and it leaves alone anybody who can already see them',
     /box\.top >= 0 && box\.bottom <= \(window\.innerHeight/.test(js));

  /* The shared navbar is fixed and transparent, which is right over the
     home page's photograph and wrong over a page of text. */
  ok('the navbar gets a ground on this page', /\.navbar_wrap\s*\{[^}]*background:/.test(css));

  ok('the particulars sit below the form, not in front of the first choice',
     html.indexOf('bk__meta') > html.indexOf('data-step-field="day"'));
}

console.log('\na date on its own does not say which week it is');
{
  const js = readFileSync('assets/js/book.js', 'utf8');
  const slots = readFileSync('functions/api/slots.js', 'utf8');

  ok('the rows are grouped by week', /bk__week/.test(js) && /weekOf\(/.test(js));
  ok('and the near days are named as well as dated',
     /'Today, ' \+ date/.test(js) && /'Tomorrow, ' \+ date/.test(js));

  /* Which week a day falls in is answered against the DIARY's clock,
     not the visitor's device. The days offered are days in the owner's
     timezone; a visitor six hours behind working it out from their own
     phone gets labels that disagree with the dates beside them. */
  ok('today comes down with the slots', /today/.test(slots));
  ok('and the page uses that rather than the browser',
     /state\.today = j\.today/.test(js) && !/new Date\(\)\.getDay/.test(js));

  /* Weeks start on Sunday, and that is a decision rather than an
     oversight. Monday-start weeks put Sunday at the end of its week, so
     on a Sunday tomorrow lands in the next one and the page prints
     "Next week" directly above a row that says "Tomorrow". */
  ok('weeks start on Sunday, for the Sunday case',
     /t\.getUTCDate\(\) - t\.getUTCDay\(\)/.test(js));

  // the grouping itself, run the way the page runs it
  const atNoon = (d) => new Date(d + 'T12:00:00Z');
  const weekOf = (today, day) => {
    const t = atNoon(today);
    t.setUTCDate(t.getUTCDate() - t.getUTCDay());
    return Math.floor((atNoon(day) - t) / (7 * 86400000));
  };
  const plus = (d, n) => {
    const x = atNoon(d); x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const SUN = '2026-09-06';
  ok('on a Sunday, tomorrow is this week', weekOf(SUN, plus(SUN, 1)) === 0);
  ok('on a Friday, the coming Monday is next week',
     weekOf(plus(SUN, 5), plus(SUN, 8)) === 1);
  ok('and a fortnight out is neither', weekOf(SUN, plus(SUN, 14)) === 2);
  ok('every weekday agrees that a day inside the next seven is at most next week',
     [0, 1, 2, 3, 4, 5, 6].every((i) => {
       const today = plus(SUN, i);
       return [1, 2, 3, 4, 5, 6, 7].every((off) => weekOf(today, plus(today, off)) <= 1);
     }));
}

console.log('\nthe diary in the studio');
{
  const studioApi = readFileSync('functions/api/studio/[[route]].js', 'utf8');
  const studioJs = readFileSync('assets/js/studio.js', 'utf8');
  const studioHtml = readFileSync('studio.html', 'utf8');
  const decidePage = readFileSync('functions/book/decide.js', 'utf8');

  ok('the link the decide page offers goes somewhere',
     /\/studio#\/bookings/.test(decidePage)
     && /area === 'bookings'/.test(studioJs));
  ok('there is a screen for it', /data-view="bookings"/.test(studioHtml));
  ok('and a way into it from the menu', /#\/bookings', 'Times'/.test(studioJs));
  ok('the diary route exists', /head === 'appointments'/.test(studioApi));
  ok('the agent token cannot read it',
     /The diary is not something the agent token can read/.test(studioApi));
  ok('stale holds are let go before you are shown what is free',
     /await releaseStale\(env\.DB\)/.test(studioApi));
  ok('held hours are shown on the overview, above everything else',
     /Times held/.test(studioJs));
  ok('and each one says how long is left on it', /function heldFor/.test(studioJs));
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

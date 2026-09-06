/**
 * booking.js — real slots, held while you decide.
 *
 * The old form asked for a date and up to three preferred times and sent
 * you an email. That is a contact form wearing a calendar's clothes: two
 * people can ask for the same hour, nobody knows what is free, and the
 * answer always needs a second message.
 *
 * WHAT A SLOT IS. Availability is computed, never stored. Working days,
 * hours and length come from settings; everything already taken comes out
 * of `appointments`. There is no table of empty slots to keep in step
 * with the calendar, and changing your hours changes what is offered
 * immediately rather than from the next generation run.
 *
 * WHAT STOPS A DOUBLE BOOKING. A partial unique index, in the database:
 *
 *   CREATE UNIQUE INDEX one_live_per_slot ON appointments(day, start)
 *     WHERE state IN ('pending','confirmed')
 *
 * Two requests for the same hour cannot both be written, whatever the
 * application does, whoever wins the race. Checking-then-inserting in JS
 * is a check and an insert with a gap in the middle, and the gap is where
 * the double booking lives.
 *
 * WHAT STOPS A HOARD. Every pending request expires. A held slot is only
 * held for as long as it takes a person to answer an email, and after
 * that it is free again with nobody doing anything. That is also the
 * answer to somebody scripting a hundred requests: they hold the diary
 * for a day, not forever, and the rate limit below means they cannot get
 * a hundred in.
 *
 * THE RESEARCH, which set the shape of what is offered:
 *   three to five days ahead, not a month. A short window books better
 *   and cancels less.
 *   five to eight times visible at once. Fewer feels shut, more is a
 *   decision nobody wants to make.
 *   one date, one time, then confirm. Three steps, no account.
 *   scarcity only where it is true. The slots shown are the slots there
 *   are, so a thin day looks thin.
 */

import { getSetting } from './tokens.js';

/*
 * How the call actually happens.
 *
 * The page said "video call, link sent on confirmation" and never asked
 * which one, which left the link impossible to send: confirming a
 * booking meant guessing between Meet and Zoom, or writing a second
 * email to ask. One tap on the request answers it.
 *
 * `needs` is a phone number, and it is what makes this more than a
 * label: a WhatsApp call to an address does not exist, so choosing one
 * of those has to bring the number with it.
 */
export const PLATFORMS = {
  meet: { label: 'Google Meet', needs: false, note: 'I send a link' },
  zoom: { label: 'Zoom', needs: false, note: 'I send a link' },
  teams: { label: 'Microsoft Teams', needs: false, note: 'I send a link' },
  whatsapp: { label: 'WhatsApp', needs: true, note: 'I call you' },
  phone: { label: 'Phone call', needs: true, note: 'I call you' },
  facetime: { label: 'FaceTime', needs: true, note: 'I call you' },
};

/** The ones on offer, in the order they are offered. */
export function offeredPlatforms(setting) {
  const want = String(setting ?? '')
    .split(',').map((x) => x.trim().toLowerCase()).filter((x) => PLATFORMS[x]);
  const list = want.length ? [...new Set(want)] : ['meet', 'zoom', 'phone'];
  return list.map((id) => ({ id, ...PLATFORMS[id] }));
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Working pattern, with defaults that suit one person. */
export async function shape(db) {
  const get = async (k, d) => (await getSetting(db, k)) ?? d;
  const hours = String(await get('book.hours', '10:00-16:00'));
  const [from, to] = hours.split('-').map((x) => x.trim());
  return {
    days: String(await get('book.days', 'mon,tue,wed,thu,fri'))
      .split(',').map((x) => x.trim().toLowerCase()).filter((x) => DAY_KEYS.includes(x)),
    from: /^\d{2}:\d{2}$/.test(from) ? from : '10:00',
    to: /^\d{2}:\d{2}$/.test(to) ? to : '16:00',
    minutes: numOr(await get('book.minutes', 45), 15, 240, 45),
    gap: numOr(await get('book.gap', 15), 0, 120, 15),
    /* Two days, not one. Email read once a day and a slot bookable
       tomorrow is a request that can be answered after it has happened.
       The lead time has to be longer than the gap between readings. */
    lead: numOr(await get('book.lead', 2), 0, 14, 2),
    window: numOr(await get('book.window', 5), 1, 21, 5),
    offset: numOr(await get('book.offset', 1), -12, 14, 1),
    holdHours: numOr(await get('book.hold', 36), 1, 168, 36),
    perDay: numOr(await get('book.perDay', 3), 1, 12, 3),
    platforms: offeredPlatforms(await get('book.platforms', '')),
    callFrom: String(await get('book.callFrom', '')).slice(0, 60),
  };
}

/* `Number(x) || fallback` is wrong for every setting whose valid range
   includes zero: "no gap between calls" and "bookable today" both read
   as 0, 0 is falsy, and both silently became the fallback. A person sets
   the gap to none, saves, and the diary keeps a fifteen minute gap with
   nothing on screen to say why. */
const numOr = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};

const mins = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Every time this pattern would offer on one day, before anything is taken. */
export function dayTimes(s) {
  const out = [];
  for (let m = mins(s.from); m + s.minutes <= mins(s.to); m += s.minutes + s.gap) {
    out.push(hhmm(m));
  }
  return out;
}

/**
 * What is actually free, day by day.
 *
 * `now` is injectable so the whole thing can be tested without waiting
 * for Tuesday. Everything is computed in the LOCAL clock and the offset
 * is applied once, at the end, when a time is turned into an instant.
 */
export async function availability(db, { now = new Date() } = {}) {
  const s = await shape(db);
  const taken = await liveAppointments(db);
  const busy = new Set(taken.map((r) => `${r.day} ${r.start}`));
  const perDay = new Map();
  for (const r of taken) perDay.set(r.day, (perDay.get(r.day) ?? 0) + 1);

  const days = [];
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + s.lead);

  const nowLocal = now.getTime() + s.offset * 3600000;
  for (let i = 0; days.length < s.window && i < s.window + 21; i++) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() + i);
    const key = DAY_KEYS[d.getUTCDay()];
    if (!s.days.includes(key)) continue;
    const day = ymd(d);
    if ((perDay.get(day) ?? 0) >= s.perDay) continue;

    const times = dayTimes(s).filter((t) => {
      if (busy.has(`${day} ${t}`)) return false;
      // an hour that has already started today is not on offer
      const at = Date.parse(`${day}T${t}:00Z`);
      return at > nowLocal;
    });
    if (times.length) days.push({ day, weekday: key, times });
  }

  /* Today, in the diary's clock rather than the visitor's.
     The page says "Tomorrow" and "This week" against this, and it has to
     be this: the days offered are days in the owner's timezone, and a
     visitor six hours behind who works it out from their own device gets
     a page whose labels quietly disagree with its dates. */
  return { shape: s, days, today: ymd(new Date(nowLocal)) };
}

/** Pending and confirmed: the two states that hold an hour. */
export async function liveAppointments(db) {
  try {
    const { results } = await db
      .prepare(`SELECT day, start, state FROM appointments
                WHERE state IN ('pending','confirmed') ORDER BY day, start`)
      .all();
    return results ?? [];
  } catch (e) {
    if (/no such table|no such column/i.test(String(e?.message || e))) return [];
    throw e;
  }
}

/**
 * Let a pending request go when nobody answered.
 *
 * Run before availability is read and before a request is written, so a
 * slot somebody sat on and never confirmed comes back on its own rather
 * than needing anybody to notice.
 */
export async function releaseStale(db, { now = new Date() } = {}) {
  try {
    const r = await db
      .prepare(`UPDATE appointments SET state = 'expired', decided_at = ?1
                WHERE state = 'pending' AND expires_at <= ?1`)
      .bind(now.toISOString())
      .run();
    return r?.meta?.changes ?? 0;
  } catch { return 0; }
}

export { ymd, hhmm, mins, DAY_KEYS };

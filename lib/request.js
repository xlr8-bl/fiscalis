/**
 * request.js — taking a booking request, and deciding it by email.
 *
 * WHAT STOPS A CRAWLER RESERVING THE DIARY.
 *
 * Five things, in the order they cost the visitor nothing to nothing much.
 *
 *   1. It is a POST. Crawlers follow links, they do not submit forms, so
 *      the ordinary case never arises. Everything below is about somebody
 *      deliberately scripting it, which is a different problem.
 *   2. A honeypot field, hidden from people and irresistible to a form
 *      filler. Present, empty, and if it comes back full the request is
 *      accepted with a smile and written nowhere.
 *   3. How long the form was open. A person cannot read a page, pick a
 *      day, pick a time and type their name in three seconds.
 *   4. A rate limit on the hash of the address. Two live requests from
 *      one place, five a day. The hash is stored, not the address: it is
 *      enough to count with and not enough to identify anybody.
 *   5. Turnstile, if TURNSTILE_SECRET is set. Optional on purpose, so a
 *      deployment nobody has configured still defends itself.
 *
 * And the sixth, which is the one that actually matters: every pending
 * request EXPIRES. Somebody who gets past all five holds the diary for a
 * day and a half, not forever, and the slots come back on their own.
 *
 * WHY THE EMAIL LINK DOES NOT DECIDE ANYTHING BY ITSELF.
 *
 * The mail has two links. Neither one confirms or declines when it is
 * opened. Mail scanners, link previewers and corporate security proxies
 * fetch every URL in an inbound message, and a GET that changes state is
 * a booking confirmed by a virus scanner at four in the morning. So the
 * link opens a page that says what will happen and has a button on it,
 * and the button POSTs. One extra tap, and the decision is yours.
 *
 * The token is random, long, and single use: it is cleared the moment a
 * decision is recorded, so a forwarded email cannot undo anything.
 */

import { availability, releaseStale, shape, PLATFORMS } from './booking.js';

const MAX = 4000;
const clean = (v, n = 400) => String(v ?? '').trim().slice(0, Math.min(n, MAX));
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** A token nobody can guess and nothing can enumerate. */
function token() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** The address, reduced to something countable and not identifying. */
async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${salt || 'web3ashley'}|${ip || ''}`);
  const sum = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(sum)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function turnstileOk(env, tokenValue, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: true, skipped: true };
  try {
    const body = new FormData();
    body.append('secret', env.TURNSTILE_SECRET);
    body.append('response', String(tokenValue || ''));
    if (ip) body.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
                          { method: 'POST', body });
    const j = await r.json();
    return { ok: j.success === true, reason: (j['error-codes'] || []).join(',') };
  } catch {
    // the check itself failing is not the visitor's fault, and refusing a
    // real booking because Cloudflare had a bad minute is the worse error
    return { ok: true, degraded: true };
  }
}

/**
 * Take a request for one hour.
 *
 * Everything is validated against what is ACTUALLY on offer rather than
 * against what the form said: a posted day and time that is not in
 * availability is refused, so a stale page or a hand-made request cannot
 * book outside the working pattern.
 */
export async function requestBooking(env, body, meta = {}) {
  const db = env.DB;
  const now = meta.now ? new Date(meta.now) : new Date();

  // let go of anything nobody answered, before anything else looks
  await releaseStale(db, { now });

  const day = clean(body.day, 10);
  const start = clean(body.start, 5);
  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const phone = clean(body.phone, 60);
  const about = clean(body.about ?? body.message, 2000);

  /* Accepted and dropped, not refused. A bot told its submission failed
     tries again with the field cleared; one told it worked does not. */
  if (clean(body.company, 200)) return { ok: true, quiet: true, state: 'ignored' };

  const opened = Number(body.opened_at);
  if (Number.isFinite(opened) && now.getTime() - opened < 3000) {
    return { ok: true, quiet: true, state: 'ignored' };
  }

  /* How the call happens, checked against what is actually on offer
     rather than against the list of everything this knows about. Turning
     Zoom off in the studio has to turn it off for a hand-made request
     too, or the setting is decoration. */
  const s0 = await shape(db);
  const wanted = clean(body.platform, 20).toLowerCase();
  const platform = wanted
    ? s0.platforms.find((p) => p.id === wanted)
    : s0.platforms[0];

  const problems = [];
  if (!name) problems.push('Your name, so I know who I am talking to.');
  if (!isEmail(email)) problems.push('An email address I can reply to.');
  if (!day || !start) problems.push('Pick a day and a time.');
  if (about.length > 1500) problems.push('Keep it under 1,500 characters.');
  /* Asking for one that is not on offer is refused rather than quietly
     swapped. Falling back to the first looked kinder and was not: a
     stale page offering WhatsApp would book somebody onto Google Meet
     without either of us knowing, and they would find out at the hour.
     Losing a booking to a clear message beats keeping one to the wrong
     medium. */
  if (!platform) {
    problems.push('That is not one of the ways I take calls. Pick another and reload.');
  } else if (platform.needs && phone.replace(/\D/g, '').length < 7) {
    /* A WhatsApp call to an email address does not exist. This is the
       one place the choice is more than a label, so it is the one place
       it can refuse. */
    problems.push(`A number I can reach you on, for ${platform.label}.`);
  }
  if (problems.length) return { ok: false, problems };

  const cf = await turnstileOk(env, body.turnstile ?? body['cf-turnstile-response'], meta.ip);
  if (!cf.ok) return { ok: false, problems: ['That did not look like a person. Try again.'] };

  const ipHash = await hashIp(meta.ip, env.BOOKING_SALT);
  const limited = await overLimit(db, ipHash, now);
  if (limited) return { ok: false, problems: [limited] };

  const { days, shape: s } = await availability(db, { now });
  const offered = days.find((d) => d.day === day);
  if (!offered || !offered.times.includes(start)) {
    return { ok: false, taken: true,
             problems: ['That time has gone. Pick another and it is yours.'] };
  }

  const t = token();
  const expires = new Date(now.getTime() + s.holdHours * 3600000).toISOString();

  try {
    await db
      .prepare(`INSERT INTO appointments
                  (day, start, minutes, name, email, phone, about, platform,
                   state, token, ip_hash, expires_at, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?10, ?11, ?12)`)
      .bind(day, start, s.minutes, name, email, phone, about, platform.id, t,
            ipHash, expires, now.toISOString())
      .run();
  } catch (e) {
    /* The unique index did its job: somebody else got that hour between
       the page being drawn and this being posted. That is the race the
       index exists for, and this is what it looks like from up here. */
    if (/UNIQUE|constraint/i.test(String(e?.message || e))) {
      return { ok: false, taken: true,
               problems: ['Somebody took that one a moment ago. Pick another.'] };
    }
    throw e;
  }

  return { ok: true, state: 'pending', day, start, minutes: s.minutes,
           holdHours: s.holdHours, token: t, name, email, about, phone,
           platform: platform.id, platform_label: platform.label,
           platform_note: platform.note };
}

/** Two live at once from one place, five in a day. */
async function overLimit(db, ipHash, now) {
  try {
    const dayAgo = new Date(now.getTime() - 86400000).toISOString();
    const row = await db
      .prepare(`SELECT
                  SUM(CASE WHEN state = 'pending' THEN 1 ELSE 0 END) AS live,
                  SUM(CASE WHEN created_at >= ?2 THEN 1 ELSE 0 END) AS today
                FROM appointments WHERE ip_hash = ?1`)
      .bind(ipHash, dayAgo)
      .first();
    if ((row?.live ?? 0) >= 2) {
      return 'You already have a time held. I will come back to you on that one first.';
    }
    if ((row?.today ?? 0) >= 5) {
      return 'That is a lot of requests from one place today. Email me instead.';
    }
    return null;
  } catch { return null; }
}

/* ------------------------------------------------------------- deciding */

/** The row behind a decide link, or nothing. */
export async function byToken(db, t) {
  const value = clean(t, 80);
  if (value.length < 32) return null;
  try {
    return await db
      .prepare(`SELECT * FROM appointments WHERE token = ?1 AND token != ''`)
      .bind(value)
      .first();
  } catch { return null; }
}

/**
 * Confirm or decline, once.
 *
 * The token is cleared in the same statement that reads it, so a second
 * press, a forwarded email and a retried request all find nothing.
 */
export async function decide(env, t, verdict, { now = new Date(), link } = {}) {
  const db = env.DB;
  const want = verdict === 'confirm' ? 'confirmed' : 'declined';
  const joining = clean(link, 500);
  const row = await byToken(db, t);
  if (!row) return { ok: false, gone: true, reason: 'That link has been used already.' };
  if (row.state !== 'pending') {
    return { ok: false, already: row.state,
             reason: `That request is already ${row.state}.` };
  }

  /* The joining link is written in the same statement as the decision,
     so a confirmation cannot go out ahead of the thing it is confirming.
     Blank leaves whatever was there, which is what makes confirming from
     the email and pasting the link later two halves of one job rather
     than one overwriting the other. */
  const r = await db
    .prepare(`UPDATE appointments
                 SET state = ?2, token = '', decided_at = ?3,
                     link = CASE WHEN ?5 = '' THEN link ELSE ?5 END
               WHERE id = ?1 AND state = 'pending' AND token = ?4`)
    .bind(row.id, want, now.toISOString(), clean(t, 80), joining)
    .run();

  if ((r?.meta?.changes ?? 0) === 0) {
    return { ok: false, gone: true, reason: 'That link has been used already.' };
  }
  return { ok: true, state: want,
           appointment: { ...row, state: want, token: '', link: joining || row.link } };
}

/**
 * The same decision, made by a person in the studio rather than by email.
 *
 * The email link and this are two doors into one room, so they end in the
 * same states and both clear the token: deciding here means the link in
 * the inbox is spent, which is what you want when you have already dealt
 * with it. `cancel` is the one thing the link cannot do, because a
 * confirmed hour can only be given back from the diary.
 *
 * The UPDATE re-states the row's state as a condition. That is not belt
 * and braces: between reading the row and writing it, the email link or a
 * second tab can decide the same request, and without the condition the
 * later write silently wins.
 */
export async function decideById(env, id, verdict, { now = new Date(), note, link } = {}) {
  const db = env.DB;
  const want = { confirm: 'confirmed', decline: 'declined', cancel: 'cancelled' }[verdict];
  if (!want) return { ok: false, reason: 'That is not a decision.' };

  const row = await db
    .prepare('SELECT * FROM appointments WHERE id = ?1')
    .bind(Number(id))
    .first();
  if (!row) return { ok: false, gone: true, reason: 'There is no request with that number.' };

  const from = want === 'cancelled' ? ['pending', 'confirmed'] : ['pending'];
  if (!from.includes(row.state)) {
    return { ok: false, already: row.state, reason: `That one is already ${row.state}.` };
  }

  const joining = clean(link, 500);
  const r = await db
    .prepare(`UPDATE appointments
                 SET state = ?2, token = '', decided_at = ?3,
                     note = CASE WHEN ?4 = '' THEN note ELSE ?4 END,
                     link = CASE WHEN ?6 = '' THEN link ELSE ?6 END
               WHERE id = ?1 AND state = ?5`)
    .bind(row.id, want, now.toISOString(), clean(note ?? '', 2000), row.state, joining)
    .run();

  if ((r?.meta?.changes ?? 0) === 0) {
    return { ok: false, gone: true, reason: 'Somebody decided that one a moment ago.' };
  }
  return { ok: true, state: want,
           appointment: { ...row, state: want, token: '', link: joining || row.link } };
}

/**
 * Set or replace the joining link on a booking already confirmed, and
 * send it.
 *
 * Confirming and having the link to hand are not always the same moment:
 * a Zoom room made after the fact, a link that changed, a confirmation
 * sent from a phone with nothing to paste. This is the second half on
 * its own, and it is the whole reason the diary screen exists.
 */
export async function setLink(env, id, link, { now = new Date() } = {}) {
  const db = env.DB;
  const joining = clean(link, 500);
  if (!joining) return { ok: false, reason: 'Nothing to send.' };

  const row = await db
    .prepare('SELECT * FROM appointments WHERE id = ?1')
    .bind(Number(id))
    .first();
  if (!row) return { ok: false, gone: true, reason: 'There is no request with that number.' };
  if (row.state !== 'confirmed') {
    return { ok: false, reason: `That one is ${row.state}, so there is nothing to join.` };
  }

  await db
    .prepare('UPDATE appointments SET link = ?2 WHERE id = ?1')
    .bind(row.id, joining)
    .run();
  return { ok: true, appointment: { ...row, link: joining } };
}

/**
 * Tell the person who asked.
 *
 * A confirmation nobody receives is a booking that exists only on your
 * side, and they will book somebody else while it sits there. A decline
 * nobody receives is worse: they wait.
 *
 * Both doors send this, so the wording lives here rather than in whichever
 * one you happened to use.
 */
export async function tellThem(send, env, a, state) {
  const when = niceWhen(a);
  const how = PLATFORMS[a.platform];
  const link = clean(a.link, 500);
  /* The number it will ring from. An unknown foreign number ringing at
     the appointed hour is a call people let go to voicemail, so saying
     it in advance is the difference between a booking and a no-show. */
  const from = await callFrom(env);

  /* What happens at that hour, said in one line, and it is the line the
     whole booking is for. A confirmation that does not say how to get
     to the call is half an answer: it commits somebody to a time and
     leaves them waiting to be told the rest. */
  let via;
  if (!how) {
    via = link
      ? `Here is where: ${link}`
      : 'I will send the joining details nearer the time.';
  } else if (how.needs) {
    const num = link || from;
    via = `I will ring you on ${a.phone}, on ${how.label}.`
      + (num ? `\n\nThe call comes from ${num}, so you know it is me.` : '');
  } else {
    via = link
      ? `${how.label}, and here is the link. Open it at the time:\n\n  ${link}`
      : `We are on ${how.label}. I will send the link before then.`;
  }

  const text = {
    confirmed:
      `That time is yours: ${when}, ${a.minutes} minutes.\n\n`
      + `${via}\n\n`
      + 'Nothing else to do. If something changes at your end, reply to this '
      + 'and I will move it.',
    declined:
      `I cannot do ${when}, sorry.\n\n`
      + 'The other times on the page are still open, so pick another and it is '
      + 'yours. Or reply to this and tell me what suits you.',
    cancelled:
      `I have had to give up ${when}, sorry.\n\n`
      + 'The page has my other times on it and they are all real, so pick one '
      + 'and it is yours. Or reply to this and I will find you something.',
  }[state];
  if (!text || !a.email) return { sent: false };

  const subject = state === 'confirmed' ? `Confirmed: ${when}` : `About ${when}`;
  try {
    await send(env, { to: a.email, subject, text });
    return { sent: true };
  } catch {
    // the decision is recorded either way; a mail server having a bad
    // minute must not roll back an hour you have already given away
    return { sent: false };
  }
}

/**
 * The receipt, sent the moment a request goes in.
 *
 * Somebody filled in a form, watched it succeed, and then had nothing in
 * writing at all until a human got round to answering. That is the point
 * at which a person wonders whether it went through, and the honest fix
 * is a message that says what they asked for and what happens next,
 * including the part they will not like: that this is a request and not
 * yet a booking.
 */
export async function sendReceipt(send, env, a) {
  if (!a.email) return { sent: false };
  const when = niceWhen(a);
  const how = PLATFORMS[a.platform];
  const hours = Math.round(a.holdHours || 36);
  const from = await callFrom(env);

  const text =
    `Thanks. I have got your request for ${when}, ${a.minutes} minutes.\n\n`
    + `That hour is held for you and nobody else can take it while I read this.\n\n`
    + (how
        ? (how.needs
            ? `You asked for ${how.label}, and I will ring you on ${a.phone}.`
              + (from ? ` The call comes from ${from}.` : '') + '\n\n'
            : `You asked for ${how.label}. The link comes with the confirmation.\n\n`)
        : '')
    + `WHAT HAPPENS NEXT. I read these myself rather than a robot, so the answer `
    + `comes from me. I read them once a day, so give it until this time tomorrow.\n\n`
    + `If it suits me you get a confirmation with everything you need to join. `
    + `If it does not, I will say so and the hour goes back on the page, and I `
    + `will point you at the times that are still open.\n\n`
    + `If you hear nothing within ${hours} hours the hold lets go on its own and `
    + `the time is free again, so nothing is stuck waiting on either of us.\n\n`
    + (a.about ? `You said:\n\n  ${a.about}\n\n` : '')
    + 'Reply to this if anything changes.';

  try {
    await send(env, { to: a.email, subject: `Request received: ${when}`, text });
    return { sent: true };
  } catch {
    // a receipt that fails to send is not a reason to lose the booking
    return { sent: false };
  }
}

/**
 * The number I ring from, or nothing.
 *
 * Read here rather than passed in, because every caller that sends one
 * of these messages would otherwise have to remember to fetch it, and
 * the one that forgot would send a message missing the one line that
 * stops the call going to voicemail.
 */
async function callFrom(env) {
  try {
    return (await shape(env.DB)).callFrom || '';
  } catch { return ''; }
}

/** "Wednesday 9 September at 10:00", not "2026-09-09 at 10:00". */
function niceWhen(a) {
  const d = new Date(`${a.day}T12:00:00Z`);
  if (isNaN(d)) return `${a.day} at ${a.start}`;
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  return `${day} at ${a.start}`;
}

export { clean, isEmail, hashIp, token, shape };

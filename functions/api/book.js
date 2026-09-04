/**
 * POST /api/book — intro call requests
 *
 * A Cloudflare Pages Function (a Worker). Runs on the same origin as the site,
 * so the form posts to /api/book with no CORS and no third-party JS.
 *
 * The request is WRITTEN DOWN before anything is sent. That order is the
 * whole point of this file.
 *
 * It used to be delivery-only: email if RESEND_API_KEY was set, KV if a
 * namespace was bound, and otherwise `console.log` and a 200. Neither
 * was configured, so every enquiry this site has ever received went into
 * a log stream nobody reads and was thrown away — while the visitor was
 * shown "Sent." Nothing was stored, so there was nothing to recover.
 *
 * So now:
 *   1. write it to D1, which is already bound and needs no setup
 *   2. then try to email it, if RESEND_API_KEY is set
 *   3. then try KV, if a namespace is bound
 *
 * If every delivery route fails the enquiry is still in the database and
 * still shows up in the studio. If the database write itself fails, the
 * old behaviour is the fallback rather than the plan.
 *
 * Set secrets with:
 *   npx wrangler pages secret put RESEND_API_KEY
 */

const TO_EMAIL = 'ashleymbaht@icloud.com';
const FROM_EMAIL = 'bookings@web3ashley.com'; // must be a domain verified in Resend
const MAX_FIELD = 4000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });

const clean = (v) => String(v == null ? '' : v).trim().slice(0, MAX_FIELD);
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return await request.json();

  const form = await request.formData();
  const out = {};
  for (const [k, v] of form.entries()) {
    if (k === 'slot') (out.slot = out.slot || []).push(String(v));
    else out[k] = String(v);
  }
  return out;
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await readBody(request);
  } catch {
    return json({ ok: false, error: 'Could not read that request.' }, 400);
  }

  // Bots fill hidden fields; humans do not.
  if (clean(data.company)) return json({ ok: true });

  const name = clean(data.name);
  const email = clean(data.email);
  const message = clean(data.message);
  const duration = clean(data.duration) || '30 minutes';
  const date = clean(data.date);
  const slots = Array.isArray(data.slot) ? data.slot.map(clean).filter(Boolean) : [clean(data.slot)].filter(Boolean);

  const errors = [];
  if (!name) errors.push('name');
  if (!isEmail(email)) errors.push('email');
  if (!message) errors.push('message');
  if (!slots.length) errors.push('slot');
  if (errors.length) {
    return json({ ok: false, error: 'Some fields need attention.', fields: errors }, 422);
  }

  const submittedAt = new Date().toISOString();
  const record = {
    name, email, message, duration, date, slots, submittedAt,
    country: request.headers.get('cf-ipcountry') || null
  };

  // 0. The database, first, before anything can go wrong downstream.
  //
  // `referrer` is the page they came from, which is the only way to tell
  // an enquiry that started on an article from one that started on the
  // home page — and therefore the only way to know which writing works.
  let stored = false;
  if (env.DB) {
    try {
      await env.DB
        .prepare(
          `INSERT INTO bookings
             (name, email, message, duration, wanted_date, slots, country,
              referrer, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
        )
        .bind(
          name, email, message, duration, date, slots.join(', '),
          request.headers.get('cf-ipcountry') || '',
          clean(data.from || request.headers.get('referer') || '').slice(0, 300),
          submittedAt
        )
        .run();
      stored = true;
    } catch (err) {
      // most likely: the table is not there yet because setup has not been
      // run since this shipped. Say so in the log in those words, so it is
      // not mistaken for a code fault.
      console.error('booking not saved to D1', String(err?.message ?? err));
    }
  }

  const finish = (delivered) => {
    if (stored && env.DB) {
      // best effort, and deliberately not awaited into the response: the
      // visitor should not wait on a bookkeeping update
      env.DB
        .prepare(`UPDATE bookings SET delivered = ?1 WHERE created_at = ?2 AND email = ?3`)
        .bind(delivered, submittedAt, email)
        .run()
        .catch(() => {});
    }
    return json({ ok: true, delivered, saved: stored });
  };

  const text =
    `Intro call request\n\n` +
    `Name:     ${name}\n` +
    `Email:    ${email}\n` +
    `Duration: ${duration}\n` +
    `Date:     ${date || 'not given'}\n` +
    `Times:    ${slots.join(', ')} (GMT+1)\n` +
    `Sent:     ${submittedAt}\n\n` +
    `What is broken:\n${message}\n`;

  // 1. Email via Resend
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          from: env.FROM_EMAIL || FROM_EMAIL,
          to: [env.TO_EMAIL || TO_EMAIL],
          reply_to: email,
          subject: `Intro call request — ${name}`,
          text
        })
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('resend failed', res.status, detail);
        // fall through to KV so the request is not lost
      } else {
        return finish('email');
      }
    } catch (err) {
      console.error('resend threw', err);
    }
  }

  // 2. Persist to KV
  if (env.BOOKINGS) {
    try {
      await env.BOOKINGS.put(`booking:${submittedAt}:${email}`, JSON.stringify(record));
      return finish('kv');
    } catch (err) {
      console.error('kv put failed', err);
    }
  }

  // 3. Nothing sends it anywhere — but it is in the database, and the
  // studio shows it. That is the difference between this and what was
  // here before, where the same branch threw the enquiry away.
  if (stored) return finish('studio');

  console.log('booking request (nothing configured, nothing stored)', text);
  return json({ ok: true, delivered: 'logged', saved: false });
}

// Anything other than POST
export async function onRequest({ request }) {
  if (request.method === 'POST') return; // handled above
  return json({ ok: false, error: 'Use POST.' }, 405);
}

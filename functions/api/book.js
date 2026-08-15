/**
 * POST /api/book — intro call requests
 *
 * A Cloudflare Pages Function (a Worker). Runs on the same origin as the site,
 * so the form posts to /api/book with no CORS and no third-party JS.
 *
 * Delivery, in order of what is configured:
 *   1. RESEND_API_KEY set        -> emails you via Resend
 *   2. BOOKINGS KV namespace     -> writes the request to KV
 *   3. neither                   -> logs and still returns 200, so the visitor
 *                                   never sees a failure caused by your setup
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
        return json({ ok: true, delivered: 'email' });
      }
    } catch (err) {
      console.error('resend threw', err);
    }
  }

  // 2. Persist to KV
  if (env.BOOKINGS) {
    try {
      await env.BOOKINGS.put(`booking:${submittedAt}:${email}`, JSON.stringify(record));
      return json({ ok: true, delivered: 'stored' });
    } catch (err) {
      console.error('kv put failed', err);
    }
  }

  // 3. Nothing configured — do not fail the visitor.
  console.log('booking request (no delivery configured)', text);
  return json({ ok: true, delivered: 'logged' });
}

// Anything other than POST
export async function onRequest({ request }) {
  if (request.method === 'POST') return; // handled above
  return json({ ok: false, error: 'Use POST.' }, 405);
}

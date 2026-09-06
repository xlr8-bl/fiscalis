/**
 * POST /api/request — ask for one hour, and hold it while I decide.
 *
 * Replaces the old /api/book, which took a date and three preferred
 * times and emailed them: a contact form wearing a calendar's clothes.
 * This holds the actual hour, so two people cannot ask for the same one
 * and nobody has to send a second message to find out.
 *
 * The mail that goes out carries two links. Neither decides anything on
 * its own: see lib/request.js for why a GET that confirms a booking is a
 * booking confirmed by a mail scanner.
 */
import { requestBooking } from '../../lib/request.js';
import { send } from '../../lib/mail.js';
import { SITE } from '../../lib/templates.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return await request.json();
  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, problems: ['Booking is not set up yet.'] }, 503);

  let body;
  try { body = await readBody(request); }
  catch { return json({ ok: false, problems: ['Could not read that.'] }, 400); }

  const ip = request.headers.get('cf-connecting-ip') || '';
  let out;
  try {
    out = await requestBooking(env, body, { ip });
  } catch (e) {
    return json({ ok: false, problems: [`Something went wrong: ${String(e?.message || e)}`] }, 500);
  }

  // a submission that tripped a trap is told it worked and written nowhere
  if (out.quiet) return json({ ok: true, held: false });
  if (!out.ok) return json(out, out.taken ? 409 : 422);

  const when = `${out.day} at ${out.start}`;
  const base = env.SITE || SITE;
  const yes = `${base}/book/decide?t=${out.token}&do=confirm`;
  const no = `${base}/book/decide?t=${out.token}&do=decline`;

  /* The subject carries it, because the whole point of asking is that
     you know what to send before you open anything. */
  const how = out.platform_label
    ? `${out.platform_label}${out.phone ? `, ${out.phone}` : ''}`
    : '';

  const mail = await send(env, {
    replyTo: out.email,
    subject: `Booking request: ${out.name}, ${when}${how ? ` (${how})` : ''}`,
    text:
      `${out.name} <${out.email}> asked for ${when}, ${out.minutes} minutes.\n` +
      (how ? `How: ${how}. ${out.platform_note || ''}\n` : '') +
      `\n${out.about || 'They did not say what it is about.'}\n\n` +
      `The hour is held for ${out.holdHours} hours and then lets go by itself.\n\n` +
      `Confirm:  ${yes}\nDecline:  ${no}\n\n` +
      `Neither link decides anything on its own. Each one opens a page with a ` +
      `button on it, because mail scanners follow links and one of them would ` +
      `otherwise confirm this for you at four in the morning.`,
    html:
      `<p><b>${esc(out.name)}</b> &lt;${esc(out.email)}&gt; asked for ` +
      `<b>${esc(when)}</b>, ${out.minutes} minutes.</p>` +
      (how ? `<p><b>How:</b> ${esc(how)}. ${esc(out.platform_note || '')}</p>` : '') +
      `<p>${esc(out.about || 'They did not say what it is about.')}</p>` +
      `<p>Held for ${out.holdHours} hours, then it lets go by itself.</p>` +
      `<p><a href="${yes}">Confirm this time</a> &nbsp;|&nbsp; ` +
      `<a href="${no}">Decline it</a></p>` +
      `<p style="color:#666;font-size:13px">Neither link decides anything on its ` +
      `own: each opens a page with a button, because mail scanners follow links.</p>`,
  });

  return json({
    ok: true,
    held: true,
    day: out.day,
    start: out.start,
    minutes: out.minutes,
    hold_hours: out.holdHours,
    notified: mail.sent === true,
  });
}

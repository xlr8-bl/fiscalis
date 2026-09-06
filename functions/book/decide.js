/**
 * /book/decide — confirm or decline a held hour.
 *
 * TWO STEPS, DELIBERATELY.
 *
 * GET shows a page saying what will happen, with a button on it. POST is
 * what actually decides. The obvious design is a link in the email that
 * confirms when you open it, and it is wrong: mail scanners, link
 * previewers and corporate security proxies fetch every URL in an inbound
 * message, so the obvious design confirms bookings at four in the morning
 * without anybody reading them.
 *
 * The token is single use and is cleared in the same statement that acts
 * on it, so a second press, a forwarded mail and a retried request all
 * find nothing rather than deciding twice.
 *
 * No sign-in. The token IS the authority, which is the same bargain every
 * unsubscribe link in the world makes, and it is a fair one here: 32
 * random bytes, one use, and the worst a leaked one can do is confirm or
 * decline one hour that you can then change in the studio.
 */
import { byToken, decide } from '../../lib/request.js';
import { page, esc } from '../../lib/plainpage.js';
import { send } from '../../lib/mail.js';

const shell = (title, inner) => page(title, `
  <h1 class="jr_title u-text-style-h2">${esc(title)}</h1>
  ${inner}
`);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const t = url.searchParams.get('t') || '';
  const want = url.searchParams.get('do') === 'decline' ? 'decline' : 'confirm';

  const row = env.DB ? await byToken(env.DB, t) : null;
  if (!row) {
    return shell('That link has been used', `
      <p class="jr_lede u-text-style-h4">Either it has been decided already, or it
      let go on its own. Open the studio to see where the request got to.</p>`);
  }
  if (row.state !== 'pending') {
    return shell(`Already ${esc(row.state)}`, `
      <p class="jr_lede u-text-style-h4">${esc(row.name)} at ${esc(row.day)}
      ${esc(row.start)} is ${esc(row.state)}. Nothing to do here.</p>`);
  }

  const verb = want === 'confirm' ? 'Confirm' : 'Decline';
  return shell(`${verb} this time?`, `
    <p class="jr_lede u-text-style-h4">
      <b>${esc(row.name)}</b> asked for <b>${esc(row.day)} at ${esc(row.start)}</b>,
      ${row.minutes} minutes.
    </p>
    <p>${esc(row.about || 'They did not say what it is about.')}</p>
    <p>Reply to: ${esc(row.email)}${row.phone ? ` &middot; ${esc(row.phone)}` : ''}</p>
    <form method="POST" action="/book/decide">
      <input type="hidden" name="t" value="${esc(t)}">
      <input type="hidden" name="do" value="${esc(want)}">
      <button type="submit" class="g_btn_main">${verb} it</button>
    </form>
    <p style="color:#888;font-size:14px;margin-top:2rem">
      Nothing has changed yet. This page exists because mail scanners follow
      links, and a link that decided on its own would be decided by one of them.
    </p>
  `);
}

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const t = String(form.get('t') || '');
  const want = String(form.get('do') || 'confirm') === 'decline' ? 'decline' : 'confirm';

  if (!env.DB) return shell('Not set up', '<p>There is no database on this deployment.</p>');

  const out = await decide(env, t, want);
  if (!out.ok) {
    return shell('Nothing to do', `<p class="jr_lede u-text-style-h4">${esc(out.reason)}</p>`);
  }

  const a = out.appointment;
  const confirmed = out.state === 'confirmed';

  /* Tell the person who asked. A confirmation nobody receives is a
     booking that only exists on your side, and they will book somebody
     else while it sits there. */
  await send(env, {
    to: a.email,
    subject: confirmed
      ? `Confirmed: ${a.day} at ${a.start}`
      : `About ${a.day} at ${a.start}`,
    text: confirmed
      ? `That time is yours: ${a.day} at ${a.start}, ${a.minutes} minutes.\n\n`
        + 'I will send the joining details nearer the time. If something changes, '
        + 'reply to this and I will move it.'
      : `I cannot do ${a.day} at ${a.start}, sorry.\n\n`
        + 'The other times on the page are still open, so pick another and it is '
        + 'yours. Or reply to this and tell me what suits you.',
  });

  return shell(confirmed ? 'Confirmed' : 'Declined', `
    <p class="jr_lede u-text-style-h4">
      ${esc(a.name)}, ${esc(a.day)} at ${esc(a.start)}.
      ${confirmed
        ? 'The hour is booked and out of the diary. They have been told.'
        : 'The hour is back on the page for somebody else. They have been told, '
          + 'and pointed at the other times.'}
    </p>
    <p><a href="/studio#/bookings">Open the studio</a></p>
  `);
}

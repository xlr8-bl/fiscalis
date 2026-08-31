/**
 * digest.js — the one mail a day.
 *
 * "The posts are ready, here they are, here is the link." That is the
 * whole job. It replaces the staging folder and the thread of screenshots:
 * the mail says what is waiting and every line of it is a link into the
 * studio, so reviewing is one tap from a phone.
 *
 * It is deliberately not a report. Anything you would have to read twice
 * belongs on the screen it links to.
 *
 * Nothing schedules this. Spark ends its cycle by asking for it, which is
 * right: the mail should arrive because the day's work is actually ready,
 * not because a clock went off while the images were still rendering.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const day = (d = new Date()) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

/**
 * What is waiting on a person, and what is stuck.
 *
 * `review` is the queue. `changes` is with Spark, and appears only as a
 * count — chasing it is not your job. `failed` slides are called out
 * separately because they are the one thing that will not resolve itself.
 */
export async function gather(db) {
  const { results: waiting } = await db
    .prepare(
      `SELECT c.slug, c.title, c.pillar, c.topic, c.updated_at,
              count(s.id)                                         AS slides,
              sum(CASE WHEN s.state = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM carousels c LEFT JOIN slides s ON s.carousel_id = c.id
       WHERE c.status = 'review'
       GROUP BY c.id
       ORDER BY c.updated_at`
    )
    .all();

  const counts = {};
  const { results: byStatus } = await db
    .prepare('SELECT status, count(*) AS n FROM carousels GROUP BY status')
    .all();
  for (const r of byStatus ?? []) counts[r.status] = r.n;

  return { waiting: waiting ?? [], counts };
}

/**
 * The mail. Plain text and HTML say the same thing — a mail client that
 * shows the text part must not show a worse version of it.
 */
export function compose({ waiting, counts }, site) {
  const n = waiting.length;
  const subject = n
    ? `${n} carousel${n === 1 ? '' : 's'} to review — ${day()}`
    : `Nothing to review — ${day()}`;

  const board = `${site}/studio#/social`;
  const link = (c) => `${site}/studio#/social/${encodeURIComponent(c.slug)}`;

  const line = (c) =>
    `${c.title || c.slug}` +
    ` — ${c.slides} slide${c.slides === 1 ? '' : 's'}` +
    (c.pillar ? `, ${c.pillar}` : '') +
    (c.failed ? `, ${c.failed} failed to draw` : '');

  const tail = [
    counts.changes ? `${counts.changes} back with Spark.` : '',
    counts.approved ? `${counts.approved} approved, waiting for a slot.` : '',
    counts.scheduled ? `${counts.scheduled} scheduled.` : '',
  ].filter(Boolean);

  const text = n
    ? [
        `${n} carousel${n === 1 ? ' is' : 's are'} ready for you.`,
        '',
        ...waiting.map((c) => `  ${line(c)}\n  ${link(c)}`),
        '',
        ...(tail.length ? [tail.join(' '), ''] : []),
        `All of them: ${board}`,
      ].join('\n')
    : [
        'Nothing is waiting on you.',
        '',
        ...(tail.length ? [tail.join(' '), ''] : []),
        board,
      ].join('\n');

  const html = n
    ? `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#181715">
         <p style="margin:0 0 1.4em">${n} carousel${n === 1 ? ' is' : 's are'} ready for you.</p>
         ${waiting
           .map(
             (c) =>
               `<p style="margin:0 0 1.1em">
                  <a href="${esc(link(c))}" style="color:#181715;font-weight:600">${esc(
                 c.title || c.slug
               )}</a><br>
                  <span style="color:#6b645c;font-size:14px">${esc(
                    line(c).split(' — ').slice(1).join(' — ')
                  )}</span>
                </p>`
           )
           .join('')}
         ${tail.length
           ? `<p style="margin:1.8em 0 0;color:#6b645c;font-size:14px">${esc(tail.join(' '))}</p>`
           : ''}
         <p style="margin:1.4em 0 0;font-size:14px">
           <a href="${esc(board)}" style="color:#6b645c">All of them</a>
         </p>
       </div>`
    : `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#181715">
         <p style="margin:0 0 1.4em">Nothing is waiting on you.</p>
         ${tail.length
           ? `<p style="margin:0 0 1.4em;color:#6b645c;font-size:14px">${esc(tail.join(' '))}</p>`
           : ''}
         <p style="font-size:14px"><a href="${esc(board)}" style="color:#6b645c">The board</a></p>
       </div>`;

  return { subject, text, html, count: n };
}

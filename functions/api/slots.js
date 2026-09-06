/**
 * GET /api/slots — what is actually free.
 *
 * Public and uncached. Cached availability is availability that is wrong
 * within a minute of somebody booking, and a visitor picking a slot that
 * has gone is the one thing a booking page must never do to anybody.
 *
 * Stale holds are released before the answer is worked out, so an hour
 * somebody sat on and never confirmed is offered again with nobody
 * having to notice.
 */
import { availability, releaseStale } from '../../lib/booking.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ days: [], reason: 'No database on this deployment.' });
  try {
    await releaseStale(env.DB);
    const { days, shape, today } = await availability(env.DB);
    return json({
      days,
      today,
      minutes: shape.minutes,
      window: shape.window,
      offset: shape.offset,
      hold_hours: shape.holdHours,
    });
  } catch (e) {
    return json({ days: [], reason: String(e?.message || e) }, 200);
  }
}

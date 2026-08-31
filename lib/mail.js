/**
 * mail.js — sending mail from a Worker.
 *
 * Resend, the same account the booking form already uses. The API key and
 * the addresses come from the environment; with no key set nothing is
 * sent and the caller is told so plainly, because a notification that
 * silently does not arrive is worse than one that never existed — you
 * stop checking the studio because you are waiting for a mail.
 *
 *   npx wrangler pages secret put RESEND_API_KEY
 *
 * FROM_EMAIL has to be on a domain verified in Resend.
 */

const FROM = 'studio@web3ashley.com';
const TO = 'ashleymbaht@icloud.com';

/**
 * @returns {Promise<{sent: boolean, reason?: string, id?: string}>}
 */
export async function send(env, { subject, text, html, to, replyTo }) {
  if (!env.RESEND_API_KEY) {
    return { sent: false, reason: 'No RESEND_API_KEY on this deployment.' };
  }
  const body = {
    from: env.FROM_EMAIL || FROM,
    to: [to || env.TO_EMAIL || TO],
    subject,
    text,
    ...(html ? { html } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const said = await res.text().catch(() => '');
      return { sent: false, reason: `Resend said ${res.status}: ${said.slice(0, 300)}` };
    }
    const out = await res.json().catch(() => ({}));
    return { sent: true, id: out.id };
  } catch (e) {
    return { sent: false, reason: String(e.message || e) };
  }
}

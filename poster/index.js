/**
 * web3ashley-poster — cron triggers for the posting run.
 *
 *   npx wrangler deploy --config poster/wrangler.toml
 *
 * Optional. The same run is reachable from the site as an MCP tool, so a
 * deployment driven entirely from a phone does not need this Worker at
 * all — Gemini Spark schedules its own tasks and calls post_due. This is
 * here for a deployment that would rather its schedule did not depend on
 * Spark being awake.
 *
 * All the logic is in lib/publish.js, shared with the site, so the two
 * triggers cannot drift apart.
 */

import { runDue, due } from '../lib/publish.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDue(env));
  },

  /** The same run on demand, so a slot can be tested without waiting. */
  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = request.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const allowed = env.AGENT_TOKEN && bearer === env.AGENT_TOKEN;

    if (url.pathname === '/run' && request.method === 'POST') {
      if (!allowed) return new Response('Unauthorized', { status: 401 });
      return Response.json(await runDue(env));
    }
    if (url.pathname === '/due' && request.method === 'GET') {
      if (!allowed) return new Response('Unauthorized', { status: 401 });
      return Response.json({ due: await due(env.DB) });
    }
    return new Response('web3ashley-poster', { status: 200 });
  },
};

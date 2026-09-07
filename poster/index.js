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
import { runDueArticles, dueArticles } from '../lib/schedule.js';
import { preflight, preflightAccounts } from '../lib/preflight.js';

export default {
  /* Both queues on every firing: approved carousels onto the platforms,
     scheduled articles onto the journal. The cron slots are the same
     because neither run cares what time it is — each publishes whatever
     is past its own slot, so a missed firing catches up rather than
     skipping anything. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([runDue(env), runDueArticles(env)]));
  },

  /** The same run on demand, so a slot can be tested without waiting. */
  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = request.headers.get('authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const allowed = env.AGENT_TOKEN && bearer === env.AGENT_TOKEN;

    if (url.pathname === '/run' && request.method === 'POST') {
      if (!allowed) return new Response('Unauthorized', { status: 401 });
      const [carousels, articles] = await Promise.all([runDue(env), runDueArticles(env)]);
      return Response.json({ carousels, articles });
    }
    if (url.pathname === '/due' && request.method === 'GET') {
      if (!allowed) return new Response('Unauthorized', { status: 401 });
      return Response.json({
        carousels: await due(env.DB),
        articles: await dueArticles(env.DB),
      });
    }
    /*
     * The rehearsal, against this Worker's own bindings.
     *
     * Worth having separately from the site's: the Worker has its own
     * secrets and its own SITE var, so it can be holding a stale token
     * while the studio's screen says everything is fine. This asks the
     * questions with the credentials that will actually be used at the
     * next firing.
     */
    if (url.pathname === '/check' && request.method === 'GET') {
      if (!allowed) return new Response('Unauthorized', { status: 401 });
      const rows = await due(env.DB);
      return Response.json({
        accounts: await preflightAccounts(env),
        carousels: await Promise.all(rows.map((r) => preflight(env, r))),
      });
    }
    return new Response('web3ashley-poster', { status: 200 });
  },
};

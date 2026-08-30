/**
 * GET /journal/ — the index, rendered from D1.
 *
 * Cached at the edge for an hour and revalidated by the studio on publish,
 * so a reader is served from cache and a publish still shows up at once.
 */
import { listPublished } from '../../lib/articles.js';
import { renderIndexPage, prepare } from '../../lib/templates.js';
import { htmlResponse, missingDatabase, orNotReady } from '../../lib/respond.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return missingDatabase();
  const got = await orNotReady(() => listPublished(env.DB));
  if (!got.ok) return missingDatabase();
  return htmlResponse(renderIndexPage(got.value.map(prepare)));
}

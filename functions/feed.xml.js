/** GET /feed.xml */
import { listPublished } from '../lib/articles.js';
import { renderFeed } from '../lib/templates.js';
import { xmlResponse, missingDatabase } from '../lib/respond.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return missingDatabase();
  return xmlResponse(renderFeed(await listPublished(env.DB)));
}

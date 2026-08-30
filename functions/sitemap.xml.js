/** GET /sitemap.xml — generated from D1 so a publish is submitted at once. */
import { listPublished } from '../lib/articles.js';
import { renderSitemap } from '../lib/templates.js';
import { xmlResponse, missingDatabase, orNotReady } from '../lib/respond.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return missingDatabase();
  const got = await orNotReady(() => listPublished(env.DB));
  if (!got.ok) return missingDatabase();
  return xmlResponse(renderSitemap(got.value));
}

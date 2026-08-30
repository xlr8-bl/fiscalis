/**
 * GET /journal/:slug — one article, rendered from D1.
 *
 * `?preview=<token>` also serves drafts, marked noindex, so the studio can
 * show a real page before anything is published.
 */
import { getBySlug, related } from '../../lib/articles.js';
import { renderArticlePage, prepare } from '../../lib/templates.js';
import { htmlResponse, notFound, missingDatabase } from '../../lib/respond.js';
import { timingSafeEqual } from '../../lib/auth.js';

export async function onRequestGet({ env, params, request }) {
  if (!env.DB) return missingDatabase();

  const slug = String(params.slug || '');
  const token = new URL(request.url).searchParams.get('preview');
  const preview = Boolean(token && env.STUDIO_PASSWORD && timingSafeEqual(token, env.STUDIO_PASSWORD));

  const row = await getBySlug(env.DB, slug, { publishedOnly: !preview });
  if (!row) return notFound();

  const article = prepare(row);
  const isDraft = row.status !== 'published';
  const rel = isDraft ? [] : await related(env.DB, row);

  return htmlResponse(renderArticlePage(article, rel, { preview: isDraft }), {
    // a draft is never cached and never indexed
    cache: isDraft ? 'no-store' : undefined,
  });
}

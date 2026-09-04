/**
 * GET /journal/:slug — one article, rendered from D1.
 *
 * `?preview=<token>` also serves drafts, marked noindex, so the studio can
 * show a real page before anything is published.
 */
import { getBySlug, related } from '../../lib/articles.js';
import { renderArticlePage, prepare } from '../../lib/templates.js';
import { htmlResponse, notFound, missingDatabase, orNotReady } from '../../lib/respond.js';
import { timingSafeEqual } from '../../lib/auth.js';
import { sizesFor } from '../../lib/media.js';
import { bookingOnlyRedirect } from '../../lib/content.js';

export async function onRequestGet({ env, params, request }) {
  if (!env.DB) return missingDatabase();

  const slug = String(params.slug || '');
  const token = new URL(request.url).searchParams.get('preview');
  const preview = Boolean(token && env.STUDIO_PASSWORD && timingSafeEqual(token, env.STUDIO_PASSWORD));

  // a preview link is his own, and has to keep working while the site is
  // showing one thing only — otherwise he cannot read what he is publishing
  const away = await bookingOnlyRedirect(env.DB, { unless: preview });
  if (away) return away;

  const got = await orNotReady(() => getBySlug(env.DB, slug, { publishedOnly: !preview }));
  if (!got.ok) return missingDatabase();
  const row = got.value;
  if (!row) return notFound();

  const isDraft = row.status !== 'published';
  const [sizes, rel] = await Promise.all([
    sizesFor(env.DB, row.body),
    isDraft ? [] : related(env.DB, row),
  ]);
  const article = prepare(row, sizes);

  return htmlResponse(renderArticlePage(article, rel, { preview: isDraft }), {
    // a draft is never cached and never indexed
    cache: isDraft ? 'no-store' : undefined,
  });
}

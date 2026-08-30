/**
 * GET /media/* — serve an uploaded image out of R2.
 *
 * Keys are immutable (they carry a random suffix), so these are cached hard
 * and never revalidated.
 */
export async function onRequestGet({ env, params, request }) {
  if (!env.MEDIA) return new Response('Not found', { status: 404 });

  const key = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const etag = object.httpEtag;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', etag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  // an uploaded SVG is a script vector; never let one run on the site origin
  if ((object.httpMetadata?.contentType || '').includes('svg')) {
    headers.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'");
  }
  return new Response(object.body, { headers });
}

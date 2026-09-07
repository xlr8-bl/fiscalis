/**
 * GET /media/* — serve an uploaded image out of R2.
 *
 * Keys are immutable (they carry a random suffix), so these are cached hard
 * and never revalidated.
 */
export async function onRequestGet(ctx) {
  return serve(ctx, true);
}

/**
 * HEAD is the same answer without the bytes, and it used to 404 on every
 * key because only onRequestGet was exported. Worth having: a 4K master
 * is megabytes, and asking what is there should not cost that. The
 * posting rehearsal checks every slide this way before a post goes out,
 * and a 404 there reads as a missing picture.
 *
 * R2's own `head` returns the metadata without the body, so this is a
 * cheaper call and not just a discarded one.
 */
export async function onRequestHead(ctx) {
  return serve(ctx, false);
}

async function serve({ env, params, request }, withBody) {
  if (!env.MEDIA) return new Response('Not found', { status: 404 });

  const key = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean).join('/');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  const object = withBody ? await env.MEDIA.get(key) : await env.MEDIA.head(key);
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
  // content-length is the whole point of a HEAD, and writeHttpMetadata
  // does not set it
  if (!withBody) headers.set('content-length', String(object.size));
  return new Response(withBody ? object.body : null, { headers });
}

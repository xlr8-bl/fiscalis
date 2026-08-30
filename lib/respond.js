/** Shared responses, so caching and content types are decided in one place. */

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

/**
 * Public pages are cached at the edge for an hour and served stale for a day
 * while revalidating, so a cold D1 read never blocks a reader. The studio
 * purges the edge on publish, so an edit is live immediately regardless.
 */
const PUBLIC_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export function htmlResponse(html, { status = 200, cache } = {}) {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': cache || PUBLIC_CACHE,
      ...SECURITY,
    },
  });
}

export function xmlResponse(xml, { status = 200 } = {}) {
  return new Response(xml, {
    status,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': PUBLIC_CACHE,
      ...SECURITY,
    },
  });
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...SECURITY,
      ...extraHeaders,
    },
  });
}

export function notFound() {
  return htmlResponse(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Not found — Web3Ashley</title>' +
      '<meta name="robots" content="noindex">' +
      '<link href="/assets/css/site.css" rel="stylesheet"><link href="/assets/css/statement.css" rel="stylesheet">' +
      '<link href="/assets/css/journal.css" rel="stylesheet"></head>' +
      '<body class="body jr-body"><main class="jr_wrap"><h1 class="jr_display">404</h1>' +
      '<p class="jr_index_lede u-text-style-h4">That page is not here. ' +
      '<a href="/journal/">The journal</a> might be what you wanted.</p></main></body></html>',
    { status: 404, cache: 'no-store' }
  );
}

/**
 * The one failure a fresh clone hits. Says what to run rather than 500ing,
 * because "no D1 binding" is a setup step, not a bug.
 */
export function missingDatabase() {
  return htmlResponse(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<title>Journal not configured</title><meta name="robots" content="noindex">' +
      '<style>body{background:#080807;color:#e8e8e3;font:15px/1.6 system-ui;padding:3rem;max-width:44rem}' +
      'code{background:#1a1a17;padding:.15em .4em}pre{background:#141412;padding:1rem;overflow-x:auto}</style>' +
      '</head><body><h1>The journal has no database yet</h1>' +
      '<p>Create it, apply the schema, and put the id in <code>wrangler.toml</code>:</p>' +
      '<pre>npx wrangler d1 create web3ashley\n' +
      'npx wrangler d1 execute web3ashley --remote --file=./schema.sql\n' +
      'python3 tools/seed_d1.py | npx wrangler d1 execute web3ashley --remote --file=-</pre>' +
      '<p>See <code>content/README.md</code>.</p></body></html>',
    { status: 503, cache: 'no-store' }
  );
}

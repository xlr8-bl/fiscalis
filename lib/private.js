/**
 * private.js — 404 for source paths.
 *
 * pages_build_output_dir is the repo root, so every file in it is uploaded
 * and served. _redirects cannot express a 404 (only redirect statuses), and
 * Pages has no ignore file, but a Function shadows a static asset on the
 * same path — so these routes exist purely to hide their directories.
 *
 * Nothing here holds a secret (secrets come from the environment), so this
 * is tidiness rather than a control. Do not start relying on it as one.
 */
export const hidden = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });

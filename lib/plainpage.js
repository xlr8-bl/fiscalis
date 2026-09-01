/**
 * plainpage.js — the small dark page the OAuth round trips land on.
 *
 * These are not site pages. They are the two or three screens a person
 * sees while wiring something up: approve this, that worked, that did
 * not and here is the exact field to fix. They load with no stylesheet,
 * no fonts and no script, because a page whose job is to explain a
 * failure should not have anything of its own left to fail.
 *
 * One copy, because two of them would drift and these screens are
 * exactly where a person is already unsure whether they are in the right
 * place.
 */

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const page = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} — Web3Ashley</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#080807; color:#e8e8e3;
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  main { width:min(30rem,90vw); padding:2rem 0; }
  h1 { font-size:1.5rem; margin:0 0 .6rem; font-weight:600; }
  p { color:#938f8a; margin:0 0 1.4rem; }
  ul { color:#938f8a; padding-left:1.1rem; margin:0 0 1.4rem; }
  li { margin-bottom:.3rem; }
  label { display:block; margin-bottom:.4rem; }
  input { width:100%; box-sizing:border-box; padding:.8rem .9rem;
          background:#14130f; color:inherit; border:0; font:inherit; }
  button { margin-top:1.2rem; padding:.8rem 1.4rem; border:0; cursor:pointer;
           background:#e8e8e3; color:#080807; font:inherit; font-weight:600; }
  a { color:#e8e8e3; }
  .err { color:#e8b3a0; }
  code { color:#bfbfb1; font-size:.85em; word-break:break-all; }
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  );

# web3ashley

A digital studio focused on systems that work.

Static site. No build step, no framework, no dependencies, no bundled third-party
assets — ten text files, all written for this project.

```
index.html            the page
assets/css/main.css   styles
assets/js/main.js     behaviour (optional; the page works without it)
favicon.svg
_headers              security + caching headers (Cloudflare Pages)
_redirects            old paths → in-page anchors
robots.txt  sitemap.xml
wrangler.toml  package.json
```

## Run locally

```bash
npm run serve     # http://127.0.0.1:8080
# or
npx wrangler pages dev .
```

## Deploy to Cloudflare Pages

**Option A — connect the Git repo (recommended).** In the Cloudflare dashboard:
Workers & Pages → Create → Pages → Connect to Git, pick this repo, then set:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `/` |

Every push to the branch publishes automatically.

**Option B — from the terminal.**

```bash
npx wrangler login
npm run deploy        # wrangler pages deploy . --project-name=web3ashley
```

## Custom domain

Pages project → Custom domains → add `web3ashley.com` and `www.web3ashley.com`.
Cloudflare issues the certificate and handles the apex/www redirect. If the domain
is already on Cloudflare DNS there is nothing else to configure.

## Contact form

The form has no backend. By default it composes an email to `ashleymbaht@icloud.com`
from the fields, so it works with nothing to configure and nothing to pay for.

To POST to a real endpoint instead, add `data-endpoint` to the `<form>`:

```html
<form class="form" data-form data-endpoint="https://example.com/submit">
```

The script then POSTs `FormData` and shows inline success/failure. If you point it at
a third-party service, add that origin to `form-action` in `_headers`, or the CSP will
block the submission.

## Notes

- `_headers` sets HSTS, `nosniff`, `X-Frame-Options`, a referrer policy, a strict CSP
  (`default-src 'self'`), and immutable caching for `/assets/*`. Verified: the page
  loads clean under that policy with no violations.
- Editing content means editing `index.html` — the copy is plain HTML, in order.

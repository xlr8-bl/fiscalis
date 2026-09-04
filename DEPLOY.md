# Deploying

Static site plus one Cloudflare Pages Function. No build step.

```
index.html            home
book.html             intro call request page  (served at /book)
assets/               css, js, fonts, media
functions/api/book.js the Worker that receives booking requests
_headers _redirects   Pages config
wrangler.toml
```

## Run it locally

```bash
npm run dev      # npx wrangler pages dev .  -> http://127.0.0.1:8788
```

That runs the Function too, so the booking form works locally. `npm run serve`
starts a plain static server instead, where the form falls back to composing an email.

## Deploy

**Connect the repo (recommended).** Cloudflare dashboard → Workers & Pages → Create →
Pages → Connect to Git:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | *(empty)* |
| Build output directory | `/` |

`functions/` is picked up automatically. Every push publishes.

**Or from the terminal:**

```bash
npx wrangler login
npm run deploy
```

## Make the booking form send email

The Function works with nothing configured — it accepts the request and returns
success, so visitors never hit an error. To actually receive the requests, pick one:

### Resend (email)

1. Sign up at resend.com, verify `web3ashley.com` as a sending domain.
2. Add the key as a secret:

```bash
npx wrangler pages secret put RESEND_API_KEY
```

3. Optionally override the addresses with `TO_EMAIL` and `FROM_EMAIL` environment
   variables in the Pages dashboard. `FROM_EMAIL` must be on the verified domain.

Requests arrive with `reply_to` set to the visitor, so replying goes straight to them.

### KV (no third party)

```bash
npx wrangler kv namespace create BOOKINGS
```

Uncomment the `[[kv_namespaces]]` block in `wrangler.toml` and paste the id. Requests
are stored under `booking:<timestamp>:<email>`; read them with
`npx wrangler kv key list --binding BOOKINGS`.

If both are configured, email is tried first and KV is the fallback, so a provider
outage never loses a request.

## The endpoint

`POST /api/book`, accepting form-encoded or JSON:

| Field | Notes |
| --- | --- |
| `name` | required |
| `email` | required, validated |
| `message` | required |
| `slot` | required, repeatable — one per selected time |
| `duration` | defaults to 30 minutes |
| `date` | optional |
| `company` | honeypot — must stay empty |

Responses: `200 {ok:true}`, `422` with a `fields` array when validation fails,
`405` for anything other than POST.

## Custom domain

Pages project → Custom domains → add `web3ashley.com` and `www.web3ashley.com`.
Cloudflare issues the certificate and handles the apex/www redirect.

## The journal

Articles live in D1 and are rendered by a Worker — there is no build step and
nothing to commit. `/studio.html` is where you write and publish.

Setup (database, R2 bucket, secrets, importing the existing articles) is in
`content/README.md`. Until D1 is bound, `/journal/` returns a page telling you
which commands to run rather than a 500.

## Showing the booking page only

`/studio.html` → Settings → **What's showing** → Booking only.

One switch, from a phone. It leaves the opening, the questions and the
closing call and takes away the pitch, the statement, Work, Services,
Process and the Journal, along with every link that pointed at them. The
journal answers `302 /book` rather than a 404, so nothing it has earned in
search is lost, and it drops out of the sitemap for as long as it is
redirecting. Your own preview links keep working.

Nothing is deleted and nothing is deployed. The markup ships whole and the
sections are taken out on the way to the browser, so turning it off puts
everything back on the next request. `node tools/check_showing.mjs` asserts
both directions against a running dev server.

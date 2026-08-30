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

Articles live in `content/articles/` as Markdown and are compiled to static
pages by `tools/build_journal.py`. Run it after any content change and commit
the output — there is still no build step on deploy.

```bash
python3 tools/build_journal.py
```

It regenerates `journal/`, `sitemap.xml` and `feed.xml`. See `content/README.md`
for writing and for the Gemini drafting pipeline.

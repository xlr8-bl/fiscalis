# The Unsplash application

Paste part one into the form at **unsplash.com/oauth/applications/new**.
Once the app exists, paste part two into the **Apply for Production**
form in the same dashboard.

Nothing here claims anything the code does not do. The three guideline
requirements are in `lib/photos.js`, and where the honest answer to a
question is "no", that is the answer.

---

## Part one: registering the application

**Application name**

    web3ashley studio

**Description**

> The publishing tool for my web design business. I write my articles
> and Instagram posts in it and schedule them, and I use the Unsplash
> API to find the photograph that goes behind each one. I search, look
> at what comes back, and pick one. That photograph becomes the
> background of a cover image or a social sheet. One business, one user.

Tick every guideline box, then read the next section. Two of those boxes
are what applications get rejected over.

---

## Part two: applying for production

This is the part a person reads. Put it in your own words if you would
rather. What matters is that all three requirements are named and shown.

> **What does your application do?**
>
> It is the publishing tool for my own web design business. I write
> articles and social posts in it and schedule them. When a post needs a
> photograph I search Unsplash from inside the tool, look at what comes
> back, and choose one. That photograph becomes the background of a
> cover image or a social sheet with my own typography over it. I am the
> only user.
>
> **How do you use the API?**
>
> Only `/search/photos`, and only when I press search. Nothing crawls
> and nothing pre-fetches, so my request volume is roughly the number of
> posts I write. The access key is a server-side secret on Cloudflare
> and never reaches a browser.
>
> On hotlinking: photographs always load from the URL the API returns. I
> take `urls.raw` and add Unsplash's own sizing parameters to it, so
> Unsplash serves every view and the photographer gets the count. I
> never re-host a search result to display it and I never build a URL of
> my own.
>
> On download tracking: choosing a photograph and keeping it sends an
> authenticated GET to that photo's `links.download_location` first.
> Searching does not send it. Only actually taking the picture does,
> which is what the endpoint is for.
>
> On attribution: I store the photographer's name with every photograph,
> along with a link to their Unsplash profile and a link to Unsplash,
> and the credit appears wherever the photograph does. Both links carry
> `?utm_source=web3ashley&utm_medium=referral`.
>
> Things I do not do. I do not sell photographs, altered or otherwise. I
> do not offer a photo search or a wallpaper feature to anyone else; the
> search exists so I can illustrate my own writing. I keep the Unsplash
> name and logo out of my branding, and I do not describe the app as an
> Unsplash client. There are no other users, so nobody is asked to
> register a developer account.

---

## What they will check, and where it is

| Their requirement | Where it lives |
| --- | --- |
| Hotlinked image URLs | `fromUnsplash`, built on `p.urls.raw` |
| Download endpoint on use | `keepPhoto`, GET to `photo.countAt` |
| Photographer credit and profile link | `keepPhoto` returns `credit`, `creditLink` |
| Link to Unsplash | `keepPhoto` returns `homeLink` |
| UTM on both links | `withUtm` |
| Key kept server-side | Cloudflare secret `UNSPLASH_ACCESS_KEY` |

## Before you submit

Two things have to be true on the day they look, because they may open
the site.

**Set the key**, or the tool has never made an API call and there is
nothing for them to see:

    npx wrangler pages secret put UNSPLASH_ACCESS_KEY

Paste the Access Key from the app you just registered. Not the Secret
Key. That one is for OAuth, which this does not use.

**Then use it a few times.** Search, pick a photograph, publish the post
it belongs to. An application with a live key and no requests behind it
reads as a form somebody filled in. A handful of real ones reads as a
tool. There is no minimum and no waiting period; a week of ordinary use
is plenty.

Demo access is 50 requests an hour, already more than a day of writing
needs. Production is 1,000. Only calls to `api.unsplash.com` count
against it, so the photographs themselves are free. Nothing breaks while
you wait.

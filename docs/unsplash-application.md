# The Unsplash application

Everything below is written to be pasted into the form at
**unsplash.com/oauth/applications/new**, and then, once the app exists,
into the **Apply for Production** form in the same dashboard.

Nothing here claims anything the code does not do. The three guideline
requirements are implemented in `lib/photos.js`, and where the form asks
a question the honest answer to is "no", that is the answer given.

---

## Part one: registering the application

**Application name**

    web3ashley studio

**Description**

> A small web design studio's own publishing tool. It writes and
> schedules the studio's articles and its Instagram posts from one
> place, and it uses the Unsplash API to find the photograph that goes
> behind each one. A search returns candidates, a person picks one, and
> the picked photograph becomes the background of an article's cover
> image or a social sheet. It is used by one person, for one business.

**Tick every guideline box.** Then read the next section, because two of
them are the ones applications get rejected for.

---

## Part two: applying for production

This is the part they read. Answer in your own words if you would rather;
what matters is that each of the three requirements is named and shown.

> **What does your application do?**
>
> It is the publishing tool for my own web design business. I write
> articles and social posts in it and schedule them. When a post needs a
> photograph I search Unsplash from inside the tool, look at what comes
> back, and choose one. The chosen photograph becomes the background of
> a cover image or a social sheet, with my own typography over it. There
> is one user, which is me.
>
> **How do you use the API?**
>
> Only `/search/photos`, and only when I press search. There is no
> crawling, no pre-fetching and no caching of results: a search happens
> because a person asked for one, so my request volume is roughly the
> number of posts I write. The access key is a server-side secret on
> Cloudflare and is never sent to a browser.
>
> **Hotlinking.** Photographs are always loaded from the URL the API
> returns. I build the display URL on `urls.raw` and add Unsplash's own
> sizing parameters to it, so every view is served by Unsplash and
> counts for the photographer. I never re-host a search result to show
> it, and I never use a URL I constructed myself.
>
> **Download tracking.** When I choose a photograph and it is kept, the
> tool sends an authenticated GET to that photo's
> `links.download_location` before anything else happens. Searching does
> not trigger it; only actually taking the picture does, which is what
> the endpoint is for.
>
> **Attribution.** Every photograph is stored with the photographer's
> name, a link to their Unsplash profile and a link to Unsplash, and the
> credit is shown wherever the photograph is. Both links carry
> `?utm_source=web3ashley&utm_medium=referral`.
>
> **What I do not do.** I do not sell photographs, altered or otherwise.
> I do not offer a photo search or a wallpaper feature to anybody else;
> the search exists so that I can illustrate my own writing. I do not
> use the Unsplash name or logo in my branding, and the app is not
> called an Unsplash client. There are no other users to register, so
> nobody is asked for a developer account.

---

## What they will check, and where it is

| Their requirement | Where it lives |
| --- | --- |
| Hotlinked image URLs | `fromUnsplash`, built on `p.urls.raw` |
| Download endpoint on use | `keepPhoto`, GET to `photo.countAt` |
| Photographer credit + profile link | `keepPhoto` returns `credit`, `creditLink` |
| Link to Unsplash | `keepPhoto` returns `homeLink` |
| UTM on both links | `withUtm` |
| Key kept server-side | Cloudflare secret `UNSPLASH_ACCESS_KEY` |

## Before you submit

Two things have to be true on the day they look, because they may open
the site.

1. **The key has to be set**, or the tool has never made a single API
   call and there is nothing for them to see:

       npx wrangler pages secret put UNSPLASH_ACCESS_KEY

   Paste the Access Key from the app you just registered. Not the Secret
   Key: that one is for OAuth, which this does not use.

2. **Use it a few times first.** Search, choose a photograph, publish
   the post it belongs to. An application with a live key and zero
   requests reads as a form somebody filled in, and one with a handful
   of real ones reads as a tool. There is no minimum and no waiting
   period; a week of ordinary use is plenty.

Demo access is 50 requests an hour, which is already more than a day of
writing needs. Production is 1,000. Only calls to `api.unsplash.com`
count, so the photographs themselves are free of the limit. Nothing
breaks while you wait.

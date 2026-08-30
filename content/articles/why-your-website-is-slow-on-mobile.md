---
title: Why your website is slow on a phone, and what it is costing you
description: Your site loads fine on your laptop and takes eleven seconds on a customer's phone. Here is where those seconds actually go, and which ones are worth buying back.
date: 2026-08-04
tags: [speed, mobile]
---

You open your own website on your own laptop, on your own wifi, and it appears
instantly. So the site is fine.

Then someone tries it on a four-year-old Android, on mobile data, standing
outside your shop. It takes eleven seconds. They are gone by second four.

This is the single most common gap I find, and it is invisible from the inside.
You are the worst possible tester of your own site, because your browser has
already cached everything and your connection is nothing like theirs.

## Where the seconds actually go

There are only a handful of real culprits, and they are almost always the same
ones.

**Images that were never resized.** Someone uploaded a photo straight off a
phone camera — 4000 pixels wide, four megabytes — into a slot that displays it
at 400 pixels. The browser downloads all four megabytes, then throws away 90%
of it. Five of those on a page is twenty megabytes of transfer for something
that should have been under one.

**Fonts that block the text.** A custom font has to download before the browser
will paint a single word in it. If the font is 300KB and hosted on a third-party
domain, that is a DNS lookup, a connection, a download, and only then does your
headline appear. Until that finishes, the visitor is looking at a blank page.

**Scripts that run before anything is shown.** Chat widgets, popup builders,
analytics, cookie banners, A/B testing tools, review widgets. Each one is a
separate download and a separate chunk of work on a phone processor that is
already struggling. I have seen sites where the actual content was 200KB and
the marketing tools around it were 2.4MB.

**A platform doing far too much.** Some page builders ship the code for every
feature they support, not the ones you used. You get the slider library on a
page with no slider.

## What each second is worth

The numbers here are well established and unusually consistent across
industries. Google's own research puts the bounce probability up 32% when a
page goes from one second to three, and up 90% when it goes from one to five.
By ten seconds it is up 123%.

That is not a ranking penalty. That is customers leaving before they see
anything you sell.

> Every second you cut is not a technical improvement. It is a percentage of
> people who now arrive instead of giving up.

There is a second-order effect too. Google uses page experience signals in
ranking, so a slow site is both losing the people who arrive and getting fewer
of them in the first place.

## How to actually measure it

Stop testing on your own machine. Two free tools give you the truth:

1. **PageSpeed Insights** (pagespeed.web.dev). Paste your URL. Read the *field
   data* at the top, not the lab score underneath — field data is real visits
   from real people on real phones. The lab score is a simulation.
2. **WebPageTest** (webpagetest.org). Set the location near your customers, the
   device to a mid-range Android, and the connection to 4G. Then watch the
   filmstrip. You will see exactly what a visitor sees at each second.

The number that matters most is **Largest Contentful Paint** — how long until
the biggest thing on screen appears. Under 2.5 seconds is good. Over 4 seconds
is losing you money.

## What to fix first

In order of return on effort:

1. **Resize and compress every image.** Usually the single biggest win and the
   easiest. Export at the size it actually displays, at around 80% quality.
   Convert to WebP if your platform supports it.
2. **Remove third-party scripts you are not using.** Go through them one at a
   time and ask what each one has done for you in the last six months. Most
   sites are carrying two or three tools nobody has looked at since they were
   installed.
3. **Host your fonts yourself, and subset them.** A font cut down to the
   characters you actually use is often 90% smaller.
4. **Lazy-load anything below the fold.** Images and videos further down the
   page should not compete with the content someone is trying to read now.

## When it is not worth optimising

Sometimes the honest answer is that the platform is the problem. If the site is
built on a page builder that ships 2MB of code before your content, you can
spend a week shaving 300KB off and still be slow.

At that point the choice is a rebuild, and that is a real decision with a real
cost. But it is worth pricing, because the alternative is paying for traffic
that leaves before it arrives.

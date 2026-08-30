---
title: Your menu is a photograph, and Google cannot read a word of it
description: A menu saved as a JPEG or PDF is invisible to search, unreadable on a phone, and impossible for a screen reader. Here is what it costs and how to fix it in an afternoon.
date: 2026-07-28
tags: [search, restaurants, accessibility]
---

The designer sent over a beautiful menu. Someone saved it as a JPEG and put it
on the website. It looks exactly like the printed one, which felt like the
point.

Nothing in it can be searched, read aloud, copied, translated, or found by
anyone looking for what you sell.

## What a search engine sees

When Google crawls a page with a text menu, it reads every dish, every
description, every price. When someone in your town searches "wood fired pizza
near me" or "gluten free bakery", those words on your page are why you come up.

When Google crawls a page with an image of a menu, it sees a rectangle. It can
guess a little from the filename and the alt text, and that is all. Every dish
name you offer — every one of them a phrase a real person might type — is
invisible.

You are competing for local searches with one hand tied, against competitors
whose menus happen to be text.

> A menu image is not a design decision. It is an opt-out from every search
> for the food you actually sell.

## What a customer sees

It is worse on a phone. An image sized for A4 arrives on a 6-inch screen at
about 15% of its intended size. The visitor pinches, zooms, drags around, loses
their place, gives up. Every one of those actions is a chance to leave.

A PDF is not better. On most phones it opens in a separate viewer, taking the
visitor out of your site entirely. Coming back means the back button and a
reload. Many do not.

## Who is excluded completely

Anyone using a screen reader gets nothing. Not a summarised version — nothing at
all. The same is true for anyone who needs larger text, higher contrast, or a
translation into their own language.

Depending on where you operate this may also be a legal exposure, but the
practical point stands on its own: these are customers who wanted to buy from
you and could not read what you sell.

## The fix

It is genuinely an afternoon of work.

1. **Type the menu into the page as text.** Headings for sections, a list for
   dishes, the description underneath, the price alongside. This is ordinary
   web content.
2. **Keep the design in CSS, not in the image.** The typography, the rules
   between courses, the spacing — all of that can be styled. You do not have to
   choose between looking good and being readable.
3. **Add structured data.** `Menu` and `MenuItem` schema tell Google explicitly
   what each item is and what it costs. This is what powers rich results.
4. **Keep the PDF as a download if you want.** Link to it as an extra, for
   people who want to print. Just do not make it the only version.

## The version that keeps happening

The reason menus end up as images is almost never ignorance. It is that
updating text on the website is hard, and replacing an image is easy. Someone
changes a price, exports a new JPEG, uploads it, done.

That is a real workflow problem and it deserves a real answer: the menu should
be editable by you, in a few minutes, without calling anybody. If it is not,
the image will come back within a year no matter how well the text version is
built.

Fix the workflow and the menu stays text. Fix only the page and you are back
here next spring.

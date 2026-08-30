---
title: Your contact form works. The notifications stopped six months ago.
description: The form submits, the thank-you page appears, and nothing arrives. It is the most expensive silent failure on a small business website. Here is how to test yours in five minutes.
date: 2026-07-21
tags: [forms, leads]
---

The form still works. Somebody fills it in, presses send, and gets a cheerful
"thanks, we'll be in touch". Every part of that is real.

The email announcing it broke months ago, and nobody noticed, because a form
that has stopped delivering looks exactly like a form nobody is filling in.

## Why this fails silently

Form notifications are almost always sent from your website's server to your
inbox. That is a handoff between systems, and there are a dozen ordinary,
undramatic ways for it to stop:

- **The forwarding address changed.** Someone left, the mailbox was closed, the
  form is still sending to it.
- **The sending domain lost its authentication.** SPF, DKIM and DMARC records
  drift when DNS is edited. Mail that used to arrive starts being marked as
  spam, then rejected outright.
- **A plugin updated.** The mail settings reset to defaults, or the integration
  key expired.
- **The host changed their mail policy.** Many now block direct mail from web
  servers to fight spam, which quietly kills any form not using a proper
  sending service.
- **It is going to spam.** Not lost — just in a folder nobody opens.

None of these produce an error the visitor sees. From their side, it worked.

> A broken form is worse than no form. No form sends people to the phone. A
> broken form takes their enquiry and their expectation of a reply.

## Test yours in five minutes

Do this now, properly, not from memory.

1. Open your site on your phone, on mobile data, not on the office wifi. Use a
   private window so you are not logged in as an admin.
2. Fill the form in as a customer would, with a personal email address you
   control — not a company one.
3. Send it. Note the exact time.
4. Check the destination inbox. Then check spam. Then check any shared mailbox
   or helpdesk it might route to.
5. Reply to the notification. Confirm the reply reaches the address the
   customer typed, and does not bounce.

That last step catches the second-most-common failure: notifications arrive,
but the reply-to header is wrong, so answering goes nowhere.

## Make it impossible to fail quietly again

Testing once tells you about today. The point is to know within a day, every
time, forever.

**Send through a real email service.** Resend, Postmark, SendGrid — any of them.
They authenticate properly, they retry, and crucially they show you a delivery
log. You can look up whether a specific message was accepted, bounced, or
deferred.

**Store every submission somewhere other than email.** A database row, a
spreadsheet, a CRM. Email is a notification, not a record. If email fails, the
enquiry should still exist somewhere you can find it.

**Send yourself a weekly digest.** "Three enquiries this week." Zero is
information. A week with no digest at all is a louder signal than a week with a
zero in it.

**Add a monitor.** A scheduled job that submits a test enquiry once a day and
alerts you if it does not land. This is fifteen minutes to set up and it turns
a six-month outage into a one-day one.

## What it costs to leave

Work out roughly what one customer is worth to you over the time they stay. Then
guess conservatively at how many enquiries a month the form used to bring — two,
five, ten.

Multiply by six months.

That is the number, and for most of the businesses I have shown it to, it is
considerably more than the cost of ever having the form looked at.

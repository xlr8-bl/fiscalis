---
title: The spreadsheet that runs your business, and the day it goes missing
description: One file, one person who understands it, and no version of the business that survives losing either. How to tell when a spreadsheet has outgrown itself, and what to do about it.
date: 2026-06-02
tags: [operations, tools]
---

There is a spreadsheet. It holds the bookings, or the stock, or the customers,
or the jobs. It has grown for years. One person understands the formulas, and
increasingly not all of them.

It works. That is not sarcasm — spreadsheets are extraordinary tools and most
businesses should use one for longer than they think.

The problem is not that it is a spreadsheet. It is that nothing else in the
business would survive the file being deleted, and nobody has quite noticed that.

## Where the actual risk sits

**One copy, one person.** Ask yourself: if the laptop died this afternoon, and
the person who maintains it were unreachable for a fortnight, could the business
take an order tomorrow? For a lot of businesses the honest answer is no, and
that is a serious single point of failure hiding in something that feels
mundane.

**No history.** Someone overwrites a cell in March. You find out in July.
Nothing tells you what it used to say or who changed it.

**Two people, two versions.** The moment anyone works from a copy, the copies
diverge, and you get quiet, expensive disagreements about which is right.

**It cannot be checked.** A spreadsheet will happily accept a booking for the
30th of February, a negative quantity, or the same slot twice. It has no idea
what your rules are.

**Formulas rot.** A row gets inserted, a range does not extend, a total is
silently wrong from that day forward. This is the failure mode that costs the
most, because it does not look like a failure.

## When it is genuinely still fine

Do not let anyone rush you off a spreadsheet that is working. Keep it if:

- One person maintains it and that is not a problem yet.
- Volume is low enough that manual entry is not eating real time.
- The rules change often — spreadsheets are far better than software at
  handling a process you are still figuring out.
- It is backed up automatically and version history exists.

That last point does most of the work. Moving the file to Google Sheets,
OneDrive or Dropbox — where every change is versioned and it is not on one
laptop — removes the two worst risks in about ten minutes, for free.

**If you do nothing else after reading this, do that.**

## The signals it has outgrown itself

- **Someone is retyping.** The same information entered twice, in two places.
  That is the clearest signal available, and it always gets worse.
- **You are afraid of it.** People avoid touching certain tabs. Fear is a
  reliable indicator of unmanaged complexity.
- **Customers see the seams.** Double bookings. "Let me check and call you
  back." Things falling through.
- **It cannot answer a simple question.** How many of X did we sell last spring?
  Which customers have not ordered in six months? If getting an answer means an
  afternoon of manual work, the data is trapped.
- **More than two people need it at once.**

## What replacing it should look like

The failure mode here is going straight to a large custom system. That is
usually wrong, expensive, and produces something people refuse to use.

Better, in order:

1. **Move it somewhere versioned and shared.** Ten minutes. Removes the
   catastrophic risks.
2. **Add validation inside the spreadsheet.** Dropdowns instead of free text,
   date pickers, protected formula ranges. An afternoon, and it kills a whole
   category of error.
3. **Use an off-the-shelf tool for the specific job.** Booking systems,
   inventory tools, simple CRMs — these exist, they are cheap, and they have
   already solved your problem. Look here properly before commissioning
   anything.
4. **Build something custom only for the part that is genuinely yours.** Most
   businesses need custom software for one process, not for everything.

> The goal is not to get rid of the spreadsheet. It is to make sure the business
> does not stop when the file does.

## The migration nobody plans for

If you do move to a system, the hard part is not the software. It is the years
of accumulated data, in a format the new system does not expect, with
inconsistencies nobody knew about — three spellings of the same customer, dates
in two formats, a column that means different things before and after 2023.

Budget real time for that. Every migration I have seen that went badly went
badly here, and every one that went well started by exporting the data and
looking at it honestly before choosing anything.

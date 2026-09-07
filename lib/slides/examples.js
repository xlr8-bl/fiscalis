/**
 * examples.js — one filled slide per template.
 *
 * These exist to be looked at. A template with no example is a shape
 * nobody has seen carrying real words, and the reference set is full of
 * layouts that hold six words beautifully and fall apart at twenty.
 *
 * Written in the voice: first person singular, no price, nothing
 * claimed that is not diagnosed, and no invented figure. Where a number
 * appears it is the kind you would read off a report rather than one
 * that sounds right.
 */

export const EXAMPLE_SLIDES = [
  {
    _name: 'open', template: 'open', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Your site loads. So what?',
    say: 'Loading is the floor, not the finish. A page can appear in two '
       + 'seconds and still lose every person who opens it, because '
       + 'arriving somewhere is not the same as knowing what to do there.',
    icons: ['orbit', 'bolt', 'eye', 'no'],
    action: 'Open your own site on your phone, on data, and time how long '
          + 'before you know what to tap.',
  },
  {
    _name: 'reasons', template: 'reasons', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Why nobody calls',
    say: 'The enquiries are not missing because the site is ugly. They are '
       + 'missing because of one of these:',
    chips: ['the number is a picture', 'the form emails nowhere',
            'the hours are last year’s'],
    icons: ['message', 'no', 'target'], accent: ['idea'],
    action: 'Send yourself an enquiry through your own form and wait a day '
          + 'for it to arrive.',
  },
  {
    _name: 'steps', template: 'steps', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'How to test it',
    say: 'You do not need a tool for this. You need somebody who has never '
       + 'seen the site:',
    chips: ['hand them your phone', 'say nothing at all', 'watch where they stop'],
    say2: 'Wherever they stop is the thing to fix. It is almost never the '
        + 'thing you were about to change.',
    icons: ['click', 'eye', 'idea'],
    action: 'Do it once this week with somebody who is not a customer yet.',
  },
  {
    _name: 'compare', template: 'compare', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Slow, or just heavy?',
    say: 'These get treated as one problem and they have different fixes:',
    duo: [
      { head: 'Slow', tail: 'the server is thinking' },
      { head: 'Heavy', tail: 'the page is enormous' },
    ],
    say2: 'A faster host will not shrink a four megabyte photograph, and '
        + 'shrinking it will not fix a host that takes a second to answer.',
    icons: ['server', 'bolt', 'chart'],
    action: 'Look up your home page’s total size before you change anything.',
  },
  {
    _name: 'proof', template: 'proof', ground: 'ink',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'What I actually found',
    say: 'One restaurant, one afternoon, nothing rebuilt. Three things were '
       + 'wrong and all three were in the markup already:',
    chips: ['menu was a PDF', 'no phone link on mobile',
            'closed on Google, open in life'],
    icons: ['folder', 'message', 'rise'],
    action: 'Search your own business name and read what Google says your '
          + 'hours are.',
  },
  {
    _name: 'portrait', template: 'portrait', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    portrait: 'blue-flat',
    title: 'Who is checking',
    say: 'One person, in Douala, looking at one site at a time. Everything '
       + 'on these sheets is a check I run before I touch anything.',
    action: 'Send me the URL and I will tell you which of the four it is.',
  },
  {
    _name: 'close', template: 'close', ground: 'amber',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'That is the whole check',
    say: 'Four things, an afternoon, and no rebuild. Most sites I look at '
       + 'are three small fixes away from working, and nobody had checked.',
    icons: ['ring', 'idea'],
    action: 'This is the kind of thing I fix.',
  },
];

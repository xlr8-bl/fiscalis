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
  },
  {
    _name: 'reasons', template: 'reasons', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Why nobody calls',
    say: 'The enquiries are not missing because the site is ugly. They are '
       + 'missing because of one of these:',
    chips: ['the number is a picture', 'the form emails nowhere',
            'the hours are last year’s'],
    icons: ['message', 'no', 'target'], accent: ['sparkle-gold'],
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
    icons: ['cursor', 'loading', 'lives'],
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
  },
  {
    _name: 'portrait', template: 'portrait', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    portrait: 'blue-flat',
    title: 'Who is checking',
    say: 'One person, looking at one site at a time. Everything on these '
       + 'sheets is a check I run before I touch anything.',
  },
  {
    _name: 'recap', template: 'recap', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The whole check',
    recap: ['Time it on your phone, on data',
            'Send yourself an enquiry and wait',
            'Read what Google says your hours are',
            'Watch one person try to tap something'],
    prompt: { question: 'Which of the four did yours fail on?',
              options: ['the phone', 'the form', 'the hours'] },
    line: 'Whether you are putting your first one up or fixing the one you have.',
    action: 'Do the first one today. It takes a minute and it is usually the '
          + 'one that finds something.',
  },
  {
    _name: 'calling', template: 'calling', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    align: 'left',
    say: { mark: 'Still ringing.',
           text: 'If your number is a picture, this is what it sounds like at '
               + 'your end. Nothing. They rang the next business on the list '
               + 'and you never knew there was a call.' },
    prompt: { question: 'What happens when you tap your own number?',
              options: ['it dials', 'nothing', 'no number'] },
    line: 'New site, or the one that has been quiet for two years.',
    action: 'Tap your own number on your own site. If nothing dials, that is '
          + 'the whole problem.',
  },
  {
    _name: 'bookend', template: 'bookend', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    echo: 'Your site loads. So what?',
    title: 'Now you know what to check',
    say: 'Loading was never the question. Four things decide whether anybody '
       + 'gets from your page to your phone, and none of them is speed.',
    icons: ['cursor', 'message', 'rise'],
    line: 'The site that is not built yet, and the one that is and is not working.',
    action: 'Run the four on your own site before you pay anybody to rebuild it.',
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
  {
    _name: 'shot', template: 'shot', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'What Google shows',
    say: 'The panel that tells you what people typed to find you.',
    shot: { src: 'example-console', url: 'search.google.com/search-console',
            caption: 'The queries panel, on a site that has never been looked at.' },
  },
  {
    _name: 'annotated', template: 'annotated', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'One word, one call',
    shot: { src: 'example-contact', url: 'example.com/contact' },
    swap: [{ head: 'Submit', tail: 'Send my enquiry' }],
  },
  {
    _name: 'chart', template: 'chart', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Where the weight is',
    say: 'What is actually in the icon library these sheets draw from.',
    bars: [{ label: 'App marks', value: 28 },
           { label: 'Pixel set', value: 20 },
           { label: 'The kit', value: 16 }],
    unit: 'icons',
    source: 'Counted in assets/icons, September 2026.',
  },
  {
    _name: 'figure', template: 'figure', ground: 'ink',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    stat: { figure: '10 min', of: 'of browser time a day, which is what taking '
                                + 'screenshots costs on the free plan.' },
    say: 'Enough for a few dozen captures. Past it the plan errors rather than '
       + 'charging, so there is no bill to be surprised by.',
    source: 'Cloudflare Browser Rendering limits, read September 2026.',
  },
  {
    _name: 'define', template: 'define', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    term: { word: 'Favicon',
            means: 'The tiny picture in the browser tab. Yours is probably the '
                 + 'default grey globe, which is the one thing every open tab '
                 + 'of your site says about you.' },
    say: 'It takes one file and five minutes, and it is the cheapest thing on '
       + 'this list that changes how a site looks to somebody.',
    icons: ['browser', 'eye'],
  },
  {
    _name: 'quote', template: 'quote', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    quote: { text: 'Simple Icons cannot be held responsible for any legal '
                 + 'activity raised by a brand, or users of the package.',
             who: 'Simple Icons, DISCLAIMER.md' },
    say: 'Which is why a logo being free to download is not the same as being '
       + 'free to put on your home page.',
  },
  {
    _name: 'tools', template: 'tools', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Where a site gets built',
    say: 'Four ways to the same page. The one you pick decides what you can '
       + 'change later on your own.',
    apps: ['webflow', 'wordpress', 'shopify', 'squarespace'],
  },
  {
    _name: 'swap', template: 'swap', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The button nobody presses',
    swap: [{ head: 'Submit', tail: 'Send my enquiry' }],
    action: 'Read your own buttons out loud and see which one you would press.',
  },
  {
    /* Last, because it is always last. The ground and the photograph are
       not choices here: checkOutro refuses any other pair. */
    _name: 'signoff', template: 'signoff', ground: 'amber',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    portrait: 'phone-chair', context: 'signoff', anchor: 'top',
    title: 'Not the speed.',
    // one sentence: the column beside him is about 19 characters a line
    say: 'Four checks, an afternoon, no rebuild.',
    action: 'Run the four on your own site before you pay anybody to rebuild it.',
  },
];

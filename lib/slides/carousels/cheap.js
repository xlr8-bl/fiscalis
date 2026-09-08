/**
 * cheap.js — why one site looks expensive and another looks cheap.
 *
 * design-eye pillar, "two ways, side by side" angle. His photograph
 * twice: the hook sheet and the portrait slide where the argument turns,
 * so the set reads as a person talking, not a deck with a face on it.
 */

export const CHEAP = [
  {
    _name: '01-hook', hook: 'h051',
    handle: '@web3ashley', series: 'SITE CHECKS',
    railL: 'Same budget. Same brief.',
    railR: 'Web design, plainly',
    setup: 'Your home page looks',
    hero: 'CHEAP',
    subhead: 'And it is not the money',
    body: 'Two sites cost the same and one of them is trusted on sight. The '
        + 'difference is never the budget. It is a handful of decisions that '
        + 'cost nothing and are made by whoever is quickest.',
    cta: 'Look again',
    date: 'Site checks',
    note: 'Not taste. Not a redesign. Three things you can see for yourself '
        + 'on your own home page in a minute.',
    footer: 'What makes a site look expensive is mostly what is missing from it.',
    tagB: 'THE EYE',
  },
  {
    _name: '02-reasons', template: 'reasons', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'What gives it away.',
    say: 'Nobody reads a site before deciding whether it looks serious. That '
       + 'happens in the first moment, and it is decided by three things that '
       + 'have nothing to do with what you spent.',
    chips: ['too many typefaces',
            'photos taken at different times',
            'nothing given room to breathe'],
    icons: ['eye', 'browser', 'no'],
    action: 'Open your home page and count the typefaces you can see.',
  },
  {
    _name: '03-compare', template: 'compare', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The same page, twice.',
    say: 'One studio buys a typeface and a photographer. The other picks two '
       + 'weights of one free face and shoots everything on the same afternoon.',
    duo: [{ head: 'Expensive', tail: 'one face, one light source' },
          { head: 'Cheap', tail: 'four faces, four cameras' }],
    say2: 'The second one costs more, because it was bought in pieces over '
        + 'three years and none of the pieces know about each other.',
    icons: ['eye', 'card', 'rise'],
    action: 'Put your two most important pages side by side on a phone.',
  },
  {
    _name: '04-open', template: 'open', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'I take things away.',
    say: 'Most of what I do to a site that looks cheap is subtraction. One '
       + 'typeface instead of four, and room around the thing that matters.',
    icons: ['no', 'eye', 'idea'],
    action: 'Delete one thing from your home page and look at it again.',
  },
  {
    /* Fixed by checkOutro: amber and phone-chair, on this and every set. */
    _name: '05-signoff', template: 'signoff', ground: 'amber',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    portrait: 'phone-chair', context: 'signoff', anchor: 'top',
    title: 'Not the money.',
    say: 'Three decisions, and decisions can be made again.',
    action: 'Send me your home page and I will tell you which of the three it is.',
  },
];

/**
 * copy.js — what goes in the slots.
 *
 * A layout is geometry with the words taken out. This is one set of
 * words for each, in Ashley's voice, about what he actually sells. It is
 * a worked example rather than the only possible fill: an agent writes
 * its own `copy` object against the same slot ids and the layout holds.
 *
 * `_art` names the files a layout's picture slots should load. Anything
 * not listed draws its box and says what is missing, which is how the
 * shot list stays honest.
 */

export const COPY = {

  h001: {
    head: 'gone.',
    mid: 'speed before style',
    script: 'Latency',
    third: 'Eleven???',
    body: [
      'Observed behaviour indicates elevated exit rate',
      'triggered by delayed first paint.',
      'Subject displays repeated back gestures',
      'associated with abandoned sessions.',
    ],
    stamp: '/// BOUNCE: 187% ABOVE BASELINE ///',
  },

  h002: {
    head: 'gone.',
    mid: 'speed before style',
    script: 'Latency',
    third: 'Eleven???',
    body: [
      'Observed behaviour indicates elevated exit rate',
      'triggered by delayed first paint.',
      'Subject displays repeated back gestures',
      'associated with abandoned sessions.',
    ],
    stamp: '/// BOUNCE: 187% ABOVE BASELINE ///',
  },

  h018: {
    railL: 'poster by',
    railR: 'web3ashley',
    head1: 'OPEN YOUR OWN',
    head2: 'SITE ON A PHONE',
    turn: 'And then Time It',
    body: 'Not on your laptop, not on the office wifi. On a phone, on mobile data, the way a customer actually arrives.',
  },

  h037: {
    lead: 'If Google does not suggest you,',
    punch: 'you do not exist.',
  },

  h051: {
    railL: ['Traffic does not matter.', 'Booked calls do.'],
    railR: ['Made by', 'Ashley'],
    setup: ['Traffic is loud.', 'Enquiries are'],
    index: '04',
    hero: 'QUIET',
    subhead: ['LOUD FADES.', 'BOOKED STAYS.'],
    body: 'Ads might open the door, but it is the page that keeps anyone in the room. The busiest sites are not the ones that convert.',
    cta: 'Book the hour',
    date: '06.03.2026',
    note: 'A working page is not exciting. It is quiet, repetitive, and it books the calls the loud one never did.',
    footer: 'You do not need the most traffic. You need the page that turns it into a call.',
    tagA: 'AUDIT.1',
    tagB: 'ONE HOUR',
  },
};

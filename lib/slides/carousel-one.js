/**
 * carousel-one.js — one complete carousel, written out, to look at.
 *
 * The topic is the WhatsApp number that is a picture. It is a real
 * fault, it is enormously common on small business sites, and it costs
 * the owner enquiries in a way nobody ever reports to them, which is the
 * shape of every good subject for this account.
 *
 * Nothing here is invented. There is no statistic, no client, no case
 * study and no figure that would need a source. The whole carousel is a
 * check the reader performs on their own site, and the only evidence it
 * offers is what they find when they do.
 *
 * The close is written out of this carousel's own subject rather than
 * from a fixed sign-off, and it asks for exactly one thing.
 */

export const CAROUSEL = {
  title: 'The number that is a picture',
  pillar: 'site-checks',
  topic: 'Contact numbers set as images or as plain unlinked text, which '
       + 'cannot be tapped on a phone. Verified by reading the markup of '
       + 'any site, not from a source.',
  caption:
    'Your number might not be a number.\n\n'
    + 'On a phone, a number has to be a link before it can be tapped. If it '
    + 'was placed as an image, or typed as ordinary text, the tap does '
    + 'nothing. No error, no message. The person just puts the phone down.\n\n'
    + 'It takes eleven characters of markup to fix, and it is the single '
    + 'most common thing I find on a small business site.\n\n'
    + 'Long-press your own number on your phone. If no menu appears, that is '
    + 'the fault.',
  hashtags: '#webdesign #smallbusiness #websitetips #cameroon #uxdesign',
  targets: ['instagram', 'tiktok'],

  slides: [
    {
      template: 'open', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'Your number is not a number',
      say: 'On a phone, a phone number has to be a link before anything can '
         + 'happen when it is tapped. Plenty of them are not.',
      icons: ['message', 'no', 'click'], accent: ['browser'],
      action: 'Open your own site on your phone and tap your number once.',
    },
    {
      template: 'reasons', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'Three ways it breaks',
      say: 'It looks right on every one of these. It only fails when '
         + 'somebody tries to use it:',
      chips: ['it is part of an image', 'it is plain typed text',
              'it links to the wrong one'],
      icons: ['no', 'eye', 'target'], iconsWhere: 'corner',
      action: 'Try to select the number with your finger. If it will not '
            + 'highlight, it is a picture.',
    },
    {
      template: 'compare', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'What a tap does',
      say: 'The difference is one attribute in the markup:',
      duo: [
        { head: 'A link', tail: 'the dialler opens' },
        { head: 'Text', tail: 'nothing at all' },
      ],
      say2: 'There is no error either way. A person who taps and gets nothing '
          + 'assumes the business is closed.',
      icons: ['code', 'bolt'],
      action: 'Long-press the number. A real link offers you Call and Copy.',
    },
    {
      template: 'steps', ground: 'ink',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'How to fix it',
      say: 'Whoever built the site can do this in a minute. If that is you:',
      chips: ['find the number', 'wrap it in a tel link', 'test it on a phone'],
      say2: 'Write the number in full international form so it works for '
          + 'somebody calling from outside the country.',
      icons: ['folder', 'code', 'click'],
      action: 'Ask for tel: links on every number and every WhatsApp button.',
    },
    {
      template: 'reasons', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'While you are there',
      say: 'The same fault turns up in three more places on the same sites:',
      chips: ['the WhatsApp button', 'the email address', 'the map pin'],
      icons: ['message', 'orbit', 'target'], iconsWhere: 'edge',
      action: 'Tap all four. It takes a minute and you only have to do it '
            + 'once.',
    },
    {
      template: 'close', ground: 'amber',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'Nobody reports this',
      say: 'A person who taps your number and gets nothing does not email to '
         + 'tell you. They go back to the search results and tap the next '
         + 'business.',
      icons: ['no', 'rise', 'shout'],
      // the close, written out of this carousel: the pass-on shape
      action: 'Send this to whoever built the site, not to whoever pays for '
            + 'it.',
    },
  ],
};

/**
 * forms.js — a full carousel, written to be posted rather than to
 * demonstrate a template.
 *
 * Subject: the contact form nobody is reading. Chosen because it is a
 * fault Ashley can actually diagnose from outside a business, it costs
 * the owner money quietly, and none of it needs a rebuild to fix, which
 * is the shape every one of these should have.
 *
 * Every figure in it is one you read off a thing you own: your own
 * inbox, your own spam folder, your own phone. Nothing here is a
 * statistic about other people's businesses.
 */

export const FORMS = [
  {
    _name: '01-open', template: 'open', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Your form works. Probably.',
    say: 'Every contact form on earth says "thanks, we will be in touch" '
       + 'whether or not anything was sent. That message is written by the '
       + 'page, not by your inbox, so it appears either way.',
    icons: ['message', 'no', 'loading'],
    action: 'Send yourself an enquiry through your own form, right now, and '
          + 'do not look at your inbox yet.',
  },
  {
    _name: '02-reasons', template: 'reasons', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Where it goes instead',
    say: 'When a form is quiet it is rarely broken in an interesting way. '
       + 'It is one of these:',
    chips: ['it sends to an old address', 'it lands in spam every time',
            'the plugin licence expired', 'nothing was ever connected'],
    icons: ['folder', 'no', 'crt'], accent: ['sparkle-gold'],
    action: 'Check the address the form sends to. Read it out loud. People '
          + 'change email and forget the form knows the old one.',
  },
  {
    _name: '03-steps', template: 'steps', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'How to test it properly',
    say: 'Testing from your own laptop proves nothing. Your address is the '
       + 'one most likely to arrive:',
    chips: ['use an address off your domain', 'send it from your phone',
            'wait a full day before deciding'],
    say2: 'A day, because one that arrives in four hours is one nobody '
        + 'answered in four hours. Different problem.',
    icons: ['cursor', 'loading', 'card'],
    action: 'Send one from a phone, on data, using an address that is not '
          + 'yours. Note the time you sent it.',
  },
  {
    _name: '04-compare', template: 'compare', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Not arriving, or not answered?',
    say: 'These feel identical and are opposite problems:',
    duo: [
      { head: 'Not arriving', tail: 'nobody knows it exists' },
      { head: 'Not answered', tail: 'somebody read it and stopped' },
    ],
    say2: 'The first is an afternoon of plumbing. The second is a habit, and '
        + 'rebuilding the site will not touch it.',
    icons: ['server', 'message', 'lives'],
    action: 'Look at the last five enquiries you did get. How long did each '
          + 'one wait?',
  },
  {
    _name: '05-proof', template: 'proof', ground: 'ink',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'What I keep finding',
    say: 'This is the one that turns up most, and it is always the same '
       + 'three things in the same order:',
    chips: ['form points at a dead mailbox', 'the reply lands in spam',
            'no reply at all was ever set'],
    icons: ['no', 'folder', 'rise'],
    action: 'Search your spam folder for your own business name. That is '
          + 'where the last three months went.',
  },
  {
    _name: '06-calling', template: 'calling', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    align: 'left',
    say: { mark: 'Nothing.',
           text: 'That is what an enquiry sounds like at your end when the '
               + 'form is pointed at an address you closed two years ago.' },
    prompt: { question: 'When did you last get one through the form?',
              options: ['this week', 'cannot remember', 'never have'] },
    line: 'Whether you are putting your first one up or fixing the one you have.',
    action: 'Send yourself one now and go and look tomorrow. Not today: '
          + 'tomorrow is the honest test.',
  },
  {
    _name: '07-recap', template: 'recap', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The whole check',
    recap: ['Send one from a phone, on data',
            'Use an address that is not yours',
            'Read the address the form sends to',
            'Search spam for your own name',
            'Time the last five you answered'],
    line: 'New site, or the one that has been quiet for two years.',
    action: 'Do the first one before you close this. It takes a minute and '
          + 'it is the one that usually finds it.',
  },
];

/**
 * leaks.js — the three quiet leaks, written to be posted.
 *
 * The same subject Spark was given, done to the rules: every check is one
 * you run on your own phone, in a minute, without opening a laptop and
 * without being able to read code. No numbers on the slides, no jargon,
 * and the close asks for one thing.
 */

export const LEAKS = [
  {
    _name: '01-open', template: 'open', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Three checks your site fails.',
    say: 'A site that loads is not a site that works. The three faults '
       + 'below lose enquiries every week, and none of them shows up on '
       + 'the screen. Nobody complains, because nobody knows.',
    icons: ['eye', 'no', 'message'],
    action: 'Open your own site on your phone, on data, not on your wifi.',
  },
  {
    _name: '02-reasons', template: 'reasons', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The first one is time.',
    say: 'Every extra thing added to a site over the years still runs '
       + 'every time somebody opens it. On a phone, on a weak signal, '
       + 'those seconds are the whole first impression.',
    chips: ['count out loud to five',
            'watch for the jump as it settles',
            'try it away from your wifi'],
    icons: ['loading', 'bolt', 'ring'],
    action: 'Count the seconds before you can read the first sentence.',
  },
  {
    _name: '03-steps', template: 'steps', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The second is the form.',
    say: 'Every form says thanks whether or not anything was sent. The '
       + 'page writes that message, not your inbox.',
    chips: ['send yourself a real enquiry',
            'wait a day before looking',
            'check the spam folder too'],
    say2: 'If it never arrives, it has been not arriving for as long as '
        + 'the form has been there.',
    icons: ['message', 'folder', 'no'],
    action: 'Send yourself an enquiry now and do not look until tomorrow.',
  },
  {
    _name: '04-proof', template: 'proof', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'The third is Google.',
    say: 'Google answers your hours and your number before anyone reaches '
       + 'your site. Wrong there, and people arrive at a closed door.',
    chips: ['search your own name on a phone',
            'read the hours it shows',
            'tap the number and see who answers'],
    icons: ['target', 'browser', 'click'],
    action: 'Search your business the way a stranger would, and read it.',
  },
  {
    _name: '05-close', template: 'close', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Three checks, one evening.',
    say: 'None of these needs a rebuild and none of them costs anything '
       + 'to find. The one that fails is usually the one that has been '
       + 'failing longest.',
    icons: ['eye', 'idea', 'rise'],
    action: 'Send me the one that failed and I will tell you what it is.',
  },
];

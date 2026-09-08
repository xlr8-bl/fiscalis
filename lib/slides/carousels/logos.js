/**
 * logos.js — the free logo that is not free to use.
 *
 * The read-the-source pillar: a real disclaimer, on the record, with the
 * address on the sheet. Six slides and six different arrangements, which
 * is the point of the set as much as the subject is.
 */

export const LOGOS = [
  {
    _name: '01-hook', hook: 'h051',
    handle: '@web3ashley', series: 'SITE CHECKS',
    railL: 'Downloaded is not licensed.',
    railR: 'Web design, plainly',
    setup: 'That logo on your site is',
    hero: 'BORROWED',
    subhead: 'And it can be asked back',
    body: 'Every brand mark you can download in one click is somebody\'s '
        + 'trademark. The file being free has nothing to do with whether you '
        + 'may put it on a page that sells something.',
    cta: 'Read it properly',
    date: 'Site checks',
    note: 'Not a lawyer. This is the thing the packs themselves say, in '
        + 'writing, on the page you downloaded from.',
    footer: 'The licence covers the drawing. It does not cover the name.',
    tagB: 'THE SOURCE',
  },
  {
    _name: '02-define', template: 'define', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    term: { word: 'CC0',
            means: 'A licence that puts a file in the public domain. No credit '
                 + 'owed, no permission needed, no conditions at all.' },
    say: 'It is the most permissive licence there is, and it is the reason '
       + 'every icon pack you have used says you can do what you like.',
    icons: ['folder', 'idea'],
  },
  {
    _name: '03-quote', template: 'quote', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    quote: { text: 'Simple Icons cannot be held responsible for any legal '
                 + 'activity raised by a brand, or users of the package.',
             who: 'Simple Icons, DISCLAIMER.md' },
    say: 'That is the pack that ships 3400 brand marks under CC0, saying out '
       + 'loud that CC0 is not the brand\'s permission.',
  },
  {
    _name: '04-figure', template: 'figure', ground: 'ink',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    stat: { figure: '2', of: 'marks I went looking for that are not in the pack '
                           + 'any more. They are removed when a brand asks.' },
    say: 'Which is the clearest demonstration there is: the file can be public '
       + 'domain and the name still is not yours.',
    source: 'Checked against the pack, September 2026.',
  },
  {
    _name: '05-swap', template: 'swap', ground: 'paper',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'What to do instead',
    swap: [{ head: 'Their logo, in your header',
             tail: 'Their name, in your own type' }],
    action: 'Look at your home page and count the logos that are not yours.',
  },
  {
    _name: '06-signoff', template: 'signoff', ground: 'amber',
    handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    portrait: 'phone-chair', context: 'signoff', anchor: 'top',
    title: 'Borrowed, not given.',
    say: 'Naming a tool is fine. Wearing its logo is not.',
    action: 'Send me your home page and I will tell you which marks to take off.',
  },
];

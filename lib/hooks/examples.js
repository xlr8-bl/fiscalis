/**
 * examples.js — three fills per layout, on three unrelated subjects.
 *
 * WHY THREE, AND WHY UNRELATED. A single worked example becomes the
 * definition. Show one fill of h018 that says "open your own site on a
 * phone" and every agent that reads it writes put your site to the test,
 * test it on a cheap phone, have you tested your site — the same post
 * forever, re-worded. Three fills on three subjects make the structure
 * the only thing they have in common, which is the thing to copy.
 *
 * These are for a person to look at and for the renderer to draw when
 * nothing else is supplied. brief() in layouts.js deliberately does NOT
 * return them: an agent gets the slot notes and writes to the structure.
 *
 * `_art` names a file only when one exists to point at. Everything else
 * draws its box and says what kind of picture belongs there, which is
 * how the shot list stays honest.
 */

export const EXAMPLES = {

  h001: [
    { _name: 'speed',
      head: 'gone.', mid: 'speed before style', script: 'Latency', third: 'Eleven???',
      body: ['Observed: elevated exit rate at first paint.',
             'Subject displays repeated back gestures.',
             'No complaint is filed. No record is kept.'],
      stamp: '/// EXIT: 187% ABOVE BASELINE ///' },
    { _name: 'a kitchen at close',
      head: 'cold.', mid: 'orders before covers', script: 'Ticket', third: 'Again???',
      body: ['Observed: pass holds four plates at once.',
             'Subject reheats rather than refires.',
             'Nobody at the table is told.'],
      stamp: '/// RETURNS: 3 OF 40 TONIGHT ///' },
    { _name: 'a gym in february',
      head: 'quiet.', mid: 'January before March', script: 'Attrition', third: 'Where???',
      body: ['Observed: 71 of 300 cards still active.',
             'Subject cancels without notice.',
             'The direct debit runs one more month.'],
      stamp: '/// LAPSE: 76% BY WEEK NINE ///' },
  ],

  h002: [
    { _name: 'speed, red',
      head: 'gone.', mid: 'speed before style', script: 'Latency', third: 'Eleven???',
      body: ['Observed: elevated exit rate at first paint.',
             'Subject displays repeated back gestures.',
             'No complaint is filed. No record is kept.'],
      stamp: '/// EXIT: 187% ABOVE BASELINE ///' },
  ],

  h018: [
    { _name: 'testing',
      railL: 'poster by', railR: 'web3ashley',
      head1: 'PUT IT DOWN', head2: 'AND WALK AWAY',
      turn: 'Then Come Back Cold',
      body: 'You cannot see your own work at eleven at night. You can see it fine at eight the next morning.' },
    { _name: 'quoting',
      railL: 'notes', railR: 'no. 07',
      head1: 'NAME THE PRICE', head2: 'BEFORE THE CALL',
      turn: 'Or Have It Twice',
      body: 'Every conversation that avoids the number has to happen again with the number in it.' },
    { _name: 'hiring',
      railL: 'field notes', railR: '2026',
      head1: 'HIRE THE ONE', head2: 'WHO ASKS WHY',
      turn: 'Not the One Who Nods',
      body: 'Agreement is cheap and you can buy it anywhere. The question you had not thought of is the whole job.' },
  ],

  h037: [
    { _name: 'search',
      lead: 'If Google does not suggest you,', punch: 'you do not exist.' },
    { _name: 'a menu',
      lead: 'If they cannot read it on a phone,', punch: 'they do not order.' },
    { _name: 'a reply',
      lead: 'If you answer on Monday,', punch: 'they booked on Friday.' },
  ],

  h051: [
    { _name: 'traffic',
      railL: ['Traffic does not matter.', 'Booked calls do.'],
      railR: ['Made by', 'Ashley'],
      setup: ['Traffic is loud.', 'Enquiries are'], index: '04', hero: 'QUIET',
      subhead: ['LOUD FADES.', 'BOOKED STAYS.'],
      body: 'Ads open the door. The page is what keeps anyone in the room, and the busiest sites are rarely the ones that convert.',
      cta: 'Book the hour', date: '06.03.2026',
      note: 'A working page is not exciting. It is repetitive, and it books the calls the loud one never did.',
      footer: 'You do not need the most traffic. You need the page that turns it into a call.',
      tagA: 'AUDIT.1', tagB: 'ONE HOUR' },
    { _name: 'a trade',
      railL: ['Reviews are not referrals.', 'Repeat work is.'],
      railR: ['Field note', '11'],
      setup: ['Reviews are public.', 'Referrals are'], index: '11', hero: 'PRIVATE',
      subhead: ['STARS FADE.', 'NUMBERS STAY.'],
      body: 'A five star review is read once by a stranger. A phone number passed at a kitchen table is used for years.',
      cta: 'See the checks', date: '19.02.2026',
      note: 'Nobody photographs the job that went fine. That is exactly the one that gets you the next three.',
      footer: 'Ask for the number, not the star. One of them comes back.',
      tagA: 'TRADE.2', tagB: 'REFERRAL' },
    { _name: 'writing',
      railL: ['Posting is not the work.', 'Finishing is.'],
      railR: ['Draft', '03'],
      setup: ['Ideas are cheap.', 'Finished is'], index: '03', hero: 'RARE',
      subhead: ['STARTS ARE EASY.', 'ENDINGS ARE NOT.'],
      body: 'Everyone has the idea. The difference is the fortnight after the idea stops being interesting.',
      cta: 'Read the last one', date: '02.01.2026',
      note: 'The post you nearly deleted is usually the one somebody replies to.',
      footer: 'Nobody is short of ideas. Everybody is short of finished ones.',
      tagA: 'DRAFT.3', tagB: 'SHIPPED' },
  ],
};

/** The first example, which is what the renderer draws by default. */
export const sample = (id) => EXAMPLES[id]?.[0] ?? {};

/** All of them, for a person comparing range. */
export const samples = (id) => EXAMPLES[id] ?? [];

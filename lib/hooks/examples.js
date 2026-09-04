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

  h013: [
    { _name: 'a studio taking work',
      kicker: "I'm", head: 'Hiring', second: '*Clients',
      strap: 'Only serious applicants. My patience is limited.',
      date: ['2ND JUNE', 'TUESDAY'], rail: 'APPLY NOW',
      terms: ['Requirements:', '- Pays on time (no "next week")',
              '- Knows what they want (not "surprise me")',
              '- Never says "make the logo bigger"'],
      deadline: ['Deadline:', 'ASAP, before I find', 'a better brief'],
      foot: 'Send your budget, your idea, and one honest sentence.' },
    { _name: 'a kitchen taking bookings',
      kicker: "We're", head: 'Seeking', second: '*Regulars',
      strap: 'Walk-ins welcome. Loyalty preferred.',
      date: ['FRIDAY', 'FROM SIX'], rail: 'BOOK NOW',
      terms: ['Requirements:', '- Turns up when the table is held',
              '- Orders the thing they came for',
              '- Tells us before they stop coming'],
      deadline: ['Closing:', 'when the last', 'table goes'],
      foot: 'Two names, one time, and we hold the corner one.' },
    { _name: 'a writer taking readers',
      kicker: 'Now', head: 'Wanted', second: '*Readers',
      strap: 'No experience necessary. Attention span helpful.',
      date: ['ISSUE', 'ELEVEN'], rail: 'SUBSCRIBE',
      terms: ['Requirements:', '- Opens it the day it lands',
              '- Replies when something lands wrong',
              '- Forwards it once, to one person'],
      deadline: ['Frequency:', 'fortnightly, and', 'never at midnight'],
      foot: 'Your address, and nothing else, ever.' },
  ],

  h020: [
    { _name: 'starting late',
      kicker: 'its never too late to', head: 'lock in.' },
    { _name: 'a slow season',
      kicker: 'nobody is coming to', head: 'save it.' },
    { _name: 'a long draft',
      kicker: 'the only way out is to', head: 'finish it.' },
  ],

  h024: [
    { _name: 'ownership',
      kicker: 'if not me', head: 'then who?', mark: 'A.M.' },
    { _name: 'timing',
      kicker: 'if not now', head: 'then when?', mark: 'FIELD 09' },
    { _name: 'price',
      kicker: 'if not this', head: 'then what?', mark: 'NOTE 02' },
  ],

  h032: [
    { _name: 'creativity',
      handle: '@web3ashley',
      head: ['The', 'Biggest Lie', 'About Creativity'],
      note: '(for everyone who has been told to "just make it pop", swipe to know what they actually mean)' },
    { _name: 'pricing',
      handle: '@web3ashley',
      head: ['What', 'Cheap Work', 'Actually Costs'],
      note: '(for anyone about to accept the lowest quote, this is the bit that arrives in month four)' },
    { _name: 'reviews',
      handle: '@web3ashley',
      head: ['Why', 'Five Stars', 'Change Nothing'],
      note: '(for the shops with a perfect rating and an empty Tuesday, the number is not the problem)' },
  ],

  h068: [
    { _name: 'one size',
      head: ['Support is not'], tail: ['one size', 'fits all.'],
      strap: 'Every business breaks differently.' },
    { _name: 'audiences',
      head: ['Your audience is not'], tail: ['everyone', 'with a phone.'],
      strap: 'Narrow beats loud, every time.' },
    { _name: 'advice',
      head: ['Good advice is not'], tail: ['the same advice', 'twice.'],
      strap: 'Ask what changed since the last one.' },
  ],

  h069: [
    { _name: 'how enquiries arrived',
      brand: 'FIELD NOTES', era: '2006 — 2026',
      noteA: ['The phone book', '2006'],
      noteB: ['The first website', '2012'],
      noteC: ['The Facebook page', '2017'],
      noteD: ['The map listing', '2026'],
      close: 'It moved four times.',
      closeBody: ['Each time, the businesses that moved with it', 'kept the calls.',
                  'The ones that waited for it to come back', 'are still waiting.'] },
    { _name: 'how a kitchen filled tables',
      brand: 'SERVICE', era: 'FIVE YEARS',
      noteA: ['Walk-ins', 'Year one'],
      noteB: ['The phone', 'Year two'],
      noteC: ['The booking link', 'Year four'],
      noteD: ['The Saturday list', 'Now'],
      close: 'Nothing was replaced.',
      closeBody: ['Every route that ever worked still works.', 'They just stopped being equal.',
                  'One of them now brings four in five,', 'and it is not the one on the door.'] },
    { _name: 'how a trade got known',
      brand: 'ON THE TOOLS', era: 'A DECADE',
      noteA: ['A van and a number', '2015'],
      noteB: ['A neighbour told one', '2018'],
      noteC: ['A photo of the job', '2021'],
      noteD: ['A page that answers', '2026'],
      close: 'Word of mouth grew a URL.',
      closeBody: ['The recommendation still happens', 'at a kitchen table.',
                  'What changed is where they go', 'ten seconds afterwards.'] },
  ],

  h070: [
    { _name: 'sameness',
      tagTL: 'CONTENT', tagTR: 'STRATEGY',
      lineA: ['NO', 'DESIGN'], lineB: 'is the same.',
      column: ['When there is a', 'concept, even the', 'strange choice', 'makes sense.'],
      sticker: 'Everything speaks',
      tagBL: 'CONTENT', tagBC: '@WEB3ASHLEY', tagBR: 'STRATEGY' },
    { _name: 'quotes',
      tagTL: 'PRICING', tagTR: 'HONESTY',
      lineA: ['NO', 'QUOTE'], lineB: 'is neutral.',
      column: ['A number is an', 'argument about', 'what the work', 'is worth.'],
      sticker: 'Say it first',
      tagBL: 'PRICING', tagBC: '@WEB3ASHLEY', tagBR: 'HONESTY' },
    { _name: 'meetings',
      tagTL: 'PROCESS', tagTR: 'TIME',
      lineA: ['NO', 'MEETING'], lineB: 'is free.',
      column: ['An hour with six', 'people in it costs', 'six hours, and it', 'is never billed.'],
      sticker: 'Write it down',
      tagBL: 'PROCESS', tagBC: '@WEB3ASHLEY', tagBR: 'TIME' },
  ],

  h077: [
    { _name: 'briefs',
      head: ['Clients asking for', 'creativity without', 'a brief?'],
      body: 'Learn how to extract clear direction from clients who cannot articulate it.' },
    { _name: 'deadlines',
      head: ['Asked for it Friday', 'and briefed you', 'on Thursday?'],
      body: 'There is a way to say no to the date without saying no to the work.' },
    { _name: 'feedback',
      head: ['Getting notes that', 'only say "make it', 'more premium"?'],
      body: 'Three questions that turn a feeling into something you can actually build.' },
  ],
};

/** The first example, which is what the renderer draws by default. */
export const sample = (id) => EXAMPLES[id]?.[0] ?? {};

/** All of them, for a person comparing range. */
export const samples = (id) => EXAMPLES[id] ?? [];

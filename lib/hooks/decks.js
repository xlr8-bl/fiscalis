/**
 * decks.js — ten finished carousels.
 *
 * A deck is an ordered list of slides. Each slide names a layout — a
 * measured hook from layouts.js for the first one, an invented device
 * from inside.js for the rest — and the copy that goes in it. Nothing
 * else: the ground, the type and the pictures all come from the layout,
 * so a deck is only ever a running order and a script.
 *
 * RULES THESE ARE WRITTEN TO
 *
 *   First person singular. One person does this work and the copy has
 *   to sound like it. No "we", no "our team".
 *
 *   No numbers that were not counted. No percentages, no "studies
 *   show", no invented client names. Everything here is either an
 *   observation or an argument, and it is written so you can tell which.
 *
 *   No prices and no packages anywhere. The only thing any of these
 *   ask for is an hour.
 *
 *   One idea per slide. If a slide needs a "because", the part after
 *   the because is the next slide.
 *
 * The last slide is always `close` and never carries a swipe arrow.
 */

const HANDLE = 'WEB3ASHLEY';

/* Index strings are written out rather than generated, because a deck
   that gets a slide added should have its numbering re-read by a person
   — a generated "05 / 07" on a slide that is now the fourth is worse
   than no index at all. */
const ix = (n, of) => `${String(n).padStart(2, '0')} / ${String(of).padStart(2, '0')}`;

export const DECKS = {

  /* ------------------------------------------------------------ 01 */
  findable: {
    id: 'findable', title: 'The site nobody can find',
    about: 'Local search. The argument is that being good is not the same as '
         + 'being findable, and that the fix is mostly not on the website.',
    slides: [
      { layout: 'h037', copy: {
        lead: 'If Google does not suggest you,', punch: 'you do not exist.' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'Most people never type your name. They type what they need and pick from the first three.' } },
      { layout: 'versus', copy: {
        index: ix(3, 6), handle: HANDLE,
        labelA: 'WHAT I HEAR', lineA: 'We spent months on the website and nothing changed.',
        labelB: 'WHAT I FIND', lineB: 'The listing is empty, the hours are wrong, and the map pin is on the next street.' } },
      { layout: 'list', copy: {
        index: ix(4, 6), handle: HANDLE,
        head: 'Four things I check before I touch a page:',
        rowA: 'The listing exists and you own it',
        rowB: 'The hours are right this week',
        rowC: 'The phone number rings the phone you carry',
        rowD: 'The map pin drops on your door' } },
      { layout: 'say', copy: {
        index: ix(5, 6), handle: HANDLE,
        say: 'Every one of those is free, and none of them is a website job.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Search your own business the way a stranger would, from a phone you are not signed in on.',
        cta: 'DO IT NOW' } },
    ],
  },

  /* ------------------------------------------------------------ 02 */
  redesign: {
    id: 'redesign', title: 'The redesign loop',
    about: 'Why a rebuild every eighteen months keeps happening, and what '
         + 'question stops it.',
    slides: [
      { layout: 'h011', copy: {
        l1: 'BREAK', l2: 'THE', l3: 'REDESIGN', l4: 'LOOP', l5: 'OR THE',
        l6: 'SAME', l7: 'PAGE', l8: 'COMES BACK', l9: 'IN EIGHTEEN MONTHS',
        foot: 'WEB3ASHLEY' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'A redesign is what you do when nobody can say what the page is for.' } },
      { layout: 'count', copy: {
        index: ix(3, 6), handle: HANDLE, num: '1',
        head: 'Nobody wrote down what the old one was supposed to do',
        body: 'So there is nothing to judge the new one against. It gets judged on whether it looks current, which it will not in a year.' } },
      { layout: 'count', copy: {
        index: ix(4, 6), handle: HANDLE, num: '2',
        head: 'The thing that was wrong was never on the page',
        body: 'It was in the enquiry that took four days to answer, or the form that sent nothing. A new layout does not touch either.' } },
      { layout: 'versus', copy: {
        index: ix(5, 6), handle: HANDLE,
        labelA: 'THE BRIEF I USUALLY GET', lineA: 'Make it look modern.',
        labelB: 'THE BRIEF THAT WORKS', lineB: 'Get more of the people who land here to pick up the phone.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Write down what the page is for in one sentence. If you cannot, that is the job, not the design.',
        cta: 'BOOK THE HOUR' } },
    ],
  },

  /* ------------------------------------------------------------ 03 */
  afterhours: {
    id: 'afterhours', title: 'After hours',
    about: 'What happens to enquiries that arrive when nobody is there. The '
         + 'argument is that the site is the only thing awake.',
    slides: [
      { layout: 'h014', copy: {
        mark: 'WEB3ASHLEY',
        lineA: 'nobody', lineB: 'is', lineC: 'answering.',
        footL: 'Book an hour', footR: 'web3ashley.com' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'People decide to call you at eleven at night and ring somebody else at nine the next morning.' } },
      { layout: 'plate', copy: {
        index: ix(3, 6), handle: HANDLE,
        line: 'The site is the only part of the business that is open at eleven.' } },
      { layout: 'list', copy: {
        index: ix(4, 6), handle: HANDLE,
        head: 'What an out-of-hours visitor needs to find in ten seconds:',
        rowA: 'What you actually do',
        rowB: 'Whether you cover where they are',
        rowC: 'A way to leave a message that works',
        rowD: 'When they will hear back' } },
      { layout: 'versus', copy: {
        index: ix(5, 6), handle: HANDLE,
        labelA: 'WHAT MOST SITES SAY', lineA: 'Contact us.',
        labelB: 'WHAT WOULD WORK', lineB: 'Leave this here tonight and I will answer before ten tomorrow.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Open your own contact page at midnight and try to leave yourself a message.',
        cta: 'TRY IT TONIGHT' } },
    ],
  },

  /* ------------------------------------------------------------ 04 */
  onejob: {
    id: 'onejob', title: 'One job per page',
    about: 'The single most common structural fault: a page asked to do four '
         + 'things and therefore doing none.',
    slides: [
      { layout: 'h015', copy: {
        lineA: 'How to find your', lineB: 'PAGES', lineC: 'Purpose',
        footL: '@web3ashley', footC: 'save for later' } },
      { layout: 'say', copy: {
        index: ix(2, 7), handle: HANDLE,
        say: 'Every page on your site is either asking for something or it is filler.' } },
      { layout: 'count', copy: {
        index: ix(3, 7), handle: HANDLE, num: '1',
        head: 'Name the one thing this page is for',
        body: 'Book, buy, call, read, join. One verb. Write it at the top of the file before you write anything else.' } },
      { layout: 'count', copy: {
        index: ix(4, 7), handle: HANDLE, num: '2',
        head: 'Delete anything that asks for something different',
        body: 'A newsletter box on a booking page is a second request. The reader picks the easier one, which is neither.' } },
      { layout: 'count', copy: {
        index: ix(5, 7), handle: HANDLE, num: '3',
        head: 'Put the ask where they already are',
        body: 'Most people never reach the bottom. If the only button is down there, you have hidden it from the people most likely to press it.' } },
      { layout: 'versus', copy: {
        index: ix(6, 7), handle: HANDLE,
        labelA: 'A PAGE WITH FOUR JOBS', lineA: 'Everything is available and nothing is obvious.',
        labelB: 'A PAGE WITH ONE', lineB: 'You can tell what to do without reading a word.' } },
      { layout: 'close', copy: {
        index: ix(7, 7), handle: HANDLE,
        turn: 'Open your busiest page and say its job out loud in one verb. Then count how many other things it asks for.',
        cta: 'COUNT THEM' } },
    ],
  },

  /* ------------------------------------------------------------ 05 */
  brief: {
    id: 'brief', title: 'The brief I actually want',
    about: 'Written as a job advert. It is about what makes a project go well, '
         + 'said from the side that usually stays quiet.',
    slides: [
      { layout: 'h013', copy: {
        date: ['THIS WEEK', 'STILL OPEN'], rail: 'GET IN TOUCH',
        kicker: "I'm", head: 'Wanting', turn: 'Briefs',
        strap: 'No mood boards required. One clear sentence will do.',
        reqHead: 'Requirements:',
        reqList: ['- Knows what the page is supposed to make happen',
                  '- Has somebody who can say yes',
                  '- Never says "surprise me"'],
        deadHead: 'Timing:',
        deadList: ['an hour first,', 'then we both know', 'if there is a job'],
        foot: 'Send what you have, however rough it is.',
        mark: 'W3A' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'A good brief is not a long one. It is one where somebody has already decided something.' } },
      { layout: 'list', copy: {
        index: ix(3, 6), handle: HANDLE,
        head: 'Four sentences and I can quote the work:',
        rowA: 'What the page is for',
        rowB: 'Who is going to read it',
        rowC: 'What happens now instead',
        rowD: 'Who signs it off' } },
      { layout: 'versus', copy: {
        index: ix(4, 6), handle: HANDLE,
        labelA: 'A LONG BRIEF', lineA: 'Forty pages and no decision in any of them.',
        labelB: 'A SHORT ONE', lineB: 'Four sentences, one of which is a decision somebody already made.' } },
      { layout: 'say', copy: {
        index: ix(5, 6), handle: HANDLE,
        say: 'If the decision has not been made, the first hour is for making it, and that is fine.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Send the four sentences. If you only have two, send two.',
        cta: 'SEND THE BRIEF' } },
    ],
  },

  /* ------------------------------------------------------------ 06 */
  silent: {
    id: 'silent', title: 'The form that never sent',
    about: 'Silent failures. The complaint told as a joke on the hook, then '
         + 'taken seriously for the rest.',
    slides: [
      { layout: 'h016', copy: {
        head: ['THE FORM', 'SAID THANK YOU', 'AND SENT', 'NOTHING..'],
        handle: '@WEB3ASHLEY' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'A broken form does not look broken. It looks like nobody wanted you.' } },
      { layout: 'count', copy: {
        index: ix(3, 6), handle: HANDLE, num: '1',
        head: 'It sends to an address nobody opens any more',
        body: 'Usually the one from whoever built the site, three people ago. The mail arrives. It just arrives somewhere with nobody in it.' } },
      { layout: 'count', copy: {
        index: ix(4, 6), handle: HANDLE, num: '2',
        head: 'It lands in spam every single time',
        body: 'Sent from a server that is not yours, claiming to be you. Your own mail provider is the one deciding not to trust it.' } },
      { layout: 'plate', copy: {
        index: ix(5, 6), handle: HANDLE,
        line: 'Nobody complains about a form that fails silently. They just go and use somebody else.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Fill in your own form with your own phone, from data, and wait for the mail to arrive.',
        cta: 'TEST YOUR FORM' } },
    ],
  },

  /* ------------------------------------------------------------ 07 */
  checks: {
    id: 'checks', title: 'The quarterly checks',
    about: 'A short list of things that break without telling anybody. The '
         + 'hook is the card grid, so the deck is a genuine list.',
    slides: [
      { layout: 'h003', copy: {
        kicker: 'The', brand: 'web3ashley', hero: '4', sub: 'Checks',
        cardAlead: ['A short list of', 'things that break'],
        cardAhead: ['quietly, and', 'expensively.'],
        cardAfoot: 'Check. Fix. Forget.',
        cardBlist: ['Forms', 'Speed', 'Listings', 'Links', 'Backups'],
        cardCcap: ['Twenty minutes,', 'once a quarter.'],
        cardDlabel: 'Start here', cardEmark: '?',
        footer: 'THE ONES THAT NEVER TELL YOU' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'Nothing on this list will ever send you an email to say it has stopped working.' } },
      { layout: 'list', copy: {
        index: ix(3, 6), handle: HANDLE,
        head: 'The four worth doing this week:',
        rowA: 'Send yourself a message through the form',
        rowB: 'Open the site on mobile data, not wifi',
        rowC: 'Check the listing hours against this month',
        rowD: 'Confirm the backup ran, by restoring one' } },
      { layout: 'count', copy: {
        index: ix(4, 6), handle: HANDLE, num: '4',
        head: 'A backup nobody has restored is not a backup',
        body: 'It is a folder you are paying for. The only way to know it works is to put it back somewhere and look at it.' } },
      { layout: 'versus', copy: {
        index: ix(5, 6), handle: HANDLE,
        labelA: 'HOW IT FEELS', lineA: 'The site is fine, nobody has said anything.',
        labelB: 'WHAT THAT MEANS', lineB: 'Nobody has said anything.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Put twenty minutes in the calendar for the same day every quarter and do the four.',
        cta: 'PUT IT IN NOW' } },
    ],
  },

  /* ------------------------------------------------------------ 08 */
  firstlook: {
    id: 'firstlook', title: 'What they see first',
    about: 'The first screen. Built on the glass hook, so the deck is about '
         + 'the difference between what you look at and what they see.',
    slides: [
      { layout: 'h004', copy: {
        kicker: 'the first screen', head: 'WHAT THEY SEE',
        glassA: 'YOU SEE', glassB: 'THE WHOLE PAGE',
        swipe: 'swipe', lens: 'look', code: 'WEB3ASHLEY' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'You have looked at your home page a thousand times. Nobody else has looked at it once.' } },
      { layout: 'versus', copy: {
        index: ix(3, 6), handle: HANDLE,
        labelA: 'WHAT YOU SEE', lineA: 'The whole page, because you already know what is on it.',
        labelB: 'WHAT THEY SEE', lineB: 'One screen, held at arm’s length, for about four seconds.' } },
      { layout: 'list', copy: {
        index: ix(4, 6), handle: HANDLE,
        head: 'What has to survive on that one screen:',
        rowA: 'What you do, in plain words',
        rowB: 'Where you do it',
        rowC: 'One thing to press',
        rowD: 'A reason to believe any of it' } },
      { layout: 'say', copy: {
        index: ix(5, 6), handle: HANDLE,
        say: 'If your name is the biggest thing up there, you have spent the screen on the one fact they already had.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Screenshot your home page on a phone without scrolling, and show it to somebody who does not know what you do.',
        cta: 'ASK ONE PERSON' } },
    ],
  },

  /* ------------------------------------------------------------ 09 */
  traffic: {
    id: 'traffic', title: 'Traffic is not the number',
    about: 'Analytics. The argument is that the number everyone reports is the '
         + 'one that changes nothing.',
    slides: [
      { layout: 'h051', copy: {
        railL: ['Traffic does not matter.', 'Booked calls do.'],
        railR: ['Field note', '04'],
        setup: ['Traffic is loud.', 'Enquiries are'], index: '04', hero: 'QUIET',
        subhead: ['LOUD FADES.', 'BOOKED STAYS.'],
        body: 'Ads open the door. The page is what keeps anyone in the room, and the busiest sites are rarely the ones that get the call.',
        cta: 'Book the hour', date: 'THIS WEEK',
        note: 'A working page is not exciting. It is repetitive, and it books the calls the loud one never did.',
        footer: 'You do not need the most traffic. You need the page that turns it into a call.',
        tagA: 'AUDIT.1', tagB: 'ONE HOUR' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'Visits go up when you post. They go back down when you stop. Nothing has changed.' } },
      { layout: 'versus', copy: {
        index: ix(3, 6), handle: HANDLE,
        labelA: 'THE NUMBER IN THE REPORT', lineA: 'How many people arrived.',
        labelB: 'THE NUMBER THAT PAYS', lineB: 'How many of them did the one thing the page was for.' } },
      { layout: 'count', copy: {
        index: ix(4, 6), handle: HANDLE, num: '1',
        head: 'Pick the one action worth counting',
        body: 'A booking, a call, a message. One. It has to be something that would put money in the account if it happened more often.' } },
      { layout: 'count', copy: {
        index: ix(5, 6), handle: HANDLE, num: '2',
        head: 'Count it before you change anything',
        body: 'Otherwise every change is an opinion. A fortnight of the number as it stands is the cheapest thing you can buy.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Name the one action on your site that is worth money, and find out how many times it happened last month.',
        cta: 'FIND THE NUMBER' } },
    ],
  },

  /* ------------------------------------------------------------ 10 */
  waiting: {
    id: 'waiting', title: 'Four seconds',
    about: 'Speed, on the risograph hook. The argument is that slowness is not '
         + 'a technical complaint, it is a lost enquiry.',
    slides: [
      { layout: 'h017', copy: {
        stamp: 'LOAD IT!', cry: 'STILL?',
        lineA: 'nobody waits', lineB: 'that long....' } },
      { layout: 'say', copy: {
        index: ix(2, 6), handle: HANDLE,
        say: 'Nobody has ever told you your site is slow. They just went back to the results.' } },
      { layout: 'plate', copy: {
        index: ix(3, 6), handle: HANDLE,
        line: 'It is fast on your laptop, on your wifi, with everything already cached.' } },
      { layout: 'list', copy: {
        index: ix(4, 6), handle: HANDLE,
        head: 'What is usually doing it:',
        rowA: 'One photograph nobody resized',
        rowB: 'A font loaded four ways',
        rowC: 'A chat widget you forgot about',
        rowD: 'Tracking for a campaign that ended' } },
      { layout: 'versus', copy: {
        index: ix(5, 6), handle: HANDLE,
        labelA: 'WHAT SPEED SOUNDS LIKE', lineA: 'A technical problem, for later.',
        labelB: 'WHAT IT IS', lineB: 'The people who wanted you, leaving before they saw anything.' } },
      { layout: 'close', copy: {
        index: ix(6, 6), handle: HANDLE,
        turn: 'Turn wifi off and open your own site on mobile data. Count out loud until it is readable.',
        cta: 'COUNT IT OUT LOUD' } },
    ],
  },
};

export const DECK_IDS = Object.keys(DECKS);

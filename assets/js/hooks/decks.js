/**
 * decks.js — ten carousels.
 *
 * A deck is a running order and a script. Each slide names a layout — a
 * measured hook from layouts.js first, an invented device from inside.js
 * after — and the copy for it.
 *
 * HOW THE HOOKS ARE WRITTEN. A hook is not a mood. It is
 * [who this is for] + [the tension] + [what they get for swiping], and
 * it has about two seconds to land, so it is one short line of big type
 * that says what is inside. "tomorrow's not promised" hooks onto
 * nothing; "the 4 things making your site slow" says what the swipe
 * buys. Where a number is used it is the real count of items in the
 * deck, not a rounded-up one.
 *
 * SHAPE. Hook, then four slides of one idea each, then the line that
 * lands it, then the thing to do. Seven.
 *
 * STANDING RULES. First person singular. No number that was not
 * counted, no invented client, no study cited. No price, no package.
 * No slide numbers — they tell the reader how much is left, which is a
 * reason to stop.
 */

const H = 'WEB3ASHLEY';

export const DECKS = {

  findable: {
    id: 'findable', title: 'Found before the website',
    about: 'Local search. Four free fixes, none of them on the site.',
    slides: [
      { layout: 'h005', copy: {
        railL: 'LOCAL SEARCH', railC: 'web3ashley', railR: 'FIELD NOTE',
        head1: 'stop rebuilding', head2: 'the site',
        strap: 'FOUR FREE FIXES   THAT LIVE   SOMEWHERE ELSE',
        body: 'None of them needs a developer, a login, or a penny. Twenty minutes, once.' } },
      { layout: 'say', copy: { handle: H,
        say: 'Most people never type your name. They type what they need and pick from the first three.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'WHAT I GET TOLD', lineA: 'We spent months on the website and nothing changed.',
        labelB: 'WHAT I FIND', lineB: 'Empty listing, wrong hours, map pin on the next street.' } },
      { layout: 'list', copy: { handle: H,
        head: 'The four, in the order I do them:',
        rowA: 'Claim the listing. It probably already exists',
        rowB: 'Fix the hours, including next bank holiday',
        rowC: 'Put the number that rings the phone you carry',
        rowD: 'Drag the map pin onto your actual door' } },
      { layout: 'count', copy: { handle: H, num: '20',
        head: 'Twenty minutes, no developer, no login to your site',
        body: 'Every one of those four is free and lives outside the website. I have watched them move the phone more than a rebuild did.' } },
      { layout: 'say', copy: { handle: H,
        say: 'Being good and being findable are two different jobs. Only one of them is free.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Search your own business the way a stranger would, on a phone you are not signed in on.',
        cta: 'DO IT NOW' } },
    ],
  },

  redesign: {
    id: 'redesign', title: 'Why the redesign comes back',
    about: 'The eighteen-month rebuild loop and the one sentence that ends it.',
    slides: [
      { layout: 'h011', copy: {
        l1: 'WHY', l2: 'YOUR', l3: 'NEW SITE', l4: 'GETS', l5: 'REDONE',
        l6: 'IN 18', l7: 'MONTHS', l8: 'AND THE', l9: 'ONE LINE THAT STOPS IT',
        foot: 'WEB3ASHLEY' } },
      { layout: 'say', copy: { handle: H,
        say: 'A redesign is what you do when nobody can say what the page was for.' } },
      { layout: 'count', copy: { handle: H, num: '1',
        head: 'Nobody wrote down what the old one was meant to do',
        body: 'So there is nothing to judge the new one against, and it gets judged on whether it looks current. In a year it will not.' } },
      { layout: 'count', copy: { handle: H, num: '2',
        head: 'The thing that was broken was never on the page',
        body: 'It was the enquiry that took four days to answer, or the form that sent nothing. A new layout does not touch either of those.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'THE BRIEF I USUALLY GET', lineA: 'Make it look modern.',
        labelB: 'THE BRIEF THAT WORKS', lineB: 'Get more of the people who land here to pick up the phone.' } },
      { layout: 'say', copy: { handle: H,
        say: 'One sentence, written before anybody opens a design tool. That is the whole difference.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Write what your page is for in one sentence. If you cannot, that is the job — not the design.',
        cta: 'BOOK THE HOUR' } },
    ],
  },

  afterhours: {
    id: 'afterhours', title: 'What a visitor needs at 11pm',
    about: 'Out-of-hours enquiries. Four things the site owes somebody when '
         + 'nobody is there to answer.',
    slides: [
      { layout: 'h016', ground: 'navy', tweak: { scene: { darken: 0.52 } }, copy: {
        head: ['4 THINGS', 'YOUR SITE OWES', 'A VISITOR', 'AT 11PM'],
        handle: '@WEB3ASHLEY' } },
      { layout: 'say', copy: { handle: H,
        say: 'People decide to call you at eleven at night and ring somebody else at nine the next morning.' } },
      { layout: 'list', copy: { handle: H,
        head: 'What they have to find in ten seconds:',
        rowA: 'What you actually do, in plain words',
        rowB: 'Whether you cover where they are',
        rowC: 'A way to leave a message that works',
        rowD: 'When they will hear back from you' } },
      { layout: 'plate', copy: { handle: H,
        line: 'The site is the only part of the business that is open at eleven.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'WHAT MOST SITES SAY', lineA: 'Contact us.',
        labelB: 'WHAT WOULD WORK', lineB: 'Leave this here tonight and I will answer before ten tomorrow.' } },
      { layout: 'say', copy: { handle: H,
        say: 'The fourth one is the one everybody skips, and it is the only one that stops them ringing your competitor.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Open your own contact page at midnight and try to leave yourself a message.',
        cta: 'TRY IT TONIGHT' } },
    ],
  },

  onejob: {
    id: 'onejob', title: 'Give every page one job',
    about: 'The commonest structural fault: a page asked to do four things '
         + 'and therefore doing none.',
    slides: [
      { layout: 'h015', copy: {
        lineA: 'How to give every', lineB: 'PAGE', lineC: 'One Job',
        footL: '@web3ashley', footC: 'save for later' } },
      { layout: 'say', copy: { handle: H,
        say: 'Every page on your site is either asking for something or it is filler.' } },
      { layout: 'count', copy: { handle: H, num: '1',
        head: 'Name the one thing the page is for',
        body: 'Book, buy, call, read, join. One verb, written at the top of the file before anything else goes in it.' } },
      { layout: 'count', copy: { handle: H, num: '2',
        head: 'Delete whatever asks for something different',
        body: 'A newsletter box on a booking page is a second request. The reader picks the easier one, which turns out to be neither.' } },
      { layout: 'count', copy: { handle: H, num: '3',
        head: 'Move the ask up to where they already are',
        body: 'Most people never reach the bottom. If the only button lives down there, you have hidden it from the people most likely to press it.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'A PAGE WITH FOUR JOBS', lineA: 'Everything is available and nothing is obvious.',
        labelB: 'A PAGE WITH ONE', lineB: 'You can tell what to do without reading a word.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Open your busiest page, say its job out loud in one verb, then count what else it asks for.',
        cta: 'COUNT THEM' } },
    ],
  },

  brief: {
    id: 'brief', title: 'Four sentences and I can quote it',
    about: 'What a workable brief contains. Written as a job advert.',
    slides: [
      { layout: 'h013', copy: {
        date: ['THIS WEEK', 'STILL OPEN'], rail: 'GET IN TOUCH',
        kicker: "I'm", head: 'Wanting', turn: 'Briefs',
        strap: 'Four sentences and I can quote the work. Here they are.',
        reqHead: 'Requirements:',
        reqList: ['- Knows what the page should make happen',
                  '- Has somebody who can say yes',
                  '- Never says "surprise me"'],
        deadHead: 'Timing:',
        deadList: ['an hour first,', 'then we both know', 'if there is a job'],
        foot: 'Send what you have, however rough it is.',
        mark: 'W3A' } },
      { layout: 'say', copy: { handle: H,
        say: 'A good brief is not a long one. It is one where somebody has already decided something.' } },
      { layout: 'list', copy: { handle: H,
        head: 'The four sentences:',
        rowA: 'What this page is supposed to make happen',
        rowB: 'Who is going to read it',
        rowC: 'What they do instead at the moment',
        rowD: 'Who signs it off' } },
      { layout: 'count', copy: { handle: H, num: '4',
        head: 'The fourth one saves the most time',
        body: 'Work with no named approver goes round twice. Naming one person before anything starts is the cheapest thing in the whole project.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'A LONG BRIEF', lineA: 'Forty pages and not one decision in any of them.',
        labelB: 'A SHORT ONE', lineB: 'Four sentences, one of which is a decision somebody already made.' } },
      { layout: 'say', copy: { handle: H,
        say: 'If the decision has not been made yet, making it is the first hour of work. That is fine — it is just not design.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Send the four sentences. If you only have two, send two.',
        cta: 'SEND THE BRIEF' } },
    ],
  },

  silent: {
    id: 'silent', title: 'Two reasons your form sends nothing',
    about: 'Silent failure. The two causes I find, and the test that proves it.',
    slides: [
      { layout: 'h016', tweak: { scene: { darken: 0.42 } }, copy: {
        head: ['2 REASONS', 'YOUR CONTACT', 'FORM SENDS', 'NOTHING'],
        handle: '@WEB3ASHLEY' } },
      { layout: 'say', copy: { handle: H,
        say: 'A broken form does not look broken. It looks like nobody wanted you.' } },
      { layout: 'count', copy: { handle: H, num: '1',
        head: 'It sends to an address nobody opens any more',
        body: 'Usually the one belonging to whoever built the site, three people ago. The mail arrives. It just arrives somewhere with nobody in it.' } },
      { layout: 'count', copy: { handle: H, num: '2',
        head: 'It lands in spam every single time',
        body: 'Sent from a server that is not yours, claiming to be you. Your own mail provider is the thing deciding not to trust it.' } },
      { layout: 'plate', copy: { handle: H,
        line: 'Nobody complains about a form that fails quietly. They just go and use somebody else.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'THE TEST THAT PROVES IT', lineA: 'Send yourself one, from your own phone, on mobile data.',
        labelB: 'WHAT IT COSTS', lineB: 'Two minutes, and you find out today rather than in six months.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Fill in your own form from your phone and wait for the mail. Check spam before you decide it worked.',
        cta: 'TEST IT NOW' } },
    ],
  },

  checks: {
    id: 'checks', title: 'Four checks, twenty minutes',
    about: 'The things that break without telling anybody, and the quarterly '
         + 'twenty minutes that catches them.',
    slides: [
      { layout: 'h003', copy: {
        kicker: 'The', brand: 'web3ashley', hero: '4', sub: 'Checks',
        cardAlead: ['Twenty minutes,', 'once a quarter,'],
        cardAhead: ['catches what', 'breaks quietly.'],
        cardAfoot: 'Check. Fix. Forget.',
        cardBlist: ['Forms', 'Speed', 'Listings', 'Backups'],
        cardCcap: ['None of them', 'will email you.'],
        cardDlabel: 'Start here', cardEmark: '?',
        footer: 'THE ONES THAT NEVER TELL YOU' } },
      { layout: 'say', copy: { handle: H,
        say: 'Nothing on this list will ever send you an email to say it has stopped working.' } },
      { layout: 'list', copy: { handle: H,
        head: 'The four, and how long each takes:',
        rowA: 'Send yourself a message through the form',
        rowB: 'Open the site on mobile data, not wifi',
        rowC: 'Check the listing hours against this month',
        rowD: 'Restore one backup somewhere and look at it' } },
      { layout: 'count', copy: { handle: H, num: '4',
        head: 'A backup nobody has restored is not a backup',
        body: 'It is a folder you are paying for. The only way to know it works is to put it back somewhere and open it.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'HOW IT FEELS', lineA: 'The site is fine. Nobody has said anything.',
        labelB: 'WHAT THAT MEANS', lineB: 'Nobody has said anything.' } },
      { layout: 'say', copy: { handle: H,
        say: 'Every one of these is cheap the week you find it and expensive the quarter you do not.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Put twenty minutes in the calendar for the same day every quarter, and do the four.',
        cta: 'PUT IT IN NOW' } },
    ],
  },

  firstlook: {
    id: 'firstlook', title: 'Four things that must survive the first screen',
    about: 'The fold. What has to be readable before anybody scrolls.',
    slides: [
      { layout: 'h004', copy: {
        kicker: 'your home page', head: '4 SECONDS',
        glassA: 'WHAT', glassB: 'SURVIVES',
        swipe: 'swipe', lens: 'look', code: 'WEB3ASHLEY' } },
      { layout: 'say', copy: { handle: H,
        say: 'You have looked at your home page a thousand times. Nobody else has looked at it once.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'WHAT YOU SEE', lineA: 'The whole page, because you already know what is on it.',
        labelB: 'WHAT THEY SEE', lineB: 'One screen, held at arm’s length, for about four seconds.' } },
      { layout: 'list', copy: { handle: H,
        head: 'What has to survive that one screen:',
        rowA: 'What you do, in words they would use',
        rowB: 'Where you do it',
        rowC: 'One thing to press',
        rowD: 'A reason to believe any of it' } },
      { layout: 'count', copy: { handle: H, num: '1',
        head: 'Your name is not one of the four',
        body: 'They already have it — it is why they are here. Spending the biggest thing on the screen on the one fact they arrived with is the commonest waste I see.' } },
      { layout: 'say', copy: { handle: H,
        say: 'If a stranger cannot say what you sell from that screen alone, nothing further down gets read.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Screenshot your home page on a phone without scrolling, and show it to somebody who does not know what you do.',
        cta: 'ASK ONE PERSON' } },
    ],
  },

  traffic: {
    id: 'traffic', title: 'The one number worth counting',
    about: 'Analytics. Why the number everybody reports is the one that '
         + 'changes nothing.',
    slides: [
      { layout: 'h051', copy: {
        railL: ['Traffic is the number', 'that changes nothing.'],
        railR: ['Field note', '04'],
        setup: ['Everyone counts visits.', 'The number that pays is'],
        index: '04', hero: 'QUIET',
        subhead: ['THE 1 NUMBER', 'WORTH COUNTING.'],
        body: 'Ads open the door. The page decides whether anybody stays in the room, and the busiest sites are rarely the ones that get the call.',
        cta: 'Book the hour', date: 'THIS WEEK',
        note: 'Visits go up when you post and back down when you stop. Nothing about the business has changed in between.',
        footer: 'You do not need the most traffic. You need the page that turns it into a call.',
        tagA: 'AUDIT.1', tagB: 'ONE HOUR' } },
      { layout: 'say', copy: { handle: H,
        say: 'Visits go up when you post. They go back down when you stop. Nothing has changed.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'THE NUMBER IN THE REPORT', lineA: 'How many people arrived.',
        labelB: 'THE NUMBER THAT PAYS', lineB: 'How many of them did the one thing the page was for.' } },
      { layout: 'count', copy: { handle: H, num: '1',
        head: 'Pick the single action worth counting',
        body: 'A booking, a call, a message. One. It has to be something that would put money in the account if it happened more often.' } },
      { layout: 'count', copy: { handle: H, num: '2',
        head: 'Count it for a fortnight before you change anything',
        body: 'Otherwise every change afterwards is an opinion. A fortnight of the number as it stands is the cheapest thing you can buy.' } },
      { layout: 'say', copy: { handle: H,
        say: 'One number, counted honestly, will settle arguments a year of reporting never did.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Name the one action on your site that is worth money, and find out how many times it happened last month.',
        cta: 'FIND THE NUMBER' } },
    ],
  },

  waiting: {
    id: 'waiting', title: 'Four things making your site slow',
    about: 'Speed. Not a technical complaint — a lost enquiry.',
    slides: [
      { layout: 'h017', copy: {
        stamp: 'TOO SLOW!', cry: 'STILL?',
        lineA: 'the 4 things', lineB: 'doing it....' } },
      { layout: 'say', copy: { handle: H,
        say: 'Nobody has ever told you your site is slow. They just went back to the results.' } },
      { layout: 'list', copy: { handle: H,
        head: 'What it usually is, in order:',
        rowA: 'One photograph nobody resized',
        rowB: 'A font loaded four different ways',
        rowC: 'A chat widget you forgot about',
        rowD: 'Tracking for a campaign that ended' } },
      { layout: 'plate', copy: { handle: H,
        line: 'It is fast on your laptop, on your wifi, with everything already cached.' } },
      { layout: 'count', copy: { handle: H, num: '1',
        head: 'The photograph is nearly always the whole problem',
        body: 'One image straight off a camera can outweigh the rest of the page put together. Resizing it is a job for an afternoon, not a rebuild.' } },
      { layout: 'versus', copy: { handle: H,
        labelA: 'WHAT SLOW SOUNDS LIKE', lineA: 'A technical problem, for later.',
        labelB: 'WHAT IT IS', lineB: 'The people who wanted you, leaving before they saw anything.' } },
      { layout: 'close', copy: { handle: H,
        turn: 'Turn wifi off, open your own site on mobile data, and count out loud until it is readable.',
        cta: 'COUNT IT OUT LOUD' } },
    ],
  },
};

export const DECK_IDS = Object.keys(DECKS);

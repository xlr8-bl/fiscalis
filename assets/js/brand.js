/**
 * brand.js — the voice rules, as something a machine can check.
 *
 * The brand spec is written for a reader: "never use these words", "first
 * person singular always", "competence is inferred, never asserted". Spark
 * writes five captions a day and will not re-read a document before each
 * one, so the rules live here instead — handed to it in the brief, and
 * enforced where it matters.
 *
 * Two places, deliberately different:
 *
 *   at plan time   reported back in the tool result, so Spark can fix the
 *                  caption in the same turn it wrote it
 *   at approval    refused outright, the same as a platform limit, so
 *                  nothing off-voice can reach a queue
 *
 * Shared by the Worker, the studio, and tools/check_brand.mjs, because two
 * copies of a banned-word list is how one of them quietly falls behind.
 */

/* ------------------------------------------------------------- the rules */

/** Phrases that ask. Availability is stated as fact, never pitched. */
export const BANNED_CTA =
  /\b(dm me|let'?s talk|book a free|free call|contact us today|reach out|link in bio|swipe up|follow for more|check it out|want me to help)\b/i;

/** The words the spec lists as never. */
export const BANNED_WORDS =
  /\b(passionate|innovative|cutting[- ]edge|seamless|solutions|leverage|empower|world[- ]class|best[- ]in[- ]class|game[- ]chang\w+|revolutionary)\b/i;

/** One person. There is no team, real or implied. */
export const PLURAL = /\b(we|our|us)\b/i;

/** No price, no tiers, anywhere. */
export const PRICE =
  /[$£€]\s?\d|\bpricing\b|\bpackages?\b|\btiers?\b|\brate card\b|\bstarting at\b|\bper hour\b|\bretainer\b/i;

/** Trust is inferred from the diagnosis, never claimed. */
export const ASSERTED =
  /\b(trusted by|our values|our mission|why choose|award[- ]winning|industry[- ]leading|proven track record|years of experience|expert in|world[- ]renowned)\b/i;

/** Emoji, in any context. */
export const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

/** Describing the operator's own speed, scale or capability. */
export const SELF_PRAISE =
  /\b(I am the best|I'?m the best|my award|I specialise in delivering|I deliver world|in record time|in just \d+ (hours?|days?)|built in \d+ (hours?|days?))\b/i;

/*
 * THE CLOSE.
 *
 * There used to be one line here, on every post, forever: "This is the
 * kind of thing I fix." It is gone, and it is worth writing down why,
 * because a fixed sign-off is a tempting thing to reinstate.
 *
 * It is not a call to action. It says something about ME and asks the
 * reader for nothing, so nobody does anything. It is identical on every
 * post, so by the fourth one it is furniture and stops being read. And
 * it arrives as a separate sales line stapled to the end, which is
 * precisely the failure the research names: a closing CTA works when it
 * CONTINUES the thing the reader just went through, and fails when it
 * interrupts it.
 *
 * What replaced it is a set of SHAPES rather than a line. The close is
 * written fresh for each carousel, out of that carousel's own subject,
 * and it is the only slide that turns outward.
 *
 * WHAT THE RESEARCH SAYS, and where it comes from:
 *
 *   One clear ask beats several. Pages carrying a single CTA convert at
 *   about 13.5% against 10.5% for pages carrying three or more. So the
 *   closing slide asks for exactly one thing.
 *
 *   First person beats second person on the ask itself. Unbounce's
 *   often-cited test moved "Start your free trial" to "Start my free
 *   trial" and saw click-through rise sharply; later tests generally
 *   agree on the direction while disagreeing on the size. Treat the
 *   direction as real and the number as one test, not a law. The device
 *   is that the ask is phrased in the READER's voice, as something they
 *   are choosing, not in ours as something we are instructing.
 *
 *   The close and the caption work as a pair. They are not two chances
 *   to say the same sentence.
 *
 * Sources, so this can be argued with:
 *   https://www.klientboost.com/landing-pages/call-to-action-copy/
 *   https://gempages.net/blogs/shopify/ab-testing-cta-buttons
 *   https://www.truefuturemedia.com/articles/instagram-carousel-strategy-2026
 */
export const CLOSES = [
  {
    name: 'the harder version',
    what: 'Name the same check, one level up, where it actually costs money.',
    example: 'You just checked the easy page. Run it on the one where people pay you.',
    use_when: 'The carousel taught a check that has an obvious harder sibling.',
  },
  {
    name: 'the consequence, dated',
    what: 'Say how long it has been wrong, using the reader\'s own situation.',
    example: 'If yours failed, it has been failing since the day it went live.',
    use_when: 'The fault is one that never announces itself.',
  },
  {
    name: "the reader's own words",
    what: 'The ask phrased as the reader would say it, not as an instruction.',
    example: 'Send me the URL and I will tell you which of the four it is.',
    use_when: 'The carousel produced a result the reader now wants explained.',
  },
  {
    name: 'the keep',
    what: 'Ask them to keep it, and say what for. Never "save this for later".',
    example: 'Keep this. It is the list to run before you pay anybody to rebuild.',
    use_when: 'The carousel is a checklist somebody will need again.',
  },
  {
    name: 'the pass-on',
    what: 'Name the person who needs it, specifically. Never "tag a friend".',
    example: 'Send it to whoever built the site, not to whoever pays for it.',
    use_when: 'The reader is not the person who can fix it.',
  },
];

export const CLOSE_NAMES = CLOSES.map((c) => c.name);

/**
 * Who it is for, said once, on a closing slide.
 *
 * Both halves in one line on purpose. Somebody with no site and
 * somebody with a bad one read as two audiences and are one: the second
 * is the first, two years later, and a line that names only one of them
 * loses the other. No price, no package, and no promise of a result,
 * because none of those can be made honestly on a carousel.
 */
export const AUDIENCE = [
  'Whether you are putting your first one up or fixing the one you have.',
  'New site, or the one that has been quiet for two years.',
  'The site that is not built yet, and the one that is and is not working.',
];

/**
 * Engagement bait. Refused by the validator, not merely discouraged.
 *
 * Every one of these asks the reader for a favour and gives them nothing
 * to answer. They are also the exact lines every account posts, which is
 * why they stopped working: a reader has scrolled past "save this for
 * later" a hundred times today. What replaces them is in CLOSES and in
 * the prompt block, and the rule is the same in both: ask for something
 * only somebody who read THIS carousel could give you.
 *
 * "link in bio" is here for a second reason as well. The sources that
 * rank calls to action put it last on the grounds that off-platform
 * links get de-weighted, which is not why it is banned but agrees.
 */
export const BAIT = [
  'save this for later', 'save this post', 'save for later',
  'tag a friend', 'tag someone', 'share this with someone',
  'link in bio', 'check the link in bio',
  'dm me', 'send me a dm', 'slide into',
  'follow for more', 'follow me for', 'hit follow',
  'let me know what you think', 'thoughts?', 'agree?',
  'double tap', 'like and share', 'drop a', 'comment below',
];/** The anchor beat, from a fixed rotation. */
export const ANCHORS = [
  'Nobody checked.',
  'Nobody noticed.',
  'Nobody fixed it.',
  'Nobody told them.',
];

/**
 * What the brief hands Spark before it writes anything. Prose, because
 * this is read by a language model rather than parsed.
 */
export const VOICE = {
  person: 'First person singular, always. "I build", never "we build". There is no team.',
  case: 'Sentence case. No title case headings, no ALL CAPS except a mono system label.',
  sentences: 'Short sentences, one idea each. If it would trip a read aloud, rewrite it.',
  jargon:
    'Roughly 40% technical, 60% plain. One or two technical terms per piece, dropped and '
    + 'moved past, never defined. Everything else legible to a business owner with no '
    + 'technical background: money, customers, time, consequence.',
  naming:
    'Name real people, companies and dates. "A Harvard study" is forgettable; "Michael Luca '
    + 'at Harvard Business School, using Seattle tax filings" is a story. Where a name is '
    + 'genuinely not public, say so out loud.',
  price:
    'No price, ever, anywhere. Not a range, not a package, not a tier. The numbers that '
    + 'belong in a post are the diagnosed case\'s numbers, never a fee.',
  capability:
    'Never describe your own capability, speed or scale. Competence is proven by the '
    + 'quality of the diagnosis and inferred by the reader. Asserting it is worse than '
    + 'saying nothing.',
  trust:
    'Never write stated-trust language — no "trusted by", no values statements. Trust is '
    + 'earned by diagnosing something correctly in public.',
  close:
    'There is no fixed sign-off. The last slide asks for exactly ONE thing, '
    + 'written out of this carousel\'s own subject, phrased in the reader\'s '
    + 'voice rather than as an instruction from me. Pick a shape from CLOSES '
    + 'and write it fresh. A line that would work on any post is the wrong line.',
  anchor: `One flat anchor beat per piece, from this rotation: ${ANCHORS.join(' / ')}`,
  banned:
    'Never: DM me, let\'s talk, book a call, link in bio, follow for more, passionate, '
    + 'innovative, cutting-edge, seamless, solutions, leverage, empower, emoji of any kind, '
    + 'invented testimonials or case studies.',
};

/** The evidence standard. Nothing is written from memory. */
export const RESEARCH = {
  rule: 'Every factual claim is verified by search before it is used. Nothing from memory.',
  needs: ['who, named, with their actual title', 'when, the year and ideally the month',
          'what was measured, and how', 'the exact number, not a rounded one',
          'the source URL, kept on file'],
  prefer: [
    'peer-reviewed papers',
    'named-author industry research with a published method',
    'company engineering blogs describing their own experiments',
    'aggregated industry statistics, only when the primary source cannot be found',
  ],
  avoid: [
    'unsourced "studies show"',
    'marketing blog posts citing other marketing blog posts',
    'any statistic that cannot be traced to a named method',
  ],
};

/** What to ask of a finished carousel before handing it over. */
export const SELF_CHECK = [
  'Does it name real people, companies and dates?',
  'Is every statistic traceable to a named source?',
  'Does the fix name two or three concrete actions, not vague advice?',
  'Would a business owner understand every sentence without a dictionary?',
  'Does it describe your own capability, speed or scale anywhere? If so, cut that line.',
  'Is there any price, rate or package? If so, remove it entirely.',
  'Is the anchor beat used exactly once, and is it flat?',
  'Could a CFO and a senior engineer both read it without wincing?',
];

/* ------------------------------------------------------------- the check */

const RULES = [
  ['asks for something', BANNED_CTA, 'availability is stated as fact, never pitched'],
  ['a word the spec bans', BANNED_WORDS, 'marketing filler'],
  ['first person plural', PLURAL, 'one person — "I", never "we"'],
  ['a price or a package', PRICE, 'no price appears in public content'],
  ['asserted trust', ASSERTED, 'trust is inferred from the diagnosis'],
  ['an emoji', EMOJI, 'never, in any context'],
  ['self-praise', SELF_PRAISE, 'competence is inferred, never claimed'],
];

/**
 * Everything off-voice in a carousel, in the words needed to fix it.
 * Checks the caption, the hashtags, the title, and the type on every
 * slide — a banned word set into an image is the expensive kind, because
 * fixing it means drawing the slide again.
 *
 * @returns {string[]}
 */
export function problems(c) {
  const out = [];
  const look = (where, text) => {
    if (!text) return;
    for (const [name, re, why] of RULES) {
      const hit = re.exec(String(text));
      if (hit) out.push(`${where} has ${name} — "${hit[0]}". ${why}.`);
    }
  };

  look('The title', c.title);
  look('The caption', c.caption);
  look('The hashtags', c.hashtags);
  for (const s of c.slides || []) {
    look(`Slide ${s.position + 1}`, s.copy);
  }
  return out;
}

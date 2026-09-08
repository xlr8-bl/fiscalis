/**
 * guide.js — what Spark reads before it designs a teaching carousel.
 *
 * The catalogue in slides.js says what exists. This says how to USE it,
 * which is a different thing and the one that was missing: Spark could
 * see six template names and still not know that `steps` is the densest
 * arrangement, that a chip is a phrase and not a sentence, or that an
 * icon is chosen for the sentence it sits under.
 *
 * Written as instructions rather than as a schema on purpose. A schema
 * says what is ALLOWED; an agent writing five carousels a day needs to
 * know what is GOOD, and the difference between a slide that validates
 * and a slide worth posting is entirely in here.
 *
 * Everything with a number in it is measured. Where a number came from
 * a render rather than from taste, it says so, because the day somebody
 * wants to argue with one of these is the day they need to know which
 * kind it is.
 */

import { TEMPLATES, TEMPLATE_NAMES } from '../../assets/js/slides.js';
import { PER_LINE, LIMITS, RECAP_MAX, SLIDE_FIELDS, validateSlides } from './spec.js';
import { ALL_ICONS, ICON_NAMES } from '../../assets/js/icons.js';
import { CLOSES, BAIT, AUDIENCE } from '../../assets/js/brand.js';
import { cutoutCatalogue } from '../../assets/js/cutouts.js';
import { ctaCatalogue } from './ctas.js';
import { hookCatalogue, HOW_TO_USE_A_HOOK } from '../../assets/js/hooks/guide.js';

/** Roughly how many characters fit on one line of each thing. */
const perLine = () => ({
  title: Math.floor(PER_LINE.title),
  say: Math.floor(PER_LINE.say),
  action: Math.floor(PER_LINE.action),
  note: 'Measured by wrapping real prose at the real size in the real '
      + 'column. A line of capitals runs shorter, so treat these as the '
      + 'top of the range rather than a target.',
});

/**
 * How much room each template leaves, in lines rather than characters.
 *
 * Characters are the wrong unit for a writer: "230 characters" means
 * nothing, while "about four lines, and the headline takes two of them"
 * is a decision you can make.
 *
 * ASKED OF THE VALIDATOR, not calculated alongside it. The first version
 * did the arithmetic again here and said `open` holds twelve lines of
 * paragraph when the validator refuses it well before that. Two
 * calculations of the same thing is how a guide starts lying, so this
 * one fills a slide with paragraph lines until validateSlides refuses
 * it, and reports the last number that passed.
 */
const PROBE_LINE = 'wondering about the thing that happens next in a sentence';

/**
 * The slide the room figures are measured on, exported so the check can
 * measure the same one. Two probes is the same fault as two sums: the
 * guide said `portrait` holds two lines and the check, building its own
 * probe without a photograph, found the validator refusing two.
 */
export function probeSlide(name, lines) {
  const blocks = TEMPLATES[name].blocks;
  const every = {
      template: name, ground: 'paper', handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'Why nobody calls you back',
      icons: ['bolt', 'eye', 'no'],
      // the sign-off's photograph is fixed, so measure the one it carries
      portrait: name === 'signoff' ? 'phone-chair' : 'blue-flat',
      context: name === 'signoff' ? 'signoff' : 'cta',
      action: 'Open your own site on your phone and time how long it takes.',
      chips: ['the number is a picture', 'the form emails nowhere',
              'the hours are last year'],
      duo: [{ head: 'Slow', tail: 'the server is thinking' },
            { head: 'Heavy', tail: 'the page is enormous' }],
      recap: ['Time it on your phone, on data',
              'Send yourself an enquiry and wait',
              'Read what Google says your hours are',
              'Watch one person try to tap something'],
      echo: 'Your site loads. So what?',
      prompt: { question: 'Which of the four did yours fail on?',
                options: ['the phone', 'the form', 'the hours'] },
      line: 'Whether you are putting your first one up or fixing the one you have.',
      /* The evidence blocks. A probe that leaves one empty is refused
         before it measures anything, so the room came back 0. */
      shot: { src: 'probe', url: 'example.com/contact',
              caption: 'What the page actually says, at the size a phone shows it.' },
      bars: [{ label: 'Photographs', value: 3.4 }, { label: 'Fonts', value: 0.9 }],
      swap: [{ head: 'Submit', tail: 'Send my enquiry' }],
      term: { word: 'Favicon', means: 'The tiny picture in the browser tab.' },
      apps: ['webflow', 'wordpress'],
      quote: { text: 'Arriving somewhere is not the same as knowing what to do there.',
               who: 'A line from these sheets' },
      stat: { figure: '10 min', of: 'of browser time a day on the free plan.' },
      source: 'Counted in assets/icons, September 2026.',
  };
  /* Only the fields this template actually has. The probe used to hand
     over every block's field at once and let the template pick, which
     validateSlides now refuses by name — rightly, since a field a
     template does not have is one a writer sets and never sees. */
  const keep = new Set(['template', 'ground', 'handle', 'series']);
  const counts = new Map();
  for (const b of blocks) {
    const nth = (counts.get(b) ?? 0) + 1;
    counts.set(b, nth);
    keep.add(nth === 1 ? b : `${b}${nth}`);
    if (b === 'portrait') { keep.add('portrait'); keep.add('context'); }
  }
  const slide = Object.fromEntries(
    Object.entries(every).filter(([k]) => keep.has(k)));

  const says = Math.max(1, blocks.filter((b) => b === 'say').length);
  const text = Array.from({ length: Math.max(1, Math.ceil(lines / says)) },
                          () => PROBE_LINE).join(' ');
  slide.say = text;
  if (says > 1) slide.say2 = text;
  return slide;
}

function roomIn(name) {
  const blocks = TEMPLATES[name].blocks;
  const fits = (n) => {
    const s = probeSlide(name, n);
    return validateSlides({ slides: [s, s] }, { opener: false }).ok;
  };

  /* A template with no paragraph block has no paragraph room, and the
     loop below would report 12 for it: nothing it was handed ever got
     drawn, so nothing ever failed to fit. `recap` is the case. */
  if (!blocks.includes('say')) {
    return { headline_lines: 2, paragraph_lines_total: 0,
             note: 'No paragraph on this one. What it holds instead is in its '
                 + 'own block, and the limits for that are in the block list.' };
  }

  let lines = 0;
  // opened up when the instruction came off the teaching panels: an
  // `open` slide got three lines back and the old ceiling of 12 clipped it
  for (let n = 1; n <= 24; n++) { if (!fits(n)) break; lines = n; }
  return {
    headline_lines: 2,
    paragraph_lines_total: lines,
    note: says_note(blocks),
  };
}

const says_note = (blocks) => (blocks.filter((b) => b === 'say').length > 1
  ? 'Split across the two paragraphs this template has. Measured against a '
    + 'two-line headline and a full chip stack, so a shorter headline buys '
    + 'back a line.'
  : 'All in the one paragraph. Measured against a two-line headline and a '
    + 'full chip stack, so a shorter headline buys back a line.');

export const HOW_TO_WRITE = {
  the_shape_of_a_set: [
    'Five or six slides. Two is thin and ten is a document.',
    'Open, then two to four middles, then the sign-off.',
    'Vary the shape. Two of the same template back to back is the commonest '
    + 'fault in these sets: if slides three and four are both `reasons`, one '
    + 'of them is the wrong shape for what it actually says. Pick by the job '
    + 'the slide has to do — picking_one indexes every template by that.',
    'The instruction is a KIND of slide, not a footer. Only swap, close, '
    + 'signoff, recap, calling and bookend carry a DO THIS: panel; a teaching '
    + 'panel is refused if you give it one. A set asks for one thing, at the '
    + 'end.',
    'One idea a slide. If a slide needs the word "also", it is two slides.',
    'The handle and series on the rail are the same on every slide. A '
    + 'person who saves slide four has to be able to tell whose it is.',
    'NEVER number them. No "01 / 04", no "2 of 5", not in the copy and not '
    + 'as a label. Counting tells a reader how much is left, which is an '
    + 'invitation to stop. The renderer draws no numbers and you must not '
    + 'write any.',
  ],

  headline: [
    `About ${Math.floor(PER_LINE.title)} characters a line and two lines at most, `
    + 'so roughly six words.',
    'Sentence case, not capitals. The face is heavy and tightly tracked; '
    + 'capitals at that weight close up into a block.',
    'It has to work alone. Somebody scrolling reads the headline and '
    + 'nothing else, so a headline that only makes sense after the '
    + 'paragraph has already failed.',
    'No question mark on every slide. One question in a set is a hook; '
    + 'six is a quiz.',
  ],

  paragraph: [
    `About ${Math.floor(PER_LINE.say)} characters a line. Two to four lines.`,
    'This is the only block allowed to be prose, so it carries the actual '
    + 'explanation. Do not waste it restating the headline.',
    'Second paragraph, where a template has one, is the landing: what the '
    + 'reader now knows, or the reassurance after a list. It is the reason '
    + '`steps` and `compare` exist as separate templates.',
    'End a paragraph that introduces chips with a colon. The chips are the '
    + 'rest of that sentence.',
  ],

  chips: [
    `Two to ${LIMITS.chips.max} of them, each at most ${LIMITS.chip.max} characters.`,
    'A chip is a PHRASE, not a sentence. No full stops, no verbs at the '
    + 'front unless every chip has one. They are read as one gesture, so '
    + 'they have to be the same grammatical shape.',
    'Each chip is drawn only as wide as its own words, so wildly uneven '
    + 'lengths look like an accident rather than a set. Keep them within '
    + 'about ten characters of each other.',
    'Use chips for things that belong together: what something depends '
    + 'on, what goes wrong, what to have ready. Not for steps in a '
    + 'sequence unless the order genuinely matters.',
  ],

  duo: [
    'Exactly two, and only for a real difference between two kinds.',
    `The chip is at most ${LIMITS.duoHead.max} characters and the line under `
    + `it at most ${LIMITS.duoTail.max}.`,
    'For a list of two things, use chips. Side by side says "these are '
    + 'the two kinds"; stacked says "these are two things". Getting that '
    + 'wrong turns a slide that teaches into a slide that lists.',
  ],

  instruction: [
    'Every slide has one, and it is always in the same place, so a reader '
    + 'who only wants the instruction knows where to look.',
    `About ${Math.floor(PER_LINE.action)} characters a line, two or three lines.`,
    'It has to be something a person can do today, alone, ON A PHONE, '
    + 'without buying anything and without being a developer. "Open your '
    + 'own site on your phone and time it" is an instruction. "Consider '
    + 'your load times" is not, and neither is "open the performance '
    + 'profiler in DevTools" — the reader owns the business, they do not '
    + 'build it, and there is no network tab on a phone.',
    'Write it as a sentence, not as a labelled field. "ACTION DIRECTIVE" '
    + 'over the top of it is a machine talking.',
    'On the closing slide it may be the signature line instead.',
  ],
};

export const HOW_TO_USE_ICONS = {
  what_they_are: 'Sixteen cut-out objects, chosen for what they mean. They '
    + 'carry no information: the row is the beat between the explaining '
    + 'and the instruction, and it is what makes six slides read as one '
    + 'set rather than six posts.',
  where: [
    'Set `iconsWhere` per slide: row, scatter, corner or edge. Vary it '
    + 'is the reason nobody notices them.',
    '"row" is the default and the beat between the explaining and the '
    + 'instruction. Use it on most slides, and always on the opener.',
    '"corner" drops two or three into the sheet\'s empty top-right '
    + 'shoulder, turned off square. Use it when the headline is short and '
    + 'that corner is bare. It costs the stack no height.',
    'The row is the format. Do not replace it to get variety.',
    'For "an icon here and there", set `accent` to one or two names. They '
    + 'ride the headline\'s ends, small and turned, IN ADDITION to the row. '
    + 'That is the usual way to break up a set.',
    '"scatter" drops the whole set into the headline INSTEAD of a row. It is '
    + 'the strongest arrangement and it moves the format, so use it once in '
    + 'a set at most, and never with chips: the eye cannot take both.',
    '"edge" runs them down the left of whatever is directly above, which '
    + 'is normally a chip stack, so the eye picks them up on the way past. '
    + 'Use it on one middle slide, never two in a row. It costs no height '
    + 'either, so it is free room for a longer paragraph.',
  ],
  rules: [
    `${LIMITS.icons.min} to ${LIMITS.icons.max} a slide. Three or four is the `
    + 'usual number; six is a band and reads as decoration.',
    'Pick for the sentence they sit under, never for the shape. A slide '
    + 'about load time takes `bolt`; a slide about being ignored takes '
    + '`eye`. If no icon means anything on this slide, use fewer.',
    'Vary them across the set. The same four icons on every slide is the '
    + 'strongest possible signal that nobody chose them.',
    'They are drawn with a contrast filter computed from the ground, so '
    + 'they read on paper, ink and amber alike. Nothing to set.',
  ],
  pack: ICON_NAMES.map((n) => ({ name: n, means: ALL_ICONS[n].means })),
};

/**
 * The first slide, which is the only one most people ever see.
 *
 * The fault this exists to stop: a headline that names a CATEGORY rather
 * than a thing. "Leads going nowhere" is a label on a topic. It could sit
 * on anybody's post about anything, so a scroller has to decode it before
 * knowing whether it is for them, and at feed speed they do not decode,
 * they scroll.
 *
 * There are two kinds of vagueness and only one of them works:
 *
 *   lazy       the SUBJECT is vague. "Tips for better sites." Nothing to
 *              grip. This is what a category label is, and it is banned.
 *   deliberate the subject is named and the CONSEQUENCE is withheld.
 *              "Your contact form says thanks either way." The gap only
 *              closes by swiping, which is the point.
 *
 * So: name the thing, withhold what it costs. Never the other way round.
 *
 * Read against the carousel-hook write-ups, which agree on the split and
 * on specificity beating a curiosity gap on its own:
 *   https://contentdrips.com/blog/2026/06/carousel-hook-examples/
 *   https://instacarousel.com/blog/carousel-hooks-that-stop-the-scroll/
 */
export const HOW_TO_OPEN = {
  the_rule:
    'The first slide names WHAT IT IS ABOUT in plain words, in the first '
    + 'three or four, and holds back what it costs. Somebody who reads '
    + 'nothing but the headline should be able to say what the subject '
    + 'is. Somebody who wants to know what happens has to swipe.',

  name_the_work: [
    'It has to be legible as web design, online branding or the way a '
    + 'business runs online. Not "systems", not "growth", not "presence": '
    + 'a site, a form, a booking page, a set of opening hours, a checkout.',
    'Concrete nouns do this on their own. "Your booking page" is explicit '
    + 'and takes no decoding. "Your online presence" is a category and '
    + 'takes several seconds nobody spends.',
    'A number is the other way to be concrete, and an odd one reads as '
    + 'measured rather than rounded for effect: eleven fields, not "too '
    + 'many fields".',
  ],

  before_and_after: [
    { vague: 'Leads going nowhere.',
      explicit: 'Your contact form emails nobody.',
      why: 'Names the thing on the page. The consequence is still held back.' },
    { vague: 'Fix your online presence.',
      explicit: 'Your hours on Google are last year\'s.',
      why: 'A category becomes a specific object with a specific fault.' },
    { vague: 'Websites lose customers.',
      explicit: 'Eleven fields before anyone can ask a question.',
      why: 'A counted thing. Nothing to decode and nothing rounded.' },
    { vague: 'Three quiet leaks.',
      explicit: 'Three checks your site fails on a phone.',
      why: 'Says what is being checked and where, rather than labelling a topic.' },
  ],

  never: [
    'A category label with no object in it: "growth", "presence", '
    + '"performance", "optimisation", "leads", "conversions".',
    'A question the reader cannot answer yet. A hook asks nothing.',
    'A promise about what the carousel contains. The slide is the thing, '
    + 'not a table of contents for it.',
  ],

  checked: [
    'The first slide is REFUSED if its headline names nothing a person '
    + 'could point at on their own screen. Counting is not enough on its '
    + 'own: "Three quiet leaks" counts and still names nothing.',
    'It is also refused for a word that describes the work rather than '
    + 'naming it — presence, growth, performance, leads, conversions, '
    + 'solutions, potential — even with a concrete noun beside it. '
    + '"Your site presence" names a thing and then hides it again.',
    'Neither check can tell you whether the line is any good. They catch '
    + 'the category label, which is the failure that repeats.',
  ],
};

export const HOW_TO_CLOSE = {
  the_rule: 'There is no fixed sign-off. The last slide asks for exactly ONE '
    + 'thing, written out of THIS carousel\'s subject. A line that would work '
    + 'on any post is the wrong line: it stops being read by the fourth one.',
  why: 'The old close was "This is the kind of thing I fix." on every post. It '
    + 'is not a call to action — it says something about Ashley and asks the '
    + 'reader for nothing, so nobody does anything. A closing CTA works when it '
    + 'CONTINUES what the reader just went through and fails when it '
    + 'interrupts it with a sales line.',
  research: [
    'One clear ask beats several. A page with a single CTA converts at about '
    + '13.5% against 10.5% for three or more.',
    'Phrase the ask in the READER\'s voice, as something they are choosing, '
    + 'not in ours as an instruction. First-person button copy beats '
    + 'second-person across most tests of it; treat the direction as real and '
    + 'any single percentage as one test.',
    'The closing slide and the caption are a pair, not two chances to say the '
    + 'same sentence.',
  ],
  shapes: CLOSES,
  /* Refused by the validator, not merely listed here. It was a list in
     this file, which held for as long as whoever was writing had read
     this file. */
  never: BAIT,

  the_sign_off: {
    it_is_fixed: 'Every set ends on `signoff`: Ashley seated with the phone, '
      + 'cut out, on yellow. Not a choice per carousel. A sign-off that '
      + 'changes photograph and colour between posts is not a sign-off, and a '
      + 'reader who has seen three of these knows a set has ended before '
      + 'reading a word. Set ground: "amber", portrait: "phone-chair", '
      + 'context: "signoff", anchor: "top". Anything else is refused.',
    what_you_write: 'The title, which answers what slide one opened with; one '
      + 'sentence; and the ask. The column beside him is narrow, about 19 '
      + 'characters a line, so the sentence is short by construction rather '
      + 'than by taste.',
    what_the_guidance_agrees_on: [
      'ONE ask. Never a stack of them, and one per carousel, not one per '
      + 'slide. This is the only point every source makes.',
      'The last slide should read as the reward for swiping to it, not as '
      + 'an advert appended to the end. A closing slide that changes voice '
      + 'reads as an ad and gets treated as one.',
      'It should bookend the opening, so the set has a shape rather than '
      + 'just stopping.',
      'A recap pays off the reader who swiped without reading, which is '
      + 'most of them.',
    ],
    where_they_disagree: 'What fills the rest of it. One camp says recap the '
      + 'carousel, the other says one statement and the ask, and neither '
      + 'shows work. So there is a template for each and the choice is made '
      + 'per carousel rather than settled here.',
    on_the_sources: 'Every figure in this area traces back to a marketing '
      + 'blog citing another marketing blog. The ones checked cite no '
      + 'primary source, and two of them give save rates that differ by a '
      + 'factor of four. So the STRUCTURE above is used and none of the '
      + 'numbers are, and nothing on a slide should quote any of them.',
    one_agreement_worth_noting: 'The sources that rate CTA types put "link '
      + 'in bio" last, on the grounds that off-platform links get '
      + 'de-weighted. That is independent of Ashley\'s reasons and lands in '
      + 'the same place, which is why it stays in `never` above.',
    how_long_the_recap_can_be: {
      lines_max: RECAP_MAX.n,
      with_a_prompt_as_well: RECAP_MAX.with_a_prompt,
      why_two_numbers: 'Both are real and choosing between them is the '
        + `decision. On its own the list holds ${RECAP_MAX.n} lines. Put a `
        + `question and its answers on the same sheet and ${RECAP_MAX.with_a_prompt} `
        + 'is what is left. So a long carousel gets the list, and a short one '
        + 'can afford both.',
      it_is_measured: 'Neither number is written down anywhere. Both are '
        + 'found by filling a recap slide against the same costs the layout '
        + 'uses and reporting the last count that fit, so if a metric moves '
        + 'they move with it.',
      never_short_of_the_carousel: `A carousel runs to ${LIMITS.slides.max} `
        + `slides and the list holds ${RECAP_MAX.n}, so there is no legal `
        + 'carousel a recap cannot list. That is checked, and it is the point: '
        + 'a cap that could not hold the carousel would leave nothing to do '
        + 'but drop lines quietly, and quietly is the worst way to drop them.',
      the_lines_share_the_room: 'They are not set at a fixed pitch. Four or '
        + 'fewer sit at the roomy one and past that they tighten to a floor, '
        + 'so the block stays inside one band however long it is. Write the '
        + 'list the carousel needs and let it set itself.',
      what_goes_in_it: 'One line per thing worth doing again, which is not '
        + 'necessarily one per slide. A slide that set something up and a '
        + 'slide that paid it off are one line. If the list is running to ten, '
        + 'the question is whether the carousel is doing too much, not whether '
        + 'the recap is too small.',
    },

    engagement: {
      the_device: 'One, and it is the `prompt` block: a question with two or '
        + 'three answers already on it. It works where an open question does '
        + 'not, for a reason worth knowing. An open question asks the reader '
        + 'to compose a sentence and almost nobody will; a question with the '
        + 'answers on it asks them to type one character.',
      it_does_a_second_job: 'The answers tell Ashley which of the three the '
        + 'reader is, which an open question does not. "Which of the four did '
        + 'yours fail on" comes back as a list of what is actually broken on '
        + 'the sites of people who are reading.',
      it_never_replaces_the_instruction: 'One ask per carousel is the one '
        + 'thing every source agrees on. The prompt sits ABOVE the '
        + 'instruction and is the soft one: answering is something, and doing '
        + 'the instruction is the thing.',
      write_it: [
        'Ask something only somebody who read THIS carousel could answer.',
        `Two or three answers, each at most ${LIMITS.option.max} characters. `
        + 'They go in a row, and they wrap when the column is narrow.',
        'The answers should be the real ones, including the one that is bad '
        + 'news. "no number" belongs in the list.',
        'Never a question whose answer is yes. There is nothing to say next.',
      ],
      refused: 'The bait list is enforced by the validator now, on the '
        + 'instruction and on the prompt, not left as advice here.',
    },

    who_it_is_for: {
      what: 'The `line` block: one quiet line near the foot saying who this '
        + 'is for. Optional, and it should be, because the same line on every '
        + 'outro is wallpaper. Use it on maybe one carousel in three.',
      the_rule: 'Both halves of the same person in one line. Somebody with no '
        + 'site and somebody with a bad one read as two audiences and are '
        + 'one: the second is the first, two years later. A line that names '
        + 'only one of them loses the other.',
      lines: AUDIENCE,
      never: 'No price, no package, no tier, and no promise of a result. None '
        + 'of those can be made honestly on a carousel and two of them are '
        + 'banned everywhere public.',
    },

    pick: {
      recap: 'The default. Use it when the carousel taught more than one '
           + 'thing and a reader could plausibly want the list again.',
      bookend: 'Use it when the carousel OPENED on a question or a claim. '
             + 'It needs that opening headline verbatim, so it cannot be '
             + 'written without slide one in front of you.',
      calling: 'Use it when the subject was being reachable, or not being. '
             + 'It is the only one that shows the problem instead of '
             + 'restating it, and it is the only one with no headline.',
    },
  },
};

export const HOW_TO_USE_PICTURES = {
  when: 'A teaching slide is read, not glanced at, so a photograph behind '
    + 'it is competition for the words. Use one on the opening slide or '
    + 'the closing slide, and not on the ones carrying chips.',
  how: 'Name a file from the library in `scene`. It fills the frame and the '
    + 'ground is laid over it at 82%, enough that a paragraph reads anywhere '
    + 'on the sheet. Set `veil` lower when the type is going somewhere '
    + 'SOURCES.md already measured quiet: black-wall\'s left half is darker '
    + 'than the ink ground, and at 0.82 the sheet came back as a tint with a '
    + 'ghost in it.',
  black_wall_cannot_be_cut: 'It is a scene and only a scene. Black ground, '
    + 'black jacket, so the key takes the white panel as subject and the '
    + 'jacket as ground. Asking for a cut-out of it gets a refusal rather '
    + 'than a guess.',
  two_treatments: 'blue-flat and sky-arms are cut out of paper with scissors: '
    + 'rough outline, white border, a shadow. phone-chair is keyed and NOTHING '
    + 'else, because it is a whole figure on a chair of chrome tubing about '
    + 'six pixels across at the size a sheet draws it, and both the cut and '
    + 'the border are coarse on purpose, so both bridge the tubes into white '
    + 'slabs. The treatment belongs to the photograph. You do not choose it.',
  where_they_sit: 'Decided by which edges of its own frame the photograph cut '
    + 'him, measured off the key rather than eyeballed. A cut side goes flush '
    + 'against the sheet\'s matching edge, so he reads as poking out of that '
    + 'corner, which is how the picture was taken. A side that was NOT cut '
    + 'keeps a margin, because standing a whole shoulder hard against an edge '
    + 'invents a cut. blue-flat is cut on the right and the bottom, so it has '
    + 'exactly one corner. sky-arms is cut on the bottom only, so the bottom '
    + 'is snapped and the corner is free. phone-chair is cut on no side at '
    + 'all, so it never goes against an edge: it floats, which is why it is '
    + 'the one that also works in the middle of a carousel.',
  photographs: cutoutCatalogue(),
  placement_is_fixed: 'You pick a photograph. You never pick where it goes. '
    + 'Every one has ONE placement per context, written down in cutouts.js '
    + 'and measured off the picture itself: a figure that runs off the right '
    + 'of its own frame goes to the right edge of the sheet and off it. A '
    + 'face that appears bottom-right one day and centre-left the next reads '
    + 'as an accident both times.',
  closings: ctaCatalogue(),
  a_closing_is_not_a_teaching_slide: 'Pick a closing by NAME and it arrives '
    + 'whole. They do not look like the teaching templates and that is '
    + 'deliberate: a teaching slide is a centred stack because the stack is '
    + 'the slide, and a closing has a figure holding one side and the foot. So '
    + 'the type is flush to the side he is NOT on, anchored to the top, and '
    + 'held inside the half the photograph measured quiet.',
  cut_out: 'The `portrait` template puts one of Ashley\'s photographs on the '
    + 'sheet with its background taken off: a shape on the sheet, not a '
    + 'photograph in a box. Name the file stem, e.g. `portrait: "blue-flat"`, '
    + 'and `context` for how big and where: "cta", "hook", or "middle" where '
    + 'the photograph offers it. Use it once in a set at most. It is the slide '
    + 'that says a person is behind this, and twice makes the carousel about '
    + 'him.',
  ashleys_own: [
    'Four of Ashley\'s own photographs are in assets/stock/own, and they '
    + 'come before the stock library. Their type-safe regions are '
    + 'measured and written down in SOURCES.md beside them.',
    'All four carry a recognisable face. They are for Ashley\'s own posts '
    + 'only, and nothing invented may be set over them: no fabricated '
    + 'quote, no invented figure, nothing implying the person pictured '
    + 'said the thing.',
  ],
  never: 'Do not put a photograph behind a slide whose subject is in the '
    + 'middle of the frame. The runs of type cross the centre.',
};

/** The templates, with what each is for and how much it holds. */
/**
 * Which slide to reach for, keyed by what it has to DO.
 *
 * The failure this exists to stop: nineteen templates is worse than six
 * if the way to choose between them is reading nineteen descriptions.
 * Spark took whichever came first in the list, which is how three sets
 * in a row came back as panels of reasons.
 *
 * So this is an index by intent. A writer knows what the next slide has
 * to accomplish before they know what it should look like, and that is
 * the question this answers.
 */
export const PICK_A_SLIDE = {
  how_to_use_this: 'Before writing a slide, say in one phrase what it has to '
    + 'do. Find that phrase here, use the template it names, and write only '
    + 'the fields that template takes. Every template also carries `for`, '
    + 'which is the same idea attached to the template itself.',

  by_what_the_slide_has_to_do: {
    'say what the subject is': 'open',
    'give the reasons': 'reasons',
    'give the steps, in order': 'steps',
    'separate two things people confuse': 'compare',
    'point at evidence, as a list': 'proof',
    'show a real page': 'shot',
    'show a real page AND the fix': 'annotated',
    'draw figures to scale': 'chart',
    'land one number': 'figure',
    'explain a word': 'define',
    'quote somebody, with their name': 'quote',
    'name the products involved': 'tools',
    'say instead of this, do this': 'swap',
    'say a person is behind this': 'portrait',
    'end the set': 'signoff',
  },

  the_two_that_changed: [
    'The instruction is NOT a footer any more. Only swap, close, signoff, '
    + 'recap, calling and bookend carry a DO THIS: panel, and a teaching '
    + 'panel is refused by name if you try to give it one. A set carries '
    + 'ONE ask and it is normally the sign-off. If a middle slide genuinely '
    + 'needs an instruction, that slide is a `swap`.',
    'Anything that carries evidence refuses to draw without the part that '
    + 'makes it checkable: shot needs the address it was captured from, '
    + 'chart and figure need a source, quote needs a name. That is not '
    + 'strictness for its own sake — those three are the shape of proof, '
    + 'and the shape is much easier to write than the thing.',
  ],

  do_not: [
    'Two of the same template back to back. If slides three and four are '
    + 'both `reasons`, one of them is the wrong shape for what it says.',
    'A screenshot of anything behind a login, of somebody else\'s personal '
    + 'data, or of a client\'s dashboard. Capture your own, a public demo, '
    + 'or documentation.',
    'An app mark on a slide that does not discuss that product.',
    'A number without a source, on any template.',
  ],
};

export const TEMPLATE_GUIDE = () => TEMPLATE_NAMES.map((name) => {
  /* Every field this template takes, listed rather than inferred. The
     validator refuses anything else by name, so handing over the exact
     set beforehand is the difference between a refusal that teaches and
     a guessing game. Built from the same blocks the renderer draws. */
  const counts = new Map();
  const fields = [];
  for (const b of TEMPLATES[name].blocks) {
    const nth = (counts.get(b) ?? 0) + 1;
    counts.set(b, nth);
    fields.push(nth === 1 ? b : `${b}${nth}`);
  }
  return {
    name,
    for: TEMPLATES[name].for,
    asks: TEMPLATES[name].blocks.includes('action'),
    what: TEMPLATES[name].what,
    blocks: TEMPLATES[name].blocks,
    fields_it_takes: [...fields, ...SLIDE_FIELDS].sort(),
    nothing_else:
      'Any other field is refused by name. It is not dropped quietly, and '
      + 'there is no field for a slide number, a section label or a '
      + 'heading over the instruction.',
    ...roomIn(name),
  };
});

/**
 * The whole guide, as one object.
 *
 * It goes in design_brief rather than in the tool's schema because a
 * schema is read as a list of what is permitted and this is a list of
 * what is good, and an agent that reads only the schema writes slides
 * that validate and are not worth posting.
 */
export const slideGuide = () => ({
  characters_a_line: perLine(),
  picking_one: PICK_A_SLIDE,
  templates: TEMPLATE_GUIDE(),
  writing: HOW_TO_WRITE,
  opening: HOW_TO_OPEN,
  /* The first slide can be a hook SHEET rather than a teaching panel: a
     different renderer, absolute boxes off a reference, his photograph
     cut out and snapped to an edge. They were built and never exposed,
     so every carousel opened on a teaching panel because that was the
     only thing that had a name. */
  hooks: { how: HOW_TO_USE_A_HOOK, sheets: hookCatalogue() },
  closing: HOW_TO_CLOSE,
  icons: HOW_TO_USE_ICONS,
  pictures: HOW_TO_USE_PICTURES,
  refusals: [
    'Copy is checked against the room the template has, using the same '
    + 'arithmetic that draws it. Too long comes back saying how many '
    + 'lines to cut, and the paragraphs are where the room is.',
    'A ground that cannot carry a paragraph is refused, not warned about.',
    'An icon name that is not in the pack is refused rather than dropped.',
    'A rail that changes between slides of one carousel is refused.',
    'A field the template does not have is refused BY NAME, and the '
    + 'refusal lists what it does take. Nothing is dropped quietly.',
    'A block the template does not have cannot be added. Pick a different '
    + 'template instead; an arrangement nobody measured cannot be checked.',
  ],
});

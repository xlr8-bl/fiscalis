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
import { PER_LINE, LIMITS, validateSlides } from './spec.js';
import { ICONS, ICON_NAMES } from '../../assets/js/icons.js';
import { CLOSES } from '../../assets/js/brand.js';
import { cutoutCatalogue } from './cutouts.js';
import { ctaCatalogue } from './ctas.js';

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
  const slide = {
      template: name, ground: 'paper', handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      title: 'Why nobody calls you back',
      icons: ['bolt', 'eye', 'no'],
      portrait: 'blue-flat',
      action: 'Open your own site on your phone and time how long it takes.',
      chips: ['the number is a picture', 'the form emails nowhere',
              'the hours are last year'],
      duo: [{ head: 'Slow', tail: 'the server is thinking' },
            { head: 'Heavy', tail: 'the page is enormous' }],
  };
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
    return validateSlides({ slides: [s, s] }).ok;
  };

  let lines = 0;
  for (let n = 1; n <= 12; n++) { if (!fits(n)) break; lines = n; }
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
    'Open, then two to four middles, then close. The close is the only '
    + 'slide where the instruction is the whole point of the slide.',
    'One idea a slide. If a slide needs the word "also", it is two slides.',
    'The handle and series on the rail are the same on every slide. A '
    + 'person who saves slide four has to be able to tell whose it is.',
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
    'It has to be something a person can do today, alone, without buying '
    + 'anything. "Open your own site on your phone and time it" is an '
    + 'instruction. "Consider your load times" is not.',
    'On the closing slide it may be the signature line instead.',
  ],
};

export const HOW_TO_USE_ICONS = {
  what_they_are: 'Sixteen cut-out objects, chosen for what they mean. They '
    + 'carry no information: the row is the beat between the explaining '
    + 'and the instruction, and it is what makes six slides read as one '
    + 'set rather than six posts.',
  where: [
    'Set `iconsWhere` per slide. Vary it across a set: a row every time '
    + 'is the reason nobody notices them.',
    '"row" is the default and the beat between the explaining and the '
    + 'instruction. Use it on most slides, and always on the opener.',
    '"corner" drops two or three into the sheet\'s empty top-right '
    + 'shoulder, turned off square. Use it when the headline is short and '
    + 'that corner is bare. It costs the stack no height.',
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
  pack: ICON_NAMES.map((n) => ({ name: n, means: ICONS[n].means })),
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
  never: ['save this for later', 'tag a friend', 'link in bio', 'DM me',
          'follow for more', 'let me know what you think'],
};

export const HOW_TO_USE_PICTURES = {
  when: 'A teaching slide is read, not glanced at, so a photograph behind '
    + 'it is competition for the words. Use one on the opening slide or '
    + 'the closing slide, and not on the ones carrying chips.',
  how: 'Name a file from the library in `scene`. It fills the frame and '
    + 'the ground is laid over it at 82%, which is measured to keep the '
    + 'paragraph readable rather than chosen to look right.',
  photographs: cutoutCatalogue(),
  placement_is_fixed: 'You pick a photograph. You never pick where it goes. '
    + 'Every one has ONE placement per context, written down in cutouts.js '
    + 'and measured off the picture itself: a figure that runs off the right '
    + 'of its own frame goes to the right edge of the sheet and off it. A '
    + 'face that appears bottom-right one day and centre-left the next reads '
    + 'as an accident both times.',
  closings: ctaCatalogue(),
  cut_out: 'The `portrait` template screens one of Ashley\'s photographs to a '
    + 'single ink with a hard outline: a shape on the sheet, not a photograph '
    + 'in a box. Name the file stem, e.g. `portrait: "blue-flat"`. Use it once '
    + 'in a set at most. It is the slide that says a person is behind this, '
    + 'and twice makes the carousel about him.',
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
export const TEMPLATE_GUIDE = () => TEMPLATE_NAMES.map((name) => ({
  name,
  what: TEMPLATES[name].what,
  blocks: TEMPLATES[name].blocks,
  ...roomIn(name),
}));

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
  templates: TEMPLATE_GUIDE(),
  writing: HOW_TO_WRITE,
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
  ],
});

/**
 * spec.js — check a teaching carousel before anything is drawn.
 *
 * A flow fails by running past the instruction, silently, so copy length
 * is what this refuses. Refusals carry the reason so Spark can fix them
 * in the same turn.
 */

import { CHOSEN } from '../../assets/js/hooks/chosen.js';
import { LAYOUTS } from '../../assets/js/hooks/layouts.js';
import { HOOK_BUDGETS } from '../../assets/js/hooks/budgets.js';
import { TEMPLATES, TEMPLATE_NAMES, BLOCKS, SLIDE_GROUND_NAMES, M, columnOf, recapPitch }
  from '../../assets/js/slides.js';
import { ICON_NAMES, packOf } from '../../assets/js/icons.js';
import { BAIT, scan } from '../../assets/js/brand.js';
import { APP_NAMES } from '../../assets/js/apps.js';

/*
 * A BUDGET, not per-block caps. Per-block caps refuse slides that fit,
 * because a slide is rarely at its maximum in every block at once. This
 * runs the same arithmetic the layout does.
 *
 * PER_LINE is measured by WRAPPING REAL PROSE, not by dividing the
 * column by an average character: 67.7 of average advance is 56 of
 * wrapped sentence, and that error passed twenty slides that overflowed.
 */
export const PER_LINE = { title: 14.7, say: 56.0, action: 35.0 };

/* Reserve, set by sweeping every template against the real renderer:
   0.04 let four overflows through, 0.055 lets none. A refusal costs a
   sentence; an overflow costs a carousel. */
const MARGIN = 0.055;

/** The few things that are a limit rather than a budget. */
export const LIMITS = {
  chips:   { min: 2, max: 4 },
  icons:   { min: 2, max: 6 },
  slides:  { min: 2, max: 10 },
  chip:    { max: 34, note: 'a chip is as wide as its words, and the column is not' },
  duoHead: { max: 14 },
  duoTail: { max: 34 },
  rail:    { max: 26 },
  recap:   { min: 2, max: 0 },   // max is measured below, not chosen
  /* One line, and it must stay one line: the number sits in the margin
     beside it, so a wrapped recap line runs under its own number. 62 is
     the column minus that indent, at the paragraph's 56 a line. */
  recapLine: { max: 62, note: 'the number sits beside it and a wrapped line runs under it' },
  echo:    { max: 46 },
  mark:    { max: 22 },
  line:    { max: 74 },
  options: { max: 3 },
  option:  { max: 20 },

  /* The evidence blocks. Character ceilings measured the same way the
     rest were: filled until the renderer had to shrink the type. */
  bars:     { min: 2, max: 5 },
  barLabel: { max: 22, note: 'the label column is a third of the sheet' },
  apps:     { min: 2, max: 5 },
  caption:  { max: 82, note: 'one line under the frame, saying what to look at' },
  quote:    { max: 190, note: 'set large, so it is a sentence and not a paragraph' },
  figure:   { max: 9, note: 'set at headline size' },
  swapLine: { max: 46 },
  stack:     { min: 2, max: 5 },
  stackName: { max: 24, note: 'the address sits beside it on the same line' },
  stackLine: { max: 62 },
  trio:      { min: 2, max: 3 },
  trioFig:   { max: 7, note: 'three of them share the width of the sheet' },
  trioOf:    { max: 16 },
  /* Two letters of a six-word headline is the reference. 0.18 put a
     fifth of it in the bitmap and "broken" read as a typo. */
  mix:      { max: 0.14, note: 'past this the headline reads as broken type, not as a device' },
};

/* PER_LINE was measured on the FULL column. Two templates do not get one
   — `portrait` gives its side to the cut-out and `calling` gives half the
   sheet to the object — so their lines are shorter in proportion, and a
   budget that misses that passes twelve lines into a slide showing five.
   The width comes from the renderer's own columnOf, not from a second
   version of that sum here. */
const FULL = 1 - 0.085 * 2;
const narrowing = (slide) => columnOf(slide).col / (FULL * 1080);

const wraps = (text, perLine, narrow = 1) =>
  Math.max(1, Math.ceil(len(text) / (perLine * narrow)));

/** What one block will cost, in fractions of the frame's height. */
function costOf(block, value, where, narrow = 1) {
  const CAP = 0.72;
  switch (block) {
    case 'title': {
      const n = wraps(value, PER_LINE.title, narrow);
      return M.title.size * CAP + (n - 1) * M.title.size * M.title.lead;
    }
    case 'say': {
      // a paragraph may arrive as { mark, text }: the swipe costs a line of its own
      const mark = value?.mark;
      const n = wraps(value?.text ?? value, PER_LINE.say, narrow);
      return (mark ? M.mark.size * CAP + M.mark.gap : 0)
        + M.say.size * CAP + (n - 1) * M.say.size * M.say.lead;
    }
    case 'chips': {
      const n = Math.max(1, (value ?? []).length);
      return M.chip.h + (n - 1) * M.chip.pitch;
    }
    case 'recap': {
      const n = Math.max(1, (value ?? []).length);
      return n * recapPitch(n);
    }
    case 'line':   return value ? M.line.size * CAP : 0;
    case 'prompt': {
      if (!value?.question) return 0;
      const n = wraps(value.question, PER_LINE.say, narrow);
      /* Two rows when the answers do not fit one, which they do not in a
         narrowed column. Estimated from the character count rather than
         measured, so it is charged the taller of the two. */
      const chars = (value?.options ?? []).reduce((a, o) => a + String(o).length + 6, 0);
      const rows = chars > 34 * narrow ? 2 : 1;
      return M.say.size * CAP + (n - 1) * M.say.size * M.say.lead
        + M.prompt.gap + rows * M.chip.h + (rows - 1) * M.prompt.row;
    }
    case 'echo':   return M.echo.size * CAP + M.echo.gap;
    case 'duo':    return M.chip.h + 0.010 + M.say.size * CAP;
    // a cut-out is pinned to the sheet's edge and costs the stack no
    // height; what it costs is the width of the text column
    case 'portrait': return 0;
    // a row is in the stack; the others are overlays and cost nothing
    case 'icons':  return (where ?? 'row') === 'row' ? M.icons.h : 0;

    /* The evidence blocks. Without these the budget scored a slide
       carrying a screenshot as nearly empty, because an unlisted block
       falls through to 0 and the frame is half the sheet. */
    case 'shot': {
      // the frame is 16:10 of its width, in HEIGHT units, plus the chrome
      const w = Math.min(M.shot.w, FULL * narrow);
      const frame = (w * 0.625) * (1080 / 1350) + M.shot.chromeH;
      if (!value?.caption) return frame;
      const n = wraps(value.caption, PER_LINE.say * (M.say.size / M.shot.cap), narrow);
      return frame + M.shot.capGap + n * M.shot.cap * 1.35;
    }
    case 'bars': {
      const n = Math.max(1, (value ?? []).length);
      return n * M.bars.rowH + (n - 1) * M.bars.gapRow;
    }
    case 'swap': {
      const [a] = value ?? [];
      const one = (t) => wraps(t, PER_LINE.say * (M.say.size / M.swap.size), narrow)
        * M.swap.size * 1.42 + M.swap.padY * 2;
      return one(a?.head) + M.swap.gap + one(a?.tail);
    }
    case 'term': {
      const n = wraps(value?.means, PER_LINE.say * (M.say.size / M.term.size), narrow);
      return M.term.word * CAP + M.term.gap + n * M.term.size * M.term.lead;
    }
    case 'apps':   return M.apps.h + M.apps.labGap + M.apps.lab * CAP;
    case 'quote': {
      const n = wraps(value?.text, PER_LINE.say * (M.say.size / M.quote.size), narrow);
      return n * M.quote.size * M.quote.lead + M.quote.whoGap + M.quote.who * CAP;
    }
    case 'stat': {
      const n = wraps(value?.of, PER_LINE.say * (M.say.size / M.stat.of), narrow);
      return M.stat.size * CAP + M.stat.ofGap + n * M.stat.of * 1.4;
    }
    case 'source': return M.source.size * CAP;
    case 'stack': {
      const n = Math.max(1, (value ?? []).length);
      return n * M.stack.rowH + (n - 1) * M.stack.gap;
    }
    case 'trio':   return M.trio.size * CAP + M.trio.gap + M.trio.of * CAP;
    case 'action': {
      const n = wraps(value, PER_LINE.action);
      // mirrors BLOCKS.action.height: the first line clears the label
      const clear = Math.max(M.action.padY, M.chip.h * 0.37 + 0.004);
      return M.chip.h * 0.63 + clear + M.action.padY + M.action.body * CAP
        + (n - 1) * M.action.body * M.action.lead;
    }
    default: return 0;
  }
}

const len = (v) => String(v ?? '').trim().length;

/**
 * The most recap lines that actually fit, worked out rather than chosen.
 *
 * It was 5, which was a number I liked the look of and which had no
 * relationship to the sheet. That matters because the recap lists the
 * carousel: a carousel may run to ten slides, and a cap that cannot hold
 * them leaves nothing to do but silently drop some, which is the worst
 * of the options and the one an agent would pick.
 *
 * So this fills a recap slide with lines against the same costs the
 * layout uses, at the worst case it will meet, and reports the last
 * count that fits. If a metric changes the number follows it.
 */
function measureRecapMax(withPrompt) {
  const worst = {
    template: 'recap', ground: 'paper', handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
    title: 'Everything worth doing again',    // two lines of headline
    line: 'Whether you are putting your first one up or fixing the one you have.',
    action: 'Do the first one today. It takes a minute and it is usually the '
          + 'one that finds something.',
    ...(withPrompt ? { prompt: {
      question: 'Which of these did yours fail on, if any of them?',
      options: ['the phone', 'the form', 'the hours'] } } : {}),
  };
  let last = 0;
  for (let n = 2; n <= 12; n++) {
    const items = Array.from({ length: n }, () => 'Read what Google says your hours are');
    const r = validateSlides({ slides: [{ ...worst, recap: items },
                                        { ...worst, recap: items }] }, { opener: false });
    if (!r.ok) break;
    last = n;
  }
  return last;
}

/**
 * Both numbers, because both are real and a writer needs to choose
 * between them: the ceiling is what the list can hold on its own, and
 * `with_a_prompt` is what is left once a question and its answers are
 * also on the sheet. The gap between them is the decision.
 */
export const RECAP_MAX = { n: 0, with_a_prompt: 0 };

/**
 * Refuse engagement bait, rather than advising against it.
 *
 * It was a list in the guide, which meant it held for exactly as long as
 * whoever was writing had read the guide. A line every account posts is
 * worth refusing in the same place the copy length is refused.
 */
function bait(problems, at, what, text) {
  const s = String(text ?? '').toLowerCase();
  const hit = BAIT.find((b) => s.includes(b));
  if (!hit) return;
  problems.push(`${at}: "${hit}" in ${what}. Ask for something only somebody who `
    + 'read THIS carousel could give you. A reader has scrolled past that line a '
    + 'hundred times today, and it asks them for a favour without giving them '
    + 'anything to answer.');
}

/**
 * Check one carousel. Returns `{ ok, problems, plan }`.
 *
 * `plan` says what each slide will be made of, so a caller can see the
 * shape it asked for before the drawing costs anything.
 */
/**
 * The fields a slide carries whatever its template: what it is, where it
 * sits, and the rail. Everything else is a block, and a block is only a
 * field when the template actually has it.
 *
 * Read against assets/js/slides.js, which is the renderer that consumes
 * them. A field here that the renderer ignores is a field a writer can
 * set and never see.
 */
export const SLIDE_FIELDS = [
  'template', 'blocks', 'ground', 'handle', 'series', 'slug',
  'accent', 'align', 'anchor', 'column', 'context', 'grain',
  'iconsWhere', 'portrait', 'veil',
  // travels beside `bars` the way iconsWhere travels beside `icons`
  'unit',
  /* The letter swap. The comment on `title` said "a slide can still ask
     for it by name" and no slide could: it was not in this list, so the
     validator refused it and the reference's own signature was
     unreachable. */
  'mix',
];

/**
 * The things the work is actually about. A first slide has to name one,
 * or count something, or it is a label on a topic rather than a hook.
 *
 * Deliberately objects a person can point at on their own screen, not
 * the abstractions that describe them: "presence", "growth" and
 * "performance" are the words this exists to refuse.
 */
const CONCRETE = new RegExp('\\b(' + [
  'site', 'sites', 'website', 'websites', 'page', 'pages', 'homepage',
  'form', 'forms', 'checkout', 'basket', 'cart', 'booking', 'bookings',
  'enquiry', 'enquiries', 'email', 'emails', 'inbox', 'spam',
  'hours', 'map', 'maps', 'google', 'listing', 'reviews', 'review',
  'phone', 'mobile', 'menu', 'button', 'link', 'links', 'photo', 'photos',
  'logo', 'font', 'colour', 'colours', 'brand', 'invoice', 'address',
  'number', 'header', 'footer', 'gallery', 'cover', 'copy', 'caption',
  'call', 'calls', 'calling', 'visitor', 'visitors', 'customer', 'customers',
  'door', 'doors', 'shop', 'card', 'text', 'message', 'messages',
  'check', 'checks', 'audit', 'search', 'load', 'speed',
  'field', 'fields', 'step', 'steps', 'tap', 'taps', 'click', 'clicks',
  'scroll', 'second', 'seconds', 'minute', 'minutes', 'screen', 'screens',
  'price', 'prices', 'stock', 'delivery', 'quote', 'reply', 'replies',
].join('|') + ')\\b', 'i');

/**
 * Words that describe the work instead of naming it. Every one of these
 * is a category a scroller has to unpack, and several are what an agency
 * writes when it does not want to say what it does.
 *
 * Banned in a first slide even when a concrete noun sits beside them:
 * "your site's online presence" names a thing and then hides it again.
 */
const ABSTRACT = new RegExp('\\b(' + [
  'presence', 'growth', 'performance', 'optimisation', 'optimization',
  'leads', 'conversions', 'funnel', 'engagement', 'visibility', 'reach',
  'strategy', 'strategies', 'potential', 'journey', 'synergy', 'impact',
  'solutions', 'systems', 'workflow', 'pipeline', 'ecosystem',
  'friction', 'blockers', 'pain points', 'opportunities', 'wins',
  'leaks', 'gaps', 'issues', 'problems', 'results', 'success',
].join('|') + ')\\b', 'i');

/**
 * @param opts.opener  judge this as a whole carousel: the first slide's
 *   headline and the last slide's fixed outro. Off for the internal
 *   probes that measure geometry: they fill a slide with nonsense prose
 *   to find where it stops fitting, and refusing that nonsense for being
 *   vague, or for not ending on a sign-off, makes the measurement come
 *   back zero.
 */
/**
 * Does this line name something the reader can point at on their own
 * screen? Both openers are held to it: a teaching headline and a hook
 * sheet's hero, which are the same job drawn by two renderers.
 */
function sayWhat(problems, headline, at, what) {
  /* A number is not enough on its own. "Three quiet leaks" counts
     something and still names nothing you could point at, which is
     exactly the line this is meant to refuse. */
  if (!CONCRETE.test(headline)) {
    problems.push(
      `${at}: "${headline}" names nothing a person could point at on their `
      + `own screen, so it reads as a label on a topic rather than a hook. ${what} `
      + 'has to say what the work is ON: a website, a home page, a booking form, '
      + 'a logo, the hours on Google. "One of them looks cheap" is about nothing '
      + 'until "site" is in it. Counting is not enough on its own. '
      + 'See opening.before_and_after in design_brief.'
    );
  }
  const abstract = ABSTRACT.exec(headline);
  if (abstract) {
    problems.push(
      `${at}: "${abstract[0]}" describes the work instead of naming it, and a `
      + 'scroller has to unpack it. Say the thing it actually happens to.'
    );
  }
}

/**
 * The last slide. One design, not a choice.
 *
 * A sign-off that changes photograph and colour between posts is not a
 * sign-off. phone-chair is the only one of his photographs that may sit
 * mid-sheet rather than against an edge, and its clean key needs a solid
 * ground behind it, which yellow is: the two go together.
 *
 * bookend and recap carry it badly. Measured: bookend runs six lines
 * over an empty sheet once a cut-out takes its side of the column, so
 * the arrangement is `signoff`, which was measured with him in it.
 */
export const OUTRO = 'signoff';
export const OUTRO_LOOK = {
  ground: 'amber', portrait: 'phone-chair', context: 'signoff', anchor: 'top',
};

/* A drawn figure with no source is the one thing the research rule
   refuses outright, and it is the easiest to leave off. `shot` is absent
   on purpose: its address bar IS the citation. */
const NEEDS_SOURCE = ['chart', 'figure', 'numbers'];

function checkSource(problems, slide, at) {
  if (!NEEDS_SOURCE.includes(slide.template)) return;
  if (len(slide.source)) return;
  problems.push(`${at}: ${slide.template} draws figures and has no \`source\`. Who `
    + 'published it and when, in one line. A number with no source is the one '
    + 'thing the research rule refuses outright.');
}

function checkOutro(problems, last) {
  if (last?.template !== OUTRO) {
    problems.push(
      `The last slide is "${last?.template ?? last?.hook ?? 'nothing'}" and every set ends `
      + `on ${OUTRO}: a title answering the opening, one sentence, the ask, and `
      + 'Ashley seated with the phone on yellow. A teaching panel at the end is '
      + 'another paragraph, not an ending.'
    );
    return;
  }
  for (const [k, want] of Object.entries(OUTRO_LOOK)) {
    if (last[k] !== want) {
      problems.push(
        `The last slide needs ${k}: "${want}" and has "${last[k] ?? 'nothing'}". The `
        + 'sign-off is fixed. Write the words, not the look.'
      );
    }
  }
}

/**
 * A hook sheet, if the first slide is one.
 *
 * Different renderer, different rules: named slots with measured
 * ceilings rather than a flowing column, so the checks are per slot.
 * Only the first slide may be one — a poster in the middle of a set
 * reads as a second carousel starting.
 */
function checkHook(problems, slide, at, isFirst) {
  const id = slide.hook;
  if (!CHOSEN.includes(id)) {
    problems.push(`${at}: "${id}" is not a hook sheet. Pick one of: ${CHOSEN.join(', ')}.`);
    return;
  }
  if (!isFirst) {
    problems.push(`${at}: a hook sheet is the FIRST slide and only the first. `
      + 'A poster in the middle reads as a second carousel starting.');
  }
  const layout = LAYOUTS[id];
  const budgets = HOOK_BUDGETS[id] ?? {};
  const named = layout.slots.filter((x) => x.t === 'type').map((x) => x.id);
  const allowed = new Set([...named, 'hook', 'handle', 'series', 'ground']);

  const strays = Object.keys(slide).filter((k) => !allowed.has(k) && !k.startsWith('_'));
  if (strays.length) {
    problems.push(
      `${at}: ${strays.map((k) => `"${k}"`).join(', ')} ${strays.length > 1 ? 'are' : 'is'} `
      + `not a slot on ${id}. It takes ${named.join(', ')}. A slot the sheet does not `
      + 'have is dropped without being drawn.'
    );
  }
  for (const name of named) {
    const text = slide[name];
    if (text == null || text === '') continue;
    const max = budgets[name];
    const words = String(Array.isArray(text) ? text.join(' ') : text);
    if (max && words.length > max) {
      problems.push(
        `${at}: ${name} is ${words.length} characters and ${id} holds ${max}. Measured off the `
        + 'renderer, so over it the type comes out smaller than the sheet was designed at.'
      );
    }
    /* The words on a hook sheet were never checked against the voice
       rules: `problems()` reads a teaching slide's `copy`, and a sheet
       has none. So "Douala, working worldwide" and "No. 04" both drew,
       breaking two rules that were already written down. */
    for (const found of scan(words)) problems.push(`${at}: ${name} has ${found}.`);
  }

  /* Several sheets carry an `index` slot from their reference, where it
     was an issue number. On a carousel it reads as "slide 4 of", which
     is the thing that is banned outright, so the slot stays empty. */
  if (slide.index != null && slide.index !== '') {
    problems.push(
      `${at}: index is "${slide.index}". A carousel never numbers itself, and a `
      + 'figure in that corner reads as a count whatever it was meant to be. '
      + 'Leave it out.'
    );
  }

  /* The one line most people ever read, held to the same standard as a
     teaching headline: name something on their own screen. It is the
     ONLY slide the opener rule never reached, because it looks for
     `title` and a sheet has none — so every vague hook passed. */
  const headline = [slide.setup, slide.hero, slide.subhead, slide.head, slide.kicker]
    .filter(Boolean).join(' ');
  if (headline) sayWhat(problems, headline, at, 'A hook sheet');
}

export function validateSlides(spec, { opener = true } = {}) {
  const problems = [];
  const slides = Array.isArray(spec?.slides) ? spec.slides : [];

  /* The first slide is the only one most people see, and a headline that
     names a category rather than a thing makes them decode it at feed
     speed, which they do not do. "Leads going nowhere" could sit on
     anybody's post about anything. This catches the label; it cannot
     tell whether the line is any good. */
  const first = opener ? slides[0] : null;
  const headline = String(first?.title ?? first?.echo ?? first?.calling ?? '');
  if (headline) sayWhat(problems, headline, 'Slide 1', 'A first slide');

  if (slides.length < LIMITS.slides.min || slides.length > LIMITS.slides.max) {
    problems.push(
      `A carousel is ${LIMITS.slides.min} to ${LIMITS.slides.max} slides; this has ${slides.length}.`
    );
  }

  if (opener && slides.length > 2) checkOutro(problems, slides[slides.length - 1]);

  /* The storyboard rule, and the commonest fault in these sets: a run of
     one arrangement reads as a document rather than as a carousel. It is
     also the one thing a model with twenty-three templates in front of
     it still gets wrong, because the first match is always the easiest.
     Only the middle: the hook and the sign-off are fixed by design. */
  if (opener) {
    for (let i = 1; i < slides.length - 1; i++) {
      const a = slides[i - 1]?.template;
      const b = slides[i]?.template;
      if (a && a === b) {
        problems.push(
          `Slides ${i} and ${i + 1} are both "${a}". Two of one arrangement back `
          + 'to back reads as a document rather than a carousel: whichever of '
          + 'the two is carrying evidence should be showing it instead. See '
          + 'picking_one in design_brief, which indexes every template by the '
          + 'job it does.'
        );
      }
    }
  }

  const plan = slides.map((slide, i) => {
    const at = `Slide ${i + 1}`;
    const name = slide.template;

    checkSource(problems, slide, at);

    /* A hook sheet is not a template: it goes to the other renderer. */
    if (slide.hook) {
      checkHook(problems, slide, at, i === 0);
      return { slide: i + 1, hook: slide.hook, engine: 'hooks', blocks: [] };
    }

    if (!TEMPLATE_NAMES.includes(name)) {
      problems.push(
        `${at}: "${name ?? 'nothing'}" is not a template. Pick one of: ${TEMPLATE_NAMES.join(', ')}.`
      );
      return { slide: i + 1, template: name, blocks: [] };
    }

    /* A template is a choice, not a starting point. `blocks` may drop an
       optional block from the one it named; it may not add a block the
       template does not have, and it may not reorder them. Anything else
       is composing a layout, which is the thing templates exist to stop:
       an arrangement nobody measured cannot be checked against the
       budget below, and a set of them stops looking like one set. */
    const theirs = TEMPLATES[name].blocks;
    let blocks = theirs;
    if (Array.isArray(slide.blocks)) {
      const extra = slide.blocks.filter((b) => !theirs.includes(b));
      if (extra.length) {
        problems.push(
          `${at}: ${name} has no ${extra.map((b) => `"${b}"`).join(' or ')}. `
          + `It is ${theirs.join(', ')}. Drop a block or pick another template; `
          + 'do not add one.'
        );
      }
      const kept = theirs.filter((b) => slide.blocks.includes(b));
      const required = theirs.filter((b) => !BLOCKS[b]?.optional);
      const gone = required.filter((b) => !kept.includes(b));
      if (gone.length) {
        problems.push(
          `${at}: ${name} needs ${gone.join(' and ')}. Only an optional block can be left out.`
        );
      }
      blocks = kept.length ? kept : theirs;
    }

    /* Every field this slide may carry, and nothing else.
     *
     * The gap this closes: an unknown key was silently dropped, so a
     * slide could arrive carrying `actionDirective` and `slideNumber`,
     * pass every check, and render without them — the writer believing
     * they were set and the sheet saying otherwise. A refusal that names
     * the key and lists what the template does take is the only way the
     * writer finds out. */
    const allowed = new Set([...SLIDE_FIELDS]);
    const counts = new Map();
    for (const b of blocks) {
      const nth = (counts.get(b) ?? 0) + 1;
      counts.set(b, nth);
      allowed.add(nth === 1 ? b : `${b}${nth}`);
    }
    /* The letter swap is a headline device, so it only means anything
       on a template that has one. Elsewhere it is set and never seen. */
    if (slide.mix != null) {
      if (!theirs.includes('title')) {
        problems.push(`${at}: \`mix\` swaps letters in a HEADLINE and ${name} has none. `
          + 'It would be set and never drawn.');
      } else if (!(slide.mix >= 0 && slide.mix <= LIMITS.mix.max)) {
        problems.push(`${at}: mix is ${slide.mix} and the ceiling is ${LIMITS.mix.max} — `
          + `${LIMITS.mix.note}. Two letters of a six-word headline is the reference.`);
      }
    }

    // `_name` and friends are notes to a person, never drawn, never sent
    const strays = Object.keys(slide).filter((k) => !allowed.has(k) && !k.startsWith('_'));
    if (strays.length) {
      problems.push(
        `${at}: ${strays.map((k) => `"${k}"`).join(', ')} ${strays.length > 1 ? 'are' : 'is'} `
        + `not a field on ${name}. It takes ${[...allowed].sort().join(', ')}. `
        + 'A field the template does not have is dropped without being drawn.'
      );
    }

    if (slide.ground && !SLIDE_GROUND_NAMES.includes(slide.ground)) {
      problems.push(
        `${at}: "${slide.ground}" is not a ground for a teaching slide. `
        + `These carry paragraphs, so only ${SLIDE_GROUND_NAMES.join(', ')} qualify.`
      );
    }

    /* Each block's copy, against the one limit that matters for it.
       Repeated blocks read say2, say3 — the same rule the layout uses. */
    const seen = new Map();
    for (const b of blocks) {
      const nth = (seen.get(b) ?? 0) + 1;
      seen.set(b, nth);
      const key = nth === 1 ? b : `${b}${nth}`;
      checkBlock(problems, at, b, key, slide[key]);
    }

    for (const field of ['handle', 'series']) {
      if (len(slide[field]) > LIMITS.rail.max) {
        problems.push(`${at}: the ${field} is over ${LIMITS.rail.max} characters for the rail.`);
      }
    }

    /* The budget. Same arithmetic the layout does, on estimated line
       counts, so a refusal here means the same thing a render would. */
    let stack = 0;
    let pinned = 0;
    const narrow = narrowing(slide);
    const seen2 = new Map();
    blocks.forEach((b, n) => {
      const nth = (seen2.get(b) ?? 0) + 1;
      seen2.set(b, nth);
      const key = nth === 1 ? b : `${b}${nth}`;
      const cost = costOf(b, slide[key], slide.iconsWhere, narrow);
      if (BLOCKS[b]?.pinned) { pinned = cost; return; }
      if (n > 0) {
        const prev = blocks[n - 1];
        stack += prev === 'title' ? M.gap.afterTitle
          : b === 'icons' ? M.gap.beforeIcons : M.gap.between;
      }
      stack += cost;
    });
    const room = (pinned ? 1 - M.foot - pinned - M.gap.between : 1 - M.foot)
      - M.top - MARGIN;
    const spare = room - stack;
    if (spare < 0) {
      // said in lines of a paragraph, because that is the unit a writer cuts in
      const over = Math.max(1, Math.ceil(-spare / (M.say.size * M.say.lead)));
      problems.push(`${at}: about ${over} line${over > 1 ? 's' : ''} too long for `
        + `${name}, which is the densest arrangement. Cut it from the paragraphs `
        + 'rather than the headline: that is where the room is.');
    }

    return { slide: i + 1, template: name, ground: slide.ground ?? 'paper', blocks,
             fills: `${Math.round((stack / room) * 100)}% of the room it has` };
  });

  /* The rail should not change mid-carousel: it is the one thing that
     says whose this is, and a reader who saves slide four should see the
     same name as one who saved slide one. */
  const rails = new Set(slides.filter((s) => !s.hook)
    .map((s) => `${s.handle ?? ''}|${s.series ?? ''}`));
  if (rails.size > 1) {
    problems.push('The handle and series differ between slides. The rail is what '
      + 'makes a saved slide still say whose it is, so it has to be the same on all of them.');
  }

  return { ok: problems.length === 0, problems, plan };
}

function checkBlock(problems, at, block, key, value) {
  if (block === 'say' && value && typeof value === 'object' && !Array.isArray(value)) {
    if (len(value.mark) > LIMITS.mark.max) {
      problems.push(`${at}: "${value.mark}" is ${len(value.mark)} characters on the `
        + `swipe, which takes ${LIMITS.mark.max}. It is one or two words, not a sentence.`);
    }
    return checkBlock(problems, at, block, key, value.text);
  }
  // a block that draws furniture rather than copy has nothing to check
  if (block === 'calling') return;

  if (block === 'prompt') {
    // left out entirely is fine; half of one is not
    if (value == null) return;
    const opts = Array.isArray(value.options) ? value.options : [];
    if (!len(value.question)) {
      problems.push(`${at}: the prompt has no question in it.`);
    }
    if (opts.length < 2 || opts.length > LIMITS.options.max) {
      problems.push(`${at}: a prompt carries 2 to ${LIMITS.options.max} answers and has `
        + `${opts.length}. The answers are the point: they are what makes replying `
        + 'cost a letter instead of a sentence.');
    }
    for (const o of opts) {
      if (len(o) > LIMITS.option.max) {
        problems.push(`${at}: the answer "${String(o).slice(0, 24)}…" is ${len(o)} `
          + `characters and takes ${LIMITS.option.max}. They sit in a row.`);
      }
    }
    bait(problems, at, 'the prompt', value?.question);
    return;
  }

  if (block === 'action') bait(problems, at, 'the instruction', value);

  const missing = value == null || (typeof value === 'string' && !value.trim());

  if (block === 'icons') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.icons.min || list.length > LIMITS.icons.max) {
      problems.push(`${at}: the icon row takes ${LIMITS.icons.min} to ${LIMITS.icons.max} icons; it has ${list.length}.`);
    }
    const bad = list.filter((n) => !ICON_NAMES.includes(n));
    if (bad.length) {
      problems.push(`${at}: no icon called ${bad.join(', ')}. Read design_brief for the pack.`);
      return;
    }
    /* Two registers, and mixing them on one sheet is the commonest way
       these go wrong: a pixel coffee cup beside a technical diagram
       reads as a slide that cannot decide who it is talking to. */
    const packs = [...new Set(list.map(packOf))];
    if (packs.length > 1) {
      const say = packs.map((p) => `${p}: ${list.filter((n) => packOf(n) === p).join(', ')}`);
      problems.push(`${at}: this row mixes both icon packs — ${say.join(' / ')}. One pack `
        + 'a slide. The kit is the technical register and the pixel set is the '
        + 'playful one; a sheet that uses both has not decided which it is.');
    }
    return;
  }

  if (block === 'chips') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.chips.min || list.length > LIMITS.chips.max) {
      problems.push(`${at}: a chip stack is ${LIMITS.chips.min} to ${LIMITS.chips.max} phrases; it has ${list.length}.`);
    }
    for (const item of list) {
      if (len(item) > LIMITS.chip.max) {
        problems.push(`${at}: "${String(item).slice(0, 30)}…" is ${len(item)} characters; `
          + `a chip takes ${LIMITS.chip.max}, because ${LIMITS.chip.note}.`);
      }
    }
    return;
  }

  if (block === 'recap') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.recap.min || list.length > LIMITS.recap.max) {
      problems.push(`${at}: a recap is ${LIMITS.recap.min} to ${LIMITS.recap.max} lines; `
        + `it has ${list.length}. One for each slide worth reading back, not one `
        + 'for every slide.');
    }
    for (const item of list) {
      if (len(item) > LIMITS.recapLine.max) {
        problems.push(`${at}: "${String(item).slice(0, 30)}…" is ${len(item)} characters; `
          + `a recap line takes ${LIMITS.recapLine.max}, because ${LIMITS.recapLine.note}.`);
      }
    }
    return;
  }

  if (block === 'duo') {
    const list = Array.isArray(value) ? value : [];
    if (list.length !== 2) {
      problems.push(`${at}: duo is exactly two things, and it has ${list.length}. `
        + 'For a list of two, use chips — duo says "these are the two kinds".');
      return;
    }
    for (const item of list) {
      if (len(item?.head) > LIMITS.duoHead.max) {
        problems.push(`${at}: "${item.head}" is too long for a duo chip (${LIMITS.duoHead.max}).`);
      }
      if (len(item?.tail) > LIMITS.duoTail.max) {
        problems.push(`${at}: the line under "${item?.head}" is over ${LIMITS.duoTail.max} characters.`);
      }
    }
    return;
  }

  /* The evidence blocks, which all fail the same way: they are the
     SHAPE of proof, and the shape is much easier to write than the
     thing. A screenshot with no address, a chart with no source and a
     quotation with no name each look like evidence and are not, so the
     part that makes them checkable is refused when it is missing rather
     than drawn empty. */
  if (block === 'shot') {
    if (!value?.src) {
      problems.push(`${at}: the screenshot has no \`src\`. Capture the page with `
        + 'capture_page first; it gives back the key to put here.');
    }
    if (!len(value?.url)) {
      problems.push(`${at}: the screenshot has no address. The address bar IS the `
        + 'citation on this slide — a screenshot without one is an assertion. '
        + 'Pass the page you captured.');
    }
    if (len(value?.caption) > LIMITS.caption.max) {
      problems.push(`${at}: the caption is ${len(value.caption)} characters and takes `
        + `${LIMITS.caption.max}. It says what to look at, not what to think.`);
    }
    return;
  }

  if (block === 'bars') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.bars.min || list.length > LIMITS.bars.max) {
      problems.push(`${at}: a chart is ${LIMITS.bars.min} to ${LIMITS.bars.max} bars; `
        + `it has ${list.length}. One bar is a number — use the figure template.`);
    }
    for (const item of list) {
      if (!Number.isFinite(Number(item?.value))) {
        problems.push(`${at}: "${item?.label ?? '?'}" has no number in it. A bar is `
          + 'drawn to scale, so its value has to be one.');
      }
      if (len(item?.label) > LIMITS.barLabel.max) {
        problems.push(`${at}: "${item.label}" is over ${LIMITS.barLabel.max} characters `
          + 'for a bar label, and the label column is a third of the sheet.');
      }
    }
    return;
  }

  if (block === 'quote') {
    if (!len(value?.text)) problems.push(`${at}: the quotation is empty.`);
    if (!len(value?.who)) {
      problems.push(`${at}: the quotation has no \`who\`. An unattributed quotation `
        + 'is the shape of evidence with nothing in it. Name who said it and '
        + 'where, or do not use it.');
    }
    if (len(value?.text) > LIMITS.quote.max) {
      problems.push(`${at}: the quotation is ${len(value.text)} characters and this `
        + `sheet holds ${LIMITS.quote.max}. Quote the sentence, not the paragraph.`);
    }
    return;
  }

  if (block === 'term') {
    if (!len(value?.word)) problems.push(`${at}: no word to define.`);
    else if (String(value.word).trim().split(/\s+/).length > 2) {
      problems.push(`${at}: "${value.word}" is a phrase. One word a slide, or two `
        + 'if the term genuinely is two.');
    }
    if (!len(value?.means)) {
      problems.push(`${at}: "${value?.word}" is set out and never explained, which is `
        + 'the slide doing the opposite of its job.');
    }
    return;
  }

  if (block === 'stat') {
    if (!len(value?.figure)) problems.push(`${at}: no figure.`);
    if (len(value?.figure) > LIMITS.figure.max) {
      problems.push(`${at}: "${value.figure}" is ${len(value.figure)} characters and `
        + `this is set at headline size, so it holds ${LIMITS.figure.max}.`);
    }
    if (!len(value?.of)) {
      problems.push(`${at}: the figure does not say what it counts. A number on its `
        + 'own is a decoration.');
    }
    return;
  }

  if (block === 'apps') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.apps.min || list.length > LIMITS.apps.max) {
      problems.push(`${at}: an app row is ${LIMITS.apps.min} to ${LIMITS.apps.max} marks; `
        + `it has ${list.length}.`);
    }
    for (const name of list) {
      if (!APP_NAMES.includes(name)) {
        problems.push(`${at}: there is no app mark called ${name}. The pack holds: `
          + `${APP_NAMES.join(', ')}. A mark that is not vendored cannot be drawn, `
          + 'and a mark is not fetched from anywhere at render time.');
      }
    }
    return;
  }

  if (block === 'stack') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.stack.min || list.length > LIMITS.stack.max) {
      problems.push(`${at}: a round-up is ${LIMITS.stack.min} to ${LIMITS.stack.max} rows; `
        + `it has ${list.length}.`);
    }
    for (const item of list) {
      if (!len(item?.name)) problems.push(`${at}: a row with no name.`);
      if (!len(item?.line)) {
        problems.push(`${at}: "${item?.name ?? '?'}" has no line saying what it is for. `
          + 'A name and a logo is a list of words; the line is the reason it is here.');
      }
      if (item?.app && !APP_NAMES.includes(item.app)) {
        problems.push(`${at}: there is no app mark called ${item.app}. Leave \`app\` out `
          + 'and the row draws with its name alone.');
      }
      if (len(item?.name) > LIMITS.stackName.max) {
        problems.push(`${at}: "${item.name}" is over ${LIMITS.stackName.max} characters `
          + `— ${LIMITS.stackName.note}.`);
      }
      if (len(item?.line) > LIMITS.stackLine.max) {
        problems.push(`${at}: the line under "${item?.name}" is ${len(item.line)} `
          + `characters and takes ${LIMITS.stackLine.max}.`);
      }
    }
    return;
  }

  if (block === 'trio') {
    const list = Array.isArray(value) ? value : [];
    if (list.length < LIMITS.trio.min || list.length > LIMITS.trio.max) {
      problems.push(`${at}: two or three figures, and it has ${list.length}. One is the `
        + 'figure template; four do not fit across the sheet.');
    }
    for (const item of list) {
      if (!len(item?.figure)) problems.push(`${at}: a figure with nothing in it.`);
      if (!len(item?.of)) {
        problems.push(`${at}: "${item?.figure}" does not say what it counts.`);
      }
      if (len(item?.figure) > LIMITS.trioFig.max) {
        problems.push(`${at}: "${item.figure}" is over ${LIMITS.trioFig.max} characters `
          + `— ${LIMITS.trioFig.note}.`);
      }
      if (len(item?.of) > LIMITS.trioOf.max) {
        problems.push(`${at}: "${item.of}" is over ${LIMITS.trioOf.max} characters for a `
          + 'word under a figure.');
      }
    }
    return;
  }

  if (block === 'swap') {
    const list = Array.isArray(value) ? value : [];
    const [a] = list;
    if (list.length !== 1 || !len(a?.head) || !len(a?.tail)) {
      problems.push(`${at}: swap is exactly one { head, tail }: the wrong way and `
        + 'the right one. Two of them is a list, and a list is chips.');
      return;
    }
    for (const [k, t] of [['head', a.head], ['tail', a.tail]]) {
      if (len(t) > LIMITS.swapLine.max) {
        problems.push(`${at}: the ${k} line is ${len(t)} characters and takes `
          + `${LIMITS.swapLine.max}. Both halves are short or the contrast is lost.`);
      }
    }
    return;
  }

  // a block a template may leave empty says nothing when it is empty
  if (missing && BLOCKS[block]?.optional) return;

  if (missing) {
    problems.push(`${at}: the ${key} block has nothing in it. ${BLOCKS[block]?.what ?? ''}`);
    return;
  }

  const limit = LIMITS[block];
  if (limit?.max && len(value) > limit.max) {
    problems.push(`${at}: ${key} is ${len(value)} characters and takes ${limit.max}`
      + `${limit.note ? ` — ${limit.note}` : ''}.`);
  }
}

/* Measured now that validateSlides exists. The cap is opened right up
   first, so what bounds the measurement is the sheet rather than the
   number being measured. */
LIMITS.recap.max = 99;
RECAP_MAX.n = measureRecapMax(false);
RECAP_MAX.with_a_prompt = measureRecapMax(true);
/* The cap is the ceiling, not the with-a-prompt figure. A slide that
   asks for both gets refused by the BUDGET, which says how much is over
   and in what unit; a hard cap would just say no. */
LIMITS.recap.max = RECAP_MAX.n;

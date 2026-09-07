/**
 * spec.js — check a teaching carousel before anything is drawn.
 *
 * A flow fails by running past the instruction, silently, so copy length
 * is what this refuses. Refusals carry the reason so Spark can fix them
 * in the same turn.
 */

import { TEMPLATES, TEMPLATE_NAMES, BLOCKS, SLIDE_GROUND_NAMES, M, columnOf, recapPitch }
  from '../../assets/js/slides.js';
import { ICON_NAMES } from '../../assets/js/icons.js';
import { BAIT } from '../../assets/js/brand.js';

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
                                        { ...worst, recap: items }] });
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
export function validateSlides(spec) {
  const problems = [];
  const slides = Array.isArray(spec?.slides) ? spec.slides : [];

  if (slides.length < LIMITS.slides.min || slides.length > LIMITS.slides.max) {
    problems.push(
      `A carousel is ${LIMITS.slides.min} to ${LIMITS.slides.max} slides; this has ${slides.length}.`
    );
  }

  const plan = slides.map((slide, i) => {
    const at = `Slide ${i + 1}`;
    const name = slide.template;

    if (!TEMPLATE_NAMES.includes(name)) {
      problems.push(
        `${at}: "${name ?? 'nothing'}" is not a template. Pick one of: ${TEMPLATE_NAMES.join(', ')}.`
      );
      return { slide: i + 1, template: name, blocks: [] };
    }

    const blocks = slide.blocks ?? TEMPLATES[name].blocks;
    for (const b of blocks) {
      if (!BLOCKS[b]) problems.push(`${at}: there is no "${b}" block.`);
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
  const rails = new Set(slides.map((s) => `${s.handle ?? ''}|${s.series ?? ''}`));
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

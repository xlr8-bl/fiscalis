/**
 * spec.js — checking a teaching carousel before anything is drawn.
 *
 * The whole point of the named templates is that Spark stops inventing
 * geometry, and the way to make that stick is to refuse a spec that
 * tries. So this validates the ONE decision it is allowed to make per
 * slide — which template, which ground, which icons — and refuses
 * everything else with the reason, in the same turn, so it can fix it
 * before a single slide is rendered.
 *
 * The refusals are all about copy length, because that is the only thing
 * that can break a flow layout. Absolute boxes fail by overlapping;
 * a flow fails by running past the instruction, and it does it silently.
 */

import { TEMPLATES, TEMPLATE_NAMES, BLOCKS, SLIDE_GROUND_NAMES, M }
  from '../../assets/js/slides.js';
import { ICON_NAMES } from '../../assets/js/icons.js';

/*
 * WHY THIS IS A BUDGET AND NOT A LIST OF CAPS.
 *
 * The first version gave each block a maximum length. Rendering every
 * block at its stated maximum on the densest template ran half a frame
 * over, so the caps were fiction. Measuring what actually fits gave a
 * per-template answer instead — `steps` takes a 24 character headline
 * where `open` takes 41 — and per-block caps set that low would refuse
 * slides that fit perfectly well, because a slide is rarely at its
 * maximum in every block at once. One of the example slides does exactly
 * that: a 125 character second paragraph, over any honest cap, on a
 * slide with a 14 character headline. It fits, and refusing it would be
 * wrong.
 *
 * So the check is the same arithmetic the layout does: turn each block's
 * copy into lines, lines into height, add the measured gaps, and compare
 * against the room between the rail and the instruction. A slide passes
 * because it fits, not because it stayed under a number somebody chose.
 *
 * The characters-a-line figures are measured by WRAPPING REAL PROSE at
 * the real sizes in the real column, not by dividing the column by an
 * average character. The first version did the latter and passed twenty
 * slides that then overflowed, because greedy wrapping leaves a ragged
 * gap at the end of every line and real words are what set how big it
 * is: 67.7 characters of average advance is 56 characters of wrapped
 * sentence, and the difference compounds over four lines.
 */
export const PER_LINE = { title: 14.7, say: 56.0, action: 35.0 };

/*
 * Kept back against the estimate still being an estimate.
 *
 * Set by testing, not by taste: sweeping every template against the real
 * renderer at paragraph lengths from 40 to 400 characters, 0.04 let four
 * slides through that overflowed — by under 1% of the frame each, an
 * off-by-one line. 0.055 lets none through, at the cost of refusing two
 * that would just have fitted. That is the right way round: a refusal
 * costs a sentence, and an overflow costs a carousel that went out with
 * its instruction sat under a paragraph.
 */
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
};

const wraps = (text, perLine) => Math.max(1, Math.ceil(len(text) / perLine));

/** What one block will cost, in fractions of the frame's height. */
function costOf(block, value, where) {
  const CAP = 0.72;
  switch (block) {
    case 'title': {
      const n = wraps(value, PER_LINE.title);
      return M.title.size * CAP + (n - 1) * M.title.size * M.title.lead;
    }
    case 'say': {
      const n = wraps(value, PER_LINE.say);
      return M.say.size * CAP + (n - 1) * M.say.size * M.say.lead;
    }
    case 'chips': {
      const n = Math.max(1, (value ?? []).length);
      return M.chip.h + (n - 1) * M.chip.pitch;
    }
    case 'duo':    return M.chip.h + 0.010 + M.say.size * CAP;
    // a cut-out is pinned to the sheet's edge and costs the stack no
    // height; what it costs is the width of the text column
    case 'portrait': return 0;
    /* A row is part of the stack; corner and edge are overlays beside
       something else and cost the stack nothing. Getting this wrong in
       either direction breaks the budget: charging for an overlay
       refuses copy that fits, and not charging for a row passes copy
       that overflows. */
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
    const seen2 = new Map();
    blocks.forEach((b, n) => {
      const nth = (seen2.get(b) ?? 0) + 1;
      seen2.set(b, nth);
      const key = nth === 1 ? b : `${b}${nth}`;
      const cost = costOf(b, slide[key], slide.iconsWhere);
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

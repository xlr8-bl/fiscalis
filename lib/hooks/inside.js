/**
 * inside.js — the slides that come after the hook.
 *
 * WHY THIS IS A SEPARATE FILE. layouts.js is measurements: every box in
 * it is a number read off somebody else's finished sheet, and its whole
 * value is that nothing in it was invented. These are invented. They are
 * built in the same slot grammar and drawn by the same engine, but they
 * are designs rather than measurements, and mixing the two files would
 * make it impossible to tell which was which a month from now.
 *
 * WHAT AN INSIDE SLIDE IS FOR. The hook is the only slide anybody is
 * obliged to look at. Everything after it is being read by somebody who
 * has already decided to stay, which means it can be quieter, and it
 * has to be quicker. Six devices, and the rule for all of them is the
 * same: one idea per slide, set large enough to read at thumb distance,
 * with the furniture almost silent.
 *
 *   say     one sentence, most of the frame
 *   count   a numeral, a heading, two lines under it
 *   versus  the sheet split: what you did above, what happened below
 *   list    a heading and four short rows
 *   plate   a photograph with one line printed over it
 *   close   the last slide: the turn, and the one thing to do about it
 *
 * A deck sets `ground` per slide, so the same device can run dark in the
 * middle of a light deck without a second layout.
 */

/* The furniture every inside slide carries, so a deck is recognisable
   as one thing: an index top left, the handle bottom left. Both are
   optional — a slide that omits the copy omits the slot. */
const INDEX = {
  id: 'index', t: 'type', box: [0.075, 0.070, 0.180, 0.024],
  role: 'grotesque', weight: '700', fill: 'mark', track: 0.10,
  fit: 'shrink', size: 0.017, min: 0.011,
  wants: 'The slide number, as "03 / 07". Two digits, never one.',
};

const HANDLE = {
  id: 'handle', t: 'type', box: [0.075, 0.916, 0.400, 0.024],
  role: 'grotesque', weight: '600', fill: 'mark', track: 0.06,
  fit: 'shrink', size: 0.016, min: 0.011,
  wants: 'The handle, bottom left, in caps.',
};

const SWIPE = {
  id: 'swipe', t: 'arrow', box: [0.845, 0.921, 0.080, 0.014],
  fill: 'mark', weight: 0.14,
};

export const INSIDE = {

  /* ------------------------------------------------------------- say
   * One sentence and nothing else. The workhorse: use it whenever the
   * point is a claim rather than a structure, and resist the urge to
   * add a supporting line — the supporting line is the next slide. */
  say: {
    id: 'say', kind: 'inside', ground: 'paper',
    does: 'One sentence at display size, ranged left across the middle of the '
        + 'frame, with the index above it and the handle below. Nothing else.',
    avoid: 'Two ideas. If the sentence has a "because" in it, the part after '
         + 'the because is a different slide.',
    slots: [
      INDEX,
      { id: 'say', t: 'type', box: [0.075, 0.240, 0.850, 0.520],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.092, min: 0.044, leading: 1.02, vAlign: 'middle',
        wants: 'ONE sentence, twelve words at the outside. It is set at a '
             + 'fourteenth of the sheet and wraps to three or four lines. Say '
             + 'the thing plainly; the size is the emphasis.' },
      HANDLE, SWIPE,
    ],
  },

  /* ----------------------------------------------------------- count
   * A numeral does two jobs: it says where you are in a list, and it
   * gives the eye somewhere to land before it reads anything. */
  count: {
    id: 'count', kind: 'inside', ground: 'paper',
    does: 'A large numeral in the accent colour hanging at the top left, a '
        + 'short heading beside its baseline, and two or three lines of body '
        + 'under both.',
    avoid: 'A numeral with no list behind it. If this slide is not one of a '
         + 'run of them, the number is decoration.',
    slots: [
      INDEX,
      { id: 'num', t: 'type', box: [0.075, 0.190, 0.300, 0.180],
        role: 'display', weight: '700', fill: 'accent', track: -0.04,
        fit: 'shrink', size: 0.230, min: 0.110, vAlign: 'top',
        wants: 'One or two digits. Which of the list this is.' },
      { id: 'head', t: 'type', box: [0.075, 0.400, 0.850, 0.170],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.070, min: 0.036, leading: 1.04, vAlign: 'top',
        wants: 'The item itself, in four to eight words. A thing to do or a '
             + 'thing that happens, not a category.' },
      { id: 'body', t: 'type', box: [0.075, 0.610, 0.780, 0.220],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.86,
        fit: 'wrap', size: 0.028, min: 0.018, leading: 1.42, vAlign: 'top',
        wants: 'Two or three sentences. Why it is on the list — the specific '
             + 'consequence, not the general principle.' },
      HANDLE, SWIPE,
    ],
  },

  /* ---------------------------------------------------------- versus
   * The sheet split in two. The top is printed on the paper and the
   * bottom is knocked out of a solid block, so the change of ground
   * does the work an "instead" would otherwise have to do. */
  versus: {
    id: 'versus', kind: 'inside', ground: 'paper',
    does: 'The frame cut across the middle. Above the cut, a label and a line '
        + 'on the paper; below it, a label and a line knocked out of a solid '
        + 'block of ink. The ground changing IS the argument.',
    avoid: 'Two lines that are not actually opposed. This device promises a '
         + 'reversal and looks broken without one.',
    slots: [
      INDEX,
      { id: 'labelA', t: 'type', box: [0.075, 0.180, 0.500, 0.024],
        role: 'grotesque', weight: '700', fill: 'accent', track: 0.10,
        fit: 'shrink', size: 0.018, min: 0.012,
        wants: 'One word in caps. What the top half is: WHAT I DID, BEFORE, '
             + 'THE PLAN.' },
      { id: 'lineA', t: 'type', box: [0.075, 0.230, 0.850, 0.240],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.072, min: 0.036, leading: 1.04, vAlign: 'top',
        wants: 'The first half, in a sentence. What was expected.' },

      { id: 'block', t: 'rect', box: [0.000, 0.520, 1.000, 0.480], fill: 'mark' },
      { id: 'labelB', t: 'type', box: [0.075, 0.590, 0.500, 0.024],
        role: 'grotesque', weight: '700', fill: 'accent', track: 0.10,
        fit: 'shrink', size: 0.018, min: 0.012,
        wants: 'One word in caps. What the bottom half is: WHAT HAPPENED, '
             + 'AFTER, INSTEAD.' },
      { id: 'lineB', t: 'type', box: [0.075, 0.640, 0.850, 0.240],
        role: 'display', weight: '700', fill: 'ground', track: -0.02,
        fit: 'wrap', size: 0.072, min: 0.036, leading: 1.04, vAlign: 'top',
        wants: 'The reversal. It has to actually contradict the line above — '
             + 'if it merely continues it, use `say` twice instead.' },
      { id: 'handle', t: 'type', box: [0.075, 0.916, 0.400, 0.024],
        role: 'grotesque', weight: '600', fill: 'ground', track: 0.06,
        fit: 'shrink', size: 0.016, min: 0.011,
        wants: 'The handle, bottom left, knocked out of the block.' },
      { id: 'swipe', t: 'arrow', box: [0.845, 0.921, 0.080, 0.014],
        fill: 'ground', weight: 0.14 },
    ],
  },

  /* ------------------------------------------------------------ list
   * Four rows, each with a square marker. Four is the limit: five rows
   * at this size stop being readable at thumb distance, and a list
   * nobody finishes is a slide nobody finishes. */
  list: {
    id: 'list', kind: 'inside', ground: 'paper',
    does: 'A short heading and four rows under it, each row marked with a '
        + 'small square. Every row is one line.',
    avoid: 'Rows that wrap. If a row needs two lines it is a `count` slide of '
         + 'its own, and the list has the wrong four things in it.',
    slots: [
      INDEX,
      { id: 'head', t: 'type', box: [0.075, 0.180, 0.850, 0.170],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.068, min: 0.034, leading: 1.04, vAlign: 'top',
        wants: 'What the four things are, in a short sentence ending in a '
             + 'colon or a full stop.' },
      { id: 'markA', t: 'rect', box: [0.075, 0.430, 0.022, 0.018], fill: 'accent' },
      { id: 'rowA', t: 'type', box: [0.125, 0.424, 0.800, 0.032],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.030, min: 0.018,
        wants: 'The first row. One line, no wrap.' },
      { id: 'markB', t: 'rect', box: [0.075, 0.545, 0.022, 0.018], fill: 'accent' },
      { id: 'rowB', t: 'type', box: [0.125, 0.539, 0.800, 0.032],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.030, min: 0.018, wants: 'The second row.' },
      { id: 'markC', t: 'rect', box: [0.075, 0.660, 0.022, 0.018], fill: 'accent' },
      { id: 'rowC', t: 'type', box: [0.125, 0.654, 0.800, 0.032],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.030, min: 0.018, wants: 'The third row.' },
      { id: 'markD', t: 'rect', box: [0.075, 0.775, 0.022, 0.018], fill: 'accent' },
      { id: 'rowD', t: 'type', box: [0.125, 0.769, 0.800, 0.032],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.030, min: 0.018, wants: 'The fourth row.' },
      HANDLE, SWIPE,
    ],
  },

  /* ----------------------------------------------------------- plate
   * A photograph with one line on it. The scrim is measured rather than
   * guessed: `darken` is a fixed value here because the picture is
   * chosen for this slide, not the other way round. */
  plate: {
    /* Ground is `ink`, so the PAPER colour on this slide is `mark` — on a
       dark ground `ground` is the dark one. Setting the type to 'ground'
       here prints black on a darkened photograph, which is invisible and
       looks like a scrim bug rather than a colour one. */
    id: 'plate', kind: 'inside', ground: 'ink',
    does: 'A photograph filling the frame, darkened, with one line printed '
        + 'across the lower half of it and the furniture in the paper colour.',
    avoid: 'A picture that is only a mood. It has to show the thing the line '
         + 'is about, or the slide is a stock photo with a caption.',
    slots: [
      { id: 'shot', t: 'art', role: 'scene', box: [0.000, 0.000, 1.000, 1.000],
        darken: 0.46, polarity: 'keep',
        wants: 'The thing being described, photographed plainly. Room in the '
             + 'lower half for two or three lines of type.' },
      /* `over: 'art'` with the polarity pinned: the engine measures what
         is actually behind each block and lays a veil until the paper
         colour clears 4.5:1. A fixed `darken` cannot do that, because it
         cannot know whether the photograph put a window behind the line. */
      { id: 'index', t: 'type', over: 'art', polarity: 'keep',
        box: [0.075, 0.070, 0.180, 0.024],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.10,
        fit: 'shrink', size: 0.017, min: 0.011,
        wants: 'The slide number, as "04 / 07".' },
      { id: 'line', t: 'type', over: 'art', polarity: 'keep',
        box: [0.075, 0.560, 0.850, 0.290],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.076, min: 0.038, leading: 1.04, vAlign: 'bottom',
        wants: 'One sentence over the picture. It should name what is in the '
             + 'photograph, not float above it.' },
      { id: 'handle', t: 'type', over: 'art', polarity: 'keep',
        box: [0.075, 0.916, 0.400, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', track: 0.06,
        fit: 'shrink', size: 0.016, min: 0.011, wants: 'The handle.' },
      { id: 'swipe', t: 'arrow', box: [0.845, 0.921, 0.080, 0.014],
        fill: 'mark', weight: 0.14 },
    ],
  },

  /* ----------------------------------------------------------- close
   * The last slide. One turn, one instruction, and no arrow — there is
   * nothing to swipe to, and an arrow pointing at nothing is the most
   * common thing wrong with a carousel. */
  close: {
    id: 'close', kind: 'inside', ground: 'ink',
    does: 'The turn set large, a single instruction in a pill under it, and '
        + 'the handle. No swipe arrow: there is nothing after this.',
    avoid: 'A summary. The reader has just read the deck; repeating it is the '
         + 'slowest possible ending. Say the one thing they should do.',
    slots: [
      { id: 'index', t: 'type', box: [0.075, 0.070, 0.180, 0.024],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.10,
        fit: 'shrink', size: 0.017, min: 0.011, wants: 'The last slide number.' },
      { id: 'turn', t: 'type', box: [0.075, 0.250, 0.850, 0.420],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.088, min: 0.042, leading: 1.02, vAlign: 'middle',
        wants: 'The turn, in one sentence. Not a summary of the deck — the '
             + 'thing the deck was for.' },
      { id: 'pill', t: 'pill', box: [0.075, 0.730, 0.480, 0.070],
        fill: 'accent', weight: 0.045 },
      { id: 'cta', t: 'type', box: [0.105, 0.748, 0.420, 0.034],
        role: 'grotesque', weight: '700', fill: 'accent', align: 'center',
        track: 0.04, fit: 'shrink', size: 0.028, min: 0.018,
        wants: 'One instruction, in caps. Four words at the outside, and it '
             + 'has to be something doable in the next minute.' },
      { id: 'handle', t: 'type', box: [0.075, 0.916, 0.400, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', track: 0.06,
        fit: 'shrink', size: 0.016, min: 0.011, wants: 'The handle.' },
    ],
  },
};

export const INSIDE_IDS = Object.keys(INSIDE);

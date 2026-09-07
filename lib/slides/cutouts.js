/**
 * cutouts.js — where each photograph goes. Hardcoded, because a computed
 * placement moves, and a face that appears bottom-right one day and
 * centre-left the next reads as an accident both times.
 *
 * Keyed the way the renderer keys, largest blob only, then measured for
 * the subject's box and, which is what decides everything, how much of
 * him sits ON each border. That is where the photograph was cut:
 *
 *   file          his box                    on the border
 *   blue-flat     x 0.29..1.00 y 0.28..1.00  right 0.18, bottom 0.71
 *   sky-arms      x 0.01..0.61 y 0.41..1.00  bottom 0.38, and nothing else
 *   phone-chair   x 0.09..0.98 y 0.12..0.98  nothing, on any side
 *   black-wall    unusable: the key inverts
 *
 * sky-arms looks like it touches the left at x 0.01 and does not: 0.00 of
 * the left border is him. One cut edge, so one edge to snap and a free
 * corner.
 *
 * BLACK-WALL CANNOT BE CUT. Black ground, black jacket, so the key takes
 * the white panel as subject and the jacket as ground and the mask runs
 * to all four edges. It is a scene.
 *
 * PHONE-CHAIR TAKES NO TREATMENT. It keys clean and then refuses
 * everything done to the other two: the chair is chrome tubing about six
 * pixels across at the size a sheet draws it, and both the scissors cut
 * and the paper border are coarse on purpose, so both bridge the tubes
 * into white slabs. Background off, nothing else, and never against an
 * edge, because it runs off none of its own.
 */

/**
 * `h` is HIS height on the sheet, not the photograph's.
 *
 * `snap` names only the sides the photograph actually CUT him on, and
 * those go flush against the sheet's matching edges, where the straight
 * cut reads as the frame and he pokes out of the corner the way the
 * picture was taken. `lean` is for a free axis: which way he sits when
 * nothing was cut there, and it keeps a margin. The two are separate
 * because writing `snap: 'bottom-left'` for a figure cut only on the
 * bottom claims a cut that does not exist, and check_slides refuses it.
 *
 * There is no bleed anywhere. Running a figure off an edge it was not
 * already cut on amputates it.
 *
 * `style: 'clean'` is the key with nothing else done to it.
 */
export const CUTOUTS = {
  'blue-flat': {
    // HIS width over HIS height, measured off the key, so the column
    // knows what it gives up. Not the photograph's shape.
    wide: 0.99,
    use: 'cutout',
    what: 'Head and shoulders against a flat blue sweep. Keys cleanly.',
    cta: { snap: 'bottom-right', h: 0.42 },
    // a hook carries less copy than a CTA, so the figure gets more room
    hook: { snap: 'bottom-right', h: 0.50 },
    why: 'Two cut edges, so it has only one corner: he runs off the right of '
       + 'his own frame for 18% of its height and off the bottom for 71% of '
       + 'its width. Put those against the sheet\'s right and bottom and he '
       + 'pokes out of the corner the way the photograph was taken. Any other '
       + 'placement leaves two straight cuts hanging in the middle of a sheet.',
  },

  'sky-arms': {
    wide: 0.81,
    use: 'cutout',
    what: 'Arms folded against sky, figure low and to the left.',
    // snapped on the bottom, which is cut; LEANING left, which is not
    cta: { snap: 'bottom', lean: 'left', h: 0.46 },
    hook: { snap: 'bottom', lean: 'left', h: 0.54 },
    why: 'ONE cut edge: the bottom, for 38% of the width. Nothing on the left '
       + 'or the right, so the bottom is what must sit on the sheet\'s bottom '
       + 'and the corner is free. Left keeps it a mirror of blue-flat and '
       + 'matches where he stands in his own frame, at x 0.01..0.61. Moving it '
       + 'to bottom-right costs nothing and cuts nothing off.',
  },

  'phone-chair': {
    wide: 0.83,
    use: 'cutout',
    style: 'clean',
    what: 'Seated, whole figure on a chair, phone in one hand, on a white '
        + 'sweep. Keyed and nothing else: no paper, no border, no scissors.',
    /* Free, not snapped. He touches no edge of his own frame, so there is
       no cut edge to put against anything and a snap would invent one.
       `cx`/`cy` are where his centre lands. */
    cta: { h: 0.46, cx: 0.68, cy: 0.66 },
    hook: { h: 0.54, cx: 0.62, cy: 0.63 },
    middle: { h: 0.38, cx: 0.70, cy: 0.60 },
    why: 'The one that keys clean and takes no treatment. It is a whole '
       + 'figure on chrome tubing about six pixels across at the size a sheet '
       + 'draws it, and the scissors cut is coarse on purpose, so it bridges '
       + 'the tubes into white slabs. A paper border round a chair does the '
       + 'same thing. Background off, nothing else. And it runs off no edge of '
       + 'its own frame, so it never goes against one: it floats, which is '
       + 'what makes it the one that also works mid-carousel.',
  },

  'black-wall': {
    use: 'scene',
    what: 'Against a black panel beside a white one.',
    cta: null,
    hook: { at: 'cover', h: 1, bleed: 0, from: 'bottom' },
    why: 'It cannot be cut out. The background is black and so is the '
       + 'jacket, so the key takes the white panel as subject and the jacket '
       + 'as ground, and the mask touches all four edges. Use it whole, with '
       + 'type in its left half, which SOURCES.md measured as quiet.',
  },
};

export const CUTOUT_NAMES = Object.keys(CUTOUTS);

/** The ones that can actually be cut. */
export const CUTTABLE = CUTOUT_NAMES.filter((n) => CUTOUTS[n].use === 'cutout');

/**
 * The placement for one photograph in one context.
 *
 * Returns null rather than a default when there is none, so a caller
 * asking for a CTA cut-out of the photograph that cannot be cut gets a
 * refusal instead of a guess.
 */
export function placementOf(name, context = 'cta') {
  const c = CUTOUTS[name];
  if (!c) return null;
  const place = c[context];
  // the style belongs to the photograph, not to the context it appears in
  return place ? { style: c.style, ...place } : null;
}

const CONTEXTS = ['cta', 'hook', 'middle'];

/** What Spark reads: it picks a photograph, never a position. */
export const cutoutCatalogue = () => CUTOUT_NAMES.map((n) => ({
  name: n,
  use: CUTOUTS[n].use,
  treatment: CUTOUTS[n].style === 'clean'
    ? 'keyed, and nothing else done to it' : 'cut out of paper with scissors',
  what: CUTOUTS[n].what,
  why_it_sits_there: CUTOUTS[n].why,
  contexts: CONTEXTS.filter((k) => CUTOUTS[n][k]),
}));

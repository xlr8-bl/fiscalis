/**
 * cutouts.js — where each of Ashley's photographs goes, decided once.
 *
 * WHY THESE ARE HARDCODED. A placement that is computed is a placement
 * that moves. Spark will be filing carousels every day and the one thing
 * that must not drift is where Ashley himself sits on a sheet: a face
 * that appears bottom-right on Monday and centre-left on Tuesday reads
 * as an accident both times. So every photograph has ONE placement per
 * context, written down here, and nothing downstream may override it.
 *
 * HOW THEY WERE DECIDED. By measuring, not by looking. Each photograph
 * was keyed the same way the renderer keys it — colour distance from the
 * median of its four corners — and the subject's box and which frame
 * edges it runs off were read from the mask:
 *
 *   blue-flat     subject x 0.29..1.00  y 0.28..1.00   runs off right, bottom
 *   sky-arms      subject x 0.01..0.62  y 0.42..1.00   runs off bottom
 *   phone-chair   subject x 0.09..0.99  y 0.12..0.98   runs off nothing
 *   black-wall    keys as 27% of the frame on all four sides
 *
 * The placement follows the photograph rather than fighting it. A figure
 * that runs off the right of its own source goes to the right edge of
 * the sheet and off it, because that is the composition the picture
 * already has; putting it in the middle with air on both sides makes a
 * crop look like a mistake.
 *
 * BLACK-WALL CANNOT BE CUT OUT, and that is a measurement rather than an
 * opinion. Its background is a black panel and the subject is wearing
 * black, so the key cannot separate them: it takes the white panel
 * behind him as subject and his jacket as ground, and the mask touches
 * all four edges. It is a full-bleed scene, and it is listed here saying
 * so, so nobody tries again in six months.
 */

/**
 * `at` is the anchor: which corner of the SHEET the cut-out is pinned
 * to. `bleed` is how far past that edge it runs, as a fraction of the
 * frame — a cut-out that stops short of the edge looks placed, one that
 * runs off looks photographed. `h` is its height on the sheet.
 */
export const CUTOUTS = {
  'blue-flat': {
    aspect: 1.0,   // width over height, so the column knows what it gives up
    use: 'cutout',
    what: 'Head and shoulders against a flat blue sweep. Keys cleanly.',
    cta: { at: 'right', h: 0.42, bleed: 0.06, from: 'bottom' },
    hook: { at: 'right', h: 0.52, bleed: 0.10, from: 'bottom' },
    why: 'The subject runs off the right and bottom of its own frame, so it '
       + 'goes to the right edge and off it. Centred, the crop reads as a '
       + 'mistake.',
  },

  'sky-arms': {
    aspect: 0.8,   // width over height, so the column knows what it gives up
    use: 'cutout',
    what: 'Arms folded against sky, figure low and to the left.',
    cta: { at: 'left', h: 0.46, bleed: 0.05, from: 'bottom' },
    hook: { at: 'left', h: 0.58, bleed: 0.09, from: 'bottom' },
    why: 'Mirror of blue-flat: the figure occupies the left three fifths of '
       + 'its source and runs off the bottom. It is the one that leaves the '
       + 'right side of a sheet free for type.',
  },

  'phone-chair': {
    aspect: 0.8,   // width over height, so the column knows what it gives up
    use: 'cutout',
    what: 'Seated, whole figure, on a white sweep. A phone in one hand.',
    cta: { at: 'right', h: 0.55, bleed: 0.02, from: 'bottom' },
    hook: { at: 'centre', h: 0.62, bleed: 0.00, from: 'bottom' },
    why: 'The only one whose subject is entirely inside its frame, so it is '
       + 'the only one that can stand free with a cut on all four sides. It '
       + 'is a whole figure, so it wants to be bigger and to sit on the foot '
       + 'of the sheet rather than float.',
  },

  'black-wall': {
    aspect: 1.0,   // width over height, so the column knows what it gives up
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
  return c[context] ?? null;
}

/** What Spark reads: it picks a photograph, never a position. */
export const cutoutCatalogue = () => CUTOUT_NAMES.map((n) => ({
  name: n,
  use: CUTOUTS[n].use,
  what: CUTOUTS[n].what,
  why_it_sits_there: CUTOUTS[n].why,
  contexts: ['cta', 'hook'].filter((k) => CUTOUTS[n][k]),
}));

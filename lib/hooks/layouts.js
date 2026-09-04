/**
 * layouts.js — each reference, measured.
 *
 * Every box here was read off tools/measure.py's grid, not estimated.
 * The numbers are normalised 0..1 on the frame, so the same measurement
 * renders at 1080x1350 and would render at any other size.
 *
 * A layout is NOT a finished poster. It is the reference's geometry with
 * the copy taken out: an agent supplies `copy` keyed by slot id, and
 * each slot's fit policy decides how that copy sits in the box it was
 * measured into. That is what keeps it a template rather than one
 * poster with the words swapped. `size` is the reference's own size and
 * doubles as the ceiling, so copy the same length as the original comes
 * out at the original size.
 *
 * SLOT IDS ARE A CONTRACT. An agent reads `wants` to know what to write
 * and how long it can be. Renaming one breaks every filed spec, so do
 * not rename one.
 */

export const LAYOUTS = {

  /* ------------------------------------------------------------- h001
   * Tabloid word over a screened face, undercut by a clinical readout.
   * Measured: rule x .085 w .040 running y .11 to .87; "lust." left .075,
   * cap band .115 to .30; mid line at .575/.455; script at .11/.665;
   * third line .60/.78; caption block from .02/.885; barcode .70/.845.
   */
  h001: {
    id: 'h001', family: 'halftone-portrait', ground: 'paper', ref: 'h001',
    wants: {
      head: 'One word, or two. It is set enormous, so 8 characters is the ceiling.',
      mid: 'A short phrase, 3 to 5 words. Sits at the mouth.',
      script: 'One word, italic, quiet. A label for the condition.',
      third: 'A short question or a word with punctuation. 12 characters.',
      body: 'Three or four lines of clinical observation. Present tense, third person, no verdict.',
      stamp: 'One tracked-caps line that reads like an instrument printed it.',
    },
    slots: [
      { id: 'portrait', t: 'art', box: [0, 0, 1, 1], treat: 'halftone', want: 'a close crop of your face' },
      { id: 'rule', t: 'rect', box: [0.085, 0.110, 0.040, 0.760], fill: 'accent' },
      { id: 'head', t: 'type', box: [0.075, 0.105, 0.620, 0.195],
        role: 'display', weight: '800', fill: 'accent', track: -0.03,
        fit: 'shrink', size: 0.185, max: 0.195, min: 0.075, vAlign: 'bottom' },
      { id: 'mid', t: 'type', box: [0.575, 0.420, 0.420, 0.048],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.038, min: 0.022, vAlign: 'bottom' },
      { id: 'script', t: 'type', box: [0.105, 0.625, 0.330, 0.055],
        role: 'italic', fill: 'mark', alpha: 0.72,
        fit: 'shrink', size: 0.050, min: 0.028, vAlign: 'bottom' },
      { id: 'third', t: 'type', box: [0.595, 0.745, 0.360, 0.050],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.62,
        fit: 'shrink', size: 0.044, min: 0.024, vAlign: 'bottom' },
      { id: 'body', t: 'type', box: [0.020, 0.880, 0.640, 0.088],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.023, min: 0.015, leading: 1.18 },
      { id: 'stamp', t: 'type', box: [0.020, 0.968, 0.640, 0.026],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.02,
        fit: 'shrink', size: 0.021, min: 0.014 },
      { id: 'barcode', t: 'barcode', box: [0.700, 0.845, 0.290, 0.105], fill: 'accent' },
    ],
  },

  /* h002 is h001 on the red ground: the reference is the same sheet in a
   * second colourway, which is exactly what a template is for. */
  h002: null,   // filled in below, from h001

  /* ------------------------------------------------------------- h018
   * Didone caps over three screened objects, an italic turn underneath,
   * and a centred paragraph. Measured: rails at .045; line one cap band
   * .095 to .19, line two .21 to .30; objects .11 to .87 across, .32 to
   * .73 down; turn line .755 to .845; paragraph .865 to .945.
   */
  h018: {
    id: 'h018', family: 'object-hero', ground: 'paper', ref: 'h018',
    wants: {
      railL: 'Two or three words, tracked caps. Who made it.',
      railR: 'The same, right. A handle or a date.',
      head1: 'The instruction, line one. Set in caps, so keep it under 12 characters.',
      head2: 'Line two. Same treatment, and it may be longer.',
      turn: 'The consequence, with one word in italic. Under 30 characters.',
      body: 'Two lines of reasoning, centred. Plain and calm.',
    },
    slots: [
      { id: 'railL', t: 'type', box: [0.045, 0.030, 0.300, 0.026],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.04,
        fit: 'shrink', size: 0.018, min: 0.012 },
      { id: 'railR', t: 'type', box: [0.655, 0.030, 0.300, 0.026],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.04,
        fit: 'shrink', size: 0.018, min: 0.012, align: 'right' },
      { id: 'head1', t: 'type', box: [0.100, 0.088, 0.800, 0.105],
        role: 'italic', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.098, min: 0.050, vAlign: 'bottom' },
      { id: 'head2', t: 'type', box: [0.070, 0.200, 0.860, 0.105],
        role: 'italic', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.098, min: 0.050, vAlign: 'bottom' },
      { id: 'objects', t: 'art', box: [0.110, 0.320, 0.780, 0.410],
        treat: 'contain', want: 'three objects in a row, screened' },
      { id: 'turn', t: 'type', box: [0.060, 0.752, 0.880, 0.095],
        role: 'italic', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.082, min: 0.040, vAlign: 'bottom' },
      { id: 'body', t: 'type', box: [0.150, 0.862, 0.700, 0.085],
        role: 'body', weight: '500', fill: 'mark', align: 'center',
        fit: 'wrap', size: 0.030, min: 0.018, leading: 1.22 },
    ],
  },

  /* ------------------------------------------------------------- h037
   * The whole sheet is white space, one two-weight statement at the
   * optical centre, an empty search field under it, and an arrow low
   * right. Measured: head band .225 to .315; field .095 to .905 across,
   * .335 to .385 down; arrow .755/.855.
   */
  h037: {
    id: 'h037', family: 'ui-device', ground: 'paper', ref: 'h037',
    wants: {
      lead: 'The condition, in the lighter weight. Under 40 characters.',
      punch: 'The consequence, heavy. Under 26 characters. This is the line people screenshot.',
    },
    slots: [
      { id: 'lead', t: 'type', box: [0.095, 0.372, 0.810, 0.048],
        role: 'display', weight: '500', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.042, min: 0.024, vAlign: 'bottom' },
      { id: 'punch', t: 'type', box: [0.095, 0.422, 0.810, 0.068],
        role: 'display', weight: '800', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.060, min: 0.030, vAlign: 'bottom' },
      /* The field floats. A flat grey bar reads as a hole in the page;
         the shadow is what makes it an object sitting on one, and that
         is the whole visual joke of the reference: an empty box with a
         cursor in it and nothing typed. */
      { id: 'fieldbg', t: 'rect', box: [0.108, 0.552, 0.784, 0.052],
        fill: 'ground', r: 0.006, lift: 0.014 },
      { id: 'caret', t: 'rect', box: [0.131, 0.564, 0.0028, 0.028], fill: 'accent' },
      { id: 'arrowbg', t: 'rect', box: [0.735, 0.848, 0.150, 0.052],
        stroke: 'mark', r: 'pill', weight: 0.0016 },
      { id: 'arrow', t: 'type', box: [0.735, 0.848, 0.150, 0.052],
        role: 'grotesque', weight: '500', fill: 'mark', text: '→',
        fit: 'fixed', size: 0.030, align: 'center', vAlign: 'middle' },
    ],
  },

  /* ------------------------------------------------------------- h051
   * Two-line setup, then one enormous word the figure walks through, a
   * right-hand column of supporting copy, and a footer bar of controls.
   * Measured: rails .045/.045; setup .115 to .215; QUIET cap band .225
   * to .44; figure .29 to .62 across, .38 to .82 down; column at .575;
   * ground line at .805; footer bar .845 to .95.
   */
  h051: {
    id: 'h051', family: 'figure-cut', ground: 'paper', ref: 'h051',
    wants: {
      railL: 'Two short lines, top left. The premise.',
      railR: 'Two short lines, top right. Who made it.',
      setup: 'Two lines that run into the hero word. The second must end mid-sentence.',
      hero: 'ONE word, caps, 5 or 6 letters. It is set at a quarter of the sheet.',
      index: 'A number or a version tag.',
      subhead: 'Two short lines, heavy caps. The turn.',
      body: 'Three lines of reasoning.',
      cta: 'Two or three words on a button.',
      date: 'A date, plain.',
      note: 'Three quiet lines, the smallest copy on the sheet.',
      footer: 'Two lines along the bottom bar.',
      tagA: 'A short tag in an outlined pill.',
      tagB: 'A short tag in a filled pill.',
    },
    slots: [
      { id: 'railL', t: 'type', box: [0.055, 0.032, 0.330, 0.044],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.019, min: 0.013, leading: 1.25 },
      { id: 'railR', t: 'type', box: [0.615, 0.032, 0.330, 0.044],
        role: 'body', weight: '500', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.019, min: 0.013, leading: 1.25 },
      { id: 'setup', t: 'type', box: [0.060, 0.108, 0.640, 0.108],
        role: 'display', weight: '800', fill: 'mark',
        fit: 'shrink', size: 0.052, min: 0.030, leading: 1.02 },
      { id: 'index', t: 'type', box: [0.830, 0.178, 0.115, 0.040],
        role: 'display', weight: '800', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.034, min: 0.020 },
      { id: 'hero', t: 'type', box: [0.030, 0.220, 0.945, 0.215],
        role: 'display', weight: '800', fill: 'mark', track: -0.035,
        fit: 'shrink', size: 0.205, max: 0.215, min: 0.090, vAlign: 'bottom' },
      { id: 'figure', t: 'art', box: [0.285, 0.360, 0.335, 0.455],
        treat: 'contain', want: 'you, walking, cut out' },
      { id: 'subhead', t: 'type', box: [0.575, 0.470, 0.370, 0.070],
        role: 'display', weight: '800', fill: 'mark',
        fit: 'shrink', size: 0.032, min: 0.020, leading: 1.06 },
      { id: 'body', t: 'type', box: [0.575, 0.552, 0.370, 0.070],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.019, min: 0.013, leading: 1.24 },
      { id: 'ctabg', t: 'rect', box: [0.575, 0.638, 0.245, 0.042], fill: 'mark' },
      { id: 'cta', t: 'type', box: [0.600, 0.646, 0.200, 0.028],
        role: 'grotesque', weight: '700', fill: 'ground',
        fit: 'shrink', size: 0.022, min: 0.015 },
      { id: 'date', t: 'type', box: [0.575, 0.694, 0.250, 0.030],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.75,
        fit: 'shrink', size: 0.022, min: 0.015 },
      { id: 'note', t: 'type', box: [0.575, 0.742, 0.330, 0.055],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.7,
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.24 },
      { id: 'floor', t: 'rect', box: [0.040, 0.806, 0.920, 0.004], fill: 'mark' },
      { id: 'barbg', t: 'rect', box: [0.030, 0.845, 0.940, 0.105],
        fill: 'accent', alpha: 0.14 },
      { id: 'footer', t: 'type', box: [0.055, 0.878, 0.430, 0.048],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.018, min: 0.012, leading: 1.24 },
      { id: 'tagA', t: 'type', box: [0.590, 0.880, 0.150, 0.040],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.024, min: 0.016, vAlign: 'middle' },
      { id: 'tagBbg', t: 'rect', box: [0.760, 0.872, 0.185, 0.055], fill: 'mark' },
      { id: 'tagB', t: 'type', box: [0.760, 0.872, 0.185, 0.055],
        role: 'grotesque', weight: '700', fill: 'ground', align: 'center',
        fit: 'shrink', size: 0.024, min: 0.016, vAlign: 'middle' },
    ],
  },
};

/*
 * h002 is h001 on the red ground. Written as a derivation rather than a
 * second copy of eighteen numbers, so a correction to the geometry lands
 * on both — which is the thing that always goes wrong when a colourway
 * is pasted.
 */
LAYOUTS.h002 = {
  ...LAYOUTS.h001,
  id: 'h002', ref: 'h002', ground: 'red',
  slots: LAYOUTS.h001.slots.map((s) => {
    if (s.id === 'head') return { ...s, fill: 'mark' };
    if (s.id === 'rule') return { ...s, fill: 'mark' };
    if (s.id === 'barcode') return { ...s, fill: 'mark' };
    return s;
  }),
};

export const MEASURED = Object.keys(LAYOUTS).filter((k) => LAYOUTS[k]);
export const layout = (id) => LAYOUTS[id];

/**
 * What an agent needs to know to fill one: the slot ids that take copy,
 * what each is for, and how much room it has.
 *
 * Generated from the layout rather than written beside it, so a slot
 * added without a note shows up as a slot with no note instead of
 * quietly not being mentioned.
 */
export function brief(id) {
  const l = LAYOUTS[id];
  if (!l) return null;
  return {
    id, family: l.family, ground: l.ground,
    slots: l.slots
      .filter((s) => s.t === 'type' && !s.text)
      .map((s) => ({
        slot: s.id,
        what: l.wants?.[s.id] ?? 'no note recorded',
        lines: s.fit === 'wrap' ? 'wraps to fit' : 'one line per entry',
        // the box is what actually limits it, so say it in characters at
        // the reference size rather than in normalised units nobody can picture
        roughly: `${Math.round((s.box[2] * 1080) / (s.size * 1350 * 0.52))} characters at full size`,
      })),
    art: l.slots.filter((s) => s.t === 'art').map((s) => ({ slot: s.id, want: s.want })),
  };
}

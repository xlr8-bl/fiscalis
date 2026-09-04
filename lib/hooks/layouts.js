/**
 * layouts.js — each reference, measured, with the topic taken out.
 *
 * TWO THINGS THIS FILE HAS TO GET RIGHT AT ONCE.
 *
 * ACCURATE. Every box was read off tools/measure.py's coordinate grid,
 * not estimated. Normalised 0..1 on the frame, so a measurement taken
 * from a 736px Pinterest save renders correctly at 1080x1350. The faces
 * are the faces the reference uses, sourced rather than substituted:
 * `didone` where the sheet is a Didone sheet, `script` where it turns on
 * a brush script, `black` where one word is the whole design.
 *
 * FREE. A slot describes the JOB it does — "the condition, stated
 * plainly", "the consequence, and this is the line people screenshot" —
 * and never the subject. That distinction is the whole point. The first
 * version of this file said things like "open your own site on a phone",
 * and an agent reading that writes the same post forever: put your site
 * to the test, test your site on a cheap phone, have you tested your
 * site. Same sheet, same message, endlessly re-worded. A template that
 * teaches its own topic is not a template, it is one poster with a
 * find-and-replace.
 *
 * So: `does` says what the composition is FOR, structurally. `slots`
 * says what each box wants, structurally. `avoid` says what the layout
 * is bad at, so an agent can rule it out rather than force it. And
 * examples live in examples.js, three per layout on three unrelated
 * subjects, precisely so no one of them reads as the definition.
 *
 * Pictures are the same. An art slot says what KIND of image the box
 * wants — how it is cropped, what has to be true of it for the type to
 * work — and never names a file. The agent picks or sources it.
 *
 * SLOT IDS ARE A CONTRACT. An agent writes copy keyed by them. Renaming
 * one breaks every filed spec, so do not rename one.
 */

export const LAYOUTS = {

  /* ------------------------------------------------------------- h001
   * Measured: rule x .085 w .040 running y .11 to .87; headline left
   * .075, cap band .105 to .30; mid .575/.42; script .105/.625; third
   * .595/.745; caption .020/.880; barcode .700/.845.
   */
  h001: {
    id: 'h001', family: 'halftone-portrait', ground: 'paper', ref: 'h001',

    does: 'A blunt word set enormous, then undercut by cold observational '
        + 'copy that reads as though an instrument produced it. The gap between '
        + 'the shout and the clipboard is the whole effect. Works for anything '
        + 'you can state as a finding rather than an opinion.',
    avoid: 'Do not use it for advice, encouragement, or anything with a warm '
         + 'tone. The layout is clinical and it will fight you.',

    slots: [
      { id: 'portrait', t: 'art', box: [0, 0, 1, 1], treat: 'halftone',
        wants: 'A face or figure cropped close enough that features run off the '
             + 'frame. High contrast. It gets screened to a coarse halftone, so '
             + 'detail is lost and shape is everything. Any subject: a person, '
             + 'hands, an object with a face-like read. Your call.' },
      { id: 'rule', t: 'rect', box: [0.085, 0.110, 0.040, 0.760], fill: 'accent' },
      { id: 'head', t: 'type', box: [0.075, 0.105, 0.620, 0.195],
        role: 'black', fill: 'accent', track: -0.03,
        fit: 'shrink', size: 0.185, max: 0.195, min: 0.075, vAlign: 'bottom',
        wants: 'ONE word, or two very short ones, with a full stop. It is set at a '
             + 'fifth of the sheet, so 8 characters is the ceiling. A verdict, not a topic.' },
      { id: 'mid', t: 'type', box: [0.575, 0.420, 0.420, 0.048],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.038, min: 0.022, vAlign: 'bottom',
        wants: 'Three to five words. A trade-off or an ordering, lower case. '
             + 'Sits in the middle distance and is read second.' },
      { id: 'script', t: 'type', box: [0.105, 0.625, 0.330, 0.055],
        role: 'italic', fill: 'mark', alpha: 0.72,
        fit: 'shrink', size: 0.050, min: 0.028, vAlign: 'bottom',
        wants: 'One word, italic, quiet. A name for the condition being observed.' },
      { id: 'third', t: 'type', box: [0.595, 0.745, 0.360, 0.050],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.62,
        fit: 'shrink', size: 0.044, min: 0.024, vAlign: 'bottom',
        wants: 'A short word or question with punctuation. Under 12 characters. '
             + 'It is the doubt the readout leaves behind.' },
      { id: 'body', t: 'type', box: [0.020, 0.880, 0.640, 0.088],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.023, min: 0.015, leading: 1.18,
        wants: 'Three or four short lines of observation. Third person, present '
             + 'tense, no verdict and no advice. It should read like a log entry.' },
      { id: 'stamp', t: 'type', box: [0.020, 0.968, 0.640, 0.026],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.02,
        fit: 'shrink', size: 0.021, min: 0.014,
        wants: 'One tracked-caps line with a number in it, wrapped in slashes. '
             + 'A machine readout. It does not have to be about the same thing '
             + 'as the body copy.' },
      { id: 'barcode', t: 'barcode', box: [0.700, 0.845, 0.290, 0.105], fill: 'accent' },
    ],
  },

  h002: null,   // derived from h001 below

  /* ------------------------------------------------------------- h018
   * Measured: rails .045/.030; line one cap band .088 to .193, line two
   * .200 to .305; objects .110 to .890 across, .320 to .730 down; turn
   * .752 to .847; paragraph .862 to .947.
   */
  h018: {
    id: 'h018', family: 'object-hero', ground: 'paper', ref: 'h018',

    does: 'A two-line instruction in Didone caps, a row of screened objects, '
        + 'then an italic turn and a short reasoned paragraph. The Didone makes '
        + 'an ordinary instruction feel like an old public notice. Suits anything '
        + 'imperative that you can then justify calmly.',
    avoid: 'Not for questions, and not for anything that needs more than two '
         + 'lines up top. The caps band is fixed at two lines and a third will '
         + 'shrink both past reading size.',

    slots: [
      { id: 'railL', t: 'type', box: [0.045, 0.030, 0.300, 0.026],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.04,
        fit: 'shrink', size: 0.018, min: 0.012,
        wants: 'Two or three words, tracked caps. Attribution, a series name, a date.' },
      { id: 'railR', t: 'type', box: [0.655, 0.030, 0.300, 0.026],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.04,
        fit: 'shrink', size: 0.018, min: 0.012, align: 'right',
        wants: 'The same, right aligned. The other half of the pair.' },
      { id: 'head1', t: 'type', box: [0.100, 0.088, 0.800, 0.105],
        role: 'didone', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.098, min: 0.050, vAlign: 'bottom',
        wants: 'Line one of an instruction, in caps. Under 14 characters or it '
             + 'drops below the second line and the pair stops reading as one thing.' },
      { id: 'head2', t: 'type', box: [0.070, 0.200, 0.860, 0.105],
        role: 'didone', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.098, min: 0.050, vAlign: 'bottom',
        wants: 'Line two, caps. May run longer than line one. Ending on an '
             + 'exclamation is in the spirit of the reference but not required.' },
      { id: 'objects', t: 'art', box: [0.110, 0.320, 0.780, 0.410],
        treat: 'contain',
        wants: 'A row of two to four related objects, shot flat against a plain '
             + 'ground, screened coarse. What they are is open: devices, tools, '
             + 'packaging, printed things. They only have to read as a set, and '
             + 'to sit in a wide shallow band.' },
      { id: 'turn', t: 'type', box: [0.060, 0.752, 0.880, 0.095],
        role: 'didoneItalic', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.082, min: 0.040, vAlign: 'bottom',
        wants: 'The turn, in italic. Under 30 characters. It should complete or '
             + 'complicate the instruction above rather than repeat it.' },
      { id: 'body', t: 'type', box: [0.150, 0.862, 0.700, 0.085],
        role: 'body', weight: '500', fill: 'mark', align: 'center',
        fit: 'wrap', size: 0.030, min: 0.018, leading: 1.22,
        wants: 'Two lines of calm reasoning, centred. The reason the instruction '
             + 'is worth following. No exclamation down here.' },
    ],
  },

  /* ------------------------------------------------------------- h037
   * Measured: lead band .372 to .420; punch .422 to .490; field .108 to
   * .892 across, .552 to .604 down; arrow pill .735/.848.
   */
  h037: {
    id: 'h037', family: 'ui-device', ground: 'paper', ref: 'h037',

    does: 'Almost the whole sheet is empty. One two-weight statement at the '
        + 'optical centre, one piece of interface under it, one small affordance '
        + 'low right. The emptiness is the confidence. Suits a single hard claim '
        + 'that needs no evidence beyond stating it.',
    avoid: 'Anything that needs a list, a number, or a second thought. There is '
         + 'nowhere to put one and adding a slot would break the composition.',

    slots: [
      { id: 'lead', t: 'type', box: [0.095, 0.372, 0.810, 0.048],
        role: 'display', weight: '500', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.042, min: 0.024, vAlign: 'bottom',
        wants: 'The condition, in the lighter weight. Under 40 characters. '
             + 'Usually an "if" or a "when", but any setup clause works.' },
      { id: 'punch', t: 'type', box: [0.095, 0.422, 0.810, 0.068],
        role: 'display', weight: '800', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.060, min: 0.030, vAlign: 'bottom',
        wants: 'The consequence, heavy. Under 26 characters. This is the line '
             + 'people screenshot, so it has to survive being quoted alone.' },
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
   * Measured: rails .055/.032; setup .108 to .216; index .830/.178; hero
   * cap band .220 to .435; figure .285 to .620 across, .360 to .815
   * down; right column from .575; floor rule .806; bar .845 to .950.
   */
  h051: {
    id: 'h051', family: 'figure-cut', ground: 'paper', ref: 'h051',

    does: 'A two-line setup that runs INTO one enormous word, with a figure '
        + 'standing in front of it, and a right-hand column carrying the argument. '
        + 'The best structure in the corpus: the setup is deliberately incomplete '
        + 'so the eye is dragged down into the hero word to finish the sentence. '
        + 'Suits any contrast where the second half is one word.',
    avoid: 'Useless if the payoff is not a single word. Do not try to fit two '
         + 'words into the hero slot; the whole device is that one word is the '
         + 'size of a quarter of the sheet.',

    slots: [
      { id: 'railL', t: 'type', box: [0.055, 0.032, 0.330, 0.044],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.019, min: 0.013, leading: 1.25,
        wants: 'Two short lines. The premise, stated flat before the headline '
             + 'does it properly.' },
      { id: 'railR', t: 'type', box: [0.615, 0.032, 0.330, 0.044],
        role: 'body', weight: '500', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.019, min: 0.013, leading: 1.25,
        wants: 'Two short lines, right. Attribution or a date.' },
      { id: 'setup', t: 'type', box: [0.060, 0.108, 0.640, 0.108],
        role: 'display', weight: '800', fill: 'mark',
        fit: 'shrink', size: 0.052, min: 0.030, leading: 1.02,
        wants: 'Two lines. The SECOND MUST END MID-SENTENCE so the hero word '
             + 'completes it. "X is loud. Y is" then the hero word. If your second '
             + 'line is a complete thought, this layout is the wrong one.' },
      { id: 'index', t: 'type', box: [0.830, 0.178, 0.115, 0.040],
        role: 'display', weight: '800', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.034, min: 0.020,
        wants: 'A number. An index, an issue, a count. Two digits.' },
      { id: 'hero', t: 'type', box: [0.030, 0.220, 0.945, 0.215],
        role: 'black', fill: 'mark', track: -0.035,
        fit: 'shrink', size: 0.205, max: 0.215, min: 0.090, vAlign: 'bottom',
        wants: 'ONE word, caps, 4 to 7 letters. It completes the setup line and '
             + 'it is a fifth of the sheet tall.' },
      { id: 'figure', t: 'art', box: [0.285, 0.360, 0.335, 0.455],
        treat: 'contain',
        wants: 'A single figure, cut out, standing or walking, seen whole. It '
             + 'overlaps the hero word, so it needs a clean edge and no busy '
             + 'background. Who or what it is is open, as long as it is one '
             + 'subject and roughly twice as tall as it is wide.' },
      { id: 'subhead', t: 'type', box: [0.575, 0.470, 0.370, 0.070],
        role: 'display', weight: '800', fill: 'mark',
        fit: 'shrink', size: 0.032, min: 0.020, leading: 1.06,
        wants: 'Two short lines of heavy caps. The turn, stated as two clauses.' },
      { id: 'body', t: 'type', box: [0.575, 0.552, 0.370, 0.070],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.019, min: 0.013, leading: 1.24,
        wants: 'Two or three lines of reasoning. Why the contrast holds.' },
      { id: 'ctabg', t: 'rect', box: [0.575, 0.638, 0.245, 0.042], fill: 'mark' },
      { id: 'cta', t: 'type', box: [0.600, 0.646, 0.200, 0.028],
        role: 'grotesque', weight: '700', fill: 'ground',
        fit: 'shrink', size: 0.022, min: 0.015,
        wants: 'Two or three words on a button. An action, not a slogan.' },
      { id: 'date', t: 'type', box: [0.575, 0.694, 0.250, 0.030],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.75,
        fit: 'shrink', size: 0.022, min: 0.015, wants: 'A date.' },
      { id: 'note', t: 'type', box: [0.575, 0.742, 0.330, 0.055],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.7,
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.24,
        wants: 'Three quiet lines, the smallest copy on the sheet. An aside.' },
      { id: 'floor', t: 'rect', box: [0.040, 0.806, 0.920, 0.004], fill: 'mark' },
      { id: 'barbg', t: 'rect', box: [0.030, 0.845, 0.940, 0.105],
        fill: 'accent', alpha: 0.14 },
      { id: 'footer', t: 'type', box: [0.055, 0.878, 0.430, 0.048],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.018, min: 0.012, leading: 1.24,
        wants: 'Two lines restating the premise in plainer words than the headline.' },
      { id: 'tagA', t: 'type', box: [0.590, 0.880, 0.150, 0.040],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.024, min: 0.016, vAlign: 'middle',
        wants: 'A short tag. A version, a code, a category.' },
      { id: 'tagBbg', t: 'rect', box: [0.760, 0.872, 0.185, 0.055], fill: 'mark' },
      { id: 'tagB', t: 'type', box: [0.760, 0.872, 0.185, 0.055],
        role: 'grotesque', weight: '700', fill: 'ground', align: 'center',
        fit: 'shrink', size: 0.024, min: 0.016, vAlign: 'middle',
        wants: 'A short tag, knocked out of a filled block. The louder of the two.' },
    ],
  },
};

/*
 * h002 is h001 on the red ground. Written as a derivation rather than a
 * second copy of nine boxes, so a correction to the geometry lands on
 * both — which is the thing that always goes wrong when a colourway is
 * pasted rather than derived.
 */
LAYOUTS.h002 = {
  ...LAYOUTS.h001,
  id: 'h002', ref: 'h002', ground: 'red',
  does: `${LAYOUTS.h001.does} This is the same sheet on the red ground, which is `
      + 'display-only: it carries the headline and the readout but never a paragraph.',
  slots: LAYOUTS.h001.slots.map((s) =>
    ['head', 'rule', 'barcode'].includes(s.id) ? { ...s, fill: 'mark' } : s),
};

export const MEASURED = Object.keys(LAYOUTS).filter((k) => LAYOUTS[k]);
export const layout = (id) => LAYOUTS[id];

/**
 * Everything an agent needs to fill one, and nothing that would teach it
 * a subject.
 *
 * Deliberately does NOT return the examples. An agent handed a worked
 * example alongside the slot notes writes a variation on that example;
 * handed the notes alone, it writes to the structure. The examples exist
 * for a person to look at, and are fetched separately and on purpose.
 */
export function brief(id) {
  const l = LAYOUTS[id];
  if (!l) return null;
  const chars = (s) => Math.round((s.box[2] * 1080) / (s.size * 1350 * 0.52));
  return {
    id,
    composition: l.does,
    not_for: l.avoid,
    ground: l.ground,
    write: l.slots
      .filter((s) => s.t === 'type' && !s.text)
      .map((s) => ({
        slot: s.id,
        job: s.wants ?? 'no note recorded',
        room: s.fit === 'wrap'
          ? `wraps; about ${chars(s) * 2} characters before it shrinks`
          : `about ${chars(s)} characters per line at full size`,
        lines: s.fit === 'wrap' ? 'as many as fit' : 'one per array entry',
      })),
    pictures: l.slots
      .filter((s) => s.t === 'art')
      .map((s) => ({ slot: s.id, kind: s.wants, treatment: s.treat ?? 'fills the box' })),
  };
}

/** Every layout, briefly, so an agent can pick one before asking for detail. */
export const index = () =>
  MEASURED.map((id) => ({
    id, does: LAYOUTS[id].does, avoid: LAYOUTS[id].avoid,
    needs_picture: LAYOUTS[id].slots.some((s) => s.t === 'art'),
  }));

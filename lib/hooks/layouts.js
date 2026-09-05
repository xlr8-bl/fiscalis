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
      { id: 'portrait', t: 'art', role: 'portrait', box: [0, 0, 1, 1], treat: 'halftone',
        pitch: 0.0105,
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
      { id: 'mid', over: 'art', t: 'type', box: [0.575, 0.420, 0.420, 0.048],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.038, min: 0.022, vAlign: 'bottom',
        wants: 'Three to five words. A trade-off or an ordering, lower case. '
             + 'Sits in the middle distance and is read second.' },
      { id: 'script', over: 'art', t: 'type', box: [0.105, 0.625, 0.330, 0.055],
        role: 'italic', fill: 'mark', alpha: 0.72,
        fit: 'shrink', size: 0.050, min: 0.028, vAlign: 'bottom',
        wants: 'One word, italic, quiet. A name for the condition being observed.' },
      { id: 'third', over: 'art', t: 'type', box: [0.595, 0.745, 0.360, 0.050],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.62,
        fit: 'shrink', size: 0.044, min: 0.024, vAlign: 'bottom',
        wants: 'A short word or question with punctuation. Under 12 characters. '
             + 'It is the doubt the readout leaves behind.' },
      { id: 'body', over: 'art', t: 'type', box: [0.020, 0.880, 0.640, 0.088],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.023, min: 0.015, leading: 1.18,
        wants: 'Three or four short lines of observation. Third person, present '
             + 'tense, no verdict and no advice. It should read like a log entry.' },
      { id: 'stamp', over: 'art', t: 'type', box: [0.020, 0.968, 0.640, 0.026],
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
      { id: 'objects', t: 'art', role: 'objects', box: [0.110, 0.320, 0.780, 0.410],
        treat: 'contain', count: 3, gap: 0.04,
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
      { id: 'figure', t: 'art', role: 'figure', box: [0.285, 0.360, 0.335, 0.455],
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

  /* ------------------------------------------------------------- h013
   * Measured: kicker .105/.079 .072x.016; head .102/.093 .330x.075;
   * second .061/.150 .418x.110; strap .061/.253 .465x.052; date
   * .875/.024 .082x.061; rail .943/.158 .014x.178; terms .530/.285;
   * deadline .023/.540 .163x.105; figure from .30 down; foot .342/.891.
   */
  h013: {
    id: 'h013', family: 'figure-cut', ground: 'paper', ref: 'h013',

    does: 'A notice, in the form of a wanted advert. The heading names what is '
        + 'being sought, the second line names it again in the accent colour with '
        + 'a twist, and small blocks of terms sit around a figure as though this '
        + 'were a real posting. The joke is the form, so the copy has to be '
        + 'straight-faced: the moment it winks, the sheet is a cartoon. Works for '
        + 'anything you can frame as a vacancy, a call, or a set of conditions.',
    avoid: 'Not for anything urgent or serious. The form is playful and it will '
         + 'undercut you. Also useless without a figure — the empty advert reads '
         + 'as a template nobody filled in, because that is what it is.',

    slots: [
      { id: 'kicker', t: 'type', box: [0.105, 0.079, 0.180, 0.026],
        role: 'display', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.022, min: 0.016,
        wants: 'One or two words that begin the sentence the headline finishes. '
             + 'Lower case, quiet, sitting on the headline like a breath.' },
      { id: 'head', t: 'type', box: [0.100, 0.093, 0.400, 0.078],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.078, min: 0.040, vAlign: 'bottom',
        wants: 'ONE word. The verb of the notice. Under 8 characters — it is set '
             + 'at nearly a twelfth of the sheet.' },
      { id: 'second', t: 'type', box: [0.061, 0.155, 0.440, 0.090],
        role: 'display', weight: '700', fill: 'accent', track: -0.02,
        fit: 'shrink', size: 0.078, min: 0.040, vAlign: 'bottom',
        wants: 'ONE word, the twist, in the accent colour. The pairing is the '
             + 'whole hook: the first word is expected and this one is not.' },
      { id: 'strap', t: 'type', box: [0.061, 0.258, 0.465, 0.030],
        role: 'body', weight: '700', fill: 'mark',
        fit: 'shrink', size: 0.017, min: 0.012,
        wants: 'One line of small bold, the condition of entry, said drily.' },
      { id: 'date', t: 'type', box: [0.860, 0.024, 0.115, 0.062],
        role: 'body', weight: '600', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.016, min: 0.011, leading: 1.3,
        wants: 'Two short lines top right, caps. A date, a reference, a filing.' },
      { id: 'rail', t: 'type', box: [0.930, 0.155, 0.038, 0.185],
        role: 'grotesque', weight: '600', fill: 'mark', rotate: -90,
        fit: 'shrink', size: 0.016, min: 0.012, track: 0.22,
        wants: 'Two or three words running up the right edge. An instruction.' },
      { id: 'terms', t: 'type', box: [0.530, 0.285, 0.360, 0.120],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.015, min: 0.011, leading: 1.45,
        wants: 'A heading and three dashed lines under it. Conditions, each one '
             + 'a specific complaint stated as a requirement. This block carries '
             + 'the humour; the headline only sets it up.' },
      { id: 'deadline', t: 'type', box: [0.023, 0.540, 0.200, 0.110],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.015, min: 0.011, leading: 1.45,
        wants: 'A heading and two or three short lines. A limit, expressed as a '
             + 'feeling rather than a date.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.300, 0.300, 0.700, 0.660],
        treat: 'contain',
        wants: 'One person, whole, doing something that fits the notice — on a '
             + 'phone, at a desk, waiting. It fills the lower two-thirds and is '
             + 'the reason the sheet reads as a photograph rather than a form.' },
      { id: 'foot', t: 'type', box: [0.342, 0.940, 0.400, 0.030],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.8,
        fit: 'shrink', size: 0.014, min: 0.010,
        wants: 'One line at the very bottom. How to reply, said in the same '
             + 'deadpan as the rest.' },
    ],
  },

  /* ------------------------------------------------------------- h020
   * Measured: kicker .192/.181 .524x.046; head .103/.192 .826x.148;
   * figure .216/.547 .641x.453. Reference is 736x1185, so the vertical
   * proportions are read as fractions and land slightly tighter at 4:5.
   */
  h020: {
    id: 'h020', family: 'figure-cut', ground: 'paper', ref: 'h020',

    does: 'A small flat line of setup, then the same sentence finished enormous, '
        + 'with a figure standing under it looking away. Almost nothing on the '
        + 'sheet: two blocks of type and a person. It works because the headline '
        + 'is lower case and set at a size that would normally be shouted, so it '
        + 'reads as spoken rather than announced.',
    avoid: 'Do not put a third block on it. Every element added takes the '
         + 'quietness out, and the quietness is the design. Not for anything that '
         + 'needs explaining.',

    slots: [
      { id: 'kicker', t: 'type', box: [0.190, 0.180, 0.530, 0.046],
        role: 'display', weight: '700', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.038, min: 0.024,
        wants: 'A short opening clause, lower case, that runs straight into the '
             + 'headline. It must not be a sentence on its own.' },
      { id: 'head', t: 'type', box: [0.100, 0.235, 0.830, 0.150],
        role: 'display', weight: '800', fill: 'mark', track: -0.035,
        fit: 'shrink', size: 0.145, max: 0.150, min: 0.070, vAlign: 'bottom',
        wants: 'Two or three words finishing the kicker, lower case, with a full '
             + 'stop. Under 10 characters — it runs the width of the sheet.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.216, 0.500, 0.645, 0.500],
        treat: 'contain',
        wants: 'One person from the chest up or the waist up, cut out, not looking '
             + 'at the camera. They are under the headline rather than beside it, '
             + 'so the top of the head has to sit clear of the type.' },
    ],
  },

  /* ------------------------------------------------------------- h024
   * Measured: kicker .091/.079 .180x.030; head .091/.136 .817x.101;
   * mark .712/.181 .216x.046 (right, under the headline); figure
   * .291/.179 .466x.558.
   */
  h024: {
    id: 'h024', family: 'figure-cut', ground: 'paper', ref: 'h024',

    does: 'A question in two parts: a conditional set small, and the question '
        + 'itself set across the whole sheet, with a figure falling through the '
        + 'middle of it. The figure overlaps the type rather than sitting under '
        + 'it, which is what stops it reading as a quote card.',
    avoid: 'Only for a question, and only for one that lands as a challenge. A '
         + 'rhetorical question with an obvious answer looks smug at this size.',

    slots: [
      { id: 'kicker', t: 'type', box: [0.091, 0.079, 0.300, 0.032],
        role: 'display', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.026, min: 0.018,
        wants: 'Two or three words, lower case. The condition. It is the first '
             + 'half of the question and it must feel unfinished.' },
      { id: 'head', t: 'type', box: [0.088, 0.130, 0.830, 0.105],
        role: 'display', weight: '800', fill: 'mark', track: -0.035,
        fit: 'shrink', size: 0.100, max: 0.105, min: 0.055, vAlign: 'bottom',
        wants: 'The question, finished, with a question mark. Two or three short '
             + 'words — it runs the full width.' },
      { id: 'mark', t: 'type', box: [0.700, 0.240, 0.230, 0.028],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.020, min: 0.014, track: 0.06,
        wants: 'A short signature under the right end of the headline. Initials, '
             + 'a handle, a mark. Not a sentence.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.291, 0.260, 0.470, 0.560],
        treat: 'contain',
        wants: 'One figure mid-movement — walking, falling, turning — cut out, '
             + 'seen whole. It sits under the headline and over the ground, so it '
             + 'needs air around it and a clean edge.' },
    ],
  },

  /* ------------------------------------------------------------- h032
   * Measured: handle .700/.028; head three lines from .075, cap band
   * .085 to .320, second line knocked out of a filled bar; note
   * .045/.435 .310x.090; figure .560/.230 .440x.720.
   */
  h032: {
    id: 'h032', family: 'figure-cut', ground: 'paper', ref: 'h032',

    does: 'A three-line claim where the middle line is knocked out of a solid '
        + 'bar in the accent colour, so the eye lands on the middle of the '
        + 'sentence rather than the start of it. A figure stands at the right, '
        + 'illustrating the claim rather than decorating it. The highlight is the '
        + 'device: it does the job a pull quote does, inside the headline.',
    avoid: 'The highlighted line has to be the one that carries the meaning. '
         + 'Highlighting a connective — "About", "For", "With" — makes the whole '
         + 'sheet look automated, which is exactly the failure to avoid.',

    slots: [
      { id: 'handle', t: 'type', box: [0.640, 0.028, 0.300, 0.026],
        role: 'body', weight: '500', fill: 'mark', align: 'right', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011,
        wants: 'A handle or a source, top right, small.' },
      /*
       * One slot, three lines, with the second one lit. The bar is drawn
       * to the width of whatever is written on that line rather than to a
       * measured rectangle — a rectangle fits the reference's words and
       * nothing else, and an agent's shorter line then leaves it hanging
       * out past the type.
       */
      { id: 'head', t: 'type', box: [0.070, 0.055, 0.870, 0.275],
        role: 'display', weight: '800', fill: 'mark', track: -0.03,
        highlight: 'accent', highlightLines: [1], highlightText: 'mark',
        fit: 'shrink', size: 0.085, min: 0.045, leading: 1.02,
        wants: 'A claim in exactly three lines. The MIDDLE line is knocked into a '
             + 'solid bar, so it has to be the words that carry the meaning — the '
             + 'noun, not the preposition. "The / Biggest Lie / About Creativity" '
             + 'works; lighting up "About" would not.' },
      { id: 'note', t: 'type', box: [0.045, 0.435, 0.330, 0.100],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.35,
        wants: 'Three or four lines in brackets. Who this is for, and what to do '
             + 'about it. Written as an aside, not as a caption.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.545, 0.230, 0.440, 0.730],
        treat: 'contain',
        wants: 'One figure, cut out, whose posture IS the claim — pulled about, '
             + 'held up, propped. It fills the right half from the headline down '
             + 'to the foot.' },
    ],
  },

  /* ------------------------------------------------------------- h068
   * Measured: head .213/.030 .569x.215; tail .102/.594 .815x.292;
   * strap .284/.853 .428x.063; figures fill the middle band .24 to .60.
   */
  h068: {
    id: 'h068', family: 'figure-cut', ground: 'paper', ref: 'h068',

    does: 'One sentence broken in half, with the picture set INSIDE it: the first '
        + 'half at the top, a row of cut-out people in the middle, the second half '
        + 'underneath, and a short line in the accent colour at the foot. The '
        + 'reader finishes the sentence by looking past the picture, which is why '
        + 'this holds attention longer than a headline over a photograph.',
    avoid: 'The break has to fall somewhere that leaves the top half hanging. '
         + 'Splitting between two complete clauses wastes the whole device. Needs '
         + 'several subjects rather than one — a single figure in the middle band '
         + 'looks stranded.',

    slots: [
      { id: 'head', t: 'type', box: [0.150, 0.030, 0.700, 0.215],
        role: 'display', weight: '700', fill: 'mark', align: 'center',
        track: -0.025, fit: 'shrink', size: 0.098, min: 0.055, leading: 1.02,
        wants: 'The first half of one sentence, two or three lines, centred. It '
             + 'MUST stop mid-thought — the reader has to look past the picture to '
             + 'finish it.' },
      { id: 'cast', t: 'art', role: 'crowd', box: [0.080, 0.240, 0.860, 0.370],
        treat: 'contain',
        wants: 'Several people, cut out, arranged in a row across the middle. '
             + 'Different postures and different heights: the row reads as a set '
             + 'of individuals, which is the point of the sentence around it.' },
      { id: 'tail', t: 'type', box: [0.100, 0.600, 0.815, 0.230],
        role: 'display', weight: '700', fill: 'mark', align: 'center',
        track: -0.025, fit: 'shrink', size: 0.115, min: 0.060, leading: 1.02,
        wants: 'The second half, finishing the sentence, ending in a full stop. '
             + 'Set larger than the first half: this is the line people remember.' },
      { id: 'strap', t: 'type', box: [0.284, 0.855, 0.430, 0.036],
        role: 'body', weight: '700', fill: 'accent', align: 'center',
        fit: 'shrink', size: 0.022, min: 0.015,
        wants: 'One short line in the accent colour. A claim of your own, four or '
             + 'five words, said flatly.' },
    ],
  },

  /* ------------------------------------------------------------- h069
   * Measured: brand .045/.020; the cascade runs top-right to bottom-left
   * in four stations at roughly .55/.06, .40/.20, .24/.36, .30/.55, each
   * with a note to its left; closing block .630/.800.
   */
  h069: {
    id: 'h069', family: 'figure-cut', ground: 'paper', ref: 'h069',

    does: 'A staircase. Four cut-out figures descend the sheet from the top right '
        + 'to the bottom left, each with a small dated note beside it, and a block '
        + 'of closing copy at the foot. It is a timeline that never says it is a '
        + 'timeline: the eye walks down the steps and reads the change as it goes. '
        + 'For anything with an order to it — a progression, a history, a set of '
        + 'stages.',
    avoid: 'Needs four separate cut-outs, which is the most expensive layout in '
         + 'the set to fill. Useless for a single idea; the staircase implies '
         + 'sequence and a reader will look for one whether you meant it or not.',

    slots: [
      { id: 'brand', t: 'type', box: [0.045, 0.020, 0.280, 0.030],
        role: 'grotesque', weight: '700', fill: 'mark',
        fit: 'shrink', size: 0.021, min: 0.014, wants: 'A mark or a name, top left.' },
      { id: 'era', t: 'type', box: [0.620, 0.020, 0.340, 0.030],
        role: 'body', weight: '500', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.018, min: 0.012,
        wants: 'A span, top right. Where the staircase starts and ends.' },

      { id: 'figA', t: 'art', role: 'figure', box: [0.480, 0.045, 0.260, 0.190],
        treat: 'contain', wants: 'The first station of the staircase, highest and '
             + 'furthest right. One cut-out figure.' },
      { id: 'noteA', t: 'type', box: [0.120, 0.095, 0.230, 0.055],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.4,
        wants: 'A label and a date for the first station. Two short lines.' },

      { id: 'figB', t: 'art', role: 'figure', box: [0.330, 0.200, 0.260, 0.200],
        treat: 'contain', wants: 'The second station, a step down and left.' },
      { id: 'noteB', t: 'type', box: [0.075, 0.240, 0.230, 0.055],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.4,
        wants: 'Label and date for the second station.' },

      { id: 'figC', t: 'art', role: 'figure', box: [0.300, 0.360, 0.300, 0.230],
        treat: 'contain', wants: 'The third station.' },
      { id: 'noteC', t: 'type', box: [0.075, 0.400, 0.210, 0.055],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.4,
        wants: 'Label and date for the third station.' },

      { id: 'figD', t: 'art', role: 'figure', box: [0.300, 0.540, 0.420, 0.440],
        treat: 'contain',
        wants: 'The last station, largest and nearest, at the foot of the stairs. '
             + 'It is the present tense of whatever the sequence is about.' },
      { id: 'noteD', t: 'type', box: [0.075, 0.560, 0.200, 0.055],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.4,
        wants: 'Label and date for the last station.' },

      { id: 'close', t: 'type', box: [0.620, 0.720, 0.320, 0.040],
        role: 'display', weight: '800', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.034, min: 0.020,
        wants: 'The conclusion in three or four words, bottom right, heavy.' },
      { id: 'closeBody', t: 'type', box: [0.620, 0.780, 0.320, 0.150],
        role: 'body', weight: '500', fill: 'mark', align: 'right',
        fit: 'wrap', size: 0.015, min: 0.011, leading: 1.5,
        wants: 'Four to six short lines under it. What the sequence adds up to.' },
    ],
  },

  /* ------------------------------------------------------------- h070
   * Measured: the vignette is a circle inscribed in .043/.075 to
   * .955/.905; labels on all four corners at .030 and .945; type block
   * left .055/.200; column right .530/.245. Reference is 736x981.
   */
  h070: {
    id: 'h070', family: 'figure-cut', ground: 'ink', ref: 'h070',

    does: 'A portrait inside a circular vignette, with the subject allowed to '
        + 'break the edge of it, and a two-part line laid across the left where '
        + 'the second part is knocked out of a small solid bar. The circle reads '
        + 'as a lens; anything crossing it reads as coming out of the sheet. Four '
        + 'corner labels hold the frame square around the round picture, which is '
        + 'the tension the whole thing runs on.',
    avoid: 'Needs a portrait shot close, from slightly above, with something in '
         + 'the hands. A distant or waist-up shot leaves the circle mostly empty '
         + 'and the labels then look like a border for nothing.',

    slots: [
      { id: 'tagTL', t: 'type', box: [0.045, 0.030, 0.300, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.10,
        wants: 'A category, top left, caps, small.' },
      { id: 'tagTR', t: 'type', box: [0.640, 0.030, 0.310, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.10,
        wants: 'A second category, top right. The pair frames the picture.' },
      { id: 'portrait', t: 'art', role: 'portrait', box: [0.043, 0.075, 0.912, 0.830],
        mask: 'ellipse',
        wants: 'A face shot close and from slightly above, holding something. It '
             + 'is masked to a circle, so the subject should reach the edge of the '
             + 'frame rather than sit politely inside it.' },
      { id: 'lineA', over: 'art', t: 'type', box: [0.055, 0.195, 0.330, 0.090],
        role: 'display', weight: '800', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.052, min: 0.030, leading: 1.0,
        wants: 'Two words over the picture, upper case, stacked. The first half '
             + 'of a claim.' },
      { id: 'barB', over: 'art', t: 'rect', box: [0.055, 0.288, 0.235, 0.048],
        fill: 'mark' },
      { id: 'lineB', over: 'art', t: 'type', box: [0.065, 0.292, 0.215, 0.040],
        role: 'display', weight: '800', fill: 'ground', track: -0.02,
        fit: 'shrink', size: 0.040, min: 0.024, vAlign: 'middle',
        wants: 'The second half, knocked out of a solid bar. Two words at most.' },
      { id: 'column', over: 'art', t: 'type', box: [0.560, 0.245, 0.220, 0.130],
        role: 'body', weight: '600', fill: 'mark',
        fit: 'wrap', size: 0.020, min: 0.014, leading: 1.35,
        wants: 'Three or four short lines on the right, over the picture. The '
             + 'reason the claim holds.' },
      { id: 'sticker', over: 'art', t: 'type', box: [0.545, 0.585, 0.130, 0.055],
        role: 'body', weight: '600', fill: 'mark',
        fit: 'wrap', size: 0.016, min: 0.011, leading: 1.3,
        wants: 'Two words on a small note stuck to the subject. An aside in their '
             + 'own voice.' },
      { id: 'tagBL', t: 'type', box: [0.045, 0.945, 0.300, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.10,
        wants: 'The category again, bottom left. Repetition is the frame.' },
      { id: 'tagBC', t: 'type', box: [0.360, 0.945, 0.280, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.10,
        wants: 'A handle, bottom centre.' },
      { id: 'tagBR', t: 'type', box: [0.660, 0.945, 0.290, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.10,
        wants: 'A second label, bottom right.' },
    ],
  },

  /* ------------------------------------------------------------- h077
   * Measured: head .141/.076 .758x.169; dots .820/.030 .150x.018;
   * rule .045/.060 to .955; arrow .075/.455 .045x.045; body .075/.510
   * .270x.130; figure .500/.180 .500x.820.
   */
  h077: {
    id: 'h077', family: 'figure-cut', ground: 'paper', ref: 'h077',

    does: 'A two-line question across the top, a figure occupying the right half '
        + 'with small marks attached to them, and a short answer at the lower left '
        + 'behind a round arrow. It is the most conventional composition in the '
        + 'set and the easiest to fill: the question is the hook, the figure is the '
        + 'evidence, and the answer is the reason to keep reading.',
    avoid: 'Do not use it when the answer is obvious from the question. The layout '
         + 'gives the answer its own quiet corner, and a corner holding nothing '
         + 'new is the most visible kind of empty.',

    slots: [
      { id: 'rule', t: 'rect', box: [0.045, 0.058, 0.910, 0.003], fill: 'mark',
        alpha: 0.5 },
      { id: 'dots', t: 'grid', box: [0.800, 0.028, 0.155, 0.018],
        cols: 7, rows: 1, gap: 0.15, fill: 'mark', first: 'accent',
        wants: 'A progress row. It says this is one of several.' },
      { id: 'head', t: 'type', box: [0.140, 0.075, 0.760, 0.170],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.078, min: 0.042, leading: 1.08,
        wants: 'A question, two lines, ending in a question mark. It names a '
             + 'situation the reader is already in — not a riddle.' },
      { id: 'arrow', t: 'rect', box: [0.072, 0.450, 0.052, 0.042],
        r: 'pill', fill: 'accent' },
      { id: 'body', t: 'type', box: [0.072, 0.505, 0.290, 0.140],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.021, min: 0.014, leading: 1.4,
        wants: 'Three or four lines answering the question, with two or three '
             + 'words set bold inside them. The bold words are the promise; the '
             + 'rest is how it is kept.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.480, 0.170, 0.520, 0.830],
        treat: 'contain',
        wants: 'One person from the shoulders up, thinking, looking away. Small '
             + 'marks may be attached to them. They fill the right half from just '
             + 'under the headline to the foot.' },
    ],
  },

  /* ------------------------------------------------------------- h008
   * Measured: the four fragments step across .06/.05, .40/.09, .04/.19,
   * .34/.24, each about .105 tall; the object hangs .300/.055 down to
   * .560; caption .220/.770 .400x.075; credit .420/.900.
   */
  h008: {
    id: 'h008', family: 'object-hero', ground: 'paper', ref: 'h008',

    does: 'One short sentence broken into four fragments that step down the sheet, '
        + 'with a single object hanging through the middle of them. The type is a '
        + 'Didone italic set large, so it reads as a voice rather than a headline, '
        + 'and the object is the only thing on the sheet that is not a word. For '
        + 'anything that should sound said out loud rather than published.',
    avoid: 'The sentence has to be short enough that four fragments is natural — '
         + 'five or six words in total. A clause forced into four pieces reads as '
         + 'a ransom note. Not for anything instructional.',

    slots: [
      { id: 'w1', t: 'type', box: [0.055, 0.050, 0.330, 0.110],
        role: 'didoneItalic', fill: 'mark',
        fit: 'shrink', size: 0.140, min: 0.060, vAlign: 'bottom',
        wants: 'The first fragment. One word.' },
      { id: 'w2', t: 'type', box: [0.400, 0.090, 0.330, 0.110],
        role: 'didoneItalic', fill: 'mark',
        fit: 'shrink', size: 0.140, min: 0.060, vAlign: 'bottom',
        wants: 'The second fragment, stepped right and down.' },
      { id: 'w3', t: 'type', box: [0.040, 0.190, 0.290, 0.110],
        role: 'didoneItalic', fill: 'mark',
        fit: 'shrink', size: 0.140, min: 0.060, vAlign: 'bottom',
        wants: 'The third, back to the left margin.' },
      { id: 'w4', t: 'type', box: [0.340, 0.240, 0.450, 0.115],
        role: 'didoneItalic', fill: 'mark',
        fit: 'shrink', size: 0.145, min: 0.060, vAlign: 'bottom',
        wants: 'The last fragment, carrying the punctuation. This is the one that '
             + 'has to land.' },
      { id: 'object', t: 'art', role: 'object', box: [0.290, 0.050, 0.160, 0.510],
        treat: 'contain',
        wants: 'One object hanging or falling through the type, taller than it is '
             + 'wide. It interrupts the sentence rather than illustrating it.' },
      { id: 'caption', t: 'type', box: [0.220, 0.770, 0.420, 0.080],
        role: 'didoneItalic', fill: 'mark',
        fit: 'wrap', size: 0.032, min: 0.020, leading: 1.18, align: 'center',
        wants: 'Two lines at the foot, in the same voice as the headline. The '
             + 'reason the sentence was said.' },
      { id: 'credit', t: 'type', box: [0.380, 0.900, 0.240, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center', alpha: 0.7,
        fit: 'shrink', size: 0.013, min: 0.010, wants: 'A maker credit, tiny.' },
    ],
  },

  /* ------------------------------------------------------------- h017
   * Measured: stamp .132/.033 .735x.213; object .100/.160 .800x.590;
   * bubble .700/.170 .200x.115; foot .050/.774 .866x.203.
   */
  h017: {
    id: 'h017', family: 'object-hero', ground: 'amber', ref: 'h017',

    does: 'A loud instruction stamped across the top, one drawn object filling the '
        + 'middle on a jagged burst, a small speech bubble contradicting the '
        + 'instruction, and a resigned line at the foot. It is a joke with a '
        + 'structure: the stamp shouts, the bubble panics, the foot gives up. Any '
        + 'subject where urgency and reluctance are both true.',
    avoid: 'Do not use it earnestly. The stamp and the burst are cartoon devices '
         + 'and a sincere message set in them reads as a parody of itself.',

    slots: [
      { id: 'stamp', t: 'type', box: [0.130, 0.030, 0.740, 0.120],
        role: 'black', fill: 'mark', align: 'center', track: 0.02,
        fit: 'shrink', size: 0.150, min: 0.060,
        wants: 'Two or three words, caps, with an exclamation mark. The command. '
             + 'It is set as a rubber stamp, so it has to be an imperative.' },
      { id: 'object', t: 'art', role: 'object', box: [0.100, 0.160, 0.800, 0.590],
        treat: 'contain',
        wants: 'One object, drawn or photographed, filling the middle at an angle. '
             + 'Whatever the command is about.' },
      { id: 'bubble', t: 'type', box: [0.700, 0.170, 0.210, 0.070],
        role: 'script', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.042, min: 0.024, vAlign: 'middle',
        wants: 'One word in a speech bubble. The object answering back. It has to '
             + 'undercut the stamp, not agree with it.' },
      { id: 'foot', t: 'type', box: [0.050, 0.775, 0.870, 0.200],
        role: 'display', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.090, min: 0.048, leading: 1.10,
        wants: 'Two lines, lower case, trailing off in an ellipsis. The shrug '
             + 'after the shout.' },
    ],
  },

  /* ------------------------------------------------------------- h019
   * Measured: head .216/.133 .569x.104; columns .215/.245 and
   * .575/.245, .210x.055 each; middle .400/.400 .200x.070; line
   * .380/.490 .240x.030; photo from .560 down.
   */
  h019: {
    id: 'h019', family: 'object-hero', ground: 'paper', ref: 'h019',

    does: 'An acronym set heavy and centred, glossed by two small blocks of caps '
        + 'that read as a definition, then two centred lines of the same small '
        + 'caps trailing off, and a photograph occupying the bottom half. It is '
        + 'built like a dictionary entry that turns into a confession. For naming '
        + 'a thing everyone recognises and nobody has words for.',
    avoid: 'Needs a word worth defining — a coinage, an acronym, a piece of slang. '
         + 'A plain noun in the hero slot leaves the definition blocks with '
         + 'nothing to do.',

    slots: [
      { id: 'head', t: 'type', box: [0.215, 0.125, 0.570, 0.115],
        role: 'black', fill: 'mark', align: 'center', track: -0.01,
        fit: 'shrink', size: 0.145, min: 0.060, vAlign: 'bottom',
        wants: 'The word, caps, 4 to 6 letters. An acronym or a coinage.' },
      { id: 'defL', t: 'type', box: [0.215, 0.245, 0.220, 0.055],
        role: 'grotesque', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.020, min: 0.014, leading: 1.28,
        wants: 'Two short lines of caps, left. Half of a definition, stated as a '
             + 'rule.' },
      { id: 'defR', t: 'type', box: [0.565, 0.245, 0.220, 0.055],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'right',
        fit: 'wrap', size: 0.020, min: 0.014, leading: 1.28,
        wants: 'The other half, right, inverting the first. The pair is the joke.' },
      { id: 'middle', t: 'type', box: [0.370, 0.395, 0.260, 0.080],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center',
        fit: 'wrap', size: 0.018, min: 0.012, leading: 1.35,
        wants: 'Three very short centred lines. What the thing does to you.' },
      { id: 'trail', t: 'type', box: [0.360, 0.490, 0.280, 0.032],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.022, min: 0.015,
        wants: 'One word and an ellipsis, centred. It hands over to the picture.' },
      { id: 'photo', t: 'art', role: 'objects', box: [0.280, 0.560, 0.450, 0.440],
        wants: 'A photographed detail, cropped tight and running off the bottom '
             + 'edge. Close enough to be a texture rather than a subject.' },
    ],
  },

  /* ------------------------------------------------------------- h029
   * Measured: script over .400/.030 .320x.060; head .100/.075 .800x.105;
   * script after .730/.145 .180x.070; object .220/.250 .580x.430;
   * butt .120/.700 .200x.090; close .215/.770 .690x.130; rule .900.
   */
  h029: {
    id: 'h029', family: 'object-hero', ground: 'paper', ref: 'h029',

    does: 'A confession in three registers: a script phrase riding above the line, '
        + 'a heavy roman statement, and a script phrase falling off the end of it, '
        + 'with a drawn object burning in the middle and the admission underlined '
        + 'at the foot. The mixture of scripts and romans is what makes it read as '
        + 'a thought rather than a headline. For admitting something.',
    avoid: 'Only works as a first-person admission. Written as advice it becomes '
         + 'a motivational poster, which is the opposite of the intended tone.',

    slots: [
      { id: 'over', t: 'type', box: [0.390, 0.025, 0.340, 0.062],
        role: 'script', fill: 'mark',
        fit: 'shrink', size: 0.048, min: 0.028, vAlign: 'bottom',
        wants: 'Two or three words in script, riding above the statement. The '
             + 'first half of the admission.' },
      { id: 'head', t: 'type', box: [0.095, 0.075, 0.810, 0.105],
        role: 'didone', weight: '700', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.130, min: 0.055, vAlign: 'bottom',
        wants: 'Two words, heavy roman. The statement itself.' },
      { id: 'after', t: 'type', box: [0.720, 0.140, 0.200, 0.075],
        role: 'script', fill: 'mark',
        fit: 'shrink', size: 0.052, min: 0.028, vAlign: 'bottom',
        wants: 'One word in script, falling off the end of the statement.' },
      { id: 'object', t: 'art', role: 'object', box: [0.210, 0.245, 0.590, 0.440],
        treat: 'contain',
        wants: 'One object in trouble — on fire, breaking, falling. Drawn rather '
             + 'than photographed suits this sheet, but either works.' },
      { id: 'but', t: 'type', box: [0.115, 0.695, 0.220, 0.090],
        role: 'script', fill: 'mark',
        fit: 'shrink', size: 0.060, min: 0.032, vAlign: 'bottom',
        wants: 'One word: the turn. "But", "Except", "Only".' },
      { id: 'close', t: 'type', box: [0.210, 0.770, 0.700, 0.110],
        role: 'script', fill: 'mark',
        fit: 'shrink', size: 0.125, min: 0.050, vAlign: 'bottom',
        wants: 'The admission, in script, four or five words. This is the line '
             + 'that gets screenshotted, so it has to be the honest one.' },
      { id: 'underline', t: 'rect', box: [0.290, 0.895, 0.620, 0.007],
        r: 'pill', fill: 'accent' },
    ],
  },

  /* ------------------------------------------------------------- h036
   * Measured: labels .050/.088, .400/.088, .860/.088; object
   * .290/.270 .430x.460; screen line inside it; foot .283/.808
   * .435x.020.
   */
  h036: {
    id: 'h036', family: 'object-hero', ground: 'paper', ref: 'h036',

    does: 'Almost nothing: three tiny labels on one line near the top, one object '
        + 'centred with two words on its face, and one line at the foot. The '
        + 'restraint is the whole design — every element removed makes the object '
        + 'louder. For a statement of what you do, when the point is that it needs '
        + 'no explaining.',
    avoid: 'It cannot carry an argument. Anything added to it — a second line, a '
         + 'caption, a logo — collapses the effect immediately, because the effect '
         + 'is the emptiness.',

    slots: [
      { id: 'labelL', t: 'type', box: [0.045, 0.085, 0.180, 0.022],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.7,
        fit: 'shrink', size: 0.014, min: 0.010, wants: 'A number or a code, left.' },
      { id: 'labelC', t: 'type', box: [0.380, 0.085, 0.240, 0.022],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.014, min: 0.010, wants: 'A name, centred.' },
      { id: 'labelR', t: 'type', box: [0.780, 0.085, 0.180, 0.022],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.7,
        fit: 'shrink', size: 0.014, min: 0.010, wants: 'A year, right.' },
      { id: 'object', t: 'art', role: 'object', box: [0.280, 0.260, 0.440, 0.480],
        treat: 'contain',
        wants: 'One object, centred, with a face or a surface that can carry two '
             + 'words. A screen, a sign, a label, a box.' },
      { id: 'face', over: 'art', t: 'type', box: [0.365, 0.360, 0.270, 0.100],
        role: 'display', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.046, min: 0.026, leading: 1.06, vAlign: 'middle',
        wants: 'Two words on the face of the object. What you do, said in the '
             + 'plainest possible terms.' },
      { id: 'foot', t: 'type', box: [0.240, 0.805, 0.520, 0.024],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.016, min: 0.011,
        wants: 'One line, caps, centred. A claim about how you do it.' },
    ],
  },

  /* ------------------------------------------------------------- h053
   * Measured: object .180/.020 .180x.270; head .380/.195 .545x.360;
   * note .580/.600 .345x.075; credit .040/.880 .295x.055.
   */
  h053: {
    id: 'h053', family: 'object-hero', ground: 'paper', ref: 'h053',

    does: 'A four-line statement set flush right in the lower right, one object '
        + 'hanging into the top left, and two blocks of small type at opposite '
        + 'corners. Almost all the sheet is empty, and the diagonal between the '
        + 'object and the type is what holds it. For a line that is best delivered '
        + 'flatly, with nothing helping it.',
    avoid: 'The statement has to survive being set in four short lines with no '
         + 'emphasis anywhere. If it needs a word picked out, use a layout that '
         + 'has somewhere to pick one out.',

    slots: [
      { id: 'object', t: 'art', role: 'object', box: [0.170, 0.020, 0.200, 0.280],
        treat: 'contain',
        wants: 'One object hanging into the top left corner, small. It is a '
             + 'counterweight to the type, not an illustration of it.' },
      { id: 'head', t: 'type', box: [0.370, 0.190, 0.560, 0.370],
        role: 'display', weight: '700', fill: 'mark', align: 'right', track: -0.02,
        fit: 'shrink', size: 0.094, min: 0.045, leading: 1.06,
        wants: 'One sentence in four short lines, flush right. Flat, spoken, no '
             + 'punctuation at the end.' },
      { id: 'note', t: 'type', box: [0.560, 0.598, 0.365, 0.085],
        role: 'body', weight: '500', fill: 'mark', align: 'right',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.35,
        wants: 'Three or four small lines, flush right under the statement. The '
             + 'aside that makes it land — quieter, and more specific.' },
      { id: 'credit', t: 'type', box: [0.040, 0.878, 0.320, 0.060],
        role: 'display', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.024, min: 0.016, leading: 1.20,
        wants: 'Two lines bottom left. A name for the thing, like a club or a '
             + 'series.' },
    ],
  },

  /* ------------------------------------------------------------- h057
   * Measured: head .066/.043 .867x.175; three credit columns at .066,
   * .295 and .545, y .250, .200x.075; photo .220/.380 .740x.590.
   */
  h057: {
    id: 'h057', family: 'object-hero', ground: 'paper', ref: 'h057',

    does: 'One word set to the full width of the sheet with the letters spaced '
        + 'apart, three columns of small credits under it, and a photographed '
        + 'object filling the bottom two thirds. It is a theatre bill, and it '
        + 'works because the word is treated as a poster rather than as a '
        + 'sentence. For a single loaded question or a single loaded noun.',
    avoid: 'One word only. Two words at this width become unreadable, and the '
         + 'credits under it stop looking like credits and start looking like a '
         + 'caption nobody wrote.',

    slots: [
      { id: 'head', t: 'type', box: [0.060, 0.040, 0.880, 0.180],
        role: 'grotesque', weight: '800', fill: 'mark', track: 0.06,
        fit: 'shrink', size: 0.175, max: 0.180, min: 0.080, vAlign: 'bottom',
        wants: 'ONE word, caps, 3 to 5 letters, letterspaced to the full width. '
             + 'A question word carries this best.' },
      { id: 'colA', t: 'type', box: [0.062, 0.248, 0.200, 0.080],
        role: 'grotesque', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.30, track: 0.05,
        wants: 'Three short lines of caps. Who or what this is.' },
      { id: 'colB', t: 'type', box: [0.290, 0.248, 0.220, 0.080],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.30,
        wants: 'Three short lines. Names, or what was done.' },
      { id: 'colC', t: 'type', box: [0.540, 0.248, 0.240, 0.080],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.30,
        wants: 'Three short lines. When and where.' },
      { id: 'object', t: 'art', role: 'object', box: [0.210, 0.375, 0.760, 0.600],
        wants: 'One object photographed against nothing, large, running off the '
             + 'bottom right. It should be ordinary — the size is what makes it '
             + 'strange.' },
    ],
  },

  /* ------------------------------------------------------------- h058
   * Measured: opening .040/.030 .660x.055; head .320/.115 .400x.230;
   * noteR .600/.345 .310x.055; noteL .020/.405 .290x.050; object
   * .280/.395 .440x.400; boxed .320/.835 .300x.040; closing
   * .030/.900 .220x.085; barcode .680/.930 .270x.050.
   */
  h058: {
    id: 'h058', family: 'object-hero', ground: 'paper', ref: 'h058',

    does: 'A halftoned object floating in the middle of a sheet with small type '
        + 'scattered around it at four corners, and a serif statement across the '
        + 'top that breaks apart as it reaches the object. The scattered notes are '
        + 'meant to be read in any order — it is a page of marginalia with one '
        + 'picture in it. For something with more than one thing to say and no '
        + 'obvious order to say them in.',
    avoid: 'It needs six separate short pieces of copy, none of them dependent on '
         + 'another. A single argument broken into six parts reads as a mess, '
         + 'because the layout gives no clue which part comes first.',

    slots: [
      { id: 'opening', t: 'type', box: [0.035, 0.028, 0.670, 0.058],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.021, min: 0.014, leading: 1.30,
        wants: 'Two lines at the very top, small. A statement that sounds like the '
             + 'middle of a conversation.' },
      { id: 'head', t: 'type', box: [0.300, 0.110, 0.440, 0.235],
        role: 'didone', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.075, min: 0.040, leading: 1.12,
        wants: 'Three lines of serif, centred. A statement whose last line should '
             + 'be the one that hurts.' },
      { id: 'noteR', t: 'type', box: [0.590, 0.343, 0.320, 0.058],
        role: 'body', weight: '500', fill: 'mark', align: 'right',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.30,
        wants: 'Two small lines to the right of the object.' },
      { id: 'noteL', t: 'type', box: [0.018, 0.403, 0.300, 0.055],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.30,
        wants: 'Two small lines to the left of the object.' },
      { id: 'object', t: 'art', role: 'object', box: [0.270, 0.390, 0.460, 0.410],
        treat: 'halftone', pitch: 0.009,
        wants: 'One object, centred, screened to a coarse halftone. Ordinary and '
             + 'recognisable in silhouette — the screen removes everything else.' },
      { id: 'boxed', t: 'type', box: [0.310, 0.832, 0.320, 0.042],
        role: 'body', weight: '500', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.017, min: 0.012, vAlign: 'middle',
        wants: 'One line in a box under the object. The plainest thing on the '
             + 'sheet, and usually the truest.' },
      { id: 'boxedFrame', t: 'rect', box: [0.310, 0.832, 0.320, 0.042],
        stroke: true, fill: 'mark' },
      { id: 'closing', t: 'type', box: [0.028, 0.895, 0.240, 0.090],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.016, min: 0.011, leading: 1.30,
        wants: 'Four small lines bottom left. The last word, said quietly.' },
      { id: 'barcode', t: 'barcode', box: [0.680, 0.928, 0.270, 0.050], fill: 'mark' },
      { id: 'barLabel', t: 'type', box: [0.680, 0.905, 0.270, 0.020],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center', track: 0.30,
        fit: 'shrink', size: 0.012, min: 0.009,
        wants: 'Two words over the barcode, spaced out. A season, a filing.' },
    ],
  },

  /* ------------------------------------------------------------- h064
   * Measured: head .100/.095 .790x.150; photo .270/.270 .700x.590;
   * rule .380/.870 .240x.004; mark .420/.890 .160x.045.
   */
  h064: {
    id: 'h064', family: 'object-hero', ground: 'paper', ref: 'h064',

    does: 'A headline that switches from roman to italic partway through, a '
        + 'photograph of a scene rather than an object below it, and a short rule '
        + 'with a mark under it at the foot. Everything is centred low on the '
        + 'sheet with a lot of air above, which is what makes it read as a '
        + 'considered piece rather than a post. For naming a problem you are about '
        + 'to write about at length.',
    avoid: 'The italic has to fall on the words that are the actual subject. '
         + 'Switching on a connective makes the whole device look like a font that '
         + 'ran out.',

    slots: [
      { id: 'head', t: 'type', box: [0.095, 0.090, 0.800, 0.155],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.078, min: 0.042, leading: 1.06,
        italicFrom: 2,
        wants: 'A noun phrase in three lines. The last line or two turn italic, so '
             + 'put the actual subject there: "the problem with the / creative '
             + 'economy". The italic is the part being named.' },
      { id: 'photo', t: 'art', role: 'scene', box: [0.260, 0.265, 0.710, 0.590],
        wants: 'A photograph of a situation rather than an object — somebody in '
             + 'the middle of the problem the headline names. Cut out or on a '
             + 'plain ground, and running off the right edge.' },
      { id: 'rule', t: 'rect', box: [0.375, 0.868, 0.250, 0.004], fill: 'mark' },
      { id: 'mark', t: 'type', box: [0.375, 0.888, 0.250, 0.048],
        role: 'didone', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.034, min: 0.020,
        wants: 'A short mark under the rule. Initials or a number, not a sentence.' },
    ],
  },

  /* ------------------------------------------------------------- h004
   * Measured: kicker .273/.037 .454x.030; head .250/.068 .500x.060;
   * swipe .380/.108 .240x.024; picture .034/.125 .931x.875.
   */
  h004: {
    id: 'h004', family: 'photo-full', ground: 'paper', ref: 'h004',

    does: 'A tutorial card: a small line saying what is being made, the name of '
        + 'the thing set heavy under it, an instruction to swipe, and then the '
        + 'thing itself filling everything below. Entirely functional, and it is '
        + 'the most reliable opener in the set because the reader knows within a '
        + 'second what they will get for staying.',
    avoid: 'It promises a series. Using it for a single post that does not go '
         + 'anywhere is the fastest way to teach people to scroll past you.',

    slots: [
      { id: 'kicker', t: 'type', box: [0.250, 0.032, 0.500, 0.032],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center', track: 0.02,
        fit: 'shrink', size: 0.030, min: 0.018,
        wants: 'Three or four words, caps. What this shows you how to do.' },
      { id: 'head', t: 'type', box: [0.200, 0.066, 0.600, 0.062],
        role: 'black', fill: 'mark', align: 'center', track: -0.01,
        fit: 'shrink', size: 0.070, min: 0.036, vAlign: 'bottom',
        wants: 'The name of the thing, caps, two words. It is the searchable part '
             + 'of the whole post.' },
      { id: 'swipe', t: 'type', box: [0.350, 0.106, 0.300, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center',
        alpha: 0.75, fit: 'shrink', size: 0.021, min: 0.014,
        wants: 'Two or three words and an arrow. The instruction.' },
      { id: 'photo', t: 'art', role: 'scene', box: [0.034, 0.150, 0.932, 0.820],
        wants: 'The finished thing, shown large enough to judge. Whatever the '
             + 'headline named — a screen, a surface, a result.' },
    ],
  },

  /* ------------------------------------------------------------- h005
   * Measured: rail .034/.014 .840x.028 in three cells; head1 .122/.185
   * .400x.070; head2 .122/.245 .762x.105; strap .122/.355 .762x.030;
   * body .034/.900 .900x.075.
   */
  h005: {
    id: 'h005', family: 'photo-full', ground: 'ink', ref: 'h005',

    does: 'A refusal and a replacement: two words telling you to stop, one word '
        + 'naming what to stop, a row of small caps offering the alternative, and '
        + 'a paragraph at the foot. Set over a full-bleed photograph with the '
        + 'second line in the accent colour. It works because it takes something '
        + 'away before it offers anything, which is the opposite of how most '
        + 'advice is written.',
    avoid: 'You have to actually name the replacement. A sheet that says stop '
         + 'without saying what instead is a complaint, and a complaint is not a '
         + 'hook.',

    slots: [
      { id: 'railL', t: 'type', box: [0.055, 0.030, 0.240, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.04,
        wants: 'A date, caps, top left.' },
      { id: 'railC', t: 'type', box: [0.380, 0.030, 0.260, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.04,
        wants: 'A handle, centred.' },
      { id: 'railR', t: 'type', box: [0.700, 0.030, 0.250, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.04,
        wants: 'A category, right.' },
      { id: 'photo', t: 'art', role: 'scene', box: [0, 0.075, 1, 0.925],
        wants: 'A wide photograph with a lot of one texture in it — grass, water, '
             + 'a wall — because four blocks of type sit on it and it has to stay '
             + 'quiet under them.' },
      { id: 'head1', over: 'art', t: 'type', box: [0.120, 0.180, 0.420, 0.072],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.090, min: 0.045, vAlign: 'bottom',
        wants: 'Two words, lower case. The refusal.' },
      { id: 'head2', over: 'art', t: 'type', box: [0.120, 0.245, 0.765, 0.108],
        role: 'display', weight: '800', fill: 'accent', track: -0.03,
        fit: 'shrink', size: 0.135, min: 0.060, vAlign: 'bottom',
        wants: 'ONE word in the accent colour, lower case, filling the width. The '
             + 'thing to stop.' },
      { id: 'strap', over: 'art', t: 'type', box: [0.120, 0.360, 0.765, 0.030],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.03,
        fit: 'shrink', size: 0.024, min: 0.016,
        wants: 'One line of caps offering the alternative, with the last word or '
             + 'two picked out. Spaced across the width.' },
      { id: 'body', over: 'art', t: 'type', box: [0.120, 0.895, 0.760, 0.075],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.019, min: 0.013, leading: 1.35,
        wants: 'Two lines at the foot listing what the alternative actually gives '
             + 'you. Concrete, not adjectives.' },
    ],
  },

  /* ------------------------------------------------------------- h009
   * Measured: head .090/.155 .820x.360, four lines, the third knocked
   * into a pale bar; picture full bleed.
   */
  h009: {
    id: 'h009', family: 'photo-full', ground: 'paper', ref: 'h009',

    does: 'One long sentence in four lines across the upper half of a photograph, '
        + 'with the third line highlighted as though someone had dragged a cursor '
        + 'through it. The highlight is the whole idea: it makes the sheet look '
        + 'like a screen being read rather than a poster being shown, and the '
        + 'selected line is the claim you want repeated.',
    avoid: 'The highlighted line has to stand alone as a claim. Highlighting half '
         + 'a clause makes it look like a rendering fault.',

    slots: [
      { id: 'photo', t: 'art', role: 'scene', box: [0, 0, 1, 1],
        wants: 'A wide landscape with a lot of sky or open ground in the top half, '
             + 'because the sentence sits there, and something small and human in '
             + 'the bottom half.' },
      { id: 'head', over: 'art', t: 'type', box: [0.085, 0.150, 0.830, 0.370],
        role: 'display', weight: '700', fill: 'accent', track: -0.02,
        highlight: 'ground', highlightLines: [2], highlightText: 'accent',
        fit: 'wrap', size: 0.078, min: 0.040, leading: 1.14,
        wants: 'One sentence in four lines. The THIRD line is selected, so write '
             + 'the sentence so that the third line is the part worth quoting on '
             + 'its own.' },
    ],
  },

  /* ------------------------------------------------------------- h015
   * Measured: mark .470/.035 .060x.040; line1 .265/.300 .445x.055;
   * line2 .090/.355 .820x.110; line3 .170/.460 .660x.110; foot row
   * .034/.925.
   */
  h015: {
    id: 'h015', family: 'photo-full', ground: 'paper', ref: 'h015',

    does: 'A three-register headline stacked in the middle of a grainy photograph: '
        + 'a small italic setup, a heavy roman noun, and an italic in the accent '
        + 'colour under it. A row of interface marks sits at the foot. The photo '
        + 'is deliberately grainy and washed out so the type has somewhere to sit, '
        + 'which is what separates this from a quote over a stock picture.',
    avoid: 'The three lines have to be three different kinds of word — a phrase, a '
         + 'noun, a qualifier. Three nouns stacked reads as a list nobody wrote a '
         + 'sentence for.',

    slots: [
      { id: 'photo', t: 'art', role: 'scene', box: [0, 0, 1, 1],
        wants: 'A photograph with one figure in the lower half and a large plain '
             + 'area above them. Grainy or washed suits it; a crisp photograph '
             + 'fights the type.' },
      { id: 'mark', over: 'art', t: 'type', box: [0.450, 0.032, 0.100, 0.042],
        role: 'display', weight: '700', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.038, min: 0.022,
        wants: 'A single glyph at the top. An asterisk, a star, a mark.' },
      { id: 'line1', over: 'art', t: 'type', box: [0.260, 0.295, 0.460, 0.058],
        role: 'didoneItalic', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.052, min: 0.028, vAlign: 'bottom',
        wants: 'Three or four words in italic. The setup — usually a "how to".' },
      { id: 'line2', over: 'art', t: 'type', box: [0.085, 0.352, 0.830, 0.112],
        role: 'black', fill: 'mark', align: 'center', track: -0.01,
        fit: 'shrink', size: 0.140, min: 0.060, vAlign: 'bottom',
        wants: 'ONE word, caps, filling the width. The noun everything else '
             + 'qualifies.' },
      { id: 'line3', over: 'art', t: 'type', box: [0.165, 0.470, 0.670, 0.120],
        role: 'didoneItalic', fill: 'accent', align: 'center',
        fit: 'shrink', size: 0.115, min: 0.055, vAlign: 'bottom',
        wants: 'ONE word in italic in the accent colour. The qualifier that makes '
             + 'the noun specific.' },
      { id: 'footL', over: 'art', t: 'type', box: [0.045, 0.925, 0.300, 0.026],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.85,
        fit: 'shrink', size: 0.017, min: 0.012, wants: 'A handle, bottom left.' },
      { id: 'footC', over: 'art', t: 'type', box: [0.380, 0.925, 0.260, 0.026],
        role: 'body', weight: '500', fill: 'mark', align: 'center', alpha: 0.85,
        fit: 'shrink', size: 0.017, min: 0.012,
        wants: 'Two words centred. An instruction to keep it.' },
    ],
  },

  /* ------------------------------------------------------------- h016
   * Measured: head .045/.030 .910x.200 in four outlined lines; handle
   * .375/.925 .250x.038; picture full bleed.
   */
  h016: {
    id: 'h016', family: 'photo-full', ground: 'blue', ref: 'h016',

    does: 'Four lines of hollow capitals laid across the top of a bright '
        + 'photograph, so the picture shows through the letters. Outlined type is '
        + 'the point: it lets a headline sit over the middle of an image without '
        + 'covering the thing the image is of. A small pill with a handle sits at '
        + 'the foot.',
    avoid: 'Hollow letters need a busy picture behind them to be worth doing and '
         + 'a light one to stay readable. Over a dark or flat photograph they '
         + 'either vanish or look like a mistake.',

    slots: [
      { id: 'photo', t: 'art', role: 'scene', box: [0, 0, 1, 1],
        wants: 'A bright, high-contrast photograph with something odd in it. The '
             + 'headline is hollow, so the picture is doing half the work of the '
             + 'type.' },
      { id: 'head', over: 'art', t: 'type', box: [0.045, 0.028, 0.910, 0.205],
        role: 'black', fill: 'mark', outline: true, track: -0.01,
        fit: 'wrap', size: 0.068, min: 0.038, leading: 1.02,
        wants: 'A short sentence in four lines of caps, ending in an ellipsis. '
             + 'Something said in the middle of reacting to something, not a '
             + 'considered statement.' },
      { id: 'handlebg', over: 'art', t: 'rect', box: [0.360, 0.922, 0.280, 0.040],
        r: 'pill', stroke: true, fill: 'mark' },
      { id: 'handle', over: 'art', t: 'type', box: [0.360, 0.922, 0.280, 0.040],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.019, min: 0.013, vAlign: 'middle',
        wants: 'A handle in a pill at the foot.' },
    ],
  },

  /* ------------------------------------------------------------- h022
   * Measured: head .130/.400 .310x.155; picture full bleed.
   */
  h022: {
    id: 'h022', family: 'photo-full', ground: 'red', ref: 'h022',

    does: 'One saying, set small in four short lines, on a flat field of colour '
        + 'with a soft shadow falling across it. Nothing else at all. The type is '
        + 'deliberately far smaller than the sheet can carry, which is what makes '
        + 'it read as confident rather than loud.',
    avoid: 'Only for a line that is already known, or that sounds like it is. A '
         + 'new argument set this small at this scale is simply unread.',

    slots: [
      { id: 'photo', t: 'art', role: 'scene', box: [0, 0, 1, 1], tint: 'accent',
        wants: 'A texture, not a subject: a wall, a floor, a field of colour with '
             + 'a shadow across it. If it has a subject, this layout is wrong.' },
      { id: 'head', over: 'art', t: 'type', box: [0.125, 0.395, 0.340, 0.160],
        role: 'display', weight: '800', fill: 'mark', track: -0.005,
        fit: 'wrap', size: 0.040, min: 0.024, leading: 1.20,
        wants: 'One saying in four short lines of caps, ending in a full stop. '
             + 'Under twelve words.' },
    ],
  },

  /* ------------------------------------------------------------- h023
   * Measured: kicker .170/.285 .300x.038; head .170/.330 .700x.105;
   * picture full bleed.
   */
  h023: {
    id: 'h023', family: 'photo-full', ground: 'navy', ref: 'h023',

    does: 'A small qualifying clause and then the point, both flush left across '
        + 'the upper third of a photograph shot from below against sky. The '
        + 'qualifier is what makes it work: without it the line is a platitude, '
        + 'and with it the sheet reads as someone correcting themselves.',
    avoid: 'The two halves must disagree slightly. If the small line and the big '
         + 'line say the same thing, delete the small one and use a different '
         + 'layout.',

    slots: [
      { id: 'photo', t: 'art', role: 'portrait', box: [0, 0, 1, 1],
        wants: 'One person shot from below against a plain sky, in the lower half. '
             + 'The top half has to be empty enough to hold two lines of type.' },
      { id: 'kicker', over: 'art', t: 'type', box: [0.165, 0.280, 0.320, 0.040],
        role: 'display', weight: '700', fill: 'mark',
        fit: 'shrink', size: 0.034, min: 0.020, vAlign: 'bottom',
        wants: 'Three or four words, lower case, ending in a comma. The '
             + 'concession.' },
      { id: 'head', over: 'art', t: 'type', box: [0.165, 0.330, 0.710, 0.108],
        role: 'display', weight: '800', fill: 'mark', track: -0.025,
        fit: 'shrink', size: 0.100, min: 0.050, vAlign: 'bottom',
        wants: 'Three or four words, lower case, with a full stop. The point.' },
    ],
  },

  /* ------------------------------------------------------------- h025
   * Measured: head .295/.150 .600x.310 in three lines, the middle one
   * turning italic partway; picture full bleed.
   */
  h025: {
    id: 'h025', family: 'photo-full', ground: 'paper', ref: 'h025',

    does: 'A question in three lines set to the right of a photographed object, '
        + 'with one word inside it turned italic. The object and the question are '
        + 'about the same thing, but neither explains the other, and that gap is '
        + 'what makes a reader stop.',
    avoid: 'Needs a photograph with an obvious empty side. A centred subject '
         + 'leaves the question sitting on top of it, and this layout has no '
         + 'device for holding type over detail.',

    slots: [
      { id: 'photo', t: 'art', role: 'object', box: [0, 0, 1, 1],
        wants: 'One object photographed against a plain field, off to the left. '
             + 'Something that already means waiting, stopping, or deciding.' },
      { id: 'head', over: 'art', t: 'type', box: [0.290, 0.145, 0.620, 0.320],
        role: 'display', weight: '800', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.095, min: 0.045, leading: 1.20,
        wants: 'A question in three lines of caps, with ONE word set in italic. '
             + 'Put the italic on the word carrying the doubt.' },
    ],
  },

  /* ------------------------------------------------------------- h063
   * Measured: the wall of pictures fills .030/.020 to .970/.640; the
   * figure sits centred from .560 down; caption .045/.945.
   */
  h063: {
    id: 'h063', family: 'photo-full', ground: 'paper', ref: 'h063',

    does: 'A wall of small images with one still figure sitting under it, and '
        + 'almost no type at all. It is a picture of being overwhelmed, and it '
        + 'says so without a headline, which is why the one line of copy on it has '
        + 'to be a caption rather than a claim. For a post whose first frame is '
        + 'meant to be looked at rather than read.',
    avoid: 'It carries no argument. Use it only as an opener with something behind '
         + 'it — on its own it is a mood and nothing else.',

    slots: [
      { id: 'wall', t: 'art', role: 'crowd', box: [0.030, 0.020, 0.940, 0.620],
        wants: 'Many small images together, or one photograph of many things at '
             + 'once. Density is the subject.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.300, 0.540, 0.400, 0.440],
        treat: 'contain',
        wants: 'One person, still, seated or standing, under the wall. They are '
             + 'the only calm thing on the sheet.' },
      { id: 'caption', t: 'type', box: [0.045, 0.940, 0.400, 0.030],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.85,
        fit: 'shrink', size: 0.018, min: 0.012,
        wants: 'One line, small, bottom left. A caption, not a headline — it '
             + 'should sound like something muttered.' },
    ],
  },

  /* ------------------------------------------------------------- h074
   * Measured: head .069/.125 .750x.165 in three lines with the last
   * word italic; body .100/.320 .800x.150; picture from .520 down;
   * handle .045/.945; arrow .930/.945.
   */
  h074: {
    id: 'h074', family: 'photo-full', ground: 'ink', ref: 'h074',

    does: 'A claim in heavy accent-coloured caps whose final word turns to a '
        + 'serif italic, then a centred serif paragraph that says what the claim '
        + 'actually rests on, over a dark photograph occupying the bottom half. '
        + 'The paragraph is the unusual part: it argues rather than asserts, which '
        + 'is why this holds up as the first frame of something long.',
    avoid: 'The paragraph has to contradict the obvious reading of the headline. '
         + 'If it merely restates it, the sheet has two headlines and no argument.',

    slots: [
      { id: 'photo', t: 'art', role: 'crowd', box: [0, 0.500, 1, 0.500],
        wants: 'Several people together in low light, seen at a distance. It is '
             + 'the evidence for the headline, so it should show the thing rather '
             + 'than illustrate the feeling.' },
      { id: 'head', t: 'type', box: [0.065, 0.120, 0.760, 0.170],
        role: 'grotesque', weight: '800', fill: 'accent', track: 0.01,
        italicFrom: 2, italicRole: 'didoneItalic',
        fit: 'wrap', size: 0.058, min: 0.032, leading: 1.10,
        wants: 'A claim in three lines of caps. The LAST line turns to a serif '
             + 'italic, so end the sentence with the word that matters most.' },
      { id: 'body', t: 'type', box: [0.095, 0.315, 0.810, 0.155],
        role: 'didone', weight: '500', fill: 'mark', align: 'center',
        fit: 'wrap', size: 0.033, min: 0.020, leading: 1.28,
        wants: 'Three lines of serif, centred, ruling out the two obvious '
             + 'explanations before giving the real one. Ending on something '
             + 'somebody actually says out loud works best.' },
      { id: 'handle', t: 'type', box: [0.045, 0.940, 0.320, 0.028],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.75,
        fit: 'shrink', size: 0.016, min: 0.011, wants: 'A handle, bottom left.' },
    ],
  },

  /* ------------------------------------------------------------- h006
   * Measured: rail .045/.020 .910x.022; head .045/.055 .700x.075;
   * plate .045/.130 .560x.560; side .620/.130 .340x.560; foot
   * .045/.780 .910x.150; barcode .700/.900.
   */
  h006: {
    id: 'h006', family: 'editorial-grid', ground: 'paper', ref: 'h006',

    does: 'A specimen sheet. A fine graph grid under everything, a rail of small '
        + 'credits across the top, one heavy phrase, a bordered plate holding the '
        + 'picture, and columns of tiny annotation beside and under it. It reads '
        + 'as documentation rather than promotion, which is why a claim set on it '
        + 'is believed more readily than the same claim set on a poster.',
    avoid: 'It has room for a lot of small copy and it looks wrong without it. '
         + 'Half-filled, the grid shows through and the sheet reads as unfinished '
         + 'rather than as sparse.',

    slots: [
      { id: 'paper', t: 'grid', box: [0.030, 0.020, 0.940, 0.960],
        step: 0.020, fill: 'mark', alpha: 0.09 },
      { id: 'railL', t: 'type', box: [0.045, 0.020, 0.300, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.85,
        fit: 'shrink', size: 0.015, min: 0.010, wants: 'A handle, top left.' },
      { id: 'railR', t: 'type', box: [0.660, 0.020, 0.300, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.85,
        fit: 'shrink', size: 0.015, min: 0.010, wants: 'A year, top right.' },
      { id: 'head', t: 'type', box: [0.045, 0.050, 0.720, 0.078],
        role: 'display', weight: '700', fill: 'accent', track: -0.02,
        fit: 'shrink', size: 0.098, min: 0.048, vAlign: 'bottom',
        wants: 'Two words. The name of the thing being documented, not a claim '
             + 'about it.' },
      { id: 'plate', t: 'art', role: 'portrait', box: [0.055, 0.145, 0.540, 0.535],
        treat: 'halftone', pitch: 0.011, contrast: 1.6, gamma: 0.62,
        wants: 'One picture, screened coarse, sitting in a ruled frame like a '
             + 'plate in a manual. Anything with a strong silhouette.' },
      { id: 'frame', t: 'rect', box: [0.045, 0.135, 0.560, 0.555],
        stroke: true, fill: 'mark' },
      { id: 'side', t: 'type', box: [0.625, 0.145, 0.335, 0.400],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.015, min: 0.010, leading: 1.50,
        wants: 'A column of small annotation beside the plate. Specifications, '
             + 'observations, whatever a manual would put there. Dull on purpose.' },
      { id: 'label', t: 'type', box: [0.625, 0.600, 0.335, 0.060],
        role: 'grotesque', weight: '700', fill: 'mark',
        fit: 'shrink', size: 0.026, min: 0.016, leading: 1.15,
        wants: 'Two words in caps, the label for the plate.' },
      { id: 'foot', t: 'type', box: [0.045, 0.780, 0.600, 0.140],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.50,
        wants: 'Four or five lines of the smallest copy on the sheet. The actual '
             + 'point, buried where a manual would bury it.' },
      { id: 'barcode', t: 'barcode', box: [0.700, 0.880, 0.260, 0.055], fill: 'mark' },
    ],
  },

  /* ------------------------------------------------------------- h043
   * Measured: rail .045/.020; kicker .380/.070 .240x.026; head
   * .075/.100 .850x.230; texture .150/.330 .700x.400; foot
   * .045/.860 .910x.100.
   */
  h043: {
    id: 'h043', family: 'editorial-grid', ground: 'paper', ref: 'h043',

    does: 'A tutorial sheet set as a Didone title over graph paper, with a large '
        + 'soft texture in the middle and two short columns of instruction at the '
        + 'foot. The serif title is doing something specific: it says this is a '
        + 'method rather than a tip, and a method is worth saving.',
    avoid: 'The title has to name a technique, not a feeling. A Didone at this '
         + 'size over a grid promises rigour, and copy that does not deliver any '
         + 'reads as pretension.',

    slots: [
      { id: 'paper', t: 'grid', box: [0.030, 0.020, 0.940, 0.960],
        step: 0.018, fill: 'mark', alpha: 0.10 },
      { id: 'railL', t: 'type', box: [0.045, 0.020, 0.300, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.85,
        fit: 'shrink', size: 0.015, min: 0.010, wants: 'A handle, top left.' },
      { id: 'railR', t: 'type', box: [0.660, 0.020, 0.300, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.85,
        fit: 'shrink', size: 0.015, min: 0.010, wants: 'A source, top right.' },
      { id: 'kicker', t: 'type', box: [0.370, 0.068, 0.260, 0.028],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.06,
        wants: 'Two words in a small pill. What kind of thing this is.' },
      { id: 'head', t: 'type', box: [0.070, 0.098, 0.860, 0.235],
        role: 'didone', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.105, min: 0.050, leading: 1.02,
        wants: 'A title in two or three lines of serif. "How to" followed by a '
             + 'technique. It is the whole promise of the post.' },
      { id: 'texture', t: 'art', role: 'object', box: [0.150, 0.335, 0.700, 0.400],
        treat: 'halftone', pitch: 0.007,
        wants: 'One soft shape screened very fine, more texture than subject. It '
             + 'is there to prove the technique, so it should show the effect '
             + 'rather than the thing.' },
      { id: 'colL', t: 'type', box: [0.045, 0.860, 0.420, 0.110],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.50,
        wants: 'Four lines at the foot left. What the technique is.' },
      { id: 'colR', t: 'type', box: [0.540, 0.860, 0.420, 0.110],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.50,
        wants: 'Four lines at the foot right. What it is for.' },
    ],
  },

  /* ------------------------------------------------------------- h044
   * Measured: rail .045/.020 in three cells; head .045/.055 .880x.230;
   * object .120/.330 .760x.440; block .085/.790 .830x.170.
   */
  h044: {
    id: 'h044', family: 'editorial-grid', ground: 'ink', ref: 'h044',

    does: 'A bilingual event bill: a small foreign line above, the same thing in '
        + 'heavy caps under it, an object shouting out of the middle, and a block '
        + 'of listing type at the foot. Set on a dark grid. The doubled headline is '
        + 'the device — the second reading of the same words makes them feel '
        + 'official.',
    avoid: 'Do not fake the second language. If you have no second reading, use '
         + 'a subtitle in your own — the pattern is a restatement, not a '
         + 'translation.',

    slots: [
      { id: 'paper', t: 'grid', box: [0.030, 0.020, 0.940, 0.960],
        step: 0.018, fill: 'mark', alpha: 0.16 },
      { id: 'railL', t: 'type', box: [0.045, 0.018, 0.290, 0.055],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.8,
        fit: 'wrap', size: 0.013, min: 0.009, leading: 1.4,
        wants: 'Three tiny lines top left. A place and a date.' },
      { id: 'railR', t: 'type', box: [0.640, 0.018, 0.320, 0.055],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.8,
        fit: 'wrap', size: 0.013, min: 0.009, leading: 1.4,
        wants: 'Three tiny lines top right. Who is putting it on.' },
      { id: 'over', t: 'type', box: [0.045, 0.055, 0.700, 0.045],
        role: 'grotesque', weight: '700', fill: 'accent',
        fit: 'shrink', size: 0.042, min: 0.024, vAlign: 'bottom',
        wants: 'The headline said once, small, in another register — another '
             + 'language, a technical term, a shorter form.' },
      { id: 'head', t: 'type', box: [0.045, 0.105, 0.880, 0.185],
        role: 'black', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.098, min: 0.050, leading: 1.02,
        wants: 'The headline in two lines of caps, each ending in a full stop. '
             + 'A statement of what is happening.' },
      { id: 'object', t: 'art', role: 'object', box: [0.100, 0.330, 0.800, 0.440],
        treat: 'contain',
        wants: 'One object aimed out of the sheet — something that carries, '
             + 'projects or announces. It should break the grid rather than sit '
             + 'inside it.' },
      { id: 'listing', t: 'type', box: [0.085, 0.790, 0.700, 0.120],
        role: 'grotesque', weight: '700', fill: 'mark', track: 0.02,
        fit: 'wrap', size: 0.058, min: 0.028, leading: 1.10,
        wants: 'Two or three lines of caps at the foot. Where and when, set large '
             + 'enough to be the second thing read.' },
    ],
  },

  /* ------------------------------------------------------------- h045
   * Measured: card .240/.030 .520x.630; head inside it at .290/.100
   * .420x.480; figure .560/.330 .380x.560; free .045/.780 .300x.045;
   * code .045/.830 .240x.140.
   */
  h045: {
    id: 'h045', family: 'editorial-grid', ground: 'ink', ref: 'h045',

    does: 'A white card floating on a dark grid, with a four-line phrase inside it '
        + 'set in a face that changes line by line, a small figure walking out of '
        + 'the bottom of the card, and a QR block in the corner. The card is the '
        + 'device: it makes the phrase a specimen rather than a slogan.',
    avoid: 'Only works when the phrase can be broken across four lines with a gap '
         + 'in it. A phrase that reads straight through does not need the card and '
         + 'looks trapped in it.',

    slots: [
      { id: 'paper', t: 'grid', box: [0.030, 0.020, 0.940, 0.960],
        step: 0.020, fill: 'mark', alpha: 0.18 },
      { id: 'card', t: 'rect', box: [0.240, 0.030, 0.520, 0.630], fill: 'ground' },
      { id: 'cardTop', t: 'type', box: [0.270, 0.048, 0.460, 0.040],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.7,
        fit: 'wrap', size: 0.012, min: 0.009, leading: 1.4,
        wants: 'Two tiny lines at the top of the card. A field label, as though '
             + 'this were a form.' },
      { id: 'head', t: 'type', box: [0.270, 0.100, 0.460, 0.480],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.110, min: 0.055, leading: 1.30,
        wants: 'A phrase in four lines, lower case, with the words spaced apart '
             + 'so the gaps read as part of it. Under seven words in total.' },
      { id: 'figure', t: 'art', role: 'figure', box: [0.560, 0.340, 0.400, 0.560],
        treat: 'contain',
        wants: 'One small figure walking, seen whole and at a distance, coming out '
             + 'of the bottom of the card. Small on purpose: the card is the '
             + 'subject and the figure is the scale.' },
      { id: 'free', t: 'type', box: [0.045, 0.775, 0.320, 0.050],
        role: 'display', weight: '800', fill: 'mark',
        fit: 'shrink', size: 0.046, min: 0.026, vAlign: 'bottom',
        wants: 'Two words, heavy. What is on offer.' },
      { id: 'code', t: 'grid', box: [0.045, 0.835, 0.180, 0.140],
        step: 0.014, fill: 'mark', alpha: 0.9 },
    ],
  },

  /* ------------------------------------------------------------- h046
   * Measured: two note columns at .045/.030 and .530/.030, .420x.170;
   * object .080/.190 .620x.560; head .150/.560 .800x.170; foot two
   * columns at .150/.780 and .600/.780.
   */
  h046: {
    id: 'h046', family: 'editorial-grid', ground: 'paper', ref: 'h046',

    does: 'Two headed notes at the top, a large drawn object falling across the '
        + 'middle, and a two-line title low on the sheet with two more notes under '
        + 'it. The title arrives after the argument rather than before it, which '
        + 'is unusual and is why it holds — the reader has already agreed by the '
        + 'time they read what it is called.',
    avoid: 'The notes at the top have to make sense before the title. If they only '
         + 'work once you know the subject, put the title back at the top and use '
         + 'a different layout.',

    slots: [
      { id: 'paper', t: 'grid', box: [0.030, 0.020, 0.940, 0.960],
        step: 0.022, fill: 'mark', alpha: 0.09 },
      { id: 'noteA', t: 'type', box: [0.045, 0.030, 0.400, 0.150],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.45,
        wants: 'A heading and three short lines. One principle, stated as though '
             + 'from a manual.' },
      { id: 'noteB', t: 'type', box: [0.530, 0.030, 0.420, 0.150],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.45,
        wants: 'A second heading and three lines. The other half of the pair.' },
      { id: 'object', t: 'art', role: 'object', box: [0.060, 0.190, 0.680, 0.580],
        treat: 'contain', tint: 'accent',
        wants: 'One large object seen from an odd angle, printed in one colour. '
             + 'It should be ordinary — a chair, a lamp, a tool — because the '
             + 'sheet is about simplicity and a spectacular object argues against '
             + 'it.' },
      { id: 'head', t: 'type', box: [0.140, 0.560, 0.810, 0.175],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.090, min: 0.045, leading: 1.05,
        wants: 'A title in two lines. It arrives after the argument, so it should '
             + 'name what the reader has just worked out.' },
      { id: 'footA', t: 'type', box: [0.140, 0.780, 0.380, 0.150],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.50,
        wants: 'Five or six small lines. How the principle is applied.' },
      { id: 'footB', t: 'type', box: [0.580, 0.780, 0.380, 0.150],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.50,
        wants: 'Five or six small lines. What it leaves out.' },
    ],
  },

  /* ------------------------------------------------------------- h072
   * Measured: rail .045/.020; kicker .430/.045 .240x.030; head
   * .400/.075 .420x.130; four portraits at .100/.130, .620/.180,
   * .120/.470, .600/.520, each .280x.300; crest .300/.830.
   */
  h072: {
    id: 'h072', family: 'editorial-grid', ground: 'paper', ref: 'h072',

    does: 'A roll call. Four faces arranged around a centred title, each with a '
        + 'name and a role beside it, and a crest at the foot. It is a team sheet, '
        + 'and it works because the faces are cut into odd shapes rather than '
        + 'boxed — the irregularity is what stops it looking like a staff page.',
    avoid: 'Needs four real faces and four real names. It cannot be filled with '
         + 'three, and it cannot be filled with strangers.',

    slots: [
      { id: 'paper', t: 'grid', box: [0.030, 0.020, 0.940, 0.960],
        step: 0.020, fill: 'mark', alpha: 0.09 },
      { id: 'railL', t: 'type', box: [0.045, 0.020, 0.280, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.8,
        fit: 'shrink', size: 0.014, min: 0.010, wants: 'A mark, top left.' },
      { id: 'railR', t: 'type', box: [0.680, 0.020, 0.280, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.8,
        fit: 'shrink', size: 0.014, min: 0.010, wants: 'A season, top right.' },
      { id: 'kicker', t: 'type', box: [0.400, 0.048, 0.280, 0.030],
        role: 'body', weight: '500', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.022, min: 0.014, wants: 'Two words. "meet the …".' },
      { id: 'head', t: 'type', box: [0.360, 0.078, 0.360, 0.115],
        role: 'display', weight: '800', fill: 'mark', align: 'center', track: -0.02,
        fit: 'wrap', size: 0.062, min: 0.032, leading: 1.02,
        wants: 'Two words in caps, centred, naming the group.' },
      { id: 'sub', t: 'type', box: [0.360, 0.196, 0.360, 0.040],
        role: 'didoneItalic', fill: 'mark', align: 'center',
        fit: 'shrink', size: 0.036, min: 0.020,
        wants: 'Two words in italic under it. What the group is for.' },
      { id: 'faceA', t: 'art', role: 'portrait', box: [0.075, 0.130, 0.290, 0.300],
        treat: 'contain', wants: 'The first face, top left.' },
      { id: 'nameA', t: 'type', box: [0.075, 0.440, 0.290, 0.048],
        role: 'grotesque', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.35,
        wants: 'A name in caps and a role under it.' },
      { id: 'faceB', t: 'art', role: 'portrait', box: [0.630, 0.180, 0.290, 0.300],
        treat: 'contain', wants: 'The second face, top right.' },
      { id: 'nameB', t: 'type', box: [0.630, 0.490, 0.290, 0.048],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'right',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.35,
        wants: 'A name and a role, right aligned.' },
      { id: 'faceC', t: 'art', role: 'portrait', box: [0.100, 0.520, 0.290, 0.300],
        treat: 'contain', wants: 'The third face, lower left.' },
      { id: 'nameC', t: 'type', box: [0.100, 0.830, 0.290, 0.048],
        role: 'grotesque', weight: '700', fill: 'mark',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.35,
        wants: 'A name and a role.' },
      { id: 'faceD', t: 'art', role: 'portrait', box: [0.600, 0.560, 0.290, 0.300],
        treat: 'contain', wants: 'The fourth face, lower right.' },
      { id: 'nameD', t: 'type', box: [0.600, 0.870, 0.290, 0.048],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'right',
        fit: 'wrap', size: 0.017, min: 0.012, leading: 1.35,
        wants: 'A name and a role.' },
      { id: 'crest', t: 'type', box: [0.380, 0.930, 0.240, 0.040],
        role: 'grotesque', weight: '700', fill: 'mark', align: 'center', track: 0.08,
        fit: 'shrink', size: 0.018, min: 0.012, wants: 'A group name at the foot.' },
    ],
  },

  /* ------------------------------------------------------------- h073
   * Measured: rail .620/.020 .340x.024; photo .045/.030 .560x.480;
   * head .630/.180 .330x.230; note .630/.450 .330x.120; foot
   * .045/.930 .910x.030.
   */
  h073: {
    id: 'h073', family: 'editorial-grid', ground: 'paper', ref: 'h073',

    does: 'A photograph held in the top left, a three-line lower-case title down '
        + 'the right, a short block of small caps under it, and a line of contact '
        + 'details at the foot. It is a printed advertisement, and it is the '
        + 'quietest layout in the set — nothing on it is trying to interrupt you, '
        + 'which is exactly why it gets read.',
    avoid: 'It gives the picture only a third of the sheet, so a photograph that '
         + 'needs scale is wasted on it. Use it when the words are the point and '
         + 'the picture is the proof.',

    slots: [
      { id: 'rail', t: 'type', box: [0.600, 0.022, 0.360, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', track: 0.05,
        fit: 'shrink', size: 0.016, min: 0.011, wants: 'A name, top right, caps.' },
      { id: 'photo', t: 'art', role: 'scene', box: [0.045, 0.060, 0.540, 0.460],
        wants: 'A photograph of the work being done rather than the result — a '
             + 'set, a rig, a room mid-job.' },
      { id: 'head', t: 'type', box: [0.625, 0.175, 0.340, 0.235],
        role: 'display', weight: '700', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.090, min: 0.045, leading: 1.02,
        wants: 'Three lines, lower case. A phrase naming what the reader is being '
             + 'shown.' },
      { id: 'note', t: 'type', box: [0.625, 0.440, 0.340, 0.120],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'wrap', size: 0.019, min: 0.013, leading: 1.35,
        wants: 'Four short lines of caps. What is in it, listed rather than '
             + 'described.' },
      { id: 'footL', t: 'type', box: [0.045, 0.930, 0.400, 0.030],
        role: 'grotesque', weight: '600', fill: 'mark',
        fit: 'shrink', size: 0.019, min: 0.013, wants: 'A handle, bottom left.' },
      { id: 'footR', t: 'type', box: [0.560, 0.930, 0.400, 0.030],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.019, min: 0.013,
        wants: 'A number or an address, bottom right.' },
    ],
  },

  /* ------------------------------------------------------------- h007
   * Measured: the four words fill .020/.020 to .980/.900 in an
   * interlocking block; note .045/.700 .420x.070; credit .620/.950.
   */
  h007: {
    id: 'h007', family: 'type-as-image', ground: 'paper', ref: 'h007',

    does: 'Four words of one question set so large that they interlock and overlap, '
        + 'in alternating weights and colours, filling the whole sheet. There is no '
        + 'picture and there is no room for one. It works only when the question is '
        + 'blunt enough to survive being read a word at a time.',
    avoid: 'Four words maximum, and no word longer than about seven letters. A '
         + 'fifth word or a long one turns the interlock into a jumble and the '
         + 'question stops being readable at all.',

    slots: [
      { id: 'w1', t: 'type', box: [0.020, 0.030, 0.560, 0.170],
        role: 'grotesque', weight: '800', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.215, min: 0.090, vAlign: 'bottom',
        wants: 'The first word.' },
      { id: 'w2', t: 'type', box: [0.520, 0.020, 0.460, 0.150],
        role: 'grotesque', weight: '400', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.185, min: 0.080, vAlign: 'bottom',
        wants: 'The second word, in a lighter weight so the two read as one '
             + 'phrase rather than two shouts.' },
      { id: 'w3', t: 'type', box: [0.180, 0.180, 0.500, 0.280],
        role: 'grotesque', weight: '800', fill: 'accent', track: -0.03,
        fit: 'shrink', size: 0.330, min: 0.120, vAlign: 'bottom',
        wants: 'A single mark set enormous behind the words — a question mark, an '
             + 'exclamation, an ampersand.' },
      { id: 'w4', t: 'type', box: [0.020, 0.400, 0.700, 0.180],
        role: 'grotesque', weight: '800', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.220, min: 0.090, vAlign: 'bottom',
        wants: 'The third word, largest of the three.' },
      { id: 'w5', t: 'type', box: [0.020, 0.620, 0.560, 0.180],
        role: 'grotesque', weight: '800', fill: 'mark', track: -0.02,
        fit: 'shrink', size: 0.220, min: 0.090, vAlign: 'bottom',
        wants: 'The last word, carrying the punctuation.' },
      { id: 'note', t: 'type', box: [0.045, 0.700, 0.420, 0.070],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.85,
        fit: 'wrap', size: 0.014, min: 0.010, leading: 1.45,
        wants: 'Two small lines tucked into the gap. An aside in a much quieter '
             + 'voice than the words above it.' },
      { id: 'credit', t: 'type', box: [0.600, 0.945, 0.360, 0.026],
        role: 'body', weight: '500', fill: 'mark', align: 'right', alpha: 0.8,
        fit: 'shrink', size: 0.015, min: 0.011, wants: 'A maker credit.' },
    ],
  },

  /* ------------------------------------------------------------- h011
   * Measured: head .060/.055 .880x.720 in five stepped lines; rail
   * .060/.945 .880x.026.
   */
  h011: {
    id: 'h011', family: 'type-as-image', ground: 'blue', ref: 'h011',

    does: 'One sentence in five lines of caps that step across the sheet, each '
        + 'line starting where the last one ended, on a flat field of colour. The '
        + 'stepping is what makes it read as a chant rather than a paragraph. No '
        + 'picture, no second voice, nothing else at all.',
    avoid: 'Every line has to be a phrase you would pause after. Breaking a '
         + 'sentence at a preposition to make the steps work ruins it, because '
         + 'the reader pauses where you broke it whether you meant them to or not.',

    slots: [
      { id: 'l1', t: 'type', box: [0.055, 0.050, 0.560, 0.120],
        role: 'display', weight: '800', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.150, min: 0.070, vAlign: 'bottom',
        wants: 'The first phrase, flush left.' },
      { id: 'l2', t: 'type', box: [0.180, 0.170, 0.700, 0.120],
        role: 'display', weight: '800', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.150, min: 0.070, vAlign: 'bottom',
        wants: 'The second, stepped right.' },
      { id: 'l3', t: 'type', box: [0.300, 0.290, 0.660, 0.120],
        role: 'display', weight: '800', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.150, min: 0.070, vAlign: 'bottom',
        wants: 'The third, stepped right again. This is the middle of the sentence '
             + 'and the far side of the sheet.' },
      { id: 'l4', t: 'type', box: [0.055, 0.430, 0.620, 0.120],
        role: 'display', weight: '800', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.150, min: 0.070, vAlign: 'bottom',
        wants: 'The fourth, back to the left margin. The turn.' },
      { id: 'l5', t: 'type', box: [0.055, 0.560, 0.880, 0.130],
        role: 'display', weight: '800', fill: 'mark', track: -0.01,
        fit: 'shrink', size: 0.160, min: 0.070, vAlign: 'bottom',
        wants: 'The last phrase, widest, carrying the point.' },
      { id: 'railL', t: 'type', box: [0.055, 0.945, 0.400, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.85,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.04,
        wants: 'A date, bottom left.' },
      { id: 'railR', t: 'type', box: [0.545, 0.945, 0.400, 0.026],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.85,
        fit: 'shrink', size: 0.016, min: 0.011, track: 0.04,
        wants: 'A handle, bottom right.' },
    ],
  },

  /* ------------------------------------------------------------- h026
   * Measured: rail .045/.020 in three cells; three clauses at
   * .120/.230, .120/.400, .310/.630, each .460x.090.
   */
  h026: {
    id: 'h026', family: 'type-as-image', ground: 'ink', ref: 'h026',

    does: 'One sentence broken into three clauses, set small in the accent colour '
        + 'on a dark sheet, each clause placed a long way from the last with '
        + 'nothing between them. The emptiness is the design: the reader has to '
        + 'travel to finish the sentence, and the travelling is what makes them '
        + 'read it twice.',
    avoid: 'It needs a sentence with real weight, because there is nothing else on '
         + 'the sheet to carry it. Anything conversational looks lost at this '
         + 'scale.',

    slots: [
      { id: 'railL', t: 'type', box: [0.045, 0.020, 0.300, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.7,
        fit: 'shrink', size: 0.014, min: 0.010, track: 0.05,
        wants: 'A handle, top left.' },
      { id: 'railC', t: 'type', box: [0.380, 0.020, 0.240, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'center', alpha: 0.7,
        fit: 'shrink', size: 0.014, min: 0.010, track: 0.05,
        wants: 'A date, centred.' },
      { id: 'railR', t: 'type', box: [0.660, 0.020, 0.300, 0.024],
        role: 'grotesque', weight: '600', fill: 'mark', align: 'right', alpha: 0.7,
        fit: 'shrink', size: 0.014, min: 0.010, track: 0.05,
        wants: 'A name, top right.' },
      { id: 'c1', t: 'type', box: [0.120, 0.220, 0.420, 0.090],
        role: 'grotesque', weight: '700', fill: 'accent', track: 0.03,
        fit: 'wrap', size: 0.026, min: 0.016, leading: 1.30,
        wants: 'The first clause, two short lines of caps. It must not be a '
             + 'complete sentence.' },
      { id: 'c2', t: 'type', box: [0.400, 0.390, 0.480, 0.090],
        role: 'grotesque', weight: '700', fill: 'accent', track: 0.03,
        fit: 'wrap', size: 0.026, min: 0.016, leading: 1.30,
        wants: 'The second clause, further right and much further down.' },
      { id: 'c3', t: 'type', box: [0.300, 0.620, 0.560, 0.090],
        role: 'grotesque', weight: '700', fill: 'accent', track: 0.03,
        fit: 'wrap', size: 0.026, min: 0.016, leading: 1.30,
        wants: 'The last clause, finishing the sentence. Ends in a full stop.' },
    ],
  },

  /* ------------------------------------------------------------- h041
   * Measured: head .085/.240 .830x.380 in four lines; kicker
   * .120/.170 .420x.060; strap .120/.640 .420x.045; foot .100/.860.
   */
  h041: {
    id: 'h041', family: 'type-as-image', ground: 'blue', ref: 'h041',

    does: 'A hand-lettered promise: a small enthusiastic line, then three lines of '
        + 'heavy caps in the accent colour with a script line falling off the end '
        + 'of them, over a loose painted stroke. Everything is deliberately a '
        + 'little crooked. It is the loudest layout in the set and the least '
        + 'serious, which is why it works for something free.',
    avoid: 'Not for anything expensive or considered. The hand-lettered look reads '
         + 'as generous and slightly cheap, and it will make a serious offer sound '
         + 'like a giveaway.',

    slots: [
      { id: 'stroke', t: 'art', role: 'object', box: [0.020, 0.180, 0.960, 0.560],
        draws: ['stroke'], fill: 'accent', screen: false,
        wants: 'One loose painted or drawn stroke behind the type, going right '
             + 'across the sheet. Not an object: a gesture.' },
      { id: 'kicker', over: 'art', t: 'type', box: [0.115, 0.165, 0.440, 0.062],
        role: 'script', fill: 'accent',
        fit: 'shrink', size: 0.052, min: 0.030, vAlign: 'bottom',
        wants: 'Two words in script. The enthusiasm.' },
      { id: 'head', over: 'art', t: 'type', box: [0.080, 0.235, 0.840, 0.390],
        role: 'display', weight: '800', fill: 'accent', track: -0.01,
        fit: 'wrap', size: 0.125, min: 0.055, leading: 1.02,
        wants: 'Three lines of caps naming the thing on offer. Plain nouns — the '
             + 'lettering is doing the shouting.' },
      { id: 'strap', over: 'art', t: 'type', box: [0.500, 0.630, 0.420, 0.055],
        role: 'script', fill: 'mark', align: 'right',
        fit: 'shrink', size: 0.048, min: 0.028, vAlign: 'bottom',
        wants: 'Two words in script falling off the end of the headline.' },
      { id: 'foot', t: 'type', box: [0.100, 0.845, 0.480, 0.036],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.024, min: 0.016,
        wants: 'One short reassuring line, lower case.' },
      { id: 'handle', t: 'type', box: [0.100, 0.930, 0.400, 0.028],
        role: 'body', weight: '500', fill: 'mark', alpha: 0.8,
        fit: 'shrink', size: 0.016, min: 0.011, wants: 'A handle at the foot.' },
    ],
  },

  /* ------------------------------------------------------------- h042
   * Measured: head .120/.230 .760x.400 in four lines; kicker
   * .200/.190 .300x.050; note .120/.660 .400x.040.
   */
  h042: {
    id: 'h042', family: 'type-as-image', ground: 'paper', ref: 'h042',

    does: 'A first-person sentence in four lines of heavy lower-case, with small '
        + 'stickers and marks tucked into the gaps between the lines. The stickers '
        + 'do the work a second voice would do — they interrupt, qualify and joke '
        + 'without needing a second block of copy.',
    avoid: 'The sentence has to be first person and a bit uncertain. Set as advice '
         + 'it becomes a poster, and the stickers then look like decoration '
         + 'instead of interruption.',

    slots: [
      { id: 'kicker', t: 'type', box: [0.190, 0.185, 0.320, 0.052],
        role: 'grotesque', weight: '600', fill: 'mark', alpha: 0.8,
        fit: 'shrink', size: 0.020, min: 0.014, track: 0.04,
        wants: 'Two or three words in a small tag. An interruption, in brackets or '
             + 'in caps.' },
      { id: 'head', t: 'type', box: [0.115, 0.225, 0.775, 0.405],
        role: 'display', weight: '800', fill: 'mark', track: -0.025,
        fit: 'wrap', size: 0.105, min: 0.050, leading: 1.06,
        wants: 'A first-person sentence in four lines, lower case, no full stop. '
             + 'Something you would say to one person rather than announce.' },
      { id: 'note', t: 'type', box: [0.115, 0.655, 0.440, 0.042],
        role: 'body', weight: '500', fill: 'mark',
        fit: 'shrink', size: 0.024, min: 0.016,
        wants: 'One line in square brackets. What you are about to do about it.' },
    ],
  },

  /* ------------------------------------------------------------- h052
   * Measured: head .380/.190 .420x.420 in six short lines; tag
   * .600/.230 .200x.035; tag2 .400/.400 .240x.035.
   */
  h052: {
    id: 'h052', family: 'type-as-image', ground: 'paper', ref: 'h052',

    does: 'A short claim in six very short lines of heavy lower-case, set in a '
        + 'narrow column off centre, with two small pastel tags stuck beside it. '
        + 'The narrow measure is the device — breaking a plain sentence into '
        + 'six one-word lines makes each word land separately.',
    avoid: 'Only for a claim with a number in it. Without one the six lines look '
         + 'like a poem, and a poem is not a hook.',

    slots: [
      { id: 'head', t: 'type', box: [0.370, 0.185, 0.430, 0.430],
        role: 'display', weight: '800', fill: 'mark', track: -0.02,
        fit: 'wrap', size: 0.078, min: 0.038, leading: 1.10,
        wants: 'A claim in five or six very short lines. Put the number on a line '
             + 'of its own.' },
      { id: 'tagA', t: 'type', box: [0.610, 0.225, 0.220, 0.038],
        role: 'grotesque', weight: '600', fill: 'mark',
        highlight: 'accent', highlightText: 'mark',
        fit: 'shrink', size: 0.018, min: 0.012, vAlign: 'middle',
        wants: 'One word on a coloured tag, level with the top of the claim.' },
      { id: 'tagB', t: 'type', box: [0.390, 0.400, 0.260, 0.038],
        role: 'grotesque', weight: '600', fill: 'mark',
        highlight: 'accent', highlightText: 'mark',
        fit: 'shrink', size: 0.018, min: 0.012, vAlign: 'middle',
        wants: 'Two words on a second tag, lower down. It should qualify the '
             + 'claim rather than repeat it.' },
    ],
  },

  /* ------------------------------------------------------------- h059
   * Measured: head .045/.020 .910x.520 in six knocked-out lines;
   * close .045/.860 .500x.100.
   */
  h059: {
    id: 'h059', family: 'type-as-image', ground: 'red', ref: 'h059',

    does: 'Every line of the sentence knocked out of its own white block, stacked '
        + 'and alternating left and right, on a flat field of colour, with the '
        + 'last line set apart at the foot. The blocks make each line a separate '
        + 'statement, so the final line reads as a verdict rather than a '
        + 'continuation.',
    avoid: 'The last line has to be the reversal. Used for a sentence that simply '
         + 'ends, the separated block at the foot looks like a mistake in the '
         + 'layout.',

    slots: [
      { id: 'head', t: 'type', box: [0.045, 0.020, 0.910, 0.530],
        role: 'display', weight: '700', fill: 'mark',
        highlight: 'accent', highlightText: 'mark', highlightPad: [0.14, 0.20],
        fit: 'wrap', size: 0.072, min: 0.036, leading: 1.30,
        wants: 'A sentence in five or six lines, each knocked out of its own '
             + 'block. Write it so the line breaks fall where a person would '
             + 'pause, because each break is a full stop to the eye.' },
      { id: 'close', t: 'type', box: [0.045, 0.855, 0.560, 0.105],
        role: 'display', weight: '700', fill: 'mark',
        highlight: 'accent', highlightText: 'mark', highlightPad: [0.14, 0.20],
        fit: 'wrap', size: 0.072, min: 0.036, leading: 1.30,
        wants: 'The reversal, in one or two blocks at the foot, set apart from '
             + 'the rest. Four words at most.' },
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

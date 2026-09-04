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
        draws: ['handset', 'phone', 'crt'], fill: 'mark',
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
    id: 'h070', family: 'figure-cut', ground: 'dark', ref: 'h070',

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

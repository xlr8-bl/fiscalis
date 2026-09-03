/**
 * carousel.js — five slides, each composed on its own terms.
 *
 * Not a template system. The earlier attempt was six parameterised
 * layouts, and the trouble with a layout is that it produces the same
 * slide with different words in it, which is exactly what a template
 * looks like. Every reference in the folder is its own composition:
 * 5409 overlaps and rotates its lines, 5424 fragments a sentence down
 * the page in type too small for the frame, 5405 knocks its words out
 * of a giant glyph, 5417 hangs two mirrored fragments off one heavy
 * word. Nothing in the set could be swapped for anything else in it.
 *
 * So these are five drawings, sharing primitives and nothing else.
 *
 * Three rules taken from the references and kept to:
 *
 *   Emphasis is scale. 5418 and 5422 set a small line and a giant line
 *   in the same face, the same weight and the same colour, at about one
 *   to five. An italic word in an accent colour is the cheap version of
 *   that and it reads as a template every time.
 *
 *   The furniture is nearly silent. A tiny credit, or three muted items
 *   on one rule. Badges and mono labels in every corner are decoration
 *   standing in for composition.
 *
 *   Air is the point. 5424 is mostly empty and it is the most confident
 *   thing in the folder.
 */

export const W = 1024;
export const H = 1280;

const DISPLAY = '"Display", Arial Black, sans-serif';
const MONO = '"Mono", ui-monospace, monospace';

/* Two inks a slide, three at the very most — the references never go past. */
const INK = '#0a0a09';
const PAPER = '#efeee9';
const RED = '#ED2024';
const BLUE = '#1B33E0';

/* ----------------------------------------------------------- primitives */

let faces = null;
export function loadFaces() {
  if (faces) return faces;
  faces = Promise.all([
    ['Display', '/assets/fonts/bricolage.woff2', { weight: '800' }],
    ['Mono', '/assets/fonts/geistmono.woff2', {}],
  ].map(async ([name, url, desc]) => {
    try {
      const f = new FontFace(name, `url(${url}) format("woff2")`, desc);
      await f.load(); document.fonts.add(f); return name;
    } catch { return null; }
  }));
  return faces;
}

/**
 * Set a line at exactly the width asked for.
 *
 * The giant lines in 5418 and 5422 span the measure edge to edge with
 * the tracking pulled in until they do. Fitting by font size alone
 * leaves ragged right edges; fitting by size *and* then tightening the
 * tracking is how the block gets its hard vertical edges.
 */
function setLine(ctx, text, { width, size, weight = 800, family = DISPLAY, track = null }) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = '0px';
  const natural = ctx.measureText(text).width;
  const gaps = Math.max(text.length - 1, 1);
  const spacing = track !== null ? track : (width - natural) / gaps;
  ctx.letterSpacing = `${spacing}px`;
  return { size, spacing, width: natural + spacing * gaps };
}

/** The size at which this text spans `width` with no tracking help. */
function sizeToSpan(ctx, text, width, { weight = 800, family = DISPLAY, cap = 460 } = {}) {
  ctx.letterSpacing = '0px';
  ctx.font = `${weight} 100px ${family}`;
  const at100 = ctx.measureText(text).width;
  return Math.min(cap, (width / at100) * 100);
}

/** One word, rotated about its own centre. */
function turned(ctx, text, { x, y, size, deg, colour, weight = 800, family = DISPLAY }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = colour;
  ctx.translate(x, y);
  ctx.rotate(deg * Math.PI / 180);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * A line on a curved baseline, from 5426 and 5427.
 *
 * Each glyph is placed and turned along the arc rather than the line
 * being warped as a whole, which is what a curve actually is when it is
 * set rather than filtered.
 */
function arced(ctx, text, { cx, cy, radius, size, colour, spread = 0.55, weight = 800 }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${DISPLAY}`;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0px';
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let angle = -spread * (total / 2) / radius;
  for (let i = 0; i < text.length; i++) {
    const step = widths[i] / radius * spread;
    angle += step / 2;
    ctx.save();
    ctx.translate(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius);
    ctx.rotate(angle);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    angle += step / 2;
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/** Film grain. Present on nearly every reference, never the subject. */
let noise = null;
function grain(ctx, amount = 0.07) {
  if (!noise) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 90 + Math.random() * 165;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    noise = c;
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(noise, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** The bloom on 5424's letters. Drawn under, not filtered over. */
function glow(ctx, draw, { colour, blur }) {
  // three passes, widest first: one shadow pass gives a hard halo the
  // shape of the word rather than light coming off it
  ctx.save();
  // additive: stacked normally the shadow passes darken each other and
  // leave a ring the shape of the word instead of light coming off it
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = colour;
  for (const [b, a] of [[blur * 3, 0.22], [blur * 1.5, 0.3], [blur * 0.6, 0.4]]) {
    ctx.shadowBlur = b;
    ctx.globalAlpha = a;
    draw();
  }
  ctx.restore();
  draw();
}

/** A credit, small and quiet, the way every reference signs itself. */
function credit(ctx, text, { colour, align = 'left', x, y, size = 19 }) {
  ctx.save();
  ctx.font = `${size}px ${MONO}`;
  ctx.letterSpacing = '1.5px';
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.55;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';
}

/* --------------------------------------------------------------- slides */

/**
 * 1 — after 5418 and 5422.
 *
 * A quiet line, then one enormous tight line, then a great deal of
 * nothing. The whole slide is two type sizes in one colour, and it
 * works because of the ratio and the emptiness rather than any effect.
 */
function hook(ctx) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const M = 74;
  const measure = W - M * 2;

  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';

  setLine(ctx, 'the form still works.', { width: measure * 0.62, size: 46 });
  ctx.fillText('the form still works.', M, 300);

  // one line, spanning the measure, tracking pulled in to make it span
  const big = 'nobody';
  let s = sizeToSpan(ctx, big, measure, { cap: 340 });
  setLine(ctx, big, { width: measure, size: s });
  ctx.fillText(big, M, 300 + s * 0.92);

  const big2 = 'is reading it';
  const s2 = sizeToSpan(ctx, big2, measure, { cap: 340 });
  setLine(ctx, big2, { width: measure, size: s2 });
  ctx.fillText(big2, M, 300 + s * 0.92 + s2 * 0.9);

  /*
   * 5418 fills the bottom half with a cut-out figure. With no figure
   * the air below reads as unfinished rather than as confidence, so the
   * last line is set enormous and cropped by the bottom edge instead —
   * the same device 5405 uses on its question mark.
   */
  const tail = 'since march';
  const ts = sizeToSpan(ctx, tail, measure * 1.24, { cap: 400 });
  setLine(ctx, tail, { width: measure * 1.24, size: ts });
  ctx.globalAlpha = 0.1;
  ctx.fillText(tail, M - 90, H - 30);
  ctx.globalAlpha = 1;

  ctx.letterSpacing = '0px';
  credit(ctx, 'WEB3ASHLEY', { colour: INK, x: M, y: H - 70 });
  credit(ctx, '01', { colour: INK, x: W - M, y: H - 70, align: 'right' });
  grain(ctx, 0.09);
}

/**
 * 2 — after 5424.
 *
 * One sentence broken into four, alternating left and right down the
 * page with the gaps doing the reading. The type is deliberately far
 * too small for the frame, and the black is the composition.
 */
function fragments(ctx) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);

  // the quiet three-part rule across the top, in grey rather than white
  ctx.save();
  ctx.font = `20px ${MONO}`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#6b6862';
  ctx.fillText('WEB3ASHLEY', 74, 78);
  ctx.textAlign = 'center'; ctx.fillText('LEAK 02', W / 2, 78);
  ctx.textAlign = 'right'; ctx.fillText('THE ENQUIRY', W - 74, 78);
  ctx.restore();
  ctx.textAlign = 'left';

  const lines = [
    { text: 'THE FORM', x: 128, y: 400 },
    { text: 'SENDS FINE', x: 128, y: 442 },
    { text: 'THE NOTIFICATION', x: 470, y: 596 },
    { text: 'BROKE IN MARCH', x: 470, y: 638 },
    { text: 'NOBODY', x: 128, y: 810 },
    { text: 'HAS SEEN ONE', x: 128, y: 852 },
    { text: 'SINCE.', x: 640, y: 1010 },
  ];
  ctx.font = `800 34px ${DISPLAY}`;
  ctx.letterSpacing = '1px';
  for (const l of lines) {
    glow(ctx, () => { ctx.fillStyle = RED; ctx.fillText(l.text, l.x, l.y); },
         { colour: RED, blur: 26 });
  }
  ctx.letterSpacing = '0px';
  grain(ctx, 0.1);
}

/**
 * 3 — after 5405.
 *
 * A glyph blown up past the frame as a graphic, with the words knocked
 * out of it where they cross. `source-atop` does the knockout, which is
 * the same thing overprinting does on a press.
 */
function knockout(ctx) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  const glyph = (c) => {
    c.font = `800 1500px ${DISPLAY}`;
    c.textAlign = 'center';
    c.fillText('0', W / 2 + 40, H * 0.86);
    c.textAlign = 'left';
  };
  const M = 70;
  const words = [
    { t: 'enquiries', y: 430, size: 150 },
    { t: 'that reached', y: 560, size: 118 },
    { t: 'a human', y: 690, size: 132 },
  ];
  const setWords = (c, colour) => {
    c.fillStyle = colour;
    for (const w of words) {
      c.font = `800 ${w.size}px ${DISPLAY}`;
      c.letterSpacing = '-2px';
      c.fillText(w.t, M, w.y);
    }
    c.letterSpacing = '0px';
  };

  // the figure, cropped by three edges
  ctx.fillStyle = RED;
  glyph(ctx);

  // the words, dark, everywhere
  setWords(ctx, INK);

  /*
   * And knocked out to paper where they cross it.
   *
   * Canvas cannot clip to a glyph directly, so the words are drawn in
   * paper on their own surface and then masked down to the shape of the
   * figure with `destination-in`. That leaves only the fragments that
   * sit inside the 0, which are laid back over the dark ones.
   *
   * This is what overprinting does on a press, and in 5405 it is the
   * whole reason the word and the question mark read as one object
   * rather than as a word on top of a shape.
   */
  const cut = document.createElement('canvas');
  cut.width = W; cut.height = H;
  const cx = cut.getContext('2d');
  setWords(cx, PAPER);
  cx.globalCompositeOperation = 'destination-in';
  cx.fillStyle = '#fff';
  glyph(cx);
  ctx.drawImage(cut, 0, 0);

  turned(ctx, 'since march', { x: W - 96, y: 300, size: 40, deg: 90, colour: INK });
  credit(ctx, '03', { colour: INK, x: W - 70, y: H - 64, align: 'right' });
  grain(ctx, 0.08);
}

/**
 * 4 — after 5409.
 *
 * Lines overlapping on negative leading, each starting somewhere else,
 * two of them turned a couple of degrees. One colour, one ground, and
 * the type doing all of it.
 */
function stagger(ctx) {
  ctx.fillStyle = BLUE; ctx.fillRect(0, 0, W, H);
  const M = 60;
  const measure = W - M * 2;

  /*
   * The offsets are the composition. Set at a tenth of the frame they
   * read as a slightly untidy left edge; 5409 pushes them a third of
   * the way across and lets the lines actually collide, which is what
   * makes the block look thrown rather than typed.
   */
  const rows = [
    { t: 'EVERY', x: M - 14, span: 0.66, deg: 0 },
    { t: 'LEAD', x: M + 250, span: 0.44, deg: -2.5 },
    { t: 'YOU NEVER', x: M + 90, span: 0.92, deg: 0 },
    { t: 'SAW', x: M + 430, span: 0.42, deg: 3 },
    { t: 'IS STILL', x: M - 30, span: 0.7, deg: -1 },
    { t: 'A CUSTOMER', x: M + 30, span: 1.02, deg: 1.5 },
  ];

  ctx.fillStyle = PAPER;
  let y = 300;
  for (const r of rows) {
    const size = sizeToSpan(ctx, r.t, measure * r.span, { cap: 240 });
    setLine(ctx, r.t, { width: measure * r.span, size });
    ctx.save();
    ctx.translate(r.x, y);
    if (r.deg) ctx.rotate(r.deg * Math.PI / 180);
    ctx.fillText(r.t, 0, 0);
    ctx.restore();
    // negative leading: the next line rides up into this one
    y += size * 0.68;   // they ride up into each other
  }
  ctx.letterSpacing = '0px';

  credit(ctx, '04', { colour: PAPER, x: W / 2, y: H - 64, align: 'center' });
  grain(ctx, 0.11);
}

/**
 * 5 — after 5404 and 5427.
 *
 * The magazine page: a rule with three quiet items, a headline set as a
 * lockup rather than a line, a row of specimen columns, and a block of
 * colour the closing line sits against.
 */
function editorial(ctx) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const M = 64;

  ctx.save();
  ctx.font = `19px ${MONO}`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = INK; ctx.globalAlpha = 0.6;
  ctx.fillText('WEB3ASHLEY', M, 62);
  ctx.textAlign = 'right'; ctx.fillText('05 / 05', W - M, 62);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK;
  ctx.fillRect(M, 80, W - M * 2, 2);

  // the lockup: small arced line, then the weight underneath
  // the arc reads as an accident unless it is large enough to be a
  // decision, and it belongs against the headline, not the rule
  arced(ctx, 'so here is', { cx: W / 2, cy: 560, radius: 380, size: 82, colour: INK, spread: 0.72 });
  const big = 'the fix';
  const s = sizeToSpan(ctx, big, W - M * 2, { cap: 300 });
  setLine(ctx, big, { width: W - M * 2, size: s });
  ctx.fillStyle = INK;
  ctx.fillText(big, M, 300 + s * 0.86);
  ctx.letterSpacing = '0px';

  // the specimen row, from 5404: labels over rules, filler underneath
  const cols = ['ONE', 'TWO', 'THREE'];
  const notes = ['send it twice', 'to an inbox\nsomeone opens', 'and check it\nevery friday'];
  const cw = (W - M * 2) / 3;
  ctx.font = `23px ${MONO}`;
  ctx.letterSpacing = '1.5px';
  for (let i = 0; i < 3; i++) {
    const x = M + cw * i;
    ctx.fillStyle = INK;
    ctx.fillRect(x, 690, cw - 28, 2);
    ctx.fillText(cols[i], x, 734);
    ctx.globalAlpha = 0.6;
    notes[i].split('\n').forEach((line, k) => ctx.fillText(line.toUpperCase(), x, 778 + k * 32));
    ctx.globalAlpha = 1;
  }
  ctx.letterSpacing = '0px';

  // the block, and the closing line against it
  ctx.fillStyle = RED;
  ctx.fillRect(M, 900, W - M * 2, 250);
  ctx.fillStyle = PAPER;
  const close = 'tell me what is broken';
  const cs = sizeToSpan(ctx, close, W - M * 2 - 80, { cap: 96 });
  setLine(ctx, close, { width: W - M * 2 - 80, size: cs });
  ctx.fillText(close, M + 40, 900 + 250 / 2 + cs * 0.34);
  ctx.letterSpacing = '0px';

  grain(ctx, 0.08);
}

export const SLIDES = [hook, fragments, knockout, stagger, editorial];

export async function draw(canvas, i) {
  await loadFaces();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  SLIDES[i](ctx);
  return canvas;
}

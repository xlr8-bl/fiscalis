/**
 * deck.js — five slides, each built from one of the new references.
 *
 * The note that made this necessary: every earlier attempt was a flat
 * colour with text arranged cleverly on it. That constraint was never
 * broken, and no amount of cleverness inside it gets you out.
 *
 * The five new references are not that. What they actually do:
 *
 *   The Red Idea   a halftoned cut-out person, and a flat red rectangle
 *                  composited into the photograph as though he were
 *                  holding it. A yellow circle and a red square floating
 *                  as pure geometry. The type is small and quiet.
 *   NOW            a face fragmented across a tile grid with gutters,
 *                  some tiles left empty, one letter knocked white over
 *                  a dark tile, a bar and an outlined rectangle holding
 *                  the balance.
 *   the grid one   the layout grid itself drawn in outline, type sitting
 *                  on it, grey blocks behind some words, metadata
 *                  repeated at top and bottom.
 *   uncreative     tiny type, enormous air, and a knockout block inside
 *                  a word: "un" dark on light, "creative" light on dark.
 *   Vitrium Opus   a masthead of rules and columns, and a headline under
 *                  progressive directional blur, so the word "focus" is
 *                  the least focused thing on the sheet.
 *
 * Two of those have no flat colour ground at all, and in the other three
 * the ground is nearly white. The interest is in shapes, fragments,
 * grids and treated photographs — not in a coloured rectangle.
 *
 * The copy is in the register those references use, which is a designer
 * talking rather than an agency pitching. "Your booking page takes
 * eleven seconds to load" is a slide for a sales deck.
 */

export const W = 1024;
export const H = 1280;

/* Off-white, not white: every one of the references sits on paper. */
const PAPER = '#EFEDE7';
const INK = '#111110';
const RED = '#E63122';
const YELLOW = '#F2B12C';
const GREY = '#D8D6D0';

const FACES = [
  ['Grot', '/assets/fonts/archivo-700.woff2', { weight: '700' }],
  ['Black', '/assets/fonts/inter-900.woff2', { weight: '900' }],
  ['Tall', '/assets/fonts/anton.woff2', {}],
  ['Mono', '/assets/fonts/geistmono.woff2', {}],
  ['Raw', '/assets/fonts/terminal-grotesque.ttf', {}],
];

const GROT = '"Grot", Helvetica, Arial, sans-serif';
const BLACK = '"Black", Helvetica, Arial, sans-serif';
const TALL = '"Tall", Impact, sans-serif';
const MONO = '"Mono", ui-monospace, monospace';

let faces = null;
export function loadFaces() {
  if (faces) return faces;
  faces = Promise.all(FACES.map(async ([name, url, desc]) => {
    try {
      const fmt = url.endsWith('.ttf') ? 'truetype' : 'woff2';
      const f = new FontFace(name, `url(${url}) format("${fmt}")`, desc);
      await f.load(); document.fonts.add(f); return name;
    } catch { return null; }
  }));
  return faces;
}

/* ----------------------------------------------------------- treatment */

/**
 * A photograph as coarse stipple.
 *
 * The references are not smoothly halftoned — they are grainy and
 * clotted, the way a photocopy of a photocopy is. Threshold against
 * blue noise rather than an ordered matrix: an ordered matrix gives
 * regular crosshatch, and what these have is a random-looking speckle
 * that clumps in the midtones.
 */
function stipple(img, { box, ink = INK, contrast = 1.35, lift = 0 }) {
  const c = document.createElement('canvas');
  c.width = box.w; c.height = box.h;
  const g = c.getContext('2d');
  const scale = Math.max(box.w / img.width, box.h / img.height);
  const w = img.width * scale, h = img.height * scale;
  g.drawImage(img, (box.w - w) / 2 + (box.ox || 0), (box.h - h) / 2 + (box.oy || 0), w, h);

  const d = g.getImageData(0, 0, box.w, box.h), px = d.data;
  const [r, gg, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2 - 1 + 1), 16));
  const rgb = [parseInt(ink.slice(1, 3), 16), parseInt(ink.slice(3, 5), 16), parseInt(ink.slice(5, 7), 16)];
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const i = (y * box.w + x) * 4;
      if (px[i + 3] < 8) continue;
      let l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      l = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5 + lift));
      // hashed threshold, so the speckle never grids up
      let n = (x * 374761393 + y * 668265263) | 0;
      n = (n ^ (n >> 13)) * 1274126177;
      const t = ((n ^ (n >> 16)) >>> 0) / 4294967295;
      if (l > t) { px[i + 3] = 0; }
      else { px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255; }
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** Take the sweep off, leaving the subject. */
export function cutOut(img, { tolerance = 56 } = {}) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  const at = (x, y) => { const i = (y * c.width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
  const m = [at(2, 2), at(c.width - 3, 2), at(4, 4), at(c.width - 5, 4)];
  const bg = [0, 1, 2].map((k) => m.reduce((a, v) => a + v[k], 0) / m.length);
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - bg[0], dg = px[i + 1] - bg[1], db = px[i + 2] - bg[2];
    const far = Math.sqrt(dr * dr + dg * dg + db * db);
    px[i + 3] = far < tolerance ? 0
      : far > tolerance * 1.7 ? 255
      : Math.round(((far - tolerance) / (tolerance * 0.7)) * 255);
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** Paper tooth, so the sheet is never flat. */
function tooth(ctx, amount = 0.05) {
  const c = document.createElement('canvas');
  c.width = c.height = 140;
  const g = c.getContext('2d'), d = g.createImageData(140, 140);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 110 + Math.random() * 145;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(c, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ---------------------------------------------------------------- type */

const px = (n) => `${n}px`;

/** Metadata, the way all five references carry it: small, flat, placed. */
function meta(ctx, text, { x, y, size = 20, colour = INK, align = 'left', alpha = 1, track = 0.6 }) {
  ctx.save();
  ctx.font = `${size}px ${MONO}`;
  ctx.letterSpacing = px(track);
  ctx.fillStyle = colour;
  ctx.globalAlpha = alpha;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';
}

/** A line of body copy, several lines, tight. */
function body(ctx, lines, { x, y, size = 21, colour = INK, leading = 1.42, family = GROT }) {
  ctx.save();
  ctx.font = `${size}px ${family}`;
  ctx.fillStyle = colour;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * leading));
  ctx.restore();
  return y + lines.length * size * leading;
}

/** Size a string to span exactly this width. */
function span(ctx, text, width, { family = BLACK, weight = 900, cap = 700 } = {}) {
  ctx.letterSpacing = '0px';
  ctx.font = `${weight} 100px ${family}`;
  return Math.min(cap, (width / ctx.measureText(text).width) * 100);
}

/**
 * A word with a knockout block inside it, from "uncreative".
 *
 * The block is not behind the whole word — it starts partway through, so
 * the word is dark on light up to a point and light on dark after it.
 * That is the entire idea and it only works mid-word.
 */
function knockWord(ctx, before, after, { x, y, size, ink = INK, paper = PAPER }) {
  ctx.save();
  ctx.font = `900 ${size}px ${BLACK}`;
  ctx.letterSpacing = px(-size * 0.02);
  const wBefore = ctx.measureText(before).width;
  const wAfter = ctx.measureText(after).width;
  ctx.fillStyle = ink;
  ctx.fillText(before, x, y);
  ctx.fillRect(x + wBefore - size * 0.04, y - size * 0.82, wAfter + size * 0.1, size * 1.06);
  ctx.fillStyle = paper;
  ctx.fillText(after, x + wBefore, y);
  ctx.restore();
  ctx.letterSpacing = '0px';
  return wBefore + wAfter;
}

/**
 * Directional blur across a headline, from Vitrium Opus.
 *
 * Each line is rendered to its own surface and then smeared by stacking
 * offset copies at falling opacity. Canvas has no motion blur, and
 * `ctx.filter = 'blur()'` is isotropic — it fogs the letter evenly
 * instead of dragging it sideways, which is a different effect and the
 * wrong one.
 */
function smeared(ctx, text, { x, y, size, amount, colour = INK, family = GROT }) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.font = `700 ${size}px ${family}`;
  g.fillStyle = colour;
  g.fillText(text, x, y);
  if (amount < 0.5) { ctx.drawImage(c, 0, 0); return; }

  const steps = Math.max(2, Math.round(amount));
  ctx.save();
  for (let i = steps; i >= 0; i--) {
    ctx.globalAlpha = i === 0 ? 1 : 0.42 / steps;
    ctx.drawImage(c, i * 1.5, 0);
    if (i) ctx.drawImage(c, -i * 1.5, 0);
  }
  ctx.restore();
}

/* -------------------------------------------------------------- slides */

/**
 * 1 — after The Red Idea.
 *
 * The figure is a stippled cut-out and the red rectangle is a flat
 * vector shape sitting in front of it, as though it were a thing being
 * held. That contact between drawn geometry and photograph is the whole
 * trick, and it is what none of the earlier attempts had.
 */
function redIdea(ctx, A) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  meta(ctx, 'WEB3ASHLEY©', { x: 96, y: 118, size: 30, colour: INK, track: 0 });

  // pure geometry, floating, doing nothing but weight
  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(830, 300, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RED;
  ctx.fillRect(614, 1010, 26, 26);

  if (A.figure) {
    const box = { x: 190, y: 360, w: 660, h: 560 };
    ctx.drawImage(stipple(A.figure, { box, contrast: 1.5 }), box.x, box.y);
  }

  // the flat shape, in front, overlapping where the head is
  ctx.save();
  ctx.translate(392, 408);
  ctx.rotate(-0.02);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, 214, 128);
  ctx.restore();

  const yy = 1078;
  ctx.font = `700 34px ${GROT}`;
  ctx.fillStyle = INK;
  ctx.fillText('The Same Website.', 96, yy);
  body(ctx, [
    'Nine shops on one street.',
    'One theme, four colours, the same four sections.',
    'Nobody chose any of it. It arrived that way,',
    'and everybody paid for it separately.',
  ], { x: 96, y: yy + 34, size: 19, leading: 1.45 });
}

/**
 * 2 — after NOW.
 *
 * The face is cut into tiles with gutters between them and two tiles
 * left out. The word sits across the top with one letter knocked white
 * where it crosses a dark tile.
 */
function fragmented(ctx, A) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const M = 70, gut = 12;
  const cols = 3, rows = 3;
  const cw = (W - M * 2 - gut * (cols - 1)) / cols;
  const chh = 250;
  const top = 330;

  /*
   * The face is stippled once across the whole grid, and each tile then
   * shows its own patch of that one image.
   *
   * The first version stippled per tile, which scaled the entire
   * photograph down to fit each cell — so every tile held a whole tiny
   * face rather than a piece of one big one, and the fragments did not
   * line up into anything. A fragment has to be cut out of the thing,
   * not a copy of it.
   */
  const gridW = cols * cw + (cols - 1) * gut;
  const gridH = rows * chh + (rows - 1) * gut;
  const skip = new Set(['0,2', '2,0']);

  if (A.face) {
    const whole = stipple(A.face, { box: { x: 0, y: 0, w: gridW, h: gridH }, contrast: 1.25 });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (skip.has(`${r},${c}`)) continue;
        const sx = c * (cw + gut), sy = r * (chh + gut);
        const x = M + sx, y = top + sy;
        ctx.fillStyle = '#fbfaf7';
        ctx.fillRect(x, y, cw, chh);
        ctx.drawImage(whole, sx, sy, cw, chh, x, y, cw, chh);
      }
    }
  }

  const word = 'SAME';
  const size = span(ctx, word, W - M * 2, { cap: 400 });
  ctx.font = `900 ${size}px ${BLACK}`;
  ctx.letterSpacing = px(-size * 0.03);
  const base = 260;

  // a dark tile behind the first letter, and the letter knocked out of it
  const first = ctx.measureText(word[0]).width;
  ctx.fillStyle = INK;
  ctx.fillRect(M - 10, base - size * 0.78, first + 24, size * 0.95);
  ctx.fillStyle = INK;
  ctx.fillText(word.slice(1), M + first, base);
  ctx.fillStyle = PAPER;
  ctx.fillText(word[0], M - 2, base);
  ctx.letterSpacing = '0px';

  // counterweights
  ctx.fillStyle = INK;
  ctx.fillRect(M, top + chh + gut + 96, 236, 22);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.strokeRect(W - M - 46, top + (chh + gut) * 2 - 40, 46, 210);
  ctx.fillStyle = PAPER;
  ctx.fillRect(M + 22, top + 168, 42, 42);
  ctx.fillRect(W - M - 96, top + 40, 46, 46);

  body(ctx, [
    'Every one of them was told it was bespoke.',
    'They were all looking at the same demo.',
  ], { x: M, y: H - 96, size: 21, family: GROT });
}

/**
 * 3 — after the red grid poster.
 *
 * The layout grid is drawn instead of hidden, the headline sits on it,
 * and grey blocks sit behind some of the words. The metadata repeats at
 * the top and the bottom, which is what makes it read as a page out of
 * something rather than a post.
 */
function onGrid(ctx, A) {
  ctx.fillStyle = '#F4F3EF'; ctx.fillRect(0, 0, W, H);
  const M = 54;
  const cols = 4, rows = 5;
  const cw = (W - M * 2) / cols, ch = (H - 210) / rows;

  ctx.strokeStyle = RED; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.strokeRect(M + c * cw + 5, 118 + r * ch + 5, cw - 10, ch - 10);
    }
  }
  ctx.globalAlpha = 1;

  const head = ['every', 'template has', 'a grid you', 'can feel.'];
  let y = 300;
  head.forEach((line, i) => {
    const size = span(ctx, line, W - M * 2 - (i === 0 ? 420 : i === 3 ? 300 : 0), { cap: 190 });
    ctx.font = `900 ${size}px ${BLACK}`;
    ctx.letterSpacing = px(-size * 0.035);
    const x = i === 1 ? M + 120 : M;
    // a grey block behind, offset, the way the reference does it
    ctx.fillStyle = GREY;
    ctx.fillRect(x - 8, y - size * 0.72, ctx.measureText(line).width + 26, size * 0.86);
    ctx.fillStyle = RED;
    ctx.fillText(line, x, y);
    y += size * 0.94;
  });
  ctx.letterSpacing = '0px';

  for (const yy of [70, H - 44]) {
    meta(ctx, 'WEB3ASHLEY', { x: M, y: yy, size: 19, colour: RED });
    meta(ctx, 'NOTE N. 07', { x: W / 2, y: yy, size: 19, colour: RED, align: 'center' });
    meta(ctx, 'ON TEMPLATES', { x: W - M, y: yy, size: 19, colour: RED, align: 'right' });
  }
}

/**
 * 4 — after "the uncreative".
 *
 * Almost nothing on the sheet, and a knockout block inside one word.
 * The structure is a dictionary entry, which is why it can afford to be
 * this empty: the reader has something to finish.
 */
function definition(ctx, A) {
  ctx.fillStyle = '#F2F1ED'; ctx.fillRect(0, 0, W, H);
  const M = 118;

  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
  for (const [cx, cy] of [[M, 300], [W - M, H - 300]]) {
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy); ctx.lineTo(cx + 11, cy);
    ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy + 11);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  meta(ctx, 'an attempt at not looking like everyone else', { x: 300, y: 306, size: 19 });
  meta(ctx, '@web3ashley', { x: 168, y: 340, size: 17, alpha: 0.62 });
  meta(ctx, 'NOTE 07', { x: 470, y: 340, size: 17, alpha: 0.62 });
  meta(ctx, '02/09/26', { x: 640, y: 340, size: 17, alpha: 0.62 });

  meta(ctx, 'entry IV', { x: 560, y: 620, size: 22 });

  ctx.font = `italic 30px ${GROT}`;
  ctx.fillStyle = INK;
  ctx.fillText('be', M + 44, 664);

  knockWord(ctx, 'be', 'spoke', { x: M + 44, y: 726, size: 96 });

  ctx.font = `italic 26px ${GROT}`;
  ctx.fillText('adjective', M + 44, 786);

  body(ctx, [
    'made for one person, and',
    'useless to anyone else.',
  ], { x: M + 44, y: 830, size: 30, leading: 1.34 });

  meta(ctx, 'archivo · inter · terminal grotesque', { x: 240, y: H - 262, size: 16, alpha: 0.6 });
  ctx.font = `700 21px ${GROT}`;
  ctx.fillStyle = INK;
  ctx.fillText('a different one every day', 240, H - 228);
  meta(ctx, '17pt, 30pt, 96pt', { x: W - 200, y: H - 262, size: 16, alpha: 0.6 });
}

/**
 * 5 — after Vitrium Opus.
 *
 * A masthead of rules and columns, and a headline that loses focus as it
 * goes, so the last word is the least readable. The joke has to be on
 * the right word or it is just a blurry slide.
 */
function outOfFocus(ctx, A) {
  ctx.fillStyle = '#F1F0EC'; ctx.fillRect(0, 0, W, H);
  const M = 62;

  ctx.strokeStyle = INK; ctx.globalAlpha = 0.16; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const x = M + ((W - M * 2) / 6) * i;
    ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x, H - 120); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.font = `900 34px ${BLACK}`;
  ctx.fillStyle = INK;
  ctx.fillText('WEB3ASHLEY', M, 86);
  meta(ctx, '2026', { x: 470, y: 86, size: 24 });
  meta(ctx, 'ON TEMPLATES', { x: W - M, y: 86, size: 24, align: 'right' });

  ctx.fillStyle = INK;
  ctx.fillRect(M, 108, W - M * 2, 2);
  body(ctx, ['If it was made for everyone,', 'it was made for nobody.'],
       { x: M, y: 152, size: 20 });
  meta(ctx, 'NOTE 07', { x: 470, y: 152, size: 20 });
  meta(ctx, 'SERIES 01', { x: W - M, y: 152, size: 20, align: 'right' });
  ctx.fillStyle = INK;
  ctx.fillRect(M, 198, W - M * 2, 2);

  // the headline, losing focus word by word
  const lines = [
    { t: 'in a feed', x: M, y: 470, size: 132, blur: 0 },
    { t: 'of the same', x: M, y: 592, size: 132, blur: 1.5 },
    // sized to the measure rather than guessed: at 150 the longest of
    // these ran past the right edge and lost its last letter
    { t: 'be the one', x: 300, y: 770, size: 128, blur: 4 },
    { t: 'that is', x: 300, y: 898, size: 128, blur: 7 },
    { t: 'legible', x: 300, y: 1026, size: 128, blur: 11 },
  ];
  for (const l of lines) {
    smeared(ctx, l.t, { x: l.x, y: l.y, size: l.size, amount: l.blur });
  }

  meta(ctx, 'web3ashley.com', { x: M, y: H - 58, size: 17, alpha: 0.7 });
  meta(ctx, 'you should not be reading this', { x: W / 2, y: H - 58, size: 17, alpha: 0.7, align: 'center' });
  meta(ctx, '@web3ashley', { x: W - M, y: H - 58, size: 17, alpha: 0.7, align: 'right' });
}

export const SLIDES = [redIdea, fragmented, onGrid, definition, outOfFocus];
export const NAMES = ['the red idea', 'fragmented', 'on the grid', 'definition', 'out of focus'];

const SOURCES = {
  figure: '/assets/stock/src/figure-laptop.jpg',
  face: '/assets/stock/src/portrait-bw.jpg',
};

let art = null;
async function load() {
  if (art) return art;
  const one = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  const got = {};
  for (const [k, src] of Object.entries(SOURCES)) got[k] = await one(src);
  if (got.figure) got.figure = cutOut(got.figure, { tolerance: 52 });
  art = got;
  return art;
}

export async function draw(canvas, i) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  SLIDES[i](ctx, A);
  tooth(ctx, 0.055);
  return canvas;
}

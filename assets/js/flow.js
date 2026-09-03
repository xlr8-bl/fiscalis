/**
 * flow.js — one piece of artwork, cut into five panels.
 *
 * The five slides before this were five posters that shared a palette.
 * They did not flow, because nothing in them crossed from one to the
 * next: each was composed inside its own 1024 and stopped at the edge.
 *
 * So this is drawn as a single sheet 5120 wide and sliced afterwards.
 * Everything is placed in one coordinate space, which means a shape
 * that starts on panel two and finishes on panel three is not a trick —
 * it is just a shape, and the cut happens to fall through it.
 *
 * What carries across:
 *
 *   a red rule at one height, running the whole width and passing
 *   behind everything, so the eye has a thread to follow on the swipe
 *
 *   one word set enormous across the second and third panels, so the
 *   reader who swipes gets the pay-off of it completing
 *
 *   the tile grid, which begins under that word and runs on into the
 *   drawn grid, so two different devices become one continuous field
 *
 *   the yellow circle, which appears once near the start and once near
 *   the end, and nowhere else
 *
 * What does not carry: the headlines. Each panel's own type stays
 * inside its own panel, because a slide that is illegible on its own is
 * a slide that fails for everyone who does not swipe.
 */

export const PANEL = 1024;
export const H = 1280;
export const PANELS = 5;
export const W = PANEL * PANELS;

export const PAPER = '#EFEDE7';
export const INK = '#111110';
export const RED = '#E63122';
export const YELLOW = '#F2B12C';
export const GREY = '#D9D7D1';

const FACES = [
  ['Grot', '/assets/fonts/archivo-700.woff2', { weight: '700' }],
  ['Black', '/assets/fonts/inter-900.woff2', { weight: '900' }],
];
const GROT = '"Grot", Helvetica, Arial, sans-serif';
const BLACK = '"Black", Helvetica, Arial, sans-serif';

let faces = null;
export function loadFaces() {
  if (faces) return faces;
  faces = Promise.all(FACES.map(async ([name, url, desc]) => {
    try {
      const f = new FontFace(name, `url(${url}) format("woff2")`, desc);
      await f.load(); document.fonts.add(f); return name;
    } catch { return null; }
  }));
  return faces;
}

/* ---------------------------------------------------------- treatment */

export function stipple(img, { w, h, contrast = 1.3, ox = 0, oy = 0, ink = INK }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  g.drawImage(img, (w - iw) / 2 + ox, (h - ih) / 2 + oy, iw, ih);

  const d = g.getImageData(0, 0, w, h), px = d.data;
  const k = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (px[i + 3] < 8) continue;
      let l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      l = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5));
      let n = (x * 374761393 + y * 668265263) | 0;
      n = (n ^ (n >> 13)) * 1274126177;
      const t = ((n ^ (n >> 16)) >>> 0) / 4294967295;
      if (l > t) px[i + 3] = 0;
      else { px[i] = k[0]; px[i + 1] = k[1]; px[i + 2] = k[2]; px[i + 3] = 255; }
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

export function cutOut(img, { tolerance = 54 } = {}) {
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
    px[i + 3] = far < tolerance ? 0 : far > tolerance * 1.7 ? 255
      : Math.round(((far - tolerance) / (tolerance * 0.7)) * 255);
  }
  g.putImageData(d, 0, 0);
  return trim(c);
}

/**
 * Crop a cut-out to its own ink.
 *
 * Without this the box you place is the original photograph's box, most
 * of which is now transparent, so a figure sized to 760 tall arrives on
 * the page about 450 tall and sitting wherever the photographer left
 * headroom. Cropping first means the number is the figure.
 */
export function trim(c) {
  const g = c.getContext('2d');
  const px = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (px[(y * c.width + x) * 4 + 3] < 12) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return c;
  const o = document.createElement('canvas');
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

/* --------------------------------------------------------------- type */

/**
 * A section marker. Deliberately not a monospaced, letterspaced,
 * uppercase micro-label — that treatment is the house style of every
 * generated deck on the internet. It is set in the same face as the
 * body, just heavier, and it says a whole sentence.
 */
function meta(ctx, text, { x, y, size = 26, colour = INK, align = 'left', alpha = 1 }) {
  ctx.save();
  ctx.font = `700 ${size}px ${GROT}`;
  ctx.fillStyle = colour; ctx.globalAlpha = alpha; ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.textAlign = 'left';
}

function body(ctx, lines, { x, y, size = 21, colour = INK, leading = 1.45, family = GROT }) {
  ctx.save();
  ctx.font = `${size}px ${family}`;
  ctx.fillStyle = colour;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * leading));
  ctx.restore();
}

function spanSize(ctx, text, width, { family = BLACK, weight = 900, cap = 900 } = {}) {
  ctx.letterSpacing = '0px';
  ctx.font = `${weight} 100px ${family}`;
  return Math.min(cap, (width / ctx.measureText(text).width) * 100);
}

/* ------------------------------------------------------------- scene */

/**
 * The whole sheet, in one coordinate space.
 *
 * Panel n owns x from n*1024 to (n+1)*1024, but nothing is required to
 * respect that and the interesting things do not.
 */
function scene(ctx, A) {
  const P = PANEL;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  /* ---- the thread: one rule, the whole width, behind everything ---- */
  ctx.fillStyle = RED;
  ctx.fillRect(60, 1146, W - 120, 4);

  /* ---- panel 0: the hook, and the only figure --------------------- */
  ctx.fillStyle = INK;
  ctx.font = `900 60px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillText('Enquiries dried up.', 74, 212);
  ctx.font = `900 82px ${BLACK}`;
  ctx.letterSpacing = '-3px';
  ctx.fillStyle = RED;
  ctx.fillText('It is not', 74, 306);
  ctx.fillText('your design.', 74, 388);
  ctx.letterSpacing = '0px';
  body(ctx, [
    'Three faults I find over and over. Every one of',
    'them is invisible from the inside, and every one',
    'is costing somebody money right now.',
  ], { x: 74, y: 444, size: 21 });

  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(872, 262, 33, 0, Math.PI * 2); ctx.fill();

  if (A.figure) {
    // the cut-out is trimmed to its ink, so this height is the figure's
    // real height and it can be stood on the rule rather than floated
    const fh = 640;
    const fw = Math.round(fh * (A.figure.width / A.figure.height));
    const fx = 342, fy = 1148 - fh;
    // the slab goes down first and the figure prints over it, which is
    // the order a screenprint runs in and the reason it reads as one
    // object instead of a rectangle parked on a photograph
    ctx.save();
    ctx.translate(fx + fw * 0.34, fy - 26); ctx.rotate(-0.022);
    ctx.fillStyle = RED; ctx.fillRect(0, 0, 330, 210);
    ctx.restore();
    ctx.drawImage(stipple(A.figure, { w: fw, h: fh, contrast: 1.5 }), fx, fy);
  }

  /* ---- the tile field, running under panels 1 and 2 --------------- */
  const gut = 12;
  // 470 + two 250 rows put the field's foot at 982, straight through the
  // body copy that starts at 920. Same field, lifted and shortened.
  const tileTop = 430, tileH = 220;
  /*
   * Narrower than it was. Cover-fitting a portrait into a field almost
   * two panels wide crops it to a horizontal band, and because the
   * photograph's own background is pale it dropped out to nothing — so
   * the outer tiles came up empty and the grid read as broken rather
   * than as deliberately gappy.
   */
  // ends exactly on the cut at 2048. Spilling past it left two tiles
  // alone on the next panel carrying no image, which reads as broken
  // rather than as a field running under the edge
  const fieldX = P + 150, fieldW = P * 2 - fieldX;
  const cols = 4, rows = 2;
  const cw = (fieldW - gut * (cols - 1)) / cols;

  if (A.face) {
    const whole = stipple(A.face, {
      w: Math.round(fieldW), h: Math.round(rows * tileH + gut),
      contrast: 1.45, oy: 60,
    });
    const skip = new Set(['0,3', '1,0']);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (skip.has(`${r},${c}`)) continue;
        const sx = c * (cw + gut), sy = r * (tileH + gut);
        ctx.fillStyle = '#FBFAF7';
        ctx.fillRect(fieldX + sx, tileTop + sy, cw, tileH);
        ctx.drawImage(whole, sx, sy, cw, tileH,
                      fieldX + sx, tileTop + sy, cw, tileH);
      }
    }
  }

  /*
   * The word that pays off the swipe.
   *
   * Set to span from inside panel one to inside panel three, so the cut
   * at 2048 falls through the middle of it. On the first panel it is an
   * unexplained fragment; a swipe finishes it. This is the one thing
   * here that only works because it is a carousel.
   */
  const word = 'INVISIBLE';
  const wordX = P + 40, wordW = P * 2 - 40;
  const size = spanSize(ctx, word, wordW, { cap: 420 });
  ctx.font = `900 ${size}px ${BLACK}`;
  ctx.letterSpacing = `${-size * 0.035}px`;
  ctx.fillStyle = INK;
  ctx.fillText(word, wordX, 380);
  ctx.letterSpacing = '0px';

  // above the field, not on it: at 452 it printed across the top row
  meta(ctx, 'One. Your menu is a photograph.', { x: P + 150, y: 414 });
  body(ctx, [
    'A picture of a menu is a picture. Google reads',
    'nothing in it. Neither does a screen reader, nor',
    'the person searching for the one dish you are',
    'known for.',
    '',
    'Every word on it may as well not exist.',
  ], { x: P + 150, y: 920, size: 21 });   // clear of the rule at 1146

  /*
   * ---- panel 2: the counter-list ----------------------------------
   *
   * This panel was the tail of the spanning word and nothing else:
   * two-thirds of it empty, and on its own it said nothing at all. It
   * carries the second fault now.
   */
  const ix = P * 2 + 150;
  meta(ctx, 'Two. Eleven seconds.', { x: ix, y: 560 });
  ctx.fillStyle = INK;
  ctx.font = `900 64px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillText('Nobody waits', ix, 664);
  ctx.fillText('eleven seconds.', ix, 732);
  ctx.letterSpacing = '0px';
  body(ctx, [
    'That is how long a booking page I was sent took',
    'to become usable on a phone.',
    '',
    'The booking system was fine. The page carrying',
    'it was not, and every enquiry died in the wait —',
    'silently, because nobody who leaves tells you',
    'they left.',
  ], { x: ix, y: 818, size: 19 });

  /* ---- panel 3: the grid, drawn, growing out of the tile field ---- */
  const gx = P * 3 + 52, gw = P - 104;
  ctx.strokeStyle = RED; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.4;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.strokeRect(gx + c * (gw / 3) + 5, 150 + r * 200 + 5, gw / 3 - 10, 190);
    }
  }
  ctx.globalAlpha = 1;

  /*
   * Lines are sized to their own measure, so they are all different
   * heights. Advancing by the line just drawn is wrong: where the next
   * line is bigger, its cap starts above the previous baseline and the
   * two collide. Advance by the line about to be drawn, then scale the
   * whole stack once so it lands inside the band.
   */
  const head = ['it submits.', 'it says', 'thank you.', 'it sends', 'nothing.'];
  const inset = [300, 140, 140, 60, 140];
  const sizes = head.map((l, i) => spanSize(ctx, l, gw - inset[i], { cap: 170 }));
  const step = (i) => sizes[i] * 0.98;
  const HEAD_TOP = 336, HEAD_BOTTOM = 946;
  let need = 0;
  for (let i = 1; i < sizes.length; i++) need += step(i);
  const k = Math.min(1, (HEAD_BOTTOM - HEAD_TOP) / need);

  let hy = HEAD_TOP;
  head.forEach((line, i) => {
    const s = sizes[i] * k;
    if (i) hy += step(i) * k;
    ctx.font = `900 ${s}px ${BLACK}`;
    ctx.letterSpacing = `${-s * 0.035}px`;
    const x = i === 2 ? gx + 60 : gx;
    ctx.fillStyle = GREY;
    ctx.fillRect(x - 8, hy - s * 0.72, ctx.measureText(line).width + 24, s * 0.86);
    ctx.fillStyle = RED;
    ctx.fillText(line, x, hy);
  });
  ctx.letterSpacing = '0px';

  meta(ctx, 'Three. The form that goes nowhere.', { x: gx, y: 200, colour: RED });
  // six lines at 21 ran past the rule and off the sheet; four fit
  body(ctx, [
    'A contact form quietly failing for months. Nobody',
    'complains about a business that never replied.',
    'They just go somewhere else, and you read it as',
    'a slow year.',
  ], { x: gx, y: 1000, size: 21 });

  /* ---- panel 4: 03 and 04, then the close ------------------------- */
  const dx = P * 4 + 92;
  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(P * 4 + 856, 262, 33, 0, Math.PI * 2); ctx.fill();

  ctx.font = `900 62px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillStyle = INK;
  ctx.fillText('None of that', dx, 232);

  // the knockout lands on the word the whole piece is arguing against
  const ks = 62;
  ctx.font = `900 ${ks}px ${BLACK}`;
  const wWas = ctx.measureText('was a ').width;
  const wRed = ctx.measureText('redesign.').width;
  ctx.fillStyle = INK;
  ctx.fillText('was a ', dx, 300);
  // the slab used to start 6px before the word and swallowed the space
  ctx.fillRect(dx + wWas + 4, 300 - ks * 0.82, wRed + 26, ks * 1.08);
  ctx.fillStyle = PAPER;
  ctx.fillText('redesign.', dx + wWas + 17, 300);
  ctx.letterSpacing = '0px';

  body(ctx, [
    'Three fixes, days of work, and nothing on the',
    'site has to look any different afterwards.',
  ], { x: dx, y: 356, size: 20 });

  meta(ctx, 'Check your own, in ten minutes', { x: dx, y: 500 });
  body(ctx, [
    'Paste a line from your menu into Google. If it',
    'does not come back, it is a photograph.',
    '',
    'Open your booking page on mobile data, not',
    'your own wifi, and count.',
    '',
    'Send yourself an enquiry through your own',
    'form, then go and look for the email.',
  ], { x: dx, y: 556, size: 20 });

  /*
   * The right half of this panel was empty. It gets the figure the
   * section is about — someone who gave up — standing on the same rule
   * as the figure on panel one, so the piece closes where it opened.
   */
  if (A.slump) {
    const sw = 430, sh = 664;
    ctx.fillStyle = '#FBFAF7';
    ctx.fillRect(P * 5 - sw, 1148 - sh, sw, sh);
    ctx.drawImage(stipple(A.slump, { w: sw, h: sh, contrast: 1.5, oy: -30 }),
                  P * 5 - sw, 1148 - sh);
  }

  ctx.font = `700 34px ${GROT}`;
  ctx.fillStyle = INK;
  ctx.fillText('I find these for a living.', dx, 1046);
  body(ctx, ['Ashley — web3ashley.com'], { x: dx, y: 1086, size: 21 });

  /*
   * No furniture. There was a handle top-left and an 01/05 counter
   * top-right on every panel, both in tracked uppercase mono: the exact
   * pair of tells that makes a carousel look machine-made. A reader can
   * already see how many panels there are, and the piece is signed once
   * at the end, in words.
   */
}

/** Paper tooth over the whole sheet, so the cuts share one surface. */
export function tooth(ctx, amount = 0.05, w = W, h = H) {
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
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------ export */

const SOURCES = {
  figure: '/assets/stock/src/figure-laptop.jpg',
  face: '/assets/stock/src/portrait-bw.jpg',
  slump: '/assets/stock/src/figure-slump.jpg',
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
  // no cutOut on the slump: its background is as dark as its subject, so
  // corner-sampling removes nothing and leaves a black slab with a
  // straight edge. It runs as a printed rectangle instead, which is what
  // the tile field on panels two and three is doing anyway.
  art = got;
  return art;
}

/** The whole sheet, for looking at end to end. */
export async function drawSheet(canvas) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  scene(ctx, A);
  tooth(ctx);
  return canvas;
}

/** One panel, cut out of it. */
export async function drawPanel(canvas, i) {
  const sheet = document.createElement('canvas');
  await drawSheet(sheet);
  canvas.width = PANEL; canvas.height = H;
  canvas.getContext('2d').drawImage(sheet, i * PANEL, 0, PANEL, H, 0, 0, PANEL, H);
  return canvas;
}

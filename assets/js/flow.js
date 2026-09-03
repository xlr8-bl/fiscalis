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

const PAPER = '#EFEDE7';
const INK = '#111110';
const RED = '#E63122';
const YELLOW = '#F2B12C';
const GREY = '#D9D7D1';

const FACES = [
  ['Grot', '/assets/fonts/archivo-700.woff2', { weight: '700' }],
  ['Black', '/assets/fonts/inter-900.woff2', { weight: '900' }],
  ['Mono', '/assets/fonts/geistmono.woff2', {}],
];
const GROT = '"Grot", Helvetica, Arial, sans-serif';
const BLACK = '"Black", Helvetica, Arial, sans-serif';
const MONO = '"Mono", ui-monospace, monospace';

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

function stipple(img, { w, h, contrast = 1.3, ox = 0, oy = 0 }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  g.drawImage(img, (w - iw) / 2 + ox, (h - ih) / 2 + oy, iw, ih);

  const d = g.getImageData(0, 0, w, h), px = d.data;
  const ink = [0x11, 0x11, 0x10];
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
      else { px[i] = ink[0]; px[i + 1] = ink[1]; px[i + 2] = ink[2]; px[i + 3] = 255; }
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
  return c;
}

/* --------------------------------------------------------------- type */

function meta(ctx, text, { x, y, size = 19, colour = INK, align = 'left', alpha = 0.75 }) {
  ctx.save();
  ctx.font = `${size}px ${MONO}`;
  ctx.letterSpacing = '0.8px';
  ctx.fillStyle = colour; ctx.globalAlpha = alpha; ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
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
  ctx.font = `900 96px ${BLACK}`;
  ctx.letterSpacing = '-3px';
  ctx.fillText('Four', 74, 252);
  ctx.fillText('numbers.', 74, 344);
  ctx.letterSpacing = '0px';
  ctx.font = `700 30px ${GROT}`;
  ctx.fillText('Everything else is noise.', 74, 404);
  body(ctx, [
    'Your analytics shows fourteen charts.',
    'Four of them change what you actually do.',
    'These are the four. Swipe.',
  ], { x: 74, y: 456, size: 21 });

  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(872, 262, 33, 0, Math.PI * 2); ctx.fill();

  if (A.figure) {
    // sized off the cut-out's own proportions rather than a guessed box:
    // forcing a portrait into a square one cropped it to a head and left
    // the rest of the panel empty
    const fh = 760;
    const fw = Math.round(fh * (A.figure.width / A.figure.height));
    const fx = 300, fy = H - fh - 130;
    ctx.drawImage(stipple(A.figure, { w: fw, h: fh, contrast: 1.5 }), fx, fy);
    ctx.save();
    ctx.translate(fx + fw * 0.30, fy + fh * 0.05); ctx.rotate(-0.022);
    ctx.fillStyle = RED; ctx.fillRect(0, 0, 250, 148);
    ctx.restore();
  }

  /* ---- the tile field, running under panels 1 and 2 --------------- */
  const gut = 12;
  const tileTop = 470, tileH = 250;
  /*
   * Narrower than it was. Cover-fitting a portrait into a field almost
   * two panels wide crops it to a horizontal band, and because the
   * photograph's own background is pale it dropped out to nothing — so
   * the outer tiles came up empty and the grid read as broken rather
   * than as deliberately gappy.
   */
  const fieldX = P + 150, fieldW = 1380;
  const cols = 4, rows = 2;
  const cw = (fieldW - gut * (cols - 1)) / cols;

  if (A.face) {
    const whole = stipple(A.face, {
      w: Math.round(fieldW), h: Math.round(rows * tileH + gut), contrast: 1.45, oy: 60,
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
  const word = 'ARRIVALS';
  const wordX = P + 40, wordW = P * 2 - 40;
  const size = spanSize(ctx, word, wordW, { cap: 420 });
  ctx.font = `900 ${size}px ${BLACK}`;
  ctx.letterSpacing = `${-size * 0.035}px`;
  ctx.fillStyle = INK;
  ctx.fillText(word, wordX, 380);
  ctx.letterSpacing = '0px';

  meta(ctx, '01 — WHERE THEY COME FROM', { x: P + 150, y: 452, size: 22, alpha: 1 });
  body(ctx, [
    'Split by channel: search, social, direct, referral.',
    'Not one blob called "users".',
    '',
    'Six months on Instagram, social at 4% of arrivals',
    'and search at 70%. That is an expensive thing to',
    'find out late. Check it monthly, never daily.',
  ], { x: P + 150, y: 920, size: 21 });   // clear of the rule at 1146

  /* ---- panel 3: the grid, drawn, growing out of the tile field ---- */
  const gx = P * 3 + 52, gw = P - 104;
  ctx.strokeStyle = RED; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.4;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.strokeRect(gx + c * (gw / 3) + 5, 150 + r * 200 + 5, gw / 3 - 10, 190);
    }
  }
  ctx.globalAlpha = 1;

  const head = ['how many', 'do the', 'thing you', 'want?'];
  let hy = 330;
  head.forEach((line, i) => {
    const s = spanSize(ctx, line, gw - (i === 0 ? 300 : i === 3 ? 60 : 140), { cap: 170 });
    ctx.font = `900 ${s}px ${BLACK}`;
    ctx.letterSpacing = `${-s * 0.035}px`;
    const x = i === 2 ? gx + 60 : gx;
    ctx.fillStyle = GREY;
    ctx.fillRect(x - 8, hy - s * 0.72, ctx.measureText(line).width + 24, s * 0.86);
    ctx.fillStyle = RED;
    ctx.fillText(line, x, hy);
    hy += s * 0.96;
  });
  ctx.letterSpacing = '0px';

  meta(ctx, '02 — CONVERSION', { x: gx, y: 200, size: 22, alpha: 1, colour: RED });
  // six lines at 21 ran past the rule and off the sheet; four fit
  body(ctx, [
    'Pick one action: an enquiry, a booking, a call.',
    '1 to 3% is normal. Under 0.5% is broken,',
    'and it is usually the form.',
    'Doubling this is a week of unglamorous fixes.',
  ], { x: gx, y: 1000, size: 21 });

  /* ---- panel 4: 03 and 04, then the close ------------------------- */
  const dx = P * 4 + 92;
  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(P * 4 + 856, 262, 33, 0, Math.PI * 2); ctx.fill();

  meta(ctx, '03 — WHERE THEY LAND', { x: dx, y: 200, size: 22, alpha: 1 });
  ctx.font = `900 62px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillStyle = INK;
  ctx.fillText('Entry pages,', dx, 280);
  ctx.fillText('not top pages.', dx, 348);
  ctx.letterSpacing = '0px';
  body(ctx, [
    'Where strangers meet you. Usually not',
    'the homepage. That page deserves',
    'attention out of all proportion.',
  ], { x: dx, y: 396, size: 20 });

  meta(ctx, '04 — WHERE THEY GIVE UP', { x: dx, y: 560, size: 22, alpha: 1 });
  ctx.font = `900 62px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillStyle = INK;
  ctx.fillText('One step does', dx, 640);

  // the knockout, now carrying a word that means something in context
  const ks = 62;
  ctx.font = `900 ${ks}px ${BLACK}`;
  const wAll = ctx.measureText('all the ').width;
  const wDam = ctx.measureText('damage.').width;
  ctx.fillStyle = INK;
  ctx.fillText('all the ', dx, 708);
  ctx.fillRect(dx + wAll - 6, 708 - ks * 0.8, wDam + 14, ks * 1.04);
  ctx.fillStyle = PAPER;
  ctx.fillText('damage.', dx + wAll, 708);
  ctx.letterSpacing = '0px';

  body(ctx, [
    'A phone number you did not need.',
    'A forced account. A delivery cost',
    'that only appears at the end.',
  ], { x: dx, y: 756, size: 20 });

  ctx.font = `700 34px ${GROT}`;
  ctx.fillStyle = INK;
  ctx.fillText('I find these for a living.', dx, 1046);
  meta(ctx, 'web3ashley.com', { x: dx, y: 1086, size: 20, alpha: 0.7 });

  /* ---- the furniture, once per panel so every slide is signed ----- */
  for (let i = 0; i < PANELS; i++) {
    meta(ctx, 'WEB3ASHLEY', { x: i * P + 74, y: 76 });
    // the subject rides on the right of panel one only; centred on the
    // sheet it landed exactly on a seam and printed through the counter
    // and the next panel's handle at once
    meta(ctx, i === 1 ? 'FOUR NUMBERS' : `0${i + 1}/0${PANELS}`,
         { x: (i + 1) * P - 74, y: 76, align: 'right' });
  }
}

/** Paper tooth over the whole sheet, so the cuts share one surface. */
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

/* ------------------------------------------------------------ export */

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

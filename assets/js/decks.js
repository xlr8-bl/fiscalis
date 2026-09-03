/**
 * decks.js — eight panels, eight different designs.
 *
 * flow.js is one composition cut into five. This is the opposite
 * exercise: every panel here is built on a different structural device,
 * so the set can be judged on which devices are worth keeping rather
 * than on whether a template was filled in well.
 *
 * The devices, in order:
 *
 *   1  reversed   solid ink ground, everything knocked out of it
 *   2  ransom     cut paper — each word on its own slab, its own angle
 *   3  overprint  one word printed twice, off register, ink on ink
 *   4  funnel     an actual diagram; the drop is the picture
 *   5  density    a field of small type with one hole burned in it
 *   6  crop       a numeral enlarged past every edge, type inside it
 *   7  gridswap   a photo grid with cells lifted out and replaced
 *   8  tear       the sheet split, negative above, paper below
 *
 * Content is the three faults from the site's about copy, so the panels
 * are comparable: the only variable is the design.
 */

import { PAPER, INK, RED, YELLOW, GREY, stipple, cutOut, trim, tooth } from './flow.js';

export const W = 1024;
export const H = 1280;

const FACES = [
  ['Grot', '/assets/fonts/archivo-700.woff2', { weight: '700' }],
  ['Black', '/assets/fonts/inter-900.woff2', { weight: '900' }],
  ['Book', '/assets/fonts/inter-500.woff2', { weight: '500' }],
  ['Anton', '/assets/fonts/anton.woff2', {}],
  ['Space', '/assets/fonts/spacegrotesk-700.woff2', { weight: '700' }],
  ['Rough', '/assets/fonts/terminal-grotesque.ttf', {}],
  ['Bric', '/assets/fonts/bricolage.woff2', {}],
];
const GROT = '"Grot", Helvetica, Arial, sans-serif';
const BLACK = '"Black", Helvetica, Arial, sans-serif';
const BOOK = '"Book", Helvetica, Arial, sans-serif';
const ANTON = '"Anton", Impact, Haettenschweiler, sans-serif';
const SPACE = '"Space", Helvetica, Arial, sans-serif';
const ROUGH = '"Rough", Helvetica, Arial, sans-serif';
const BRIC = '"Bric", Georgia, serif';

let faces = null;
function loadFaces() {
  if (faces) return faces;
  faces = Promise.all(FACES.map(async ([name, url, desc]) => {
    try {
      const f = new FontFace(name, `url(${url})`, desc);
      await f.load(); document.fonts.add(f); return name;
    } catch { return null; }
  }));
  return faces;
}

/* ---------------------------------------------------------------- type */

/** Point size that makes `text` exactly `width` wide in `family`. */
function fit(ctx, text, width, { family = BLACK, weight = 900, cap = 1e4 } = {}) {
  ctx.letterSpacing = '0px';
  ctx.font = `${weight} 100px ${family}`;
  return Math.min(cap, (width / ctx.measureText(text).width) * 100);
}

function para(ctx, lines, { x, y, size = 20, colour = INK, leading = 1.5, family = BOOK, weight = 500 }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = colour;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * leading));
  ctx.restore();
  return y + (lines.length - 1) * size * leading;
}

/* -------------------------------------------------------------- pieces */

/** A slab of colour at a slight angle, as if laid down by hand. */
function slab(ctx, { x, y, w, h, rot = 0, colour = RED }) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Type on its own slab: the ransom-note unit. */
function pasted(ctx, text, { x, y, size, rot = 0, family = BLACK, weight = 900,
                             ground = PAPER, colour = INK, pad = 14, track = 0 }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(text).width + pad * 2;
  const h = size * 1.16;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colour;
  ctx.fillText(text, pad, h - size * 0.28);
  ctx.restore();
  ctx.letterSpacing = '0px';
  return { w, h };
}

/* --------------------------------------------------------------- panels */

/* 1 — REVERSED ---------------------------------------------------------
   Solid ink, edge to edge, and every mark on it is an absence: the type
   is paper, the photograph is printed in paper, the only colour is one
   bar. Nothing here sits on a background — the background is the ink. */
function reversed(ctx, A) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  if (A.figure) {
    const fh = 900;
    const fw = Math.round(fh * (A.figure.width / A.figure.height));
    ctx.globalAlpha = 0.92;
    ctx.drawImage(stipple(A.figure, { w: fw, h: fh, contrast: 1.6, ink: PAPER }),
                  W - fw + 120, H - fh);
    ctx.globalAlpha = 1;
  }

  slab(ctx, { x: -30, y: 236, w: 520, h: 96, rot: -0.014, colour: RED });

  const s = fit(ctx, 'Enquiries', 700, { cap: 250 });
  ctx.fillStyle = PAPER;
  ctx.font = `900 ${s}px ${BLACK}`;
  ctx.letterSpacing = `${-s * 0.04}px`;
  ctx.fillText('Enquiries', 62, 210);
  ctx.fillText('dried up.', 62, 210 + s * 0.92);
  ctx.letterSpacing = '0px';

  para(ctx, [
    'It is not the design. It is three faults',
    'you cannot see from the inside, and',
    'every one of them is costing you now.',
  ], { x: 62, y: 470, size: 24, colour: PAPER, leading: 1.45 });

  ctx.fillStyle = PAPER;
  ctx.font = `700 26px ${GROT}`;
  ctx.fillText('web3ashley.com', 62, H - 66);
}

/* 2 — RANSOM -----------------------------------------------------------
   No background at all in the composed sense: the panel is bare paper
   and the words arrive as separate physical pieces, each with its own
   ground, size, face and angle. Meaning is assembled, not laid out. */
function ransom(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  if (A.face) {
    // at half opacity this went grey and stopped reading as print; and
    // at 620x760 from x=300 its bottom corner stuck out past the caption
    // slab as a stray block
    const c = stipple(A.face, { w: 520, h: 700, contrast: 1.55, oy: 40 });
    ctx.globalAlpha = 0.92;
    ctx.drawImage(c, 210, 420);
    ctx.globalAlpha = 1;
  }

  pasted(ctx, 'Your', { x: 58, y: 150, size: 132, rot: -0.03, ground: INK, colour: PAPER });
  pasted(ctx, 'menu', { x: 400, y: 118, size: 168, rot: 0.022, family: ANTON, weight: 400,
                        ground: YELLOW, colour: INK });
  pasted(ctx, 'is a', { x: 74, y: 330, size: 104, rot: 0.04, family: BRIC, weight: 400,
                        ground: PAPER, colour: INK, pad: 6 });
  pasted(ctx, 'PHOTO', { x: 300, y: 318, size: 150, rot: -0.018, family: ANTON, weight: 400,
                         ground: RED, colour: PAPER, track: -4 });
  pasted(ctx, 'graph.', { x: 96, y: 494, size: 176, rot: 0.012, family: ANTON, weight: 400,
                          ground: INK, colour: PAPER, track: -5 });

  slab(ctx, { x: 690, y: 686, w: 300, h: 330, rot: 0.03, colour: PAPER });
  para(ctx, [
    'A picture of a menu',
    'is a picture. Google',
    'reads nothing in it.',
    'Neither does a screen',
    'reader, nor the',
    'person searching for',
    'the one dish you are',
    'known for.',
  ], { x: 712, y: 736, size: 20, leading: 1.5 });

  pasted(ctx, 'every word on it may as well not exist', {
    x: 58, y: 1146, size: 34, rot: -0.008, family: ROUGH, weight: 400,
    ground: INK, colour: YELLOW, pad: 18,
  });
}

/* 3 — OVERPRINT --------------------------------------------------------
   One word, printed twice, out of register: red first, ink over it,
   shifted. Where they cross the paper goes black; where they miss you
   see the mistake. The photograph is banded through the middle of it so
   the word and the image share one surface. */
function overprint(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // the photograph goes down first and full width, so the plates print
  // onto it rather than under it. Bled off both edges before, the word
  // lost its first and last letter and stopped being a word.
  if (A.face) {
    const band = stipple(A.face, { w: W, h: 330, contrast: 1.5, oy: 90 });
    ctx.globalAlpha = 0.9;
    ctx.drawImage(band, 0, 168);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = INK;
  ctx.font = `700 30px ${SPACE}`;
  ctx.fillText('One. Your menu is a photograph.', 60, 120);

  const word = 'INVISIBLE';
  const s = fit(ctx, word, W - 84, { family: ANTON, weight: 400 });

  const plate = (dx, dy, colour) => {
    ctx.save();
    ctx.font = `400 ${s}px ${ANTON}`;
    ctx.letterSpacing = `${-s * 0.012}px`;
    ctx.fillStyle = colour;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillText(word, 42 + dx, 640 + dy);
    ctx.restore();
  };
  plate(0, 0, RED);
  plate(11, -8, INK);
  ctx.letterSpacing = '0px';

  para(ctx, [
    'Every word on it may as well not exist. Not to Google,',
    'not to a screen reader, not to the person searching for',
    'the one dish you are known for.',
  ], { x: 60, y: 760, size: 23, leading: 1.5 });

  ctx.fillStyle = RED;
  ctx.fillRect(60, 866, 400, 5);

  para(ctx, [
    'The fix is a menu set as text on the page.',
    'One afternoon, and no part of the design',
    'has to change.',
  ], { x: 60, y: 932, size: 23, leading: 1.5 });

  ctx.fillStyle = INK;
  ctx.font = `700 26px ${GROT}`;
  ctx.fillText('Ashley — web3ashley.com', 60, H - 66);
}

/* 4 — FUNNEL -----------------------------------------------------------
   The only panel here that is information rather than expression. Five
   bars, each the width of the traffic that survives that step, and the
   one that collapses is the whole argument. Nobody has to be persuaded
   by a picture that is simply true. */
function funnel(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.font = `900 70px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillText('One step', 60, 150);
  ctx.fillText('does all of it.', 60, 220);
  ctx.letterSpacing = '0px';

  para(ctx, ['A booking flow I was asked to look at. Same hundred people,'
             , 'step by step, and the damage is all in one place.'],
       { x: 60, y: 274, size: 21, leading: 1.5 });

  const steps = [
    ['Opened the page', 100],
    ['Chose a time', 82],
    ['Started the form', 71],
    ['Asked for a phone number', 24],
    ['Actually booked', 21],
  ];
  const bx = 60, bw = W - 120, top = 360, gap = 24;
  const bh = 108;

  steps.forEach(([label, pct], i) => {
    const y = top + i * (bh + gap);
    const w = Math.round(bw * pct / 100);
    const kill = i === 3;
    ctx.fillStyle = kill ? RED : GREY;
    ctx.fillRect(bx, y, w, bh);

    // a label wider than its own bar was being clipped by the bar it sat
    // in, so on the short bars it sets outside, in ink, on the paper
    ctx.font = `700 25px ${GROT}`;
    const fits = ctx.measureText(label).width < w - 40;
    ctx.fillStyle = fits ? (kill ? PAPER : INK) : INK;
    ctx.fillText(label, fits ? bx + 20 : bx + w + 20, y + 42);

    ctx.fillStyle = kill ? PAPER : INK;
    ctx.font = `900 ${kill ? 52 : 44}px ${BLACK}`;
    ctx.fillText(`${pct}`, bx + 20, y + bh - 18);

    if (kill) {
      ctx.fillStyle = RED;
      ctx.font = `700 24px ${GROT}`;
      ctx.fillText('47 people leave here', bx + w + 20, y + bh - 22);
    }
  });

  ctx.fillStyle = INK;
  ctx.font = `700 27px ${GROT}`;
  ctx.fillText('Remove the phone number. Nothing else changes.', 60, H - 74);
}

/* 5 — DENSITY ----------------------------------------------------------
   The panel is filled, corner to corner, with the same phrase at reading
   size, and then a hole is burned through it. The texture is type, so
   there is no flat ground anywhere on the page — and the hole is the only
   place your eye can rest, which is where the message is. */
function density(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const phrase = 'eleven seconds  ';
  ctx.font = `500 17px ${BOOK}`;
  const pw = ctx.measureText(phrase).width;
  const reps = Math.ceil((W + pw) / pw) + 1;
  const row = phrase.repeat(reps);

  ctx.fillStyle = INK;
  for (let i = 0, y = 34; y < H; i++, y += 25) {
    ctx.globalAlpha = 0.30 + 0.5 * ((i * 7) % 11) / 11;
    ctx.fillText(row, -((i * 61) % Math.round(pw)), y);
  }
  ctx.globalAlpha = 1;

  /*
   * The hole is measured from the type rather than guessed. Sized off
   * ELEVEN, the longer word ran off the right edge; and a fixed 494-high
   * slab left the headline hanging over the noise at both ends with the
   * body copy unreadable on top of it.
   */
  const s = fit(ctx, 'SECONDS', W - 210, { family: ANTON, weight: 400 });
  const top = 350, pad = 46;
  const bodyTop = top + s * 1.72 + 62;
  slab(ctx, { x: pad, y: top - 44, w: W - pad * 2,
              h: (bodyTop + 22 * 1.5 * 2 + 40) - (top - 44), colour: PAPER });

  ctx.fillStyle = RED;
  ctx.font = `400 ${s}px ${ANTON}`;
  ctx.letterSpacing = `${-s * 0.02}px`;
  ctx.fillText('ELEVEN', 78, top + s * 0.86);
  ctx.fillStyle = INK;
  ctx.fillText('SECONDS', 78, top + s * 1.72);
  ctx.letterSpacing = '0px';

  para(ctx, [
    'is how long a booking page I was sent took to',
    'become usable on a phone. The booking system',
    'was fine. The page carrying it was not.',
  ], { x: 78, y: bodyTop, size: 22, leading: 1.5 });

  slab(ctx, { x: 46, y: 1080, w: 660, h: 74, colour: INK });
  ctx.fillStyle = PAPER;
  ctx.font = `700 27px ${GROT}`;
  ctx.fillText('Nobody who leaves tells you they left.', 74, 1128);
}

/* 6 — CROP -------------------------------------------------------------
   A numeral enlarged until it leaves the sheet on all four sides, drawn
   as outline so it reads as structure rather than as a shape. The copy
   is set inside its counters. The page has no margin and no centre. */
function crop(ctx, A) {
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 0, W, H);

  /*
   * At 2000px the numeral left the sheet on every side and stopped
   * being a numeral — it read as four unexplained stripes, which is
   * exactly the abstraction this set is meant to avoid. Big enough to
   * bleed off the foot, small enough to still say eleven.
   */
  ctx.save();
  ctx.font = `400 1560px ${ANTON}`;
  ctx.letterSpacing = '-70px';
  ctx.lineWidth = 22;
  ctx.strokeStyle = INK;
  ctx.strokeText('11', 54, 1420);
  ctx.restore();
  ctx.letterSpacing = '0px';

  slab(ctx, { x: 96, y: 150, w: 470, h: 250, rot: -0.02, colour: PAPER });
  ctx.save();
  ctx.translate(96, 150); ctx.rotate(-0.02);
  ctx.fillStyle = INK;
  ctx.font = `900 60px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillText('Seconds', 28, 96);
  ctx.fillText('to load.', 28, 162);
  ctx.letterSpacing = '0px';
  ctx.font = `500 20px ${BOOK}`;
  ctx.fillText('Most people are gone by three.', 28, 212);
  ctx.restore();

  slab(ctx, { x: 300, y: 736, w: 660, h: 296, rot: 0.014, colour: INK });
  ctx.save();
  ctx.translate(300, 736); ctx.rotate(0.014);
  para(ctx, [
    'A booking page I was sent, on a phone,',
    'on mobile data rather than the office wifi.',
    '',
    'The booking system was fine. The page',
    'carrying it was not, and every enquiry',
    'died in the wait.',
  ], { x: 32, y: 62, size: 21, colour: PAPER, leading: 1.5 });
  ctx.restore();
}

/* 7 — GRIDSWAP ---------------------------------------------------------
   A photographic grid where some cells have been lifted out and replaced
   by flat colour carrying a word. The image and the type occupy the same
   structure at the same scale, so neither is sitting on the other. */
function gridswap(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  /*
   * Five rows, not four, and one whole row belongs to the caption. On a
   * four-row grid the caption band had to be laid over the cells and it
   * cut two words in half.
   */
  const cols = 3, rows = 5, gut = 8;
  const CAPTION_ROW = 2;
  const cw = (W - gut * (cols - 1)) / cols;
  const ch = (H - gut * (rows - 1)) / rows;

  const sheet = A.face
    ? stipple(A.face, { w: W, h: H, contrast: 1.5, oy: -110 })
    : null;

  // which cells are lifted, and what replaces them
  const swap = {
    '0,1': [RED, 'it', PAPER],
    '1,0': [INK, 'submits.', PAPER],
    '1,2': [YELLOW, 'it says', INK],
    '3,0': [INK, 'thank', PAPER],
    '3,2': [RED, 'you.', PAPER],
    '4,1': [INK, 'nothing', PAPER],
  };

  for (let r = 0; r < rows; r++) {
    if (r === CAPTION_ROW) continue;
    for (let c = 0; c < cols; c++) {
      const x = c * (cw + gut), y = r * (ch + gut);
      const hit = swap[`${r},${c}`];
      if (hit) {
        const [ground, text, colour] = hit;
        ctx.fillStyle = ground;
        ctx.fillRect(x, y, cw, ch);
        const s = fit(ctx, text, cw - 34, { family: ANTON, weight: 400, cap: 150 });
        ctx.fillStyle = colour;
        ctx.font = `400 ${s}px ${ANTON}`;
        ctx.fillText(text, x + 17, y + ch / 2 + s * 0.34);
      } else if (sheet) {
        ctx.fillStyle = '#FBFAF7';
        ctx.fillRect(x, y, cw, ch);
        ctx.drawImage(sheet, x, y, cw, ch, x, y, cw, ch);
      }
    }
  }

  // the caption owns its own row, full width, so it cuts nothing
  const cy = CAPTION_ROW * (ch + gut);
  slab(ctx, { x: 0, y: cy, w: W, h: ch, colour: PAPER });
  ctx.fillStyle = INK;
  ctx.font = `900 40px ${BLACK}`;
  ctx.letterSpacing = '-1px';
  ctx.fillText('Three. The form', 34, cy + 62);
  ctx.fillText('that goes nowhere.', 34, cy + 106);
  ctx.letterSpacing = '0px';
  para(ctx, [
    'Failing quietly for months. Nobody complains about a',
    'business that never replied — they go somewhere else,',
    'and you read it as a slow year.',
  ], { x: 34, y: cy + 150, size: 20, leading: 1.45 });
}

/* 8 — TEAR -------------------------------------------------------------
   The sheet is torn across a diagonal. Above it the print is negative,
   below it positive, and one line of type crosses the tear so it is half
   in each — which is only legible because the two halves invert. */
function tear(ctx, A) {
  /*
   * One path defines the tear, and everything is cut by it: the ink
   * ground, the paper below, and both halves of the type. Clipping the
   * type against a straight diagonal while filling the paper along a
   * ragged one is what ate the tops of the letters — wherever the
   * ragged edge rose above the straight line, the paper-coloured half
   * was painted over.
   */
  const edge = (from = 0) => {
    ctx.beginPath();
    ctx.moveTo(0, from);
    ctx.lineTo(W, from);
    ctx.lineTo(W, 612);
    for (let x = W; x >= 0; x -= 26) {
      const base = 742 + (612 - 742) * (x / W);
      let n = (x * 374761393) | 0; n = (n ^ (n >> 13)) * 1274126177;
      const j = (((n ^ (n >> 16)) >>> 0) / 4294967295 - 0.5) * 17;
      ctx.lineTo(x, base + j);
    }
    ctx.closePath();
  };

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // above the tear: ink ground, photograph printed in paper
  ctx.save();
  edge();
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  // 780 tall put the photograph directly behind the headline, and paper
  // type on a high-contrast stipple is unreadable however correctly it
  // is clipped. It stops short, so the reversed half sits on flat ink.
  if (A.slump) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(stipple(A.slump, { w: W, h: 570, contrast: 1.55, ink: PAPER, oy: -30 }), 0, 0);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // type crossing the tear: same string twice, clipped by the same edge
  const line = 'None of that';
  const s = fit(ctx, line, W - 110, { cap: 200 });
  const draw = (colour) => {
    ctx.font = `900 ${s}px ${BLACK}`;
    ctx.letterSpacing = `${-s * 0.04}px`;
    ctx.fillStyle = colour;
    ctx.fillText(line, 56, 748);
    ctx.letterSpacing = '0px';
  };
  ctx.save(); edge(); ctx.clip(); draw(PAPER); ctx.restore();
  ctx.save();
  edge(H);          // the same path taken from the foot: everything below
  ctx.clip();
  draw(INK);
  ctx.restore();

  ctx.fillStyle = RED;
  ctx.font = `900 ${s * 0.86}px ${BLACK}`;
  ctx.letterSpacing = `${-s * 0.034}px`;
  ctx.fillText('was a redesign.', 56, 748 + s * 0.9);
  ctx.letterSpacing = '0px';

  para(ctx, [
    'Three fixes. Days of work, not months. Nothing',
    'on the site has to look any different afterwards,',
    'and I hand over the numbers that show it worked.',
  ], { x: 56, y: 1010, size: 23, leading: 1.5 });

  ctx.fillStyle = INK;
  ctx.font = `700 26px ${GROT}`;
  ctx.fillText('Ashley — web3ashley.com', 56, H - 66);
}

/* --------------------------------------------------------------- export */

export const DESIGNS = [
  ['reversed', reversed], ['ransom', ransom], ['overprint', overprint],
  ['funnel', funnel], ['density', density], ['crop', crop],
  ['gridswap', gridswap], ['tear', tear],
];

const SOURCES = {
  figure: '/assets/stock/src/figure-laptop.jpg',
  face: '/assets/stock/src/portrait-bw.jpg',
  slump: '/assets/stock/src/figure-slump.jpg',
  crouch: '/assets/stock/src/figure-crouch.jpg',
};

let art = null;
async function load() {
  if (art) return art;
  const one = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  const got = {};
  for (const [k, src] of Object.entries(SOURCES)) got[k] = await one(src);
  // only the laptop shot has a background pale enough to key out
  if (got.figure) got.figure = cutOut(got.figure, { tolerance: 52 });
  art = got;
  return art;
}

/** Draw design `i` into `canvas` at native size. */
export async function draw(canvas, i) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  DESIGNS[i][1](ctx, A);
  tooth(ctx, 0.05, W, H);
  return canvas;
}

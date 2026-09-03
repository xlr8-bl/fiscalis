/**
 * hooks2.js — five hooks, five topics, five grounds.
 *
 * Everything learned so far, applied at once:
 *
 *   the hook grammar from hooks.js — the sentence broken across an
 *   extreme scale jump, second person, an image that is evidence
 *
 *   the grounds from press.js, which are whole colour fields carrying
 *   their measured contrast ratio, not accents on paper
 *
 *   the clustered-dot halftone at a pitch chosen per element, and
 *   grain at the measured sigma
 *
 *   the cut-outs from tools/extract_objects.py, keyed offline and
 *   loaded as transparent PNGs rather than keyed in the browser
 *
 * Each panel takes a different route to the image, so the set shows
 * range rather than one trick five times: a device, a drawn interface,
 * a field of cells with the type cutting through it, a screened figure
 * against an object, and one panel with no image at all.
 *
 * The red panel carries no body copy. That is not a stylistic choice —
 * GROUNDS.red measures 4.31:1, which is fine for display type and not
 * fine for a paragraph, so the design has to work without one.
 */

import { tooth } from './flow.js';
import { loadFaces, fit, para, GROT, BLACK } from './decks.js';
import { GROUNDS, halftone, pitchFor, grain, coverage } from './press.js';
import { phone, skeleton, mapPack, grid, receipt, chip } from './ui.js';

export const W = 1024;
export const H = 1280;
const M = 62;
const COL = W - M * 2;

/** The setup/payoff pair. Ratio is enforced, not negotiated. */
function saypair(ctx, small, big, { y, colour, accent = null, cap = 200 }) {
  ctx.save();
  const s = fit(ctx, small, COL * 0.54, { family: GROT, weight: 700, cap: 50 });
  ctx.fillStyle = colour;
  ctx.font = `700 ${s}px ${GROT}`;
  ctx.fillText(small, M, y);

  const b = Math.min(cap, ...big.map((l) => fit(ctx, l, COL, { cap })));
  ctx.font = `900 ${b}px ${BLACK}`;
  ctx.letterSpacing = `${-b * 0.042}px`;
  big.forEach((line, i) => {
    ctx.fillStyle = accent && i === big.length - 1 ? accent : colour;
    ctx.fillText(line, M, y + b * 0.86 + i * b * 0.88);
  });
  ctx.letterSpacing = '0px';
  ctx.restore();
  return y + b * 0.86 + (big.length - 1) * b * 0.88;
}

function sign(ctx, colour) {
  ctx.fillStyle = colour;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
}

/* 1 — INSTAGRAM: amber ground, a device you do not control ------------- */
function rented(ctx, A) {
  const S = GROUNDS.amber;
  ctx.fillStyle = S.ground;
  ctx.fillRect(0, 0, W, H);

  const end = saypair(ctx, 'You have 4,000 followers.',
                      ['You own', 'none of them.'],
                      { y: 176, colour: S.mark, cap: 148 });
  para(ctx, [
    'You cannot export them, cannot email them, and',
    'if the account goes you start from zero. A list of',
    '300 people you own beats 10,000 you rent.',
  ], { x: M, y: end + 74, size: 24, colour: S.mark, leading: 1.45 });

  // the device, tilted and bled, with nothing on the screen
  ctx.save();
  ctx.translate(452, 596);
  ctx.rotate(0.07);
  const s = phone(ctx, { x: 0, y: 0, w: 440, h: 900, body: S.mark, screen: '#F7F2E2' });
  ctx.fillStyle = S.accent;
  ctx.fillRect(s.x, s.y, s.w, 92);
  skeleton(ctx, { x: s.x + 28, y: s.y + 150, w: s.w - 56, lines: 3, size: 20, gap: 20,
                  colour: '#DCD4BE' });
  ctx.restore();

  sign(ctx, S.mark);
}

/* 2 — GOOGLE PROFILE: blue ground, a drawn interface ------------------- */
function freeHour(ctx, A) {
  const S = GROUNDS.blue;
  ctx.fillStyle = S.ground;
  ctx.fillRect(0, 0, W, H);

  const end = saypair(ctx, 'One free hour',
                      ['beats your', 'website.'],
                      { y: 172, colour: S.mark, accent: S.accent, cap: 150 });
  para(ctx, [
    'For a local business the map pack usually does',
    'more work than the site does. It is free, and most',
    'listings are about 40% filled in.',
  ], { x: M, y: end + 70, size: 24, colour: S.mark, leading: 1.45 });

  mapPack(ctx, {
    x: M, y: 760, w: COL, h: 420,
    ground: S.mark, on: S.ground, accent: S.accent, pick: 1,
  });

  sign(ctx, S.mark);
}

/* 3 — SPREADSHEET: paper ground, type cutting through the cells -------- */
function oneFile(ctx, A) {
  const S = GROUNDS.paper;
  ctx.fillStyle = S.ground;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = S.mark;
  ctx.font = `700 40px ${GROT}`;
  ctx.fillText('If that laptop died today,', M, 168);

  const word = ['could you take', 'an order', 'tomorrow?'];
  const b = Math.min(112, ...word.map((l) => fit(ctx, l, COL, { cap: 112 })));
  const top = 252;
  ctx.font = `900 ${b}px ${BLACK}`;
  ctx.letterSpacing = `${-b * 0.042}px`;
  word.forEach((l, i) => {
    ctx.fillStyle = i === 2 ? S.accent : S.mark;
    ctx.fillText(l, M, top + i * b * 0.9);
  });
  ctx.letterSpacing = '0px';

  // clear of the type, not through it: an earlier version put the sheet
  // over the headline and its header band cut the second line in half
  // while the cells swallowed the third
  // the first version used #FBFAF7 cells on #EFEDE7 paper, twelve
  // values apart: it read on screen and measured as nothing, which is
  // the honest answer — a field that faint is not a mark
  grid(ctx, {
    x: M, y: 512, w: COL, h: 520, cols: 6, rows: 10,
    ground: '#E4E1D8', line: '#C3BFB2', on: S.mark, accent: S.accent, hot: [4, 2],
  });

  para(ctx, [
    'One copy, one person who understands the',
    'formulas, and nothing in the business that',
    'survives losing either.',
  ], { x: M, y: 1064, size: 23, colour: S.mark, leading: 1.45 });

  sign(ctx, S.mark);
}

/* 4 — DELIVERY APPS: ink ground, screened figure and an object --------- */
function stranger(ctx, A) {
  const S = GROUNDS.ink;
  ctx.fillStyle = S.ground;
  ctx.fillRect(0, 0, W, H);

  if (A.figure) {
    const fh = 760;
    const fw = Math.round(fh * (A.figure.width / A.figure.height));
    ctx.drawImage(
      halftone(A.figure, { w: fw, h: fh, pitch: pitchFor(fh), ink: S.photo }),
      W - fw + 150, H - fh + 40);
  }

  receipt(ctx, { x: 78, y: 690, w: 300, h: 520, ground: S.photo, on: S.ground });

  const end = saypair(ctx, 'They ordered eleven times.',
                      ['You still', 'do not know', 'their name.'],
                      { y: 168, colour: S.mark, accent: S.accent, cap: 112 });
  para(ctx, [
    'No name, no email, no number you can use. You',
    'cannot tell them you open Sundays, and you',
    'cannot win them back when they stop.',
  ], { x: M, y: end + 62, size: 23, colour: S.mark, leading: 1.45 });

  // to the right of the slip, which the default position printed through
  ctx.fillStyle = S.mark;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', 424, H - 62);
}

/* 5 — REBUILD: red ground, display type only --------------------------- */
function everyDeveloper(ctx, A) {
  const S = GROUNDS.red;
  ctx.fillStyle = S.ground;
  ctx.fillRect(0, 0, W, H);

  saypair(ctx, 'Ask six developers.',
          ['Six say', 'rebuild.'],
          { y: 320, colour: S.mark, cap: 210 });

  // no paragraph on this ground: 4.31:1 will not carry one. The second
  // thought is set at display size instead, which is the size that
  // clears the ratio, and it is the whole reason the panel is short.
  const s = fit(ctx, 'It is also the bigger job.', COL, { cap: 58 });
  ctx.fillStyle = S.mark;
  ctx.font = `900 ${s}px ${BLACK}`;
  ctx.fillText('It is also the bigger job.', M, 880);
  ctx.fillStyle = S.accent;
  ctx.fillText('Six questions settle it.', M, 880 + s * 1.16);

  sign(ctx, S.mark);
}

/* --------------------------------------------------------------- export */

const GROUND_OF = ['amber', 'blue', 'paper', 'ink', 'red'];

export const PANELS = [
  ['amber — you own none of them', rented],
  ['blue — one free hour', freeHour],
  ['paper — could you take an order', oneFile],
  ['ink — they ordered eleven times', stranger],
  ['red — six say rebuild', everyDeveloper],
];

let art = null;
async function load() {
  if (art) return art;
  const one = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  art = { figure: await one('/assets/stock/cut/figure-laptop-01.png') };
  return art;
}

export async function drawPanel(canvas, i) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  PANELS[i][1](ctx, A);
  grain(ctx, W, H);
  // how much of the sheet is a mark rather than bare ground — the
  // question ink coverage cannot answer on a coloured field
  return { canvas, covered: coverage(canvas, GROUNDS[GROUND_OF[i]].ground) };
}

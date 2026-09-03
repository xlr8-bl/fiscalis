/**
 * speed.js — a third carousel, built out of interface parts.
 *
 * From content/articles/why-your-website-is-slow-on-mobile.md. The
 * material here is not photography, it is the website itself: a phone
 * mid-load, a bar chart of what the page is actually carrying, a photo
 * at the size it was uploaded next to the size it displays at, and the
 * bounce curve.
 *
 *   1  device     a phone stuck at 15%, and the number
 *   2  weights    the four culprits, drawn to scale against each other
 *   3  scale      4,000 pixels beside 400, at true relative size
 *   4  curve      what each second costs, as bars
 *   5  order      what to fix first, and the close
 *
 * Every figure on these panels is one the article states. The bars are
 * drawn from those numbers rather than chosen to look good, which is
 * why the content bar on panel two is embarrassingly short — that is
 * the point of the panel.
 */

import { PAPER, INK, RED, YELLOW, GREY, tooth } from './flow.js';
import { loadFaces, fit, para, GROT, BLACK, BOOK } from './decks.js';
import { phone, progress, skeleton, bar, chip } from './ui.js';

export const W = 1024;
export const H = 1280;

const M = 62;
const COL = W - M * 2;

/* 1 — DEVICE -----------------------------------------------------------
   The panel is the experience it describes: a phone that has not
   finished, next to the number of seconds it takes. */
function device(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const t = fit(ctx, 'Eleven', 470, { cap: 158 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${t}px ${BLACK}`;
  ctx.letterSpacing = `${-t * 0.04}px`;
  ctx.fillText('Eleven', M, 218);
  ctx.fillText('seconds.', M, 218 + t * 0.9);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = RED;
  ctx.font = `900 44px ${BLACK}`;
  ctx.fillText('They are gone', M, 218 + t * 1.86);
  ctx.fillText('by second four.', M, 218 + t * 1.86 + 52);

  const s = phone(ctx, { x: 560, y: 402, w: 404, h: 800, screen: '#FBFAF7' });
  progress(ctx, { x: s.x, y: s.y, w: s.w, h: 14, pct: 0.15 });
  skeleton(ctx, { x: s.x + 26, y: s.y + 64, w: s.w - 52, lines: 5, size: 20, gap: 18 });
  skeleton(ctx, { x: s.x + 26, y: s.y + 260, w: s.w - 52, lines: 3, size: 20, gap: 18 });
  ctx.fillStyle = GREY;
  ctx.fillRect(s.x + 26, s.y + 400, s.w - 52, 190);

  para(ctx, [
    'Your laptop, your wifi, your cached',
    'browser — it appears instantly.',
    'A four-year-old Android on mobile',
    'data is a different website.',
    '',
    'You are the worst possible tester',
    'of your own site.',
  ], { x: M, y: 218 + t * 1.86 + 132, size: 22, leading: 1.5 });

  ctx.fillStyle = INK;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
}

/* 2 — WEIGHTS ----------------------------------------------------------
   Four bars, drawn to scale from the sizes the article gives. The one
   the visitor actually came for is the shortest, and the composition
   makes that argument before the caption does. */
function weights(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const t = fit(ctx, 'What the page', COL, { cap: 92 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${t}px ${BLACK}`;
  ctx.letterSpacing = `${-t * 0.035}px`;
  ctx.fillText('What the page', M, 150);
  ctx.fillText('is carrying.', M, 150 + t * 0.92);
  ctx.letterSpacing = '0px';

  const rows = [
    ['One unresized photo', 4000, '4 MB', RED],
    ['Marketing scripts around it', 2400, '2.4 MB', RED],
    ['A third-party font', 300, '300 KB', INK],
    ['Your actual content', 200, '200 KB', INK],
  ];
  const max = 4000;
  let y = 150 + t * 1.86;
  rows.forEach(([label, kb, value, colour]) => {
    bar(ctx, {
      x: M, y, w: Math.max(8, (kb / max) * COL), h: 74,
      colour, label, value, face: BLACK, labelSize: 25, valueSize: 26, on: INK,
    });
    y += 74 + 92;
  });

  // the article states these four sizes; it does not claim they were
  // all measured on one page, so the caption must not either
  para(ctx, [
    'There are only a handful of real culprits and they are',
    'almost always the same ones. I have seen sites where',
    'the content was 200KB and the tools around it 2.4MB.',
  ], { x: M, y: y + 14, size: 22, leading: 1.5 });
}

/* 3 — SCALE ------------------------------------------------------------
   The comparison drawn at true ratio. 4,000 against 400 is ten to one,
   so the small square is a tenth of the width of the large one, and no
   caption is needed to feel it. */
function scale(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.font = `700 27px ${GROT}`;
  ctx.fillText('Uploaded straight off a phone camera', M, 132);

  const big = COL;                      // stands for 4,000 pixels
  const small = Math.round(COL / 10);   // stands for 400, at true ratio
  ctx.fillStyle = GREY;
  ctx.fillRect(M, 168, big, 470);

  const s = fit(ctx, '4,000px', 380, { cap: 118 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${s}px ${BLACK}`;
  ctx.fillText('4,000px', M + 34, 168 + 470 / 2 + s * 0.34);

  chip(ctx, '4 MB', { x: M + 34, y: 168 + 470 - 96, colour: RED, face: BLACK, size: 26 });

  ctx.fillStyle = INK;
  ctx.font = `700 27px ${GROT}`;
  ctx.fillText('Displayed at', M, 726);
  ctx.fillStyle = RED;
  ctx.fillRect(M, 762, small, 47);

  ctx.fillStyle = INK;
  ctx.font = `900 54px ${BLACK}`;
  ctx.fillText('400px', M + small + 22, 806);

  para(ctx, [
    'The browser downloads all four megabytes, paints',
    'four hundred pixels of it, and discards the rest.',
    '',
    'Five of those on one page is twenty megabytes of',
    'transfer for something that should be under one.',
  ], { x: M, y: 906, size: 23, leading: 1.5 });

  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(W - 118, 1176, 42, 0, Math.PI * 2); ctx.fill();
}

/* 4 — CURVE ------------------------------------------------------------
   The cost of each second, as bars rising off a baseline. Attributed on
   the panel, because the numbers are Google's and not mine. */
function curve(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const t = fit(ctx, 'What a second', COL, { cap: 92 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${t}px ${BLACK}`;
  ctx.letterSpacing = `${-t * 0.035}px`;
  ctx.fillText('What a second', M, 150);
  ctx.fillText('actually costs.', M, 150 + t * 0.92);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = INK;
  ctx.font = `500 22px ${BOOK}`;
  ctx.fillText('Bounce probability against a one-second page.', M, 150 + t * 1.46);

  const steps = [['3 sec', 32], ['5 sec', 90], ['10 sec', 123]];
  const base = 980, maxH = 604, maxV = 123;
  const bw = 208, gap = 56;
  steps.forEach(([lab, v], i) => {
    const h = (v / maxV) * maxH;
    const x = M + i * (bw + gap);
    ctx.fillStyle = i === 2 ? RED : INK;
    ctx.fillRect(x, base - h, bw, h);
    ctx.fillStyle = PAPER;
    ctx.font = `900 46px ${BLACK}`;
    ctx.fillText(`+${v}%`, x + 18, base - h + 58);
    ctx.fillStyle = INK;
    ctx.font = `900 30px ${BLACK}`;
    ctx.fillText(lab, x, base + 44);
  });

  para(ctx, [
    'Google’s own research, and unusually consistent',
    'across industries. That is not a ranking penalty —',
    'it is customers leaving before they see anything',
    'you sell.',
  ], { x: M, y: base + 118, size: 23, leading: 1.5 });
}

/* 5 — ORDER ------------------------------------------------------------
   Four fixes in order of return, as numbered blocks, then the close. */
function order(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const t = fit(ctx, 'Fix in this order.', COL, { cap: 88 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${t}px ${BLACK}`;
  ctx.letterSpacing = `${-t * 0.035}px`;
  ctx.fillText('Fix in this order.', M, 148);
  ctx.letterSpacing = '0px';

  const items = [
    ['Resize every image.', 'Export at the size it displays. Biggest win, least work.'],
    ['Delete scripts you do not use.', 'Ask what each has done for you in six months.'],
    ['Host and subset your fonts.', 'Cut to the characters you use is often 90% smaller.'],
    ['Lazy-load below the fold.', 'It should not compete with what someone is reading.'],
  ];
  let y = 226;
  items.forEach(([head, tail], i) => {
    ctx.fillStyle = i === 0 ? RED : INK;
    ctx.fillRect(M, y, 54, 54);
    ctx.fillStyle = PAPER;
    ctx.font = `900 34px ${BLACK}`;
    ctx.fillText(String(i + 1), M + 16, y + 39);

    const hs = Math.min(36, fit(ctx, head, COL - 82, { cap: 36 }));
    ctx.fillStyle = INK;
    ctx.font = `900 ${hs}px ${BLACK}`;
    ctx.fillText(head, M + 82, y + 34);
    ctx.font = `500 21px ${BOOK}`;
    ctx.globalAlpha = 0.62;
    ctx.fillText(tail, M + 82, y + 68);
    ctx.globalAlpha = 1;
    y += 146;
  });

  ctx.fillStyle = INK;
  ctx.fillRect(M, y + 18, COL, 196);
  const q = fit(ctx, 'Every second you cut', COL - 56, { cap: 46 });
  ctx.fillStyle = PAPER;
  ctx.font = `900 ${q}px ${BLACK}`;
  ctx.fillText('Every second you cut', M + 28, y + 84);
  ctx.fillText('is a percentage of people', M + 28, y + 84 + q * 1.08);
  ctx.fillStyle = YELLOW;
  ctx.fillText('who now arrive.', M + 28, y + 84 + q * 2.16);

  ctx.fillStyle = INK;
  ctx.font = `700 29px ${GROT}`;
  ctx.fillText('Ashley — web3ashley.com', M, H - 84);
  ctx.fillStyle = RED;
  ctx.fillRect(M, H - 60, COL, 4);
}

/* ------------------------------------------------------------- export */

export const PANELS = [
  ['device', device],
  ['weights', weights],
  ['scale', scale],
  ['curve', curve],
  ['order', order],
];

export async function drawPanel(canvas, i) {
  await loadFaces();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  PANELS[i][1](ctx);
  tooth(ctx, 0.05, W, H);
  return canvas;
}

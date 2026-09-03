/**
 * owner.js — a second carousel: who actually owns your website.
 *
 * Drawn from content/articles/who-owns-your-website.md. Five panels,
 * five different structural devices, on the principle established in
 * decks.js: a carousel is five designs that share a palette, not one
 * template filled in five times.
 *
 *   1  reversed   ink ground, the hook knocked out of it
 *   2  quadrant   the four things, as four cells; one of them is not
 *                 like the others and the design says so before the
 *                 words do
 *   3  overprint  the one word that cannot be rebuilt, printed twice
 *                 and off register
 *   4  checklist  an actual test the reader can run, drawn as a test
 *   5  statement  the line the whole piece is for, and nothing else
 *
 * Every size here is measured, not guessed: fit() returns the point
 * size that makes a string exactly as wide as the space it has, so
 * changing the copy changes the type size rather than the margin.
 */

import { PAPER, INK, RED, YELLOW, GREY, stipple, cutOut, tooth } from './flow.js';
import { loadFaces, fit, para, slab, pasted, GROT, BLACK, BOOK, ANTON } from './decks.js';

export const W = 1024;
export const H = 1280;
export const COUNT = 5;

const M = 62;                    // the margin every panel shares
const COL = W - M * 2;           // and the measure that follows from it

/* ------------------------------------------------------------- panels */

/* 1 — REVERSED ---------------------------------------------------------
   The accusation, knocked out of solid ink. Nothing sits on a ground
   here; the ground is the ink and every mark is an absence in it. */
function hook(ctx, A) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  if (A.figure) {
    // bled off the bottom edge rather than floated: the panel's whole
    // lower third was empty and a small figure parked in it read as an
    // afterthought instead of as part of the composition
    const fh = 700;
    const fw = Math.round(fh * (A.figure.width / A.figure.height));
    ctx.drawImage(stipple(A.figure, { w: fw, h: fh, contrast: 1.55, ink: PAPER }),
                  W - fw + 40, H - fh + 40);
  }

  const a = fit(ctx, 'You paid', COL, { cap: 190 });
  ctx.fillStyle = PAPER;
  ctx.font = `900 ${a}px ${BLACK}`;
  ctx.letterSpacing = `${-a * 0.04}px`;
  ctx.fillText('You paid', M, 214);
  ctx.fillText('for it.', M, 214 + a * 0.9);
  ctx.letterSpacing = '0px';

  // The second half lands on red, because it is the half that stings.
  // The slab is measured off the type rather than guessed at a fraction
  // of the column: sized by eye it was narrower than its own longest
  // line and the words hung off the right edge of it.
  const b = fit(ctx, 'You may not', COL, { cap: 132 });
  ctx.font = `900 ${b}px ${BLACK}`;
  ctx.letterSpacing = `${-b * 0.04}px`;
  const wSlab = Math.max(ctx.measureText('You may not').width,
                         ctx.measureText('own it.').width) + 40;
  const ySlab = 214 + a * 1.34;
  slab(ctx, { x: M - 20, y: ySlab, w: wSlab, h: b * 2.24, rot: -0.012 });
  ctx.fillStyle = PAPER;
  ctx.fillText('You may not', M, ySlab + b * 0.92);
  ctx.fillText('own it.', M, ySlab + b * 1.86);
  ctx.letterSpacing = '0px';

  para(ctx, [
    'Ownership of a website is four separate',
    'things. It is entirely possible to own none',
    'of them and believe you own all four.',
  ], { x: M, y: 214 + a * 1.34 + b * 2.9, size: 25, colour: PAPER, leading: 1.45 });

  ctx.fillStyle = PAPER;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
}

/* 2 — QUADRANT ---------------------------------------------------------
   Four cells for four things. Three are outlines; one is filled solid,
   because one of the four cannot be replaced and the composition should
   say that before the caption does. */
function quadrant(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const t = fit(ctx, 'Four separate', COL, { cap: 104 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${t}px ${BLACK}`;
  ctx.letterSpacing = `${-t * 0.035}px`;
  ctx.fillText('Four separate', M, 168);
  ctx.fillText('things.', M, 168 + t * 0.94);
  ctx.letterSpacing = '0px';

  const cells = [
    ['1', 'The domain', 'name', true],
    ['2', 'The code', 'and design files', false],
    ['3', 'The hosting', 'account', false],
    ['4', 'The content', 'and the logo', false],
  ];
  const gap = 16;
  const cw = (COL - gap) / 2, ch = 318;
  const top = 168 + t * 1.5;

  cells.forEach(([n, head, tail, solid], i) => {
    const x = M + (i % 2) * (cw + gap);
    const y = top + Math.floor(i / 2) * (ch + gap);
    if (solid) { ctx.fillStyle = RED; ctx.fillRect(x, y, cw, ch); }
    else { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2); }

    const fg = solid ? PAPER : INK;
    ctx.fillStyle = fg;
    ctx.font = `900 74px ${BLACK}`;
    ctx.fillText(n, x + 26, y + 92);

    const hs = Math.min(40, fit(ctx, head, cw - 52, { cap: 40 }));
    ctx.font = `900 ${hs}px ${BLACK}`;
    ctx.fillText(head, x + 26, y + 168);
    ctx.font = `500 22px ${BOOK}`;
    ctx.globalAlpha = solid ? 0.9 : 0.6;
    ctx.fillText(tail, x + 26, y + 200);
    ctx.globalAlpha = 1;
  });

  const c = fit(ctx, 'Three can be rebuilt.', COL, { cap: 52 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${c}px ${BLACK}`;
  ctx.fillText('Three can be rebuilt.', M, top + ch * 2 + gap + 92);
  ctx.fillStyle = RED;
  ctx.fillText('One cannot.', M, top + ch * 2 + gap + 92 + c * 1.06);
}

/* 3 — OVERPRINT --------------------------------------------------------
   One word, printed twice and slightly off register, the way a two-run
   screenprint misses. The red is under, the ink is over, and the sliver
   of red that escapes on every edge is the whole effect. */
function overprint(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.font = `700 27px ${GROT}`;
  ctx.fillText('Anything can be rebuilt except', M, 176);

  ctx.font = `900 66px ${BLACK}`;
  ctx.letterSpacing = '-2px';
  ctx.fillText('your', M, 258);
  ctx.letterSpacing = '0px';

  // capped, so the word cannot grow up into the two lines above it
  const s = fit(ctx, 'DOMAIN', W - 40, { family: ANTON, weight: 400, cap: 258 });
  ctx.font = `400 ${s}px ${ANTON}`;
  ctx.fillStyle = RED;
  ctx.fillText('DOMAIN', 20 - 9, 534 + 11);
  ctx.fillStyle = INK;
  ctx.fillText('DOMAIN', 20, 534);

  para(ctx, [
    'It carries your search history, your links,',
    'and every card you have ever printed.',
    '',
    'Registered in a developer\u2019s name, on their',
    'account, with their billing \u2014 recovering it',
    'ranges from tedious to not possible.',
  ], { x: M, y: 626, size: 23, leading: 1.5 });

  if (A.face) {
    // bled off the bottom rather than floated at 806, where it printed
    // straight through the last line of the paragraph
    ctx.drawImage(stipple(A.face, { w: W, h: 340, contrast: 1.5, oy: 40 }), 0, H - 340);
  }
}

/* 4 — CHECKLIST --------------------------------------------------------
   Not a list of tips set prettily. An actual instrument: four rows, each
   one a thing to do and the reading that follows from it, with the
   failure state carried in red down the right. */
function checklist(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const t = fit(ctx, 'Twenty minutes,', COL, { cap: 96 });
  ctx.fillStyle = INK;
  ctx.font = `900 ${t}px ${BLACK}`;
  ctx.letterSpacing = `${-t * 0.035}px`;
  ctx.fillText('Twenty minutes,', M, 156);
  ctx.fillText('right now.', M, 156 + t * 0.94);
  ctx.letterSpacing = '0px';

  const rows = [
    ['Look your domain up on WHOIS.', 'Note who is listed, and when it expires.'],
    ['Try to log into the registrar.', 'Cannot? Then you do not control it.'],
    ['Try to log into the hosting.', 'Same test, same answer.'],
    ['Email whoever built it.', 'Ask for the logins, for your records.'],
  ];
  let y = 156 + t * 1.62;
  rows.forEach(([act, read], i) => {
    ctx.fillStyle = i === 1 ? RED : INK;
    ctx.fillRect(M, y, 46, 46);
    ctx.fillStyle = PAPER;
    ctx.font = `900 30px ${BLACK}`;
    ctx.fillText(String(i + 1), M + 14, y + 34);

    const as = Math.min(38, fit(ctx, act, COL - 74, { cap: 38 }));
    ctx.fillStyle = INK;
    ctx.font = `900 ${as}px ${BLACK}`;
    ctx.fillText(act, M + 74, y + 34);
    ctx.font = `500 22px ${BOOK}`;
    ctx.fillStyle = i === 1 ? RED : INK;
    ctx.globalAlpha = i === 1 ? 1 : 0.62;
    ctx.fillText(read, M + 74, y + 72);
    ctx.globalAlpha = 1;
    y += 148;
  });

  slab(ctx, { x: M, y: y + 26, w: COL, h: 178, rot: 0, colour: INK });
  para(ctx, [
    'That last email is completely normal, and',
    'anyone competent answers it without',
    'friction. A defensive reply tells you what',
    'you needed to know.',
  ], { x: M + 28, y: y + 74, size: 23, colour: PAPER, leading: 1.42 });
}

/* 5 — STATEMENT --------------------------------------------------------
   One sentence at the largest size the panel will carry, and nothing
   competing with it. The close earns the space by being the shortest
   true thing in the article. */
function statement(ctx, A) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = YELLOW;
  ctx.beginPath(); ctx.arc(W - 132, 176, 46, 0, Math.PI * 2); ctx.fill();

  const s = fit(ctx, 'ownership.', COL, { cap: 168 });
  ctx.font = `900 ${s}px ${BLACK}`;
  ctx.letterSpacing = `${-s * 0.04}px`;
  ctx.fillStyle = INK;
  ctx.fillText('Access', M, 420);
  ctx.fillText('is not', M, 420 + s * 0.9);

  // the last word knocked out of a slab: the one reversal on the panel
  const wOwn = ctx.measureText('ownership.').width;
  const yOwn = 420 + s * 1.8;
  ctx.fillRect(M - 16, yOwn - s * 0.8, wOwn + 34, s * 1.06 + s * 0.18);
  ctx.fillStyle = PAPER;
  ctx.fillText('ownership.', M, yOwn);
  ctx.letterSpacing = '0px';

  para(ctx, [
    'In almost every case this is carelessness,',
    'not hostage-taking. Someone registered the',
    'domain to get the project moving and never',
    'transferred it. Ask politely, and ask while',
    'the relationship is still a good one.',
  ], { x: M, y: yOwn + 108, size: 24, leading: 1.5 });

  ctx.fillStyle = INK;
  ctx.font = `700 30px ${GROT}`;
  ctx.fillText('Ashley — web3ashley.com', M, H - 88);
  ctx.fillStyle = RED;
  ctx.fillRect(M, H - 62, COL, 4);
}

/* ------------------------------------------------------------- export */

export const PANELS = [
  ['reversed', hook],
  ['quadrant', quadrant],
  ['overprint', overprint],
  ['checklist', checklist],
  ['statement', statement],
];

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
  // trimmed to its own ink, so a figure asked for at 820 arrives at 820
  // instead of a fifth of that, floating inside the photographer's margins
  if (got.figure) got.figure = cutOut(got.figure, { tolerance: 52 });
  art = got;
  return art;
}

export async function drawPanel(canvas, i) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  PANELS[i][1](ctx, A);
  tooth(ctx, 0.05, W, H);
  return canvas;
}

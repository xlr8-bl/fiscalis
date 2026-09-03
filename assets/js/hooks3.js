/**
 * hooks3.js — hooks on full-bleed photography.
 *
 * The four references that prompted this all do the same thing and none
 * of my panels did: a photograph fills the frame, edge to edge, and the
 * type sits on it. Not a figure parked in a corner of a flat field —
 * the picture IS the ground.
 *
 * Three things make that work rather than look like a stock photo with
 * a caption:
 *
 *   THE PICTURE IS TONED INTO THE PALETTE. photoGround() maps it
 *   between two colours by luminance, so a borrowed photograph stops
 *   looking borrowed. The reference with the green field is not a
 *   photograph of grass, it is a photograph pushed into one colour.
 *
 *   THE TYPE AREA IS DARKENED UNTIL IT READS, AND THE AMOUNT IS
 *   MEASURED. fitScrim() samples the actual luminance under the words
 *   and steps a feathered veil up until the contrast clears the target.
 *   A designer does this by eye. At five a day nobody is looking, so it
 *   has to be a number — and a panel that cannot reach the target says
 *   so instead of shipping.
 *
 *   THE ACCENT IS SAMPLED FROM THE PICTURE. The reference sets one word
 *   in lime because the grass is lime. sampleAccent() finds the most
 *   saturated colour in the frame and pushes it to poster strength, so
 *   the second colour belongs to the photograph rather than arriving
 *   from a brand sheet.
 *
 * Each panel reports its measured contrast, so the set can be judged on
 * whether it is legible rather than on whether it looks legible to me.
 */

import { loadFaces, fit, para, GROT, BLACK } from './decks.js';
import {
  photoGround, fitScrim, sampleAccent, pickPolarity, grain, coverage, GROUNDS,
} from './press.js';

export const W = 1024;
export const H = 1280;
const M = 62;
const COL = W - M * 2;

const PAPERISH = '#F2F0E8';
const INKISH = '#141310';

/**
 * The setup/payoff pair, returning the box it filled so the scrim can
 * be fitted to the type rather than to a guess.
 */
function saypair(ctx, small, big, { y, colour, accent = null, cap = 190 }) {
  const s = fit(ctx, small, COL * 0.56, { family: GROT, weight: 700, cap: 48 });
  const b = Math.min(cap, ...big.map((l) => fit(ctx, l, COL, { cap })));
  const last = y + b * 0.86 + (big.length - 1) * b * 0.88;

  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = `700 ${s}px ${GROT}`;
  ctx.fillText(small, M, y);
  ctx.font = `900 ${b}px ${BLACK}`;
  ctx.letterSpacing = `${-b * 0.042}px`;
  big.forEach((line, i) => {
    ctx.fillStyle = accent && i === big.length - 1 ? accent : colour;
    ctx.fillText(line, M, y + b * 0.86 + i * b * 0.88);
  });
  ctx.letterSpacing = '0px';
  ctx.restore();
  return { bottom: last, box: { x: 0, y: y - s * 1.2, w: W, h: last - y + s * 1.2 + b * 0.3 } };
}

/**
 * Draw the panel in the order the effect requires: picture, then the
 * veil fitted to where the words will go, then the words. Measuring
 * before the type is drawn is the whole point — measure after and you
 * are measuring your own headline.
 */
function onPhoto(ctx, img, { tint, contrast = 1.0, ox = 0, oy = 0,
                             textBox, target = 4.5 }) {
  photoGround(ctx, img, { w: W, h: H, tint, contrast, ox, oy });
  const accent = sampleAccent(ctx, { w: W, h: H }) || GROUNDS.paper.accent;
  // the picture decides whether the type is light or dark; forcing
  // light type onto a bright shop interior needed a veil so heavy the
  // photograph stopped being visible
  const pol = pickPolarity(ctx, textBox, { light: PAPERISH, dark: INKISH });
  const fit_ = fitScrim(ctx, textBox, pol.colour, { target, w: W, h: H, dark: pol.dark });
  return { accent, colour: pol.colour, mean: pol.mean, fit: fit_ };
}

/* 1 — the counter: the customer you never got to keep ------------------ */
function counter(ctx, A) {
  const textBox = { x: 0, y: 120, w: W, h: 560 };
  const r = onPhoto(ctx, A.counter, {
    tint: ['#120E0C', '#F4EFE4'], contrast: 1.08,
    textBox, target: 6,
  });

  const { bottom } = saypair(ctx, 'They ordered eleven times.',
                             ['You never', 'got their', 'name.'],
                             { y: 176, colour: r.colour, accent: r.accent, cap: 124 });
  para(ctx, [
    'The apps keep the customer. No name, no email,',
    'no way to tell them you open Sundays.',
  ], { x: M, y: bottom + 64, size: 24, colour: r.colour, leading: 1.45 });

  ctx.fillStyle = r.colour;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
  return r.fit;
}

/* 2 — the path: found on purpose, or found by accident ----------------- */
function path(ctx, A) {
  const textBox = { x: 0, y: 130, w: W, h: 520 };
  const r = onPhoto(ctx, A.path, {
    tint: ['#0A1410', '#EAF2E4'], contrast: 1.15, oy: 40,
    textBox, target: 6,
  });

  const { bottom } = saypair(ctx, 'Social is discovery by accident.',
                             ['Search is', 'on purpose.'],
                             { y: 186, colour: r.colour, accent: r.accent, cap: 132 });
  para(ctx, [
    'Someone searching at 2am has already decided to',
    'buy. Nobody scrolling has decided anything.',
  ], { x: M, y: bottom + 62, size: 24, colour: r.colour, leading: 1.45 });

  ctx.fillStyle = r.colour;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
  return r.fit;
}

/* 3 — the road: type at the foot, light scrim from below --------------- */
function road(ctx, A) {
  const textBox = { x: 0, y: 700, w: W, h: 480 };
  const r = onPhoto(ctx, A.road, {
    tint: ['#170D0A', '#F6E9DC'], contrast: 1.1,
    textBox, target: 6,
  });

  const { bottom } = saypair(ctx, 'Every developer says rebuild.',
                             ['It is also', 'the bigger job.'],
                             { y: 760, colour: r.colour, accent: r.accent, cap: 116 });
  para(ctx, [
    'Six questions settle whether yours needs one, and',
    'they take about ten minutes to answer honestly.',
  ], { x: M, y: bottom + 58, size: 23, colour: r.colour, leading: 1.45 });

  ctx.fillStyle = r.colour;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
  return r.fit;
}

/* 4 — the office: dark type on a light scrim, the other direction ------ */
function office(ctx, A) {
  const textBox = { x: 0, y: 130, w: W, h: 540 };
  const r = onPhoto(ctx, A.office, {
    tint: ['#1B1E26', '#FFFFFF'], contrast: 1.2,
    textBox, target: 6,
  });

  const { bottom } = saypair(ctx, 'Your site loads in a second.',
                             ['On your', 'wifi.'],
                             { y: 190, colour: r.colour, accent: '#D42A17', cap: 160 });
  para(ctx, [
    'On a four-year-old Android on mobile data it takes',
    'eleven, and they are gone by second four.',
  ], { x: M, y: bottom + 66, size: 24, colour: r.colour, leading: 1.45 });

  ctx.fillStyle = r.colour;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
  return r.fit;
}

/* --------------------------------------------------------------- export */

export const PANELS = [
  ['counter — you never got their name', counter],
  ['path — search is on purpose', path],
  ['road — it is also the bigger job', road],
  ['office — on your wifi', office],
];

const SOURCES = {
  counter: '/assets/stock/scene/counter.jpg',
  path: '/assets/stock/scene/path.jpg',
  road: '/assets/stock/scene/road.jpg',
  office: '/assets/stock/scene/office.jpg',
};

let art = null;
async function load() {
  if (art) return art;
  const one = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  const got = {};
  for (const [k, src] of Object.entries(SOURCES)) got[k] = await one(src);
  art = got;
  return art;
}

export async function drawPanel(canvas, i) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';
  const fitted = PANELS[i][1](ctx, A);
  grain(ctx, W, H, 0.038);
  return { fitted, covered: coverage(canvas, '#000000') };
}

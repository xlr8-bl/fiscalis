/**
 * hooks.js — first panels, built to the grammar in the reference set.
 *
 * Reading all 29 references for the opening panel alone, the same
 * devices come up again and again, and none of them were in my hooks.
 *
 * 1. THE SENTENCE BREAKS ACROSS TWO EXTREME SCALES.
 *    "its never to late to / LOCK IN."  "work hard but, / ENJOY LIFE
 *    TOO."  "if not me / THEN WHO?"  "Top / 108 / Websites."
 *    Fifteen of the twenty-nine do this. The small line is not a label
 *    or a category — it is the first half of the sentence, and it only
 *    exists to get the eye moving into the second half. The ratio is
 *    three to five times, never the 1.5 I had been using.
 *
 * 2. THE IMAGE IS EVIDENCE, NOT DECORATION.
 *    A monitor buried in error dialogs under "confusion has the highest
 *    cost per click". A designer face-down on a CRT under "client
 *    feedback just took me out". A cat at a Macintosh under "I have no
 *    idea what im doing". The picture proves the sentence, and it takes
 *    half the panel or more, usually bleeding off an edge. A small
 *    figure parked in a corner — which is what I kept drawing — does no
 *    work at all.
 *
 * 3. TYPE AND OBJECT SHARE ONE SPACE.
 *    A phone handset stands in for the c of "can". Old computers sit
 *    between and over the words. A giant question mark runs behind the
 *    letters and in front of them. Nothing is arranged in zones.
 *
 * 4. IT SPEAKS TO SOMEBODY.
 *    "stop using pinterest", "what are you waiting for?", "put the
 *    phone down!", "hey can we talk?", "are you bored yet?". Almost
 *    every one is a command or a question, in the second person, in the
 *    present tense. Mine were third-person statements of fact — true,
 *    and inert.
 *
 * 5. COLOUR IS THE WHOLE GROUND OR IT IS NOT THERE.
 *    A full red field. A full orange field. Not an accent bar.
 *
 * So these four rebuild the hooks I already had, each taking a
 * different route to rule 2 — a bled object, a knocked-out figure, a
 * committed colour field, and an object interleaved with the type.
 */

import { PAPER, INK, RED, YELLOW, GREY, stipple, cutOut, tooth } from './flow.js';
import { loadFaces, fit, para, GROT, BLACK, BOOK } from './decks.js';
import { phone, progress, skeleton, roundRect } from './ui.js';

export const W = 1024;
export const H = 1280;
const M = 62;
const COL = W - M * 2;

/**
 * The setup/payoff pair, which is the whole grammar in one function.
 *
 * `small` is set at a size that makes it read as the run-up. `big` is
 * fitted to the full measure, so it is as large as the panel allows and
 * the jump between them is never negotiated down to something polite.
 */
function saypair(ctx, small, big, { y, colour = INK, accent = null, cap = 200 }) {
  ctx.save();
  const s = fit(ctx, small, COL * 0.52, { family: GROT, weight: 700, cap: 52 });
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

/* 1 — BLED OBJECT ------------------------------------------------------
   The device is the evidence and it is enormous, tilted, and running
   off two edges. Rule 2 by way of an object rather than a photograph. */
function loadsFine(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // the colour field goes down first and the object breaks out of it
  ctx.fillStyle = RED;
  ctx.fillRect(0, 596, W, H - 596);

  const end = saypair(ctx, 'It loads fine', ['for you.'], { y: 168, cap: 210 });
  // three lines put the last one behind the device; two clear it
  para(ctx, [
    'Eleven seconds on a four-year-old',
    'Android. Gone by second four.',
  ], { x: M, y: end + 74, size: 25, leading: 1.45 });

  ctx.save();
  ctx.translate(408, 470);
  ctx.rotate(-0.085);
  const s = phone(ctx, { x: 0, y: 0, w: 470, h: 930, screen: '#FBFAF7' });
  progress(ctx, { x: s.x, y: s.y, w: s.w, h: 16, pct: 0.15, track: GREY });
  skeleton(ctx, { x: s.x + 30, y: s.y + 74, w: s.w - 60, lines: 6, size: 22, gap: 20 });
  ctx.fillStyle = GREY;
  ctx.fillRect(s.x + 30, s.y + 340, s.w - 60, 240);
  ctx.restore();

  ctx.fillStyle = PAPER;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
}

/* 2 — KNOCKED-OUT FIGURE -----------------------------------------------
   Solid ink, a question rather than a finding, and the figure printed
   large in paper so it is the panel rather than an ornament on it. */
function whoOwns(ctx, A) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  if (A.figure) {
    const fh = 880;
    const fw = Math.round(fh * (A.figure.width / A.figure.height));
    ctx.drawImage(stipple(A.figure, { w: fw, h: fh, contrast: 1.55, ink: PAPER }),
                  W - fw + 130, H - fh + 30);
  }

  const end = saypair(ctx, 'You paid for it.', ['Who owns', 'it?'],
                      { y: 176, colour: PAPER, accent: RED, cap: 186 });
  para(ctx, [
    'The domain, the code, the',
    'hosting and the content are',
    'four separate things. You can',
    'own none of them and believe',
    'you own all four.',
  ], { x: M, y: end + 78, size: 24, colour: PAPER, leading: 1.45 });

  ctx.fillStyle = PAPER;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
}

/* 3 — COMMITTED FIELD --------------------------------------------------
   No image at all, and the colour is the entire ground. This only works
   when the line is short enough to carry the panel by itself. */
function neverDesign(ctx) {
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, W, H);

  saypair(ctx, 'Enquiries dried up.', ['It is never', 'the design.'],
          { y: 300, colour: INK, cap: 168 });

  para(ctx, [
    'It is a menu saved as a photograph, a booking',
    'page that takes eleven seconds, or a contact',
    'form that submits and sends nothing.',
    '',
    'Three faults. None of them visible from inside.',
  ], { x: M, y: 856, size: 25, colour: INK, leading: 1.5 });

  ctx.fillStyle = INK;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText('web3ashley.com', M, H - 62);
}

/* 4 — INTERLEAVED ------------------------------------------------------
   The object sits between the two halves of the word: the top of
   "photograph." prints over the menu card, the bottom of it runs
   behind. Same space, not two zones. */
function menuCard(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = INK;
  ctx.font = `700 44px ${GROT}`;
  ctx.fillText('Google cannot read', M, 190);

  const word = 'a photograph.';
  const b = fit(ctx, word, COL, { cap: 150 });
  const baseline = 648;
  const draw = () => {
    ctx.font = `900 ${b}px ${BLACK}`;
    ctx.letterSpacing = `${-b * 0.042}px`;
    ctx.fillStyle = RED;
    ctx.fillText(word, M, baseline);
    ctx.letterSpacing = '0px';
  };
  draw();

  // the card, laid over the word
  ctx.save();
  ctx.translate(214, 286);
  ctx.rotate(-0.05);
  ctx.fillStyle = INK;
  roundRect(ctx, 0, 0, 600, 780, 6);
  ctx.fill();
  ctx.fillStyle = '#FBFAF7';
  ctx.fillRect(26, 26, 548, 728);
  ctx.fillStyle = INK;
  ctx.font = `900 46px ${BLACK}`;
  ctx.fillText('MENU', 60, 118);
  ctx.fillStyle = GREY;
  for (let i = 0; i < 11; i++) {
    const w = 400 - ((i * 53) % 150);
    ctx.fillRect(60, 176 + i * 50, w, 20);
    ctx.fillRect(478, 176 + i * 50, 56, 20);
  }
  ctx.restore();

  // and the top half of the word printed back over the card
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, baseline - b * 0.34);
  ctx.clip();
  draw();
  ctx.restore();

  para(ctx, [
    'A picture of a menu is a picture. No search engine',
    'reads a word of it, and neither does a screen reader,',
    'nor the person searching for the one dish you are',
    'known for.',
  ], { x: M, y: 1122, size: 22, leading: 1.42 });
}

/* ------------------------------------------------------------- export */

export const PANELS = [
  ['bled object — it loads fine', loadsFine],
  ['knocked-out figure — who owns it?', whoOwns],
  ['committed field — never the design', neverDesign],
  ['interleaved — a photograph', menuCard],
];

let art = null;
async function load() {
  if (art) return art;
  const one = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  const figure = await one('/assets/stock/src/figure-laptop.jpg');
  art = { figure: figure ? cutOut(figure, { tolerance: 52 }) : null };
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

/**
 * generate.js — the machine.
 *
 * Everything before this was a panel written by hand: `ctx.fillText('You
 * paid', 62, 214)`, a coordinate tuned by looking at a render. That does
 * not survive volume. Across this session roughly every second
 * hand-tuned panel came out with a collision, an overflow or a clip, and
 * they were only caught because somebody looked at all of them.
 *
 * So the three parts here are the three things that have to be true
 * before a panel can be made without a person watching:
 *
 *   NOTHING IS PLACED AT AN ABSOLUTE Y. A block is given a box, fits its
 *   type to it, and reports the height it used. The next block starts
 *   where the last one ended. Copy that is three words longer changes
 *   the type size, not the margin.
 *
 *   OVERFLOW THROWS. If content will not fit at the minimum size the
 *   design allows, the render fails and says which block and by how
 *   much. A broken panel is never a returned panel.
 *
 *   THE CHECKS I WAS DOING BY EYE ARE CODE. Contrast on every text pair,
 *   bounding-box overlap between blocks, a type-size floor, ground
 *   coverage, and a legibility pass at feed-thumbnail width. review()
 *   returns findings; a caller that ships a panel with findings is
 *   choosing to.
 *
 * A device is a composition, not a template: it decides where things go
 * and what the picture does. The content decides the words. The seed
 * decides which device, ground and photograph a given carousel gets, so
 * the same spec always produces the same set and a set can be re-rolled
 * by changing one number.
 */

import { loadFaces, fit, GROT, BLACK, BOOK } from './decks.js';
import {
  GROUNDS, GROUND_NAMES, halftone, pitchFor, grain, coverage,
  photoGround, fitScrim, sampleAccent, pickPolarity,
} from './press.js';
import { phone, skeleton, mapPack, grid, receipt } from './ui.js';

export const W = 1024;
export const H = 1280;
export const M = 62;
export const COL = W - M * 2;

/** Thrown when content cannot be made to fit. Carries what and by how much. */
export class Overflow extends Error {
  constructor(what, over) {
    super(`${what} overflows its box by ${Math.round(over)}px`);
    this.name = 'Overflow';
    this.what = what;
    this.over = Math.round(over);
  }
}

/* ------------------------------------------------------------- seeding */

/** mulberry32 — small, fast, and the same everywhere. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string, so a slug can seed a carousel. */
export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

/* -------------------------------------------------------------- layout */

/**
 * Set lines into a box, fitting the size down until they fit, and report
 * what was used. Throws rather than spilling.
 *
 * `min` is the floor: below it the type is too small for a feed, so a
 * block that cannot reach the box at `min` is a content problem and is
 * raised as one.
 */
export function block(ctx, lines, {
  x, y, w, h = Infinity, size, min = 18, family = BOOK, weight = 500,
  colour, leading = 1.45, what = 'block', track = 0,
}) {
  const rows = lines.filter((l) => l !== undefined && l !== null);
  let s = size;
  const widest = () => {
    ctx.font = `${weight} ${s}px ${family}`;
    ctx.letterSpacing = `${track * s}px`;
    return Math.max(0, ...rows.map((l) => ctx.measureText(String(l)).width));
  };
  const tall = () => rows.length * s * leading;

  while ((widest() > w || tall() > h) && s > min) s -= 1;
  if (widest() > w) throw new Overflow(what, widest() - w);
  if (tall() > h) throw new Overflow(what, tall() - h);

  ctx.save();
  ctx.font = `${weight} ${s}px ${family}`;
  ctx.letterSpacing = `${track * s}px`;
  ctx.fillStyle = colour;
  rows.forEach((l, i) => ctx.fillText(String(l), x, y + i * s * leading));
  ctx.restore();
  ctx.letterSpacing = '0px';
  return { x, y: y - s, w: widest(), h: tall(), size: s, bottom: y + (rows.length - 1) * s * leading };
}

/**
 * The setup/payoff pair, which is the hook grammar from the reference
 * set expressed as a function.
 *
 * The scale jump is the whole device: the small line is the first half
 * of the sentence and exists to move the eye into the second. The
 * references run three to five times; `ratio` is checked afterwards by
 * review() so it cannot quietly drift back to a polite 1.5.
 */
export function saypair(ctx, setup, payoff, {
  y, colour, accent = null, cap = 190, min = 54,
}) {
  const s = fit(ctx, setup, COL * 0.56, { family: GROT, weight: 700, cap: 50 });
  let b = Math.min(cap, ...payoff.map((l) => fit(ctx, l, COL, { cap })));
  if (b < min) throw new Overflow('payoff', (min - b) * 4);

  ctx.save();
  ctx.fillStyle = colour;
  ctx.font = `700 ${s}px ${GROT}`;
  ctx.fillText(setup, M, y);
  ctx.font = `900 ${b}px ${BLACK}`;
  ctx.letterSpacing = `${-b * 0.042}px`;
  payoff.forEach((line, i) => {
    ctx.fillStyle = accent && i === payoff.length - 1 ? accent : colour;
    ctx.fillText(line, M, y + b * 0.86 + i * b * 0.88);
  });
  ctx.letterSpacing = '0px';
  ctx.restore();

  const bottom = y + b * 0.86 + (payoff.length - 1) * b * 0.88;
  return {
    bottom, setupSize: s, payoffSize: b, ratio: Math.round((b / s) * 100) / 100,
    box: { x: 0, y: y - s * 1.2, w: W, h: bottom - y + s * 1.2 + b * 0.3 },
  };
}

const signOff = (ctx, colour, at = 'web3ashley.com') => {
  ctx.fillStyle = colour;
  ctx.font = `700 25px ${GROT}`;
  ctx.fillText(at, M, H - 62);
};

/* ------------------------------------------------------------- devices */

/**
 * A device declares what it needs before it is chosen, so a spec that
 * cannot support it is never handed to it. `body` false means the device
 * sets no paragraph, which is what makes it the only one usable on a
 * display-only ground like the hot red.
 */
export const DEVICES = {
  field: {
    needs: { body: true }, wantsPhoto: false,
    draw(ctx, c, st) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      const say = saypair(ctx, c.setup, c.payoff,
                          { y: 176, colour: S.mark, accent: st.accent, cap: 150 });
      const b = block(ctx, c.body, {
        x: M, y: say.bottom + 74, w: COL, h: 300, size: 24,
        colour: S.mark, what: 'body',
      });
      signOff(ctx, S.mark);
      return { say, blocks: [say.box, b] };
    },
  },

  statement: {
    needs: { body: false }, wantsPhoto: false,
    draw(ctx, c, st) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      const say = saypair(ctx, c.setup, c.payoff,
                          { y: 320, colour: S.mark, cap: 210 });
      // display size, because this ground may not be able to carry body copy
      const b = block(ctx, c.tail ?? [], {
        x: M, y: 900, w: COL, h: 200, size: 54, min: 40,
        family: BLACK, weight: 900, colour: S.mark, leading: 1.16, what: 'tail',
      });
      signOff(ctx, S.mark);
      return { say, blocks: [say.box, b] };
    },
  },

  object: {
    needs: { body: true }, wantsPhoto: false, wantsObject: true,
    draw(ctx, c, st, A) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      const say = saypair(ctx, c.setup, c.payoff,
                          { y: 176, colour: S.mark, accent: st.accent, cap: 148 });
      const b = block(ctx, c.body, {
        x: M, y: say.bottom + 74, w: COL, h: 250, size: 24,
        colour: S.mark, what: 'body',
      });
      const top = Math.max(b.bottom + 60, 620);
      drawObject(ctx, st.object, S, top);
      signOff(ctx, S.mark);
      return { say, blocks: [say.box, b] };
    },
  },

  figure: {
    needs: { body: true }, wantsPhoto: false, wantsCutout: true,
    draw(ctx, c, st, A) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      if (A.cutout) {
        const fh = 760;
        const fw = Math.round(fh * (A.cutout.width / A.cutout.height));
        ctx.drawImage(
          halftone(A.cutout, { w: fw, h: fh, pitch: pitchFor(fh), ink: S.photo }),
          W - fw + 150, H - fh + 40);
      }
      const say = saypair(ctx, c.setup, c.payoff,
                          { y: 168, colour: S.mark, accent: st.accent, cap: 120 });
      // narrower measure: the full column runs under the figure
      const b = block(ctx, c.body, {
        x: M, y: say.bottom + 62, w: COL * 0.62, h: 260, size: 23,
        colour: S.mark, what: 'body',
      });
      signOff(ctx, S.mark);
      return { say, blocks: [say.box, b] };
    },
  },

  photo: {
    needs: { body: true }, wantsPhoto: true,
    draw(ctx, c, st, A) {
      const foot = st.footer === true;
      const textBox = foot ? { x: 0, y: 700, w: W, h: 480 }
                           : { x: 0, y: 120, w: W, h: 560 };
      photoGround(ctx, A.scene, { w: W, h: H, tint: st.tint, contrast: 1.1 });
      const accent = sampleAccent(ctx, { w: W, h: H }) || GROUNDS.paper.accent;
      const pol = pickPolarity(ctx, textBox, { light: '#F2F0E8', dark: '#141310' });
      const scrim = fitScrim(ctx, textBox, pol.colour,
                             { target: 6, w: W, h: H, dark: pol.dark });

      const say = saypair(ctx, c.setup, c.payoff,
                          { y: foot ? 760 : 176, colour: pol.colour, accent, cap: 132 });
      const b = block(ctx, c.body, {
        x: M, y: say.bottom + 62, w: COL, h: 220, size: 24,
        colour: pol.colour, what: 'body',
      });
      signOff(ctx, pol.colour);
      return { say, blocks: [say.box, b], scrim, accent, colour: pol.colour };
    },
  },

  list: {
    needs: { body: true, rows: 3 }, wantsPhoto: false,
    draw(ctx, c, st) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      const head = block(ctx, c.payoff, {
        x: M, y: 156, w: COL, h: 260, size: 92, min: 48,
        family: BLACK, weight: 900, colour: S.mark, leading: 0.96,
        track: -0.035, what: 'headline',
      });

      const rows = c.rows.slice(0, 5);
      const pitch = Math.min(148, (980 - head.bottom - 60) / rows.length);
      let y = head.bottom + 70;
      const boxes = [];
      rows.forEach((row, i) => {
        ctx.fillStyle = i === 0 ? st.accent : S.mark;
        ctx.fillRect(M, y, 54, 54);
        ctx.fillStyle = S.ground;
        ctx.font = `900 34px ${BLACK}`;
        ctx.fillText(String(i + 1), M + 16, y + 39);
        boxes.push(block(ctx, [row.head], {
          x: M + 82, y: y + 34, w: COL - 82, h: 60, size: 36, min: 22,
          family: BLACK, weight: 900, colour: S.mark, what: `row ${i + 1} head`,
        }));
        if (row.tail) {
          ctx.globalAlpha = 0.62;
          boxes.push(block(ctx, [row.tail], {
            x: M + 82, y: y + 82, w: COL - 82, h: 40, size: 21, min: 16,
            colour: S.mark, what: `row ${i + 1} tail`,
          }));
          ctx.globalAlpha = 1;
        }
        y += pitch;
      });
      signOff(ctx, S.mark);
      return { blocks: [head, ...boxes] };
    },
  },

  chart: {
    needs: { body: true, bars: 2 }, wantsPhoto: false,
    draw(ctx, c, st) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      const head = block(ctx, c.payoff, {
        x: M, y: 150, w: COL, h: 240, size: 92, min: 48,
        family: BLACK, weight: 900, colour: S.mark, leading: 0.94,
        track: -0.035, what: 'headline',
      });

      const bars = c.bars.slice(0, 5);
      const max = Math.max(...bars.map((b) => b.value));
      const room = 1010 - head.bottom - 70;
      const pitch = room / bars.length;
      let y = head.bottom + 70;
      const boxes = [];
      bars.forEach((bar, i) => {
        boxes.push(block(ctx, [bar.label], {
          x: M, y: y - 12, w: COL, h: 40, size: 25, min: 18,
          family: BLACK, weight: 900, colour: S.mark, what: `bar ${i + 1} label`,
        }));
        const bh = Math.min(74, pitch * 0.5);
        ctx.fillStyle = i < 2 ? st.accent : S.mark;
        ctx.fillRect(M, y, Math.max(8, (bar.value / max) * COL), bh);
        ctx.font = `900 26px ${BLACK}`;
        const vw = ctx.measureText(bar.text).width;
        const inside = vw + 28 < (bar.value / max) * COL;
        ctx.fillStyle = inside ? S.ground : S.mark;
        ctx.fillText(bar.text, inside ? M + 14 : M + (bar.value / max) * COL + 14,
                     y + bh / 2 + 9);
        y += pitch;
      });
      const b = block(ctx, c.body, {
        x: M, y: y + 6, w: COL, h: 140, size: 22, colour: S.mark, what: 'body',
      });
      return { blocks: [head, ...boxes, b] };
    },
  },

  quad: {
    needs: { body: true, cells: 4 }, wantsPhoto: false,
    draw(ctx, c, st) {
      const S = st.scheme;
      ctx.fillStyle = S.ground; ctx.fillRect(0, 0, W, H);
      const head = block(ctx, c.payoff, {
        x: M, y: 168, w: COL, h: 230, size: 104, min: 52,
        family: BLACK, weight: 900, colour: S.mark, leading: 0.94,
        track: -0.035, what: 'headline',
      });

      const gap = 16, cw = (COL - gap) / 2, ch = 300;
      const top = head.bottom + 56;
      const boxes = [];
      c.cells.slice(0, 4).forEach((cell, i) => {
        const x = M + (i % 2) * (cw + gap);
        const y = top + Math.floor(i / 2) * (ch + gap);
        const hot = i === 0;
        if (hot) { ctx.fillStyle = st.accent; ctx.fillRect(x, y, cw, ch); }
        else {
          ctx.fillStyle = S.mark; ctx.globalAlpha = 0.10;
          ctx.fillRect(x, y, cw, ch); ctx.globalAlpha = 1;
        }
        const fg = hot ? S.ground : S.mark;
        ctx.fillStyle = fg;
        ctx.font = `900 74px ${BLACK}`;
        ctx.fillText(String(i + 1), x + 26, y + 92);
        boxes.push(block(ctx, [cell.head], {
          x: x + 26, y: y + 176, w: cw - 52, h: 60, size: 40, min: 22,
          family: BLACK, weight: 900, colour: fg, what: `cell ${i + 1}`,
        }));
        if (cell.tail) {
          ctx.globalAlpha = hot ? 0.9 : 0.6;
          boxes.push(block(ctx, [cell.tail], {
            // +212 put the tail's box 4px inside the head's; invisible on
            // screen, and exactly what the overlap check is for
            x: x + 26, y: y + 228, w: cw - 52, h: 40, size: 22, min: 16,
            colour: fg, what: `cell ${i + 1} tail`,
          }));
          ctx.globalAlpha = 1;
        }
      });
      const b = block(ctx, c.body, {
        x: M, y: top + ch * 2 + gap + 62, w: COL, h: 140, size: 23,
        colour: S.mark, what: 'body',
      });
      return { blocks: [head, ...boxes, b] };
    },
  },
};

export const DEVICE_NAMES = Object.keys(DEVICES);

function drawObject(ctx, which, S, top) {
  if (which === 'phone') {
    ctx.save(); ctx.translate(452, top); ctx.rotate(0.07);
    const s = phone(ctx, { x: 0, y: 0, w: 440, h: 900, body: S.mark, screen: '#FBFAF7' });
    ctx.fillStyle = S.accent; ctx.fillRect(s.x, s.y, s.w, 92);
    skeleton(ctx, { x: s.x + 28, y: s.y + 150, w: s.w - 56, lines: 3, size: 20, gap: 20 });
    ctx.restore();
  } else if (which === 'mappack') {
    mapPack(ctx, { x: M, y: top, w: COL, h: Math.min(420, H - top - 90),
                   ground: S.mark, on: S.ground, accent: S.accent, pick: 1 });
  } else if (which === 'grid') {
    grid(ctx, { x: M, y: top, w: COL, h: Math.min(520, H - top - 90),
                cols: 6, rows: 10, ground: '#E4E1D8', line: '#C3BFB2',
                on: S.mark, accent: S.accent, hot: [4, 2] });
  } else {
    receipt(ctx, { x: M, y: top, w: 300, h: Math.min(520, H - top - 90),
                   ground: S.photo, on: S.ground });
  }
}

export const OBJECTS = ['phone', 'mappack', 'grid', 'receipt'];

/* ---------------------------------------------------------- choosing */

/**
 * Choose the design for one panel from the seed and what the content can
 * support. Deterministic: the same spec and seed always land on the same
 * device, ground and object, so a set can be re-rolled by changing the
 * number rather than by hoping.
 */
export function choose(content, seed, { hasScene = false, hasCutout = false } = {}) {
  const r = rng(seed);
  const usable = DEVICE_NAMES.filter((name) => {
    const d = DEVICES[name];
    if (d.needs.body && !(content.body?.length)) return false;
    if (d.needs.body === false && content.body?.length) return false;
    if (d.needs.rows && !(content.rows?.length >= d.needs.rows)) return false;
    if (d.needs.bars && !(content.bars?.length >= d.needs.bars)) return false;
    if (d.needs.cells && !(content.cells?.length >= d.needs.cells)) return false;
    if (d.wantsPhoto && !hasScene) return false;
    if (d.wantsCutout && !hasCutout) return false;
    return true;
  });
  if (!usable.length) return null;

  const device = content.device && usable.includes(content.device)
    ? content.device : pick(r, usable);

  // a device that sets a paragraph cannot go on a ground that will not
  // carry one; that is the red field's measured 4.31:1, not a preference
  const wantsBody = DEVICES[device].needs.body !== false;
  const grounds = GROUND_NAMES.filter((g) => (wantsBody ? GROUNDS[g].body : true));
  const ground = content.ground && grounds.includes(content.ground)
    ? content.ground : pick(r, grounds);

  return {
    device,
    ground,
    scheme: GROUNDS[ground],
    accent: GROUNDS[ground].accent,
    object: pick(r, OBJECTS),
    footer: r() > 0.5,
    tint: pick(r, [['#120E0C', '#F4EFE4'], ['#0A1410', '#EAF2E4'],
                   ['#170D0A', '#F6E9DC'], ['#1B1E26', '#FFFFFF']]),
  };
}

/* ---------------------------------------------------------- reviewing */

const lumOf = (hex) => {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratioOf = (a, b) => {
  const [hi, lo] = [Math.max(lumOf(a), lumOf(b)), Math.min(lumOf(a), lumOf(b))];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w
                        && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * The checks I was doing by eye, as code. Returns findings; empty means
 * the panel passed every one of them.
 *
 * The thumbnail test is the one that catches what the others miss: a
 * panel is rendered down to 120px, the width a feed actually shows, and
 * the headline has to still carry measurable contrast against the ground
 * at that size. Type that survives at 1024 and dissolves at 120 is the
 * commonest way a carousel fails in the wild.
 */
export function review(canvas, out, style, { minRatio = 4.5, minPayoffRatio = 2.4 } = {}) {
  const found = [];

  if (style?.scheme && style.scheme.ratio < minRatio) {
    found.push({ check: 'contrast', detail:
      `${style.ground} is ${style.scheme.ratio}:1, under ${minRatio}` });
  }
  if (style?.scheme && out.blocks?.some((b) => b.size && b.size < 20)
      && style.scheme.body === false) {
    found.push({ check: 'body-on-display-ground', detail:
      `${style.ground} cannot carry a paragraph` });
  }
  if (out.say && out.say.ratio < minPayoffRatio) {
    found.push({ check: 'scale-jump', detail:
      `payoff is only ${out.say.ratio}x the setup; the references run 3-5x` });
  }
  if (out.scrim && out.scrim.passed === false) {
    found.push({ check: 'scrim', detail:
      `type reaches only ${out.scrim.ratio}:1 on this photograph` });
  }

  const boxes = (out.blocks ?? []).filter((b) => b && b.w > 0 && b.h > 0);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) {
        found.push({ check: 'overlap', detail: `two text blocks share space` });
        i = boxes.length;
        break;
      }
    }
  }

  const small = boxes.filter((b) => b.size && b.size < 18);
  if (small.length) {
    found.push({ check: 'type-floor', detail: `${small.length} block(s) under 18px` });
  }

  const ground = style?.scheme?.ground ?? '#000000';
  const covered = coverage(canvas, ground);
  if (covered < 0.08) {
    found.push({ check: 'coverage', detail:
      `only ${(covered * 100).toFixed(1)}% of the sheet carries a mark` });
  }

  // the feed test
  const t = document.createElement('canvas');
  t.width = 120; t.height = Math.round(120 * (H / W));
  const tg = t.getContext('2d');
  tg.drawImage(canvas, 0, 0, t.width, t.height);
  const px = tg.getImageData(0, 0, t.width, Math.round(t.height * 0.55)).data;
  let mn = 1, mx = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    if (l < mn) mn = l; if (l > mx) mx = l;
  }
  if (mx - mn < 0.22) {
    found.push({ check: 'thumbnail', detail:
      `at 120px the top half spans only ${(mx - mn).toFixed(2)} in luminance` });
  }

  return { findings: found, covered: Math.round(covered * 1000) / 1000 };
}

/* ----------------------------------------------------------- rendering */

/**
 * Render one panel. Returns the canvas and a report; throws Overflow if
 * the content will not fit, which is the point.
 */
export async function renderPanel(canvas, content, seed, A = {}) {
  await loadFaces();
  const style = choose(content, seed, { hasScene: !!A.scene, hasCutout: !!A.cutout });
  if (!style) throw new Error('no device can carry this content');

  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  const out = DEVICES[style.device].draw(ctx, content, style, A);
  grain(ctx, W, H, style.device === 'photo' ? 0.038 : 0.031);

  const checked = review(canvas, out, style);
  return {
    canvas,
    device: style.device,
    ground: style.ground,
    accent: out.accent ?? style.accent,
    ratio: out.say?.ratio ?? null,
    scrim: out.scrim ?? null,
    ...checked,
  };
}

/** Render a whole carousel. One bad panel does not lose the others. */
export async function renderCarousel(spec, make) {
  const base = spec.seed ?? hash(spec.slug ?? spec.title ?? 'web3ashley');
  const out = [];
  for (let i = 0; i < spec.panels.length; i++) {
    const canvas = make(i);
    try {
      out.push({ index: i, ok: true, ...await renderPanel(canvas, spec.panels[i], base + i * 977, spec.assets ?? {}) });
    } catch (err) {
      out.push({ index: i, ok: false, error: err.name, detail: err.message,
                 what: err.what ?? null, over: err.over ?? null });
    }
  }
  return out;
}

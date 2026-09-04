/**
 * compose.js — a measured layout, filled with whatever copy it is given.
 *
 * THE PROBLEM THIS SOLVES
 *
 * The first pass at these templates kept each reference's idea and threw
 * away its geometry, so what came out was "inspired by" the sheet rather
 * than being the sheet. The obvious fix is to hard-code the positions
 * off a measuring grid. That fails the other way: a layout with the
 * headline nailed to one baseline at one size only works for the exact
 * words it was measured with, and an agent writing a different hook
 * either overflows it or leaves it half empty.
 *
 * So a slot is a BOX, measured off the reference, plus a policy for what
 * to do with copy inside it. The box is the accuracy. The policy is what
 * makes it a template.
 *
 *   box    [x, y, w, h] normalised 0..1 on the frame, read off the grid
 *   fit    shrink  set as large as fits, down to `min`, never past `max`
 *          wrap    break into lines and fill the box
 *          fixed   one size, and refuse if it does not fit
 *   align  where the type sits inside its box, both axes
 *
 * Normalised, so a measurement taken from a 736px Pinterest save renders
 * correctly at 1080x1350 and would render correctly at any other size.
 *
 * WHAT IS OURS. The boxes are measurements of other people's finished
 * work, which is what a reference has always been for, and measurements
 * are not the work. Every pixel emitted here is drawn from our copy in
 * our type on our palette. No reference image is loaded at render time.
 */

import { GROUNDS, halftone, pitchFor, grain, coverage, photoGround,
         fitScrim, pickPolarity } from './press.js';
import { rng, hash } from './design-spec.js';

export const W = 1080;
export const H = 1350;

/**
 * The faces, by the job they do.
 *
 * Sourced to match the corpus rather than substituted for it. The Didone
 * in six of the references IS the design of those sheets, not a detail
 * of it, and setting them in a grotesque produces a different poster
 * that happens to say the same words. Same for the brush script the two
 * risograph sheets turn on, and for the black grotesque the one-word
 * sheets need — Archivo 700 is not heavy enough to be the whole design.
 *
 * All SIL Open Font Licence. tools/get_fonts.sh fetches them.
 */
export const FACES = {
  display: 'Bricolage',          // geometric heavy: most statements
  black: 'ArchivoBlack',         // when one word IS the sheet
  condensed: 'Anton',            // long line, still huge
  grotesque: 'Archivo',          // subheads, labels, UI
  body: 'Inter',                 // anything you actually read
  didone: 'Bodoni',              // the high-contrast serif sheets
  didoneItalic: 'BodoniItalic',  // and their turn lines
  italic: 'InstrumentItalic',    // a quieter italic
  script: 'Script',              // the brush sheets
  pixel: 'PixelDisplay',         // the wordmark, and nothing else
};

/** A slot's colour names, resolved against whatever ground it is on. */
function ink(name, g) {
  return ({ mark: g.mark, accent: g.accent, ground: g.ground, photo: g.photo })[name] ?? name;
}

const px = {
  x: (v) => v * W,
  y: (v) => v * H,
  w: (v) => v * W,
  h: (v) => v * H,
  /* Type size is normalised against HEIGHT on both axes on purpose.
     Against width, the same spec would set wildly different type on a
     square crop than on a 4:5, and the whole point is that a measurement
     survives the frame changing. */
  size: (v) => v * H,
};

const fontFor = (s) =>
  `${s.style ?? ''} ${s.weight ?? ''} ${px.size(s.size)}px ${FACES[s.role] ?? FACES.grotesque}`.trim();

const fontAt = (s, size) =>
  `${s.style ?? ''} ${s.weight ?? ''} ${size}px ${FACES[s.role] ?? FACES.grotesque}`.trim();

/* ------------------------------------------------------------ measuring */

function widthAt(ctx, text, slot, size) {
  ctx.save();
  ctx.font = fontAt(slot, size);
  if (slot.track) ctx.letterSpacing = `${slot.track * size}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

function wrapAt(ctx, text, slot, size, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (widthAt(ctx, next, slot, size) <= maxW || !line) line = next;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

/**
 * Pick the size, and the line breaks, that fill the box best.
 *
 * `shrink` keeps the copy on the lines it was given and finds the
 * largest size that fits. `wrap` is free to rebreak, and finds the
 * largest size at which the rebroken block still fits the box's height.
 *
 * Both walk down from the reference size rather than up from nothing, so
 * copy that is the same length as the original renders at the original
 * size and the template is a faithful reproduction of it.
 */
function layOut(ctx, slot, copy) {
  const boxW = px.w(slot.box[2]);
  const boxH = px.h(slot.box[3]);
  const given = Array.isArray(copy) ? copy : [String(copy)];
  const top = px.size(slot.max ?? slot.size);
  const bottom = px.size(slot.min ?? (slot.size ?? 0.03) * 0.45);
  const leading = slot.leading ?? 0.94;

  if (slot.fit === 'fixed') {
    const size = px.size(slot.size);
    return { size, lines: given, over: given.some((l) => widthAt(ctx, l, slot, size) > boxW) };
  }

  for (let size = top; size >= bottom; size -= Math.max(1, top * 0.015)) {
    const lines = slot.fit === 'wrap'
      ? given.flatMap((l) => wrapAt(ctx, l, slot, size, boxW))
      : given;
    const fitsW = lines.every((l) => widthAt(ctx, l, slot, size) <= boxW);
    const blockH = size * (0.78 + (lines.length - 1) * leading);
    if (fitsW && blockH <= boxH * 1.02) return { size, lines, over: false };
  }

  // Nothing fits. Return the floor and say so, rather than drawing type
  // at four pixels or silently clipping it. The caller reports it.
  const size = bottom;
  const lines = slot.fit === 'wrap'
    ? given.flatMap((l) => wrapAt(ctx, l, slot, size, boxW))
    : given;
  return { size, lines, over: true };
}

/* -------------------------------------------------------------- drawing */

function drawType(ctx, slot, copy, g, report) {
  const { size, lines, over } = layOut(ctx, slot, copy);
  if (over) report.tight.push(slot.id);

  const bx = px.x(slot.box[0]);
  const by = px.y(slot.box[1]);
  const bw = px.w(slot.box[2]);
  const bh = px.h(slot.box[3]);
  const leading = slot.leading ?? 0.94;
  const blockH = size * (0.78 + (lines.length - 1) * leading);

  // vertical placement inside the measured box
  const vAlign = slot.vAlign ?? 'top';
  const y0 = vAlign === 'bottom' ? by + bh - blockH
    : vAlign === 'middle' ? by + (bh - blockH) / 2
      : by;

  ctx.save();
  ctx.font = fontAt(slot, size);
  ctx.fillStyle = ink(slot.fill, g);
  if (slot.alpha != null) ctx.globalAlpha = slot.alpha;
  if (slot.track) ctx.letterSpacing = `${slot.track * size}px`;
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, i) => {
    const lw = ctx.measureText(line).width;
    const align = slot.align ?? 'left';
    const x = align === 'right' ? bx + bw - lw
      : align === 'center' ? bx + (bw - lw) / 2
        : bx;
    const y = y0 + size * 0.78 + i * size * leading;

    // a span recolours one word without needing a second slot
    const span = slot.spans?.[i] ?? (i === 0 ? slot.span : null);
    if (span && line.includes(span.word)) {
      const at = line.indexOf(span.word);
      ctx.fillText(line, x, y);
      ctx.save();
      ctx.fillStyle = ink(span.fill, g);
      ctx.fillText(span.word, x + ctx.measureText(line.slice(0, at)).width, y);
      ctx.restore();
    } else {
      ctx.fillText(line, x, y);
    }
  });
  ctx.restore();

  return { x: bx, y: y0, w: bw, h: blockH, size, lines: lines.length };
}

/**
 * A rectangle, and everything the corpus does to one.
 *
 * `r` rounds it, in normalised units so a pill stays a pill at any
 * size; `r: 'pill'` rounds it fully. `stroke` outlines instead of
 * filling, which four references use for tags and buttons. `lift` is the
 * soft shadow under a floating field — the thing that makes a search box
 * read as sitting ON the page rather than being a hole in it, and the
 * detail whose absence made the first attempt at h037 look flat.
 */
function drawRect(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const r = slot.r === 'pill' ? h / 2 : px.h(slot.r ?? 0);

  ctx.save();
  if (slot.alpha != null) ctx.globalAlpha = slot.alpha;
  if (slot.lift) {
    ctx.shadowColor = 'rgba(0,0,0,.16)';
    ctx.shadowBlur = px.h(slot.lift);
    ctx.shadowOffsetY = px.h(slot.lift) * 0.35;
  }

  ctx.beginPath();
  if (r > 0) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else {
    ctx.rect(x, y, w, h);
  }

  if (slot.stroke) {
    ctx.strokeStyle = ink(slot.stroke, g);
    ctx.lineWidth = px.h(slot.weight ?? 0.0018);
    ctx.stroke();
  } else {
    ctx.fillStyle = ink(slot.fill, g);
    ctx.fill();
  }
  ctx.restore();
}

function drawBarcode(ctx, slot, g, seed) {
  const r = rng(seed);
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  ctx.save();
  ctx.fillStyle = ink(slot.fill, g);
  let cx = x;
  while (cx < x + w) {
    const bw = 2 + Math.floor(r() * 5);
    if (r() > 0.36) ctx.fillRect(cx, y, bw, h);
    cx += bw + 2 + Math.floor(r() * 4);
  }
  ctx.restore();
}

function drawGrid(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const step = px.h(slot.step ?? 0.034);
  ctx.save();
  ctx.globalAlpha = slot.alpha ?? 0.1;
  ctx.fillStyle = ink(slot.fill, g);
  for (let gx = x; gx <= x + w + 0.5; gx += step) ctx.fillRect(Math.round(gx), y, 1, h);
  for (let gy = y; gy <= y + h + 0.5; gy += step) ctx.fillRect(x, Math.round(gy), w, 1);
  ctx.restore();
}

/**
 * A picture, in its measured box, treated the way the reference treats
 * it. Missing art draws the box it will fill, at the size it will be,
 * so the layout can be judged before the shoot rather than after.
 */
/**
 * The objects that are drawn rather than photographed.
 *
 * Not a fallback. A drawn handset is a real cut-out with a clean edge on
 * bare paper, which is exactly what the references do with objects, and
 * a photograph of a 2019 handset dates in a year while this does not.
 * The keyless archive cannot supply a cut-out at all — measured, see
 * lib/hooks/art.js — so for these roles drawing is the better answer and
 * not the consolation.
 */
export const DRAWN = {
  handset(ctx, { x, y, w, h, on }) {
    const bw = w * 0.42, bh = h * 0.86;
    const bx = x + (w - bw) / 2, by = y + (h - bh) / 2;
    ctx.save();
    ctx.fillStyle = on;
    // body
    ctx.beginPath();
    ctx.roundRect?.(bx, by, bw, bh, bw * 0.18);
    if (!ctx.roundRect) ctx.rect(bx, by, bw, bh);
    ctx.fill();
    // screen and keypad knocked back out
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(bx + bw * 0.14, by + bh * 0.09, bw * 0.72, bh * 0.30);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.ellipse(bx + bw * (0.26 + c * 0.24), by + bh * (0.52 + r * 0.10),
                    bw * 0.085, bh * 0.030, 0, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  },
  crt(ctx, { x, y, w, h, on }) {
    const cw = Math.min(w * 0.86, h * 0.98);
    // bottom-aligned with the rest of the row rather than centred in its
    // own cell, which is what made it look dropped in from another sheet
    const cx = x + (w - cw) / 2, cy = y + h - cw * 0.90;
    ctx.save();
    ctx.fillStyle = on;
    ctx.beginPath();
    ctx.roundRect?.(cx, cy, cw, cw * 0.72, cw * 0.06);
    if (!ctx.roundRect) ctx.rect(cx, cy, cw, cw * 0.72);
    ctx.fill();
    ctx.fillRect(cx + cw * 0.30, cy + cw * 0.72, cw * 0.40, cw * 0.09);
    ctx.fillRect(cx + cw * 0.16, cy + cw * 0.81, cw * 0.68, cw * 0.06);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect?.(cx + cw * 0.08, cy + cw * 0.07, cw * 0.84, cw * 0.52, cw * 0.04);
    if (!ctx.roundRect) ctx.rect(cx + cw * 0.08, cy + cw * 0.07, cw * 0.84, cw * 0.52);
    ctx.fill();
    ctx.restore();
  },
  phone(ctx, { x, y, w, h, on }) {
    const bw = w * 0.36, bh = h * 0.9;
    const bx = x + (w - bw) / 2, by = y + (h - bh) / 2;
    ctx.save();
    ctx.fillStyle = on;
    ctx.beginPath();
    ctx.roundRect?.(bx, by, bw, bh, bw * 0.14);
    if (!ctx.roundRect) ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect?.(bx + bw * 0.07, by + bh * 0.05, bw * 0.86, bh * 0.86, bw * 0.08);
    if (!ctx.roundRect) ctx.rect(bx + bw * 0.07, by + bh * 0.05, bw * 0.86, bh * 0.86);
    ctx.fill();
    ctx.restore();
  },
};

/**
 * A row of drawn objects, screened.
 *
 * Drawn flat they read as placeholder icons: solid slabs at whatever
 * height each shape happened to want. Two things fix that. They are laid
 * out to a common baseline so the row reads as a set, and the whole row
 * is screened to the same halftone the photographs get, so a drawn
 * object and a photographed one belong to the same sheet.
 */
function drawObjects(ctx, slot, g, kinds) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const list = (kinds ?? ['phone']).slice(0, 4);
  const cw = w / list.length;

  // drawn onto their own surface first, so the screen can be applied to
  // the row rather than to the page under it
  const pad = new OffscreenCanvas(Math.ceil(w), Math.ceil(h));
  const p2 = pad.getContext('2d');
  list.forEach((kind, i) => {
    const fn = DRAWN[kind] ?? DRAWN.phone;
    fn(p2, { x: i * cw, y: 0, w: cw, h, on: '#000000' });
  });

  if (slot.screen === false) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(pad, x, y);
    ctx.restore();
    return;
  }

  const screened = halftone(pad, {
    w: Math.ceil(w), h: Math.ceil(h),
    pitch: slot.pitch ? px.h(slot.pitch) : Math.max(6, h * 0.028),
    angle: 0.26, ink: ink(slot.fill ?? 'mark', g), paper: g.ground, gamma: 0.9,
    // these are drawn at tones this file chose, so there is nothing to
    // measure and nothing to open up
    levels: false,
  });

  // the screened row carries the ground with it, so it is masked back to
  // the shapes: a rectangle of dots is not a cut-out
  const out = new OffscreenCanvas(Math.ceil(w), Math.ceil(h));
  const o2 = out.getContext('2d');
  o2.drawImage(screened, 0, 0);
  o2.globalCompositeOperation = 'destination-in';
  o2.drawImage(pad, 0, 0);
  ctx.drawImage(out, x, y);
}

function drawArt(ctx, slot, img, g, report) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);

  // a slot whose role is drawn does not want a photograph at all
  if (slot.draws) { drawObjects(ctx, slot, g, slot.draws); return; }

  if (!img) {
    report.missing.push(slot.id);
    ctx.save();
    ctx.strokeStyle = ink('mark', g);
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = ink('mark', g);
    ctx.font = `600 20px ${FACES.grotesque}`;
    ctx.textAlign = 'center';
    ctx.fillText(slot.want ?? slot.id, x + w / 2, y + h / 2);
    ctx.font = `500 16px ${FACES.grotesque}`;
    ctx.fillStyle = ink('accent', g);
    ctx.fillText('see PHOTOS.md', x + w / 2, y + h / 2 + 28);
    ctx.restore();
    return;
  }

  if (slot.treat === 'halftone') {
    ctx.drawImage(halftone(img, {
      w, h, pitch: slot.pitch ? px.h(slot.pitch) : pitchFor(h),
      angle: 0.26, ink: g.photo, paper: g.ground, gamma: 0.78,
    }), x, y);
    return;
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (slot.treat === 'contain') {
    const s = Math.min(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * s) / 2, y + (h - img.height * s) / 2,
                  img.width * s, img.height * s);
  } else {
    photoGround(ctx, img, { w, h, ox: x, oy: y, tint: slot.tint ?? null });
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- draw */

const DRAW = {
  rect: (ctx, s, _c, g) => drawRect(ctx, s, g),
  grid: (ctx, s, _c, g) => drawGrid(ctx, s, g),
  barcode: (ctx, s, _c, g, _r, seed) => drawBarcode(ctx, s, g, seed),
};

/**
 * Draw one composed sheet.
 *
 * @param ctx    a 1080x1350 context
 * @param spec   a measured layout from lib/hooks/layouts.js
 * @param copy   {slotId: string | string[]} — what the agent wrote
 * @param art    {slotId: HTMLImageElement} — already decoded
 */
export function compose(ctx, spec, copy = {}, art = {}) {
  const g = GROUNDS[spec.ground] ?? GROUNDS.paper;
  const seed = spec.seed ?? hash(spec.id ?? 'hook');
  const report = { tight: [], missing: [], id: spec.id };

  ctx.save();
  ctx.fillStyle = g.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  for (const slot of spec.slots) {
    if (slot.when === 'copy' && !copy[slot.id]) continue;

    if (slot.t === 'art') { drawArt(ctx, slot, art[slot.id], g, report); continue; }

    const simple = DRAW[slot.t];
    if (simple) { simple(ctx, slot, copy, g, report, seed); continue; }

    // type. The slot's own `text` is the fallback, so furniture — a
    // date, a category, the mark — does not need the agent to supply it.
    const text = copy[slot.id] ?? slot.text;
    if (text == null || text === '') continue;

    // type over a photograph decides its own polarity and veil, measured
    // against what is actually behind it rather than assumed
    if (slot.over === 'art') {
      const box = {
        x: px.x(slot.box[0]), y: px.y(slot.box[1]),
        w: px.w(slot.box[2]), h: px.h(slot.box[3]),
      };
      // pickPolarity returns a decision, not a colour: {colour, dark, mean}.
      // Passing the whole object to fitScrim, which wants a hex string,
      // is what "textHex.slice is not a function" was.
      const polarity = pickPolarity(ctx, box, { light: g.ground, dark: g.mark });
      fitScrim(ctx, box, polarity.colour, { dark: polarity.dark });
      drawType(ctx, { ...slot, fill: polarity.colour }, text, g, report);
      continue;
    }

    drawType(ctx, slot, text, g, report);
  }

  grain(ctx, W, H, spec.grain ?? 0.026);

  report.coverage = coverage(ctx.canvas, g.ground);
  return report;
}

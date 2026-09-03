/**
 * ui.js — interface parts, drawn as printed objects.
 *
 * A carousel about websites can use the website as its material. These
 * are the primitives: a phone, a progress bar, a skeleton screen, a
 * bar of a chart, a field, a button, a chip.
 *
 * Two rules hold throughout, and they are what stop this looking like a
 * screenshot pasted onto a poster:
 *
 *   Nothing is outlined. Every part is a solid shape or a shape cut out
 *   of another solid shape, because a 1px border is a screen idea and
 *   this is meant to read as ink on paper.
 *
 *   Nothing carries a shadow, a gradient or a rounded corner larger
 *   than it needs. The device is a black rectangle with a hole in it.
 *
 * Every function returns the box it drew, so callers stack rather than
 * position: the thing that follows starts where the last one ended.
 */

import { PAPER, INK, RED, GREY } from './flow.js';

/** Rounded-rect path. r is clamped so it can never invert the shape. */
export function roundRect(ctx, x, y, w, h, r = 0) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/**
 * A phone: a solid body with the screen cut out of it, not a frame with
 * a border. Returns the screen rect so the caller can draw inside it.
 */
export function phone(ctx, { x, y, w, h, bezel = 18, body = INK, screen = PAPER }) {
  ctx.save();
  ctx.fillStyle = body;
  roundRect(ctx, x, y, w, h, 44);
  ctx.fill();
  ctx.fillStyle = screen;
  const s = { x: x + bezel, y: y + bezel * 2.6, w: w - bezel * 2, h: h - bezel * 4.2 };
  roundRect(ctx, s.x, s.y, s.w, s.h, 12);
  ctx.fill();
  // the speaker slot, the one detail that makes it read as a phone
  ctx.fillStyle = screen;
  roundRect(ctx, x + w / 2 - 34, y + bezel, 68, 9, 5);
  ctx.fill();
  ctx.restore();
  return s;
}

/** A progress bar as two solid blocks: the track, and what has loaded. */
export function progress(ctx, { x, y, w, h = 12, pct, colour = RED, track = GREY }) {
  ctx.save();
  ctx.fillStyle = track;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, pct)) * w, h);
  ctx.restore();
  return { x, y, w, h };
}

/**
 * The grey blocks a page shows before its content arrives. The last
 * line is short, the way a real paragraph ends.
 */
export function skeleton(ctx, { x, y, w, lines = 4, size = 18, gap = 16, colour = GREY }) {
  ctx.save();
  ctx.fillStyle = colour;
  for (let i = 0; i < lines; i++) {
    const lw = i === lines - 1 ? w * 0.52 : w * (0.86 + ((i * 7) % 5) / 36);
    ctx.fillRect(x, y + i * (size + gap), lw, size);
  }
  ctx.restore();
  return { x, y, w, h: lines * (size + gap) - gap };
}

/**
 * One bar of a chart, with its label sitting above it rather than in a
 * column beside it — a label column forces the bars into whatever width
 * is left, and the bars are the information.
 */
export function bar(ctx, { x, y, w, h = 46, colour = INK, label, value,
                           labelSize = 24, valueSize = 24, face, on = INK }) {
  ctx.save();
  if (label) {
    ctx.fillStyle = on;
    ctx.font = `900 ${labelSize}px ${face}`;
    ctx.fillText(label, x, y - 12);
  }
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  if (value) {
    // inside the bar when it fits, just outside it when it does not
    ctx.font = `900 ${valueSize}px ${face}`;
    const vw = ctx.measureText(value).width;
    const inside = vw + 28 < w;
    ctx.fillStyle = inside ? PAPER : on;
    ctx.fillText(value, inside ? x + 14 : x + w + 14, y + h / 2 + valueSize * 0.35);
  }
  ctx.restore();
  return { x, y, w, h };
}

/** An input field: a solid well with its label knocked into the space above. */
export function field(ctx, { x, y, w, h = 62, label, face, ground = GREY, on = INK }) {
  ctx.save();
  if (label) {
    ctx.fillStyle = on;
    ctx.font = `700 20px ${face}`;
    ctx.fillText(label, x, y - 12);
  }
  ctx.fillStyle = ground;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  return { x, y, w, h };
}

/** A button: a solid block with its word centred in it. */
export function button(ctx, text, { x, y, w, h = 68, colour = RED, on = PAPER, face, size = 26 }) {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = on;
  ctx.font = `900 ${size}px ${face}`;
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, x + (w - tw) / 2, y + h / 2 + size * 0.35);
  ctx.restore();
  return { x, y, w, h };
}

/** A small solid tag. Returns its width so chips can be laid in a row. */
export function chip(ctx, text, { x, y, colour = INK, on = PAPER, face, size = 22, pad = 14 }) {
  ctx.save();
  ctx.font = `900 ${size}px ${face}`;
  const w = ctx.measureText(text).width + pad * 2;
  const h = size * 1.9;
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = on;
  ctx.fillText(text, x + pad, y + h / 2 + size * 0.35);
  ctx.restore();
  return { x, y, w, h };
}

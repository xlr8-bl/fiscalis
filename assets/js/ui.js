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

/**
 * The map pack: the three-result block that sits above the ordinary
 * search results. Drawn as solid bands, with one result picked out in
 * the accent, because the argument is about which three you are in.
 */
export function mapPack(ctx, { x, y, w, h, face, ground = PAPER, on = INK,
                               accent = RED, pick = 0 }) {
  ctx.save();
  ctx.fillStyle = ground;
  ctx.fillRect(x, y, w, h);
  // the map strip along the top
  ctx.fillStyle = GREY;
  ctx.fillRect(x, y, w, h * 0.34);
  ctx.fillStyle = accent;
  for (let i = 0; i < 3; i++) {
    const px = x + w * (0.22 + i * 0.26), py = y + h * (0.12 + (i % 2) * 0.1);
    ctx.beginPath();
    ctx.arc(px, py, h * 0.036, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - h * 0.03, py + h * 0.02);
    ctx.lineTo(px + h * 0.03, py + h * 0.02);
    ctx.lineTo(px, py + h * 0.085);
    ctx.closePath();
    ctx.fill();
  }
  // the three rows
  const rowH = (h * 0.62) / 3;
  for (let i = 0; i < 3; i++) {
    const ry = y + h * 0.36 + i * rowH;
    if (i === pick) { ctx.fillStyle = accent; ctx.fillRect(x, ry, w, rowH - 6); }
    ctx.fillStyle = i === pick ? ground : on;
    ctx.fillRect(x + 20, ry + rowH * 0.24, w * 0.46, rowH * 0.2);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x + 20, ry + rowH * 0.54, w * 0.3, rowH * 0.13);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return { x, y, w, h };
}

/**
 * A spreadsheet, as a field of cells with a header band. `hot` marks
 * one cell in the accent — the one the argument is about.
 */
export function grid(ctx, { x, y, w, h, cols = 6, rows = 12, face,
                            ground = PAPER, line = GREY, on = INK,
                            accent = RED, hot = null }) {
  ctx.save();
  const cw = w / cols, ch = h / rows;
  ctx.fillStyle = ground;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = on;
  ctx.fillRect(x, y, w, ch);                      // header band
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x + c * cw, cy = y + r * ch;
      ctx.fillStyle = (r + c) % 2 ? line : ground;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(cx + 2, cy + 2, cw - 4, ch - 4);
      ctx.globalAlpha = 1;
      if (hot && hot[0] === r && hot[1] === c) {
        ctx.fillStyle = accent;
        ctx.fillRect(cx + 2, cy + 2, cw - 4, ch - 4);
      }
    }
  }
  ctx.restore();
  return { x, y, w, h };
}

/**
 * An order slip. Deliberately narrow and tall, with a torn foot, since
 * that shape alone says receipt before any of the type does.
 */
export function receipt(ctx, { x, y, w, h, face, ground = PAPER,
                               on = INK, lines = 7 }) {
  ctx.save();
  ctx.fillStyle = ground;
  ctx.fillRect(x, y, w, h - 14);
  // the torn foot
  ctx.beginPath();
  ctx.moveTo(x, y + h - 14);
  const teeth = 9;
  for (let i = 0; i <= teeth; i++) {
    ctx.lineTo(x + (w / teeth) * i, y + h - (i % 2 ? 0 : 14));
  }
  ctx.lineTo(x + w, y + h - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = on;
  for (let i = 0; i < lines; i++) {
    const ly = y + 40 + i * ((h - 90) / lines);
    ctx.globalAlpha = i === 0 ? 1 : 0.55;
    ctx.fillRect(x + 22, ly, w * (i === 0 ? 0.5 : 0.34 + ((i * 7) % 5) / 12), i === 0 ? 16 : 10);
    ctx.fillRect(x + w - 22 - w * 0.18, ly, w * 0.18, i === 0 ? 16 : 10);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return { x, y, w, h };
}

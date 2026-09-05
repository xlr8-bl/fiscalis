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
  geometric: 'Outfit',           // the circular geometric the agency sheets set
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

/**
 * Fit a layout measured in one frame into the 1080x1350 sheet.
 *
 * The corpus is not all 4:5. Forty-five references are, thirteen are 3:4,
 * five are taller, and three are square. A measurement is normalised
 * against ITS OWN frame, so rendering a square sheet's coordinates at 4:5
 * stretches the design a quarter taller — the boxes are then right about
 * each other and wrong about the page.
 *
 * So the design is scaled uniformly to fit the sheet and centred, and
 * every normalised value moves with it: x and widths against the width,
 * y and heights and TYPE SIZES against the height, because size is
 * normalised against the height everywhere else in this file.
 */
const OUT_ASPECT = W / H;

function refit(slot, spec) {
  const a = spec.src ?? OUT_ASPECT;
  if (Math.abs(a - OUT_ASPECT) < 0.005) return slot;

  let kx = 1, ky = 1, ox = 0, oy = 0;
  if (a > OUT_ASPECT) { ky = OUT_ASPECT / a; oy = (1 - ky) / 2; }
  else { kx = a / OUT_ASPECT; ox = (1 - kx) / 2; }

  const b = slot.box;
  if (!b) return slot;
  const out = { ...slot, box: [ox + b[0] * kx, oy + b[1] * ky, b[2] * kx, b[3] * ky] };
  for (const k of ['size', 'max', 'min', 'pitch', 'step', 'lift', 'weight']) {
    if (typeof slot[k] === 'number') out[k] = slot[k] * ky;
  }
  if (typeof slot.r === 'number') out.r = slot.r * ky;
  return out;
}

/* -------------------------------------------------------------- drawing */

function drawType(ctx, slot, copy, g, report) {
  /*
   * A quarter turn swaps the box before anything is measured.
   *
   * A rail running up the right edge is a TALL box on the sheet and a WIDE
   * one to the type inside it. Laying out against the box as filed gives
   * the words a few pixels of width and shrinks them to nothing, which is
   * why h007's rotated word drew nothing at all. So the box is swapped for
   * the layout and the frame is rotated to put it back.
   */
  const turn = slot.rotate === 90 || slot.rotate === -90 ? slot.rotate : 0;
  const boxW = turn ? px.h(slot.box[3]) : px.w(slot.box[2]);
  const boxH = turn ? px.w(slot.box[2]) : px.h(slot.box[3]);
  const laid = turn
    ? { ...slot, box: [0, 0, boxW / W, boxH / H] }
    : slot;

  const { size, lines, over } = layOut(ctx, laid, copy);
  if (over) report.tight.push(slot.id);

  const bx = turn ? 0 : px.x(slot.box[0]);
  const by = turn ? 0 : px.y(slot.box[1]);
  const bw = boxW;
  const bh = boxH;
  const leading = slot.leading ?? 0.94;
  const blockH = size * (0.78 + (lines.length - 1) * leading);

  // vertical placement inside the measured box
  const vAlign = slot.vAlign ?? 'top';
  const y0 = vAlign === 'bottom' ? by + bh - blockH
    : vAlign === 'middle' ? by + (bh - blockH) / 2
      : by;

  ctx.save();

  /*
   * `rotate` turns the block about the centre of its measured box.
   *
   * Several sheets run a short instruction up the right edge. Drawing it
   * horizontally and clipping — which is what happened before this — loses
   * half the words silently, and a rail that says APPLY instead of APPLY
   * NOW looks like a bug rather than a design.
   *
   * The box stays the box: it is measured as it appears on the sheet, tall
   * and narrow, and the type is laid out along the long side of it.
   */
  if (turn) {
    const ox = px.x(slot.box[0]);
    const oy = px.y(slot.box[1]);
    const ow = px.w(slot.box[2]);
    const oh = px.h(slot.box[3]);
    if (turn === -90) { ctx.translate(ox, oy + oh); ctx.rotate(-Math.PI / 2); }
    else { ctx.translate(ox + ow, oy); ctx.rotate(Math.PI / 2); }
  }

  ctx.font = fontAt(slot, size);
  ctx.fillStyle = ink(slot.fill, g);
  if (slot.alpha != null) ctx.globalAlpha = slot.alpha;
  if (slot.track) ctx.letterSpacing = `${slot.track * size}px`;
  ctx.textBaseline = 'alphabetic';

  lines.forEach((line, i) => {
    /*
     * `italicFrom` switches face partway down a headline.
     *
     * Several sheets set the first lines roman and turn the last one or
     * two italic, and the switch is not decoration: the italic half is the
     * thing being named. It has to be one slot rather than two, because
     * two slots means two boxes and the line that turns italic then cannot
     * move when the copy gets longer.
     */
    if (slot.italicFrom != null) {
      ctx.font = fontAt(
        i >= slot.italicFrom ? { ...slot, role: slot.italicRole ?? 'didoneItalic' } : slot,
        size
      );
      if (slot.track) ctx.letterSpacing = `${slot.track * size}px`;
    }
    const lw = ctx.measureText(line).width;
    const align = slot.align ?? 'left';
    const x = align === 'right' ? bx + bw - lw
      : align === 'center' ? bx + (bw - lw) / 2
        : bx;
    const y = y0 + size * 0.78 + i * size * leading;

    /*
     * `highlight` puts a solid bar behind the line, sized to the line.
     *
     * It has to belong to the type rather than be a rect slot beside it.
     * A separate rect is measured once, against the words that were in
     * the reference, and the moment an agent writes shorter ones the bar
     * runs off past them and the sheet looks automated — which is the
     * exact failure the whole file exists to avoid. Measured here, the bar
     * is always the width of whatever was written.
     */
    const lit = slot.highlight
      && (!slot.highlightLines || slot.highlightLines.includes(i));
    if (lit) {
      const padX = size * (slot.highlightPad?.[0] ?? 0.10);
      const padY = size * (slot.highlightPad?.[1] ?? 0.16);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink(slot.highlight, g);
      ctx.fillRect(x - padX, y - size * 0.78 - padY,
                   lw + padX * 2, size * 0.78 + padY * 2);
      ctx.restore();
      ctx.fillStyle = ink(slot.highlightText ?? 'ground', g);
    } else if (slot.highlight) {
      ctx.fillStyle = ink(slot.fill, g);
    }

    // a span recolours one word without needing a second slot
    let span = slot.spans?.[i] ?? (i === 0 ? slot.span : null);
    // `last: n` picks out the final n words, so the device survives copy
    // it was not measured with; naming a literal word only works once
    if (span?.last && !span.word) {
      const parts = line.trim().split(/\s+/);
      span = { ...span, word: parts.slice(-span.last).join(' ') };
    }
    if (span?.word && line.includes(span.word)) {
      const at = line.indexOf(span.word);
      ctx.fillText(line, x, y);
      ctx.save();
      ctx.fillStyle = ink(span.fill, g);
      ctx.fillText(span.word, x + ctx.measureText(line.slice(0, at)).width, y);
      ctx.restore();
    } else if (slot.soft) {
      /* A sprayed edge. Several sheets set display type with no hard
         boundary at all — it is stencilled rather than printed — and a
         crisp glyph beside them looks like a different sheet. */
      ctx.save();
      ctx.filter = `blur(${Math.max(1, size * slot.soft)}px)`;
      ctx.fillText(line, x, y);
      ctx.restore();
    } else if (slot.outline) {
      /*
       * Type as an outline, which several sheets use over a photograph.
       *
       * Not a style for its own sake: hollow letters let the picture
       * through, so a headline can sit across the middle of a photograph
       * without covering the thing the photograph is of. The weight is a
       * fraction of the size rather than a constant, or it disappears at
       * caption sizes and turns into a slab at display sizes.
       */
      ctx.save();
      ctx.strokeStyle = ink(slot.fill, g);
      ctx.lineWidth = Math.max(1.5, size * (slot.outlineWeight ?? 0.022));
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, y);
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
  if (slot.rotate) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((slot.rotate * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
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
  /*
   * A loose stroke, for the sheets whose "picture" is a gesture rather
   * than a thing: a painted swoosh behind a headline, a scribbled
   * underline, a mark somebody made with one movement.
   *
   * Drawn rather than sourced because there is nothing to source. An
   * archive has no photographs of a brush stroke that happen to run the
   * width of a 1080x1350 sheet, and the one it returns for "paint stroke"
   * is a photograph of a wall. It is also the one kind of art that must
   * change with the sheet: the stroke exists to hold the type, so it has
   * to be drawn to the box the type is in.
   */
  stroke(ctx, { x, y, w, h, on }) {
    ctx.save();
    ctx.strokeStyle = on;
    ctx.lineWidth = h * 0.30;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.02, y + h * 0.30);
    ctx.bezierCurveTo(x + w * 0.30, y - h * 0.10,
                      x + w * 0.62, y + h * 0.62,
                      x + w * 0.98, y + h * 0.22);
    ctx.bezierCurveTo(x + w * 0.72, y + h * 1.05,
                      x + w * 0.28, y + h * 0.55,
                      x + w * 0.06, y + h * 0.92);
    ctx.stroke();
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
  const list = (kinds ?? ['stroke']).slice(0, 4);
  const cw = w / list.length;

  // drawn onto their own surface first, so the screen can be applied to
  // the row rather than to the page under it
  const pad = new OffscreenCanvas(Math.ceil(w), Math.ceil(h));
  const p2 = pad.getContext('2d');
  list.forEach((kind, i) => {
    const fn = DRAWN[kind] ?? DRAWN.stroke;
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
  // a row: several cut-outs across one box, bottom-aligned to a common
  // baseline so they read as a set rather than as loose icons
  if (Array.isArray(img)) {
    const bx = px.x(slot.box[0]), by = px.y(slot.box[1]);
    const bw = px.w(slot.box[2]), bh = px.h(slot.box[3]);
    const gap = bw * (slot.gap ?? 0.05);
    const cell = (bw - gap * (img.length - 1)) / img.length;
    img.forEach((im, i) => {
      const s = Math.min(cell / im.width, bh / im.height);
      const w = im.width * s, h = im.height * s;
      ctx.drawImage(im, bx + i * (cell + gap) + (cell - w) / 2, by + bh - h, w, h);
    });
    return;
  }
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
    // A screen lays ink in proportion to darkness, so a high-key
    // photograph — which is most of what a stock search returns — comes
    // through as a few small dots and reads as an empty box. Stretching
    // the range is not enough on its own when the range is genuinely
    // narrow, so a slot can ask for more contrast than the photograph has.
    ctx.drawImage(halftone(img, {
      w, h, pitch: slot.pitch ? px.h(slot.pitch) : pitchFor(h),
      angle: 0.26, ink: g.photo, paper: g.ground,
      gamma: slot.gamma ?? 0.78, contrast: slot.contrast ?? 1.15,
      target: slot.target ?? 0.52,
    }), x, y);
    return;
  }

  ctx.save();
  ctx.beginPath();
  /*
   * `mask: 'ellipse'` puts the picture in a vignette rather than a
   * rectangle. Several references frame a portrait in a circle and then
   * let the subject break the edge of it, which is a different move from
   * a cropped photograph: the circle reads as a lens, and anything
   * crossing it reads as coming out of the sheet.
   *
   * `bleed` is how far past the box the picture may run, as a fraction of
   * the box, so the subject can break the frame while the frame stays
   * where it was measured.
   */
  if (slot.mask === 'ellipse') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (slot.r) {
    // a screen in a collage has rounded corners; a photograph does not
    const r = slot.r === 'pill' ? Math.min(w, h) / 2 : px.h(slot.r);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else {
    const b = slot.bleed ? [px.w(slot.box[2] * slot.bleed), px.h(slot.box[3] * slot.bleed)] : [0, 0];
    ctx.rect(x - b[0], y - b[1], w + b[0] * 2, h + b[1] * 2);
  }
  ctx.clip();
  if (slot.treat === 'contain') {
    /*
     * `anchor` is which edge the picture stands on. A cut-out figure that
     * runs off the bottom of the sheet has to keep its feet at the bottom
     * of the box whatever its aspect; centring it leaves it floating and
     * the sheet reads as a paste-up.
     */
    const s = Math.min(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    const a = slot.anchor ?? 'center';
    const dx = a === 'left' ? 0 : a === 'right' ? w - iw : (w - iw) / 2;
    const dy = a === 'top' ? 0 : a === 'bottom' ? h - ih : (h - ih) / 2;
    ctx.drawImage(img, x + dx, y + dy, iw, ih);
  } else {
    /*
     * A duotone is named by its role, not by two hex values.
     *
     * photoGround takes a [dark, light] pair. Writing that pair into a
     * layout would nail the sheet to one palette, and the whole set is
     * meant to move onto one palette together — so a slot says which of
     * the ground's own colours to print in and the pair is resolved here.
     */
    /* photoGround takes [dark, light]. `ground` is that pair on a light
       sheet and inverted on a dark one, so a dark ground names `field`
       instead and gets its own colour as the shadow. */
    const tint = slot.tint === 'ground' ? [g.mark, g.ground]
      : slot.tint === 'field' ? [g.ground, g.mark]
        : slot.tint === 'accent' ? [g.mark, g.accent]
          : Array.isArray(slot.tint) ? slot.tint : null;
    photoGround(ctx, img, { w, h, ox: x, oy: y, tint, key: slot.key ?? 0,
                            contrast: slot.contrast ?? 1.0 });
  }
  ctx.restore();

  if (slot.darken) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fillStyle = `rgba(0,0,0,${slot.darken})`;
    ctx.fill();
    ctx.restore();
  }
}

/* ---------------------------------------------------------------- draw */

/**
 * A panel: the interface furniture half the corpus is built out of.
 *
 * Drawn, not sourced. A browser card is a rounded rectangle with a bar and
 * three dots, and no photograph of a laptop will ever be one — the sheets
 * that use these are showing an interface, not a desk. `chrome` adds the
 * bar; `shadow` lifts it off the sheet the way a collage does.
 */
function drawCard(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const r = slot.r === 'pill' ? Math.min(w, h) / 2 : px.h(slot.r ?? 0.010);

  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  ctx.save();
  if (slot.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = px.h(0.016);
    ctx.shadowOffsetY = px.h(0.006);
  }
  path();
  ctx.fillStyle = ink(slot.fill ?? 'mark', g);
  ctx.fill();
  ctx.restore();

  if (slot.stroke) {
    ctx.save(); path();
    ctx.strokeStyle = ink(slot.stroke, g);
    ctx.lineWidth = px.h(slot.weight ?? 0.0014);
    ctx.stroke(); ctx.restore();
  }

  if (slot.chrome) {
    const bar = px.h(0.026);
    const on = ink(slot.chromeInk ?? (slot.fill === 'ground' ? 'mark' : 'ground'), g);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = on;
    const d = bar * 0.20;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + bar * 0.7 + i * d * 3, y + bar * 0.75, d, 0, Math.PI * 2);
      ctx.fill();
    }
    // the address or menu line at the far end of the bar
    ctx.fillRect(x + w - bar * 2.4, y + bar * 0.62, bar * 1.6, d * 0.8);
    ctx.restore();
  }
}

/** A run of dots, first one filled. A step indicator, not a grid. */
function drawDots(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const n = slot.count ?? 5;
  const down = h >= w;
  const span = down ? h : w;
  const r = Math.min(down ? w : h, span / (n * 2.6)) / 2;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const cx = down ? x + w / 2 : x + r + t * (w - r * 2);
    const cy = down ? y + r + t * (h - r * 2) : y + h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (i === (slot.on ?? 0)) { ctx.fillStyle = ink(slot.fill ?? 'accent', g); ctx.fill(); }
    else {
      ctx.strokeStyle = ink(slot.dim ?? 'mark', g);
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(1, r * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

/**
 * A dial: a ring with one wedge filled and a hub at the centre.
 *
 * Half a dozen sheets in the corpus sign themselves with a small circular
 * mark in a top corner. Drawn rather than set as a glyph because no font
 * has this and substituting the nearest one (◒, ◔) gets the wedge angle
 * wrong, which is the only thing the mark says.
 */
function drawDial(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
  const rad = (d) => (d - 90) * Math.PI / 180;
  const lw = Math.max(2, r * (slot.weight ?? 0.20));
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = ink(slot.fill ?? 'mark', g);
  ctx.beginPath();
  ctx.arc(cx, cy, r - lw / 2, 0, Math.PI * 2);
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r - lw, rad(slot.from ?? 20), rad(slot.to ?? 90));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * (slot.hub ?? 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * An asterisk: spokes from a centre, drawn rather than set.
 *
 * The typographic asterisk sits in the top third of the em, because its
 * job is to hang off a word. The sheets that use one as a display mark
 * want it centred on the line it interrupts, at a size no font's
 * asterisk reaches. Same reasoning as the dial.
 */
function drawStar(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
  const n = slot.count ?? 6;
  ctx.save();
  ctx.strokeStyle = ink(slot.fill ?? 'accent', g);
  ctx.lineWidth = r * (slot.weight ?? 0.44);
  ctx.lineCap = slot.cap ?? 'butt';
  for (let i = 0; i < n / 2; i++) {
    const a = (slot.turn ?? 0) * Math.PI / 180 + i * Math.PI / (n / 2);
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A contact badge: a small disc with a phone or a globe in it.
 *
 * The contact rows along the foot of a dozen references are a 14px icon
 * and a line of figures. Set as characters they are at the mercy of
 * whatever emoji font the machine happens to have, which in a headless
 * render is usually nothing at all — so the two shapes that actually
 * appear are drawn.
 *
 * `solid` fills the disc and knocks the shape out of it; otherwise the
 * disc is a ring and the shape is drawn in the same colour.
 */
function drawBadge(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const r = Math.min(w, h) / 2, cx = x + w / 2, cy = y + h / 2;
  const solid = slot.solid !== false;
  const c = ink(slot.fill ?? 'mark', g);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, solid ? r : r - r * 0.12, 0, Math.PI * 2);
  if (solid) { ctx.fillStyle = c; ctx.fill(); }
  else { ctx.strokeStyle = c; ctx.lineWidth = r * 0.16; ctx.stroke(); }

  ctx.strokeStyle = ctx.fillStyle = solid ? ink(slot.on ?? 'ground', g) : c;
  ctx.lineWidth = r * 0.20;
  if ((slot.icon ?? 'phone') === 'globe') {
    const k = r * 0.60;
    ctx.beginPath();
    ctx.arc(cx, cy, k, 0, Math.PI * 2);
    ctx.moveTo(cx - k, cy); ctx.lineTo(cx + k, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, k * 0.48, k, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    /* A handset is one thick round-capped arc turned 45 degrees. Drawing
       the ear-piece, the mouth-piece and the bar between them separately
       is the right shape and the wrong scale — at the 20px these badges
       actually render it collapses into a squiggle. */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.34;
    ctx.beginPath();
    ctx.arc(0, -r * 0.22, r * 0.50, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** A wireframe sphere: latitude and longitude, no fill. Corpus furniture. */
function drawGlobe(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
  const n = slot.lines ?? 7;
  ctx.save();
  ctx.strokeStyle = ink(slot.fill ?? 'mark', g);
  ctx.lineWidth = Math.max(1, r * (slot.weight ?? 0.022));
  if (slot.alpha != null) ctx.globalAlpha = slot.alpha;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 1; i < n; i++) {
    const t = i / n;
    // latitudes: circles foreshortened to ellipses
    const yy = cy - r + 2 * r * t;
    const rr = Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy)));
    ctx.beginPath(); ctx.ellipse(cx, yy, rr, rr * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
    // longitudes: ellipses of varying width about the vertical axis
    ctx.beginPath(); ctx.ellipse(cx, cy, r * Math.abs(Math.cos(Math.PI * t)), r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A soft wash: a radial or vertical gradient ground. */
function drawWash(ctx, slot, g) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const from = ink(slot.from ?? 'ground', g);
  const to = ink(slot.to ?? 'ground', g);
  let grad;
  if (slot.axis === 'y') {
    grad = ctx.createLinearGradient(x, y, x, y + h);
  } else {
    const cx = x + w * (slot.cx ?? 0.5), cy = y + h * (slot.cy ?? 0.5);
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (slot.spread ?? 0.7));
  }
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Where a type slot's lines land. Shared so the frost panel and the type
    itself cannot drift apart. */
function typeLines(ctx, slot, copy) {
  const { size, lines } = layOut(ctx, slot, copy);
  const bx = px.x(slot.box[0]), by = px.y(slot.box[1]);
  const bw = px.w(slot.box[2]), bh = px.h(slot.box[3]);
  const leading = slot.leading ?? 0.94;
  const blockH = size * (0.78 + (lines.length - 1) * leading);
  const vAlign = slot.vAlign ?? 'top';
  const y0 = vAlign === 'bottom' ? by + bh - blockH
    : vAlign === 'middle' ? by + (bh - blockH) / 2 : by;
  ctx.save();
  ctx.font = fontAt(slot, size);
  if (slot.track) ctx.letterSpacing = `${slot.track * size}px`;
  const out = lines.map((line, i) => {
    const lw = ctx.measureText(line).width;
    const align = slot.align ?? 'left';
    const x = align === 'right' ? bx + bw - lw
      : align === 'center' ? bx + (bw - lw) / 2 : bx;
    return { line, x, y: y0 + size * 0.78 + i * size * leading, w: lw };
  });
  ctx.restore();
  return { size, font: fontAt(slot, size), track: slot.track, lines: out };
}

/**
 * Rough glass: a frosted panel with the letters knocked OUT of it.
 *
 * The clear part is the type. Everything else in the panel is the picture
 * seen through frosted glass, so the words are the only thing in focus —
 * which is the opposite of filling the letters, and is the effect the
 * sheet is actually teaching.
 *
 * Rough rather than smooth. A single gaussian reads as an out-of-focus
 * photograph; real frosted glass scatters, so the blurred copy is drawn
 * several times at small random offsets and then speckled. `knock` names
 * the type slots whose copy cuts through.
 */
function drawFrost(ctx, slot, copy, g, spec, seed) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = Math.round(px.w(slot.box[2])), h = Math.round(px.h(slot.box[3]));
  if (w < 4 || h < 4) return;
  const rnd = rng(seed ^ 0x9e37);

  const pane = new OffscreenCanvas(w, h);
  const pc = pane.getContext('2d');
  const blur = Math.max(3, px.h(slot.blur ?? 0.020));

  // scattered, not merely soft
  const taps = slot.taps ?? 5;
  pc.filter = `blur(${blur}px) brightness(${slot.lift ?? 1.06}) saturate(${slot.sat ?? 0.94})`;
  pc.globalAlpha = 1 / taps;
  for (let i = 0; i < taps; i++) {
    const dx = (rnd() - 0.5) * blur * 1.6;
    const dy = (rnd() - 0.5) * blur * 1.6;
    pc.drawImage(ctx.canvas, x, y, w, h, dx, dy, w, h);
  }
  pc.globalAlpha = 1;
  pc.filter = 'none';

  // the speckle that makes it read as ground glass rather than defocus
  const spec2 = pc.getImageData(0, 0, w, h);
  const d = spec2.data;
  const amt = (slot.grit ?? 14);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  pc.putImageData(spec2, 0, 0);

  // knock the words out, so they are the only thing still sharp
  const knock = (slot.knock ?? []).map((id) => spec.slots.find((t) => t.id === id))
    .filter((t) => t && (copy[t.id] ?? t.text));
  pc.globalCompositeOperation = 'destination-out';
  pc.textBaseline = 'alphabetic';
  const cut = [];
  for (const t of knock) {
    const geo = typeLines(ctx, refit(t, spec), copy[t.id] ?? t.text);
    pc.font = geo.font;
    if (geo.track) pc.letterSpacing = `${geo.track * geo.size}px`;
    for (const l of geo.lines) {
      pc.fillText(l.line, l.x - x, l.y - y);
      cut.push({ ...l, size: geo.size, font: geo.font, track: geo.track });
    }
  }
  pc.globalCompositeOperation = 'source-over';
  ctx.drawImage(pane, x, y);

  // a bevel on the cut edge: light on one side, shadow on the other, so
  // the pane has thickness where the letters go through it
  if (cut.length && slot.bevel !== false) {
    const off = Math.max(1, px.h(slot.bevel ?? 0.0022));
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = off * 1.8;
    for (const l of cut) {
      ctx.font = l.font;
      if (l.track) ctx.letterSpacing = `${l.track * l.size}px`;
      ctx.strokeStyle = `rgba(255,255,255,${slot.bevelLight ?? 0.30})`;
      ctx.strokeText(l.line, l.x - off, l.y - off);
      ctx.strokeStyle = `rgba(0,0,0,${slot.bevelDark ?? 0.22})`;
      ctx.strokeText(l.line, l.x + off, l.y + off);
    }
    ctx.restore();
  }
}

/**
 * Print words a second time, in another colour, only where they cross a
 * shape.
 *
 * h007 sets its question in one colour on the paper and in another where
 * it runs over the huge punctuation mark behind it. Two slots cannot do
 * that — the switch happens inside a letter — so the mark is drawn over
 * the words and the words are then reprinted, clipped to it.
 */
function drawReprint(ctx, slot, copy, g, spec) {
  const of = (slot.of ?? []).map((id) => spec.slots.find((t) => t.id === id))
    .filter((t) => t && (copy[t.id] ?? t.text));
  const clip = spec.slots.find((t) => t.id === slot.clip);
  if (!of.length || !clip) return;

  const pane = new OffscreenCanvas(W, H);
  const pc = pane.getContext('2d');
  pc.textBaseline = 'alphabetic';

  const put = (t, colour) => {
    const geo = typeLines(ctx, refit(t, spec), copy[t.id] ?? t.text);
    pc.save();
    if (t.rotate === -90 || t.rotate === 90) {
      const r = refit(t, spec);
      const ox = px.x(r.box[0]), oy = px.y(r.box[1]);
      const ow = px.w(r.box[2]), oh = px.h(r.box[3]);
      if (t.rotate === -90) { pc.translate(ox, oy + oh); pc.rotate(-Math.PI / 2); }
      else { pc.translate(ox + ow, oy); pc.rotate(Math.PI / 2); }
    }
    pc.font = geo.font;
    if (geo.track) pc.letterSpacing = `${geo.track * geo.size}px`;
    pc.fillStyle = colour;
    for (const l of geo.lines) pc.fillText(l.line, l.x, l.y);
    pc.restore();
  };

  /* All the words first, then ONE intersection with the shape. Setting
     source-in and drawing them one by one intersects each with the last,
     which leaves nothing after the second word. */
  for (const t of of) put(t, ink(slot.fill ?? 'ground', g));
  pc.globalCompositeOperation = 'destination-in';
  put(clip, '#000');
  ctx.drawImage(pane, 0, 0);
}

/** A starburst: a scribbled radiating mark, the kind stuck beside a word. */
function drawBurst(ctx, slot, g, seed) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const cx = x + w / 2, cy = y + h / 2;
  const n = slot.points ?? 11;
  const rnd = rng(seed ^ 0x5eed);
  ctx.save();
  ctx.fillStyle = ink(slot.fill ?? 'mark', g);
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * Math.PI * 2;
    const r = (i % 2 ? 0.34 : 0.5) * (0.8 + rnd() * 0.4);
    const px2 = cx + Math.cos(t) * w * r;
    const py2 = cy + Math.sin(t) * h * r;
    if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A waveform: the readout line several sheets use as a small mark. */
function drawWave(ctx, slot, g, seed) {
  const x = px.x(slot.box[0]), y = px.y(slot.box[1]);
  const w = px.w(slot.box[2]), h = px.h(slot.box[3]);
  const n = slot.steps ?? 40;
  const rnd = rng(seed ^ 0x77a1);
  ctx.save();
  ctx.strokeStyle = ink(slot.fill ?? 'mark', g);
  ctx.lineWidth = Math.max(1.5, h * 0.06);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // quiet at the ends, loud in the middle, which is what a readout does
    const env = Math.sin(Math.PI * t) ** 1.6;
    const v = (rnd() - 0.5) * 2 * env;
    const px2 = x + t * w;
    const py2 = y + h / 2 + v * h * 0.5;
    if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
  }
  ctx.stroke();
  ctx.restore();
}

const DRAW = {
  rect: (ctx, s, _c, g) => drawRect(ctx, s, g),
  card: (ctx, s, _c, g) => drawCard(ctx, s, g),
  dots: (ctx, s, _c, g) => drawDots(ctx, s, g),
  globe: (ctx, s, _c, g) => drawGlobe(ctx, s, g),
  dial: (ctx, s, _c, g) => drawDial(ctx, s, g),
  star: (ctx, s, _c, g) => drawStar(ctx, s, g),
  badge: (ctx, s, _c, g) => drawBadge(ctx, s, g),
  wash: (ctx, s, _c, g) => drawWash(ctx, s, g),
  frost: (ctx, s, c, g, _r, seed, spec) => drawFrost(ctx, s, c, g, spec, seed),
  reprint: (ctx, s, c, g, _r, _seed, spec) => drawReprint(ctx, s, c, g, spec),
  burst: (ctx, s, _c, g, _r, seed) => drawBurst(ctx, s, g, seed),
  wave: (ctx, s, _c, g, _r, seed) => drawWave(ctx, s, g, seed),
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

  for (const raw of spec.slots) {
    const slot = refit(raw, spec);
    if (slot.when === 'copy' && !copy[slot.id]) continue;

    if (slot.t === 'art') { drawArt(ctx, slot, art[slot.id], g, report); continue; }

    const simple = DRAW[slot.t];
    if (simple) { simple(ctx, slot, copy, g, report, seed, spec); continue; }

    // type. The slot's own `text` is the fallback, so furniture — a
    // date, a category, the mark — does not need the agent to supply it.
    const text = copy[slot.id] ?? slot.text;
    if (text == null || text === '') continue;
    // a slot another slot reads but nothing draws — the frost panel's
    // knockout words are laid out, not painted
    if (slot.hidden) continue;

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
      /* A slot can pin its polarity. Measuring what is behind the type is
         right when the picture is unknown; it is wrong when the sheet has
         already decided — h005 is white on a darkened photograph, and
         letting the measurement flip it to black over a bright frame
         produces a different poster. `darken` on the art slot is what
         makes the pinned choice safe. */
      const polarity = slot.polarity === 'keep'
        ? { colour: ink(slot.fill, g), dark: true }
        : pickPolarity(ctx, box, { light: g.ground, dark: g.mark });
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

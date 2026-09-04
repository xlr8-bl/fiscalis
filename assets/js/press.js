/**
 * press.js — the print treatment, corrected against measurements.
 *
 * tools/extract_refs.py measured the 29 references and the 19 panels I
 * had drawn, the same way. Five numbers came back badly apart, and each
 * one explains something about why mine read as rendered rather than
 * printed.
 *
 *   metric                 references     mine
 *   ink coverage                0.323    0.158   half as much mass
 *   saturation                  0.185    0.039   a fifth of the colour
 *   grain sigma                 0.031    0.049   60% too much noise
 *   ground/mark contrast         4.79    11.01   more than twice
 *   halftone pitch               18px      7px   screen far too fine
 *
 * So:
 *
 * GROUNDS commit to colour instead of accenting with it. Every scheme
 * here is a whole field, taken from the palettes the references
 * actually used. The measured 4.79 is a whole-sheet median including
 * photographs, not a type-contrast target — body copy at 4.79 would
 * fail at feed size — so each scheme carries its real measured ratio
 * and a flag saying whether it can hold a paragraph at all.
 *
 * halftone() is a clustered-dot screen at a pitch you can see. The old
 * treatment was a per-pixel hash, which measures at a 7px repeat and
 * turns to mush at the size anyone actually views these. Pitch is
 * chosen per element by pitchFor(), not globally: a portrait screened
 * at the sheet's 18px loses the face.
 *
 * grain() is matched to sigma 0.031 rather than dialled by eye.
 */

/* ------------------------------------------------------------ grounds */

// The table itself lives in design-spec.js, which has no DOM, because
// the Worker has to validate against the same numbers the browser draws
// with and two copies of a contrast ratio is two chances to be wrong.
export { GROUNDS, GROUND_NAMES } from './design-spec.js';

/* ---------------------------------------------------------- treatment */

/**
 * A clustered-dot halftone: the screen a poster is actually printed
 * through, rather than a per-pixel threshold.
 *
 * The sheet is divided into cells of `pitch`. Each cell takes the mean
 * luminance under it and prints one dot whose area is proportional to
 * how dark that patch is. Rotating the grid by 15 degrees is what stops
 * the dots reading as a stitched fabric — it is the angle a real screen
 * is set at, for the same reason.
 *
 * `pitch` defaults to 16, near the 18px median measured off the set.
 */
export function halftone(img, { w, h, pitch = 16, angle = 0.26,
                                ink = '#141310', contrast = 1.0,
                                gamma = 0.78, ox = 0, oy = 0 } = {}) {
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sg = src.getContext('2d');
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  sg.drawImage(img, (w - iw) / 2 + ox, (h - ih) / 2 + oy, iw, ih);
  const px = sg.getImageData(0, 0, w, h).data;

  const lumAt = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 1;
    const i = (y * w + x) * 4;
    if (px[i + 3] < 8) return 1;
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    return Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5));
  };

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d');
  g.fillStyle = ink;

  // walk the rotated grid over a box big enough to cover the sheet
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const reach = Math.ceil((w + h) / pitch) + 2;
  const half = pitch / 2;
  for (let v = -reach; v < reach; v++) {
    for (let u = -reach; u < reach; u++) {
      const cx = (u * pitch * cos - v * pitch * sin) + w / 2;
      const cy = (u * pitch * sin + v * pitch * cos) + h / 2;
      if (cx < -pitch || cy < -pitch || cx > w + pitch || cy > h + pitch) continue;
      // mean of a few taps inside the cell, which is cheaper than the
      // full cell and indistinguishable at this pitch
      let sum = 0;
      for (let k = 0; k < 5; k++) {
        const dx = [0, -half * 0.6, half * 0.6, 0, 0][k];
        const dy = [0, 0, 0, -half * 0.6, half * 0.6][k];
        sum += lumAt(Math.round(cx + dx), Math.round(cy + dy));
      }
      // gamma opens the midtones back up: at 1.16 with no gamma the
      // mid-greys grew until neighbouring dots met and a face filled in
      // to a solid mass, which is what the first render did
      const dark = Math.pow(Math.min(1, Math.max(0, 1 - sum / 5)), gamma);
      if (dark <= 0.02) continue;
      // area proportional to darkness, so radius goes as the root
      const r = half * Math.sqrt(dark) * 1.02;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  return out;
}

/**
 * The pitch to screen an element of this height at.
 *
 * A single global pitch is wrong. The 18px median measured off the set
 * is what a full-bleed sheet is screened at; putting a 300px portrait
 * through the same screen gives it about twenty cells across a face and
 * the face disappears. The rule that holds is roughly sixty cells
 * across the element, clamped to the range that still reads as dots.
 *
 *   a 1280 panel      -> 18px, the measured median
 *   an 800 portrait   -> 13px
 *   a 300 thumbnail   -> 8px, the floor
 */
export function pitchFor(height) {
  return Math.max(8, Math.min(22, Math.round(height / 60)));
}

/**
 * Paper grain, matched to the measured sigma rather than chosen.
 *
 * The old treatment multiplied a noise tile at 0.05, which measured at
 * sigma 0.049 against the set's 0.031 — visibly dirtier than the thing
 * it was imitating. This lays the same tile at the strength that lands
 * on the measured number.
 */
export function grain(ctx, w, h, sigma = 0.031) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 160;
  const tg = tile.getContext('2d');
  const d = tg.createImageData(160, 160);
  // sigma is the standard deviation we want in the final sheet; a
  // uniform tile at full strength has sd ~0.29, so scale to suit
  const amp = Math.min(1, sigma / 0.29);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = n;
    d.data[i + 3] = 255;
  }
  tg.putImageData(d, 0, 0);

  ctx.save();
  ctx.globalAlpha = amp;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * How much of a sheet a mark covers, 0..1, measured against the panel's
 * own ground rather than against darkness.
 *
 * This replaces judging a panel by ink coverage. Ink coverage counts
 * dark pixels, so on an amber or a red field it collapses however
 * committed the panel is — an earlier note here claiming anything under
 * 0.2 was uncommitted was wrong for exactly that reason. The reference
 * median of 0.32 ink is only comparable between panels on like grounds.
 */
export function coverage(canvas, groundHex) {
  const g = canvas.getContext('2d');
  const px = g.getImageData(0, 0, canvas.width, canvas.height).data;
  const gr = [1, 3, 5].map((i) => parseInt(groundHex.slice(i, i + 2), 16));
  let off = 0;
  for (let i = 0; i < px.length; i += 4) {
    const d = Math.abs(px[i] - gr[0]) + Math.abs(px[i + 1] - gr[1])
            + Math.abs(px[i + 2] - gr[2]);
    if (d > 60) off++;                   // past the grain, a real mark
  }
  return off / (px.length / 4);
}

/**
 * Dark pixels as a share of the sheet, the number the extractor
 * reports. Use it to compare panels on like grounds; use coverage()
 * to ask whether a panel has committed to anything.
 */
export function inkCoverage(canvas) {
  const g = canvas.getContext('2d');
  const px = g.getImageData(0, 0, canvas.width, canvas.height).data;
  let dark = 0;
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    if (l < 0.35) dark++;
  }
  return dark / (px.length / 4);
}

/* ----------------------------------------------------------- photo ground */

/**
 * A photograph filling the whole panel, which is what every hook in the
 * reference set actually does and what a flat field cannot do.
 *
 * `tint` maps the picture between two colours by luminance — a duotone.
 * It is what pulls a stock photograph into the palette instead of
 * leaving it looking borrowed. Pass null to keep it as shot.
 */
export function photoGround(ctx, img, { w, h, tint = null, ox = 0, oy = 0,
                                        contrast = 1.0 } = {}) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale, ih = img.height * scale;
  ctx.drawImage(img, (w - iw) / 2 + ox, (h - ih) / 2 + oy, iw, ih);
  if (!tint) return;

  const d = ctx.getImageData(0, 0, w, h), px = d.data;
  const lo = [1, 3, 5].map((i) => parseInt(tint[0].slice(i, i + 2), 16));
  const hi = [1, 3, 5].map((i) => parseInt(tint[1].slice(i, i + 2), 16));
  for (let i = 0; i < px.length; i += 4) {
    let l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
    l = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5));
    px[i] = lo[0] + (hi[0] - lo[0]) * l;
    px[i + 1] = lo[1] + (hi[1] - lo[1]) * l;
    px[i + 2] = lo[2] + (hi[2] - lo[2]) * l;
  }
  ctx.putImageData(d, 0, 0);
}

/** Mean WCAG relative luminance over a box of the canvas. */
export function meanLuminance(ctx, { x, y, w, h }) {
  const px = ctx.getImageData(Math.max(0, x | 0), Math.max(0, y | 0),
                              Math.max(1, w | 0), Math.max(1, h | 0)).data;
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    sum += 0.2126 * f(px[i] / 255) + 0.7152 * f(px[i + 1] / 255)
         + 0.0722 * f(px[i + 2] / 255);
  }
  return sum / (px.length / 4);
}

function ratio(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Darken (or lighten) a band of a photograph until type will actually
 * read on it, and return what it took.
 *
 * This is the part the reference designers do by eye and the part that
 * has to be computed if panels are going to be produced without one.
 * The band is measured, a veil is stepped up until the measured
 * contrast clears `target`, and the veil is feathered over `fade` so it
 * reads as light in the photograph rather than a rectangle laid on it.
 *
 * Returns { ratio, alpha, passed }. A caller that gets passed:false has
 * a photograph too busy for that text colour in that place, which is a
 * reason to move the type or change the picture — not to ship it.
 */
export function fitScrim(ctx, box, textHex, {
  target = 4.5, fade = 160, dark = true, w, h, max = 0.55,
} = {}) {
  const t = [1, 3, 5].map((i) => parseInt(textHex.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const textLum = 0.2126 * f(t[0]) + 0.7152 * f(t[1]) + 0.0722 * f(t[2]);

  let alpha = 0;
  let got = ratio(meanLuminance(ctx, box), textLum);
  for (let step = 0; step < 12 && got < target && alpha < max; step++) {
    alpha = Math.min(max, alpha + 0.07);
    const g = ctx.createLinearGradient(0, box.y - fade, 0, box.y + box.h + fade);
    const solid = `rgba(${dark ? '0,0,0' : '255,255,255'},`;
    g.addColorStop(0, `${solid}0)`);
    g.addColorStop(fade / (box.h + fade * 2), `${solid}${0.07})`);
    g.addColorStop(1 - fade / (box.h + fade * 2), `${solid}${0.07})`);
    g.addColorStop(1, `${solid}0)`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, box.y - fade, w, box.h + fade * 2);
    ctx.restore();
    got = ratio(meanLuminance(ctx, box), textLum);
  }
  return { ratio: Math.round(got * 100) / 100, alpha: Math.round(alpha * 100) / 100,
           passed: got >= target };
}

/**
 * The most saturated colour in a picture, for use as its accent.
 *
 * The reference that sets "pinterest" in lime is using the grass; the
 * one that sets a headline in red is using the only colour absent from
 * a blue sky. Sampling the photograph is what keeps an accent from
 * looking dropped on from a brand guide.
 */
export function sampleAccent(ctx, { x = 0, y = 0, w, h }, { minLum = 0.18, maxLum = 0.82 } = {}) {
  const px = ctx.getImageData(x, y, w, h).data;
  let best = null, bestScore = -1;
  for (let i = 0; i < px.length; i += 4 * 37) {          // sparse walk
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0) continue;
    const sat = (mx - mn) / mx;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum < minLum || lum > maxLum) continue;
    if (sat > bestScore) { bestScore = sat; best = [r, g, b]; }
  }
  if (!best) return null;
  // Push it to poster strength in HSL. Scaling by the largest channel
  // (the first attempt) raises luminance and leaves saturation alone,
  // which is how a sampled forest green came back as mint.
  const [r0, g0, b0] = best.map((c) => c / 255);
  const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
  const l0 = (mx + mn) / 2;
  let hue = 0;
  if (mx !== mn) {
    const d = mx - mn;
    hue = mx === r0 ? ((g0 - b0) / d + (g0 < b0 ? 6 : 0))
        : mx === g0 ? (b0 - r0) / d + 2
        : (r0 - g0) / d + 4;
    hue /= 6;
  }
  return hslHex(hue, 0.88, Math.min(0.62, Math.max(0.46, l0 * 0.6 + 0.28)));
}

/** HSL to a hex string, so an accent can be rebuilt at poster strength. */
export function hslHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Whether type on this picture should be light or dark, decided by the
 * picture rather than by habit.
 *
 * A bright photograph forced to carry light type needs a veil so heavy
 * that the photograph stops being visible — which is what happened to
 * a shop interior at 0.7. Reading the box first and flipping the type
 * keeps the picture.
 */
export function pickPolarity(ctx, box, { light = '#F2F0E8', dark = '#141310' } = {}) {
  const lum = meanLuminance(ctx, box);
  return lum > 0.42
    ? { colour: dark, dark: false, mean: Math.round(lum * 100) / 100 }
    : { colour: light, dark: true, mean: Math.round(lum * 100) / 100 };
}

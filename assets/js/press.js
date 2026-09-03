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

/**
 * Whole-field schemes. `ground` is the sheet, `mark` carries type,
 * `accent` is the second colour, `photo` is the ink a screened image
 * prints in on that ground.
 *
 * `ratio` is the measured WCAG contrast of mark on ground and `body`
 * says whether that is enough to set paragraphs in. A hot red field
 * cannot carry body copy: darkening the red until it reaches 7:1 takes
 * it to #922114, a brick that is no longer the poster colour. So red
 * stays hot and is declared display-only, which is exactly how the
 * references use it — the red-field example in the set is a headline
 * and nothing else. Callers putting a paragraph on a display-only
 * ground is a bug the generator should refuse, not a judgement call.
 *
 * Every number here came out of the same contrast function the
 * extractor uses. The first version of this table was eyeballed and
 * three of the six were wrong by enough to matter.
 */
export const GROUNDS = {
  paper: { ground: '#EFEDE7', mark: '#141310', accent: '#E0331F', photo: '#141310', ratio: 15.87, body: true },
  ink:   { ground: '#141310', mark: '#EFEDE7', accent: '#E0331F', photo: '#EFEDE7', ratio: 15.87, body: true },
  red:   { ground: '#E0331F', mark: '#140B08', accent: '#F2E4C9', photo: '#140B08', ratio: 4.31, body: false },
  blue:  { ground: '#1843BE', mark: '#F2F0E8', accent: '#F0C531', photo: '#F2F0E8', ratio: 7.12, body: true },
  navy:  { ground: '#22345E', mark: '#EFEDE7', accent: '#F0C531', photo: '#EFEDE7', ratio: 10.42, body: true },
  amber: { ground: '#F0C531', mark: '#171310', accent: '#1843BE', photo: '#171310', ratio: 11.20, body: true },
};

export const GROUND_NAMES = Object.keys(GROUNDS);

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

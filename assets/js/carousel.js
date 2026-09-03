/**
 * carousel.js — five slides, each composed on its own terms.
 *
 * Not a template system. The earlier attempt was six parameterised
 * layouts, and the trouble with a layout is that it produces the same
 * slide with different words in it, which is exactly what a template
 * looks like. Every reference in the folder is its own composition:
 * 5409 overlaps and rotates its lines, 5424 fragments a sentence down
 * the page in type too small for the frame, 5405 knocks its words out
 * of a giant glyph, 5417 hangs two mirrored fragments off one heavy
 * word. Nothing in the set could be swapped for anything else in it.
 *
 * So these are five drawings, sharing primitives and nothing else.
 *
 * Three rules taken from the references and kept to:
 *
 *   Emphasis is scale. 5418 and 5422 set a small line and a giant line
 *   in the same face, the same weight and the same colour, at about one
 *   to five. An italic word in an accent colour is the cheap version of
 *   that and it reads as a template every time.
 *
 *   The furniture is nearly silent. A tiny credit, or three muted items
 *   on one rule. Badges and mono labels in every corner are decoration
 *   standing in for composition.
 *
 *   Air is the point. 5424 is mostly empty and it is the most confident
 *   thing in the folder.
 */

export const W = 1024;
export const H = 1280;

const DISPLAY = '"Display", Arial Black, sans-serif';
const MONO = '"Mono", ui-monospace, monospace';

/* Two inks a slide, three at the very most — the references never go past. */
const INK = '#0a0a09';
const PAPER = '#efeee9';
const RED = '#ED2024';
const BLUE = '#1B33E0';

/* ----------------------------------------------------------- primitives */

let faces = null;
export function loadFaces() {
  if (faces) return faces;
  faces = Promise.all([
    ['Display', '/assets/fonts/bricolage.woff2', { weight: '800' }],
    ['Mono', '/assets/fonts/geistmono.woff2', {}],
  ].map(async ([name, url, desc]) => {
    try {
      const f = new FontFace(name, `url(${url}) format("woff2")`, desc);
      await f.load(); document.fonts.add(f); return name;
    } catch { return null; }
  }));
  return faces;
}

/**
 * Set a line at exactly the width asked for.
 *
 * The giant lines in 5418 and 5422 span the measure edge to edge with
 * the tracking pulled in until they do. Fitting by font size alone
 * leaves ragged right edges; fitting by size *and* then tightening the
 * tracking is how the block gets its hard vertical edges.
 */
function setLine(ctx, text, { width, size, weight = 800, family = DISPLAY, track = null }) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = '0px';
  const natural = ctx.measureText(text).width;
  const gaps = Math.max(text.length - 1, 1);
  const spacing = track !== null ? track : (width - natural) / gaps;
  ctx.letterSpacing = `${spacing}px`;
  return { size, spacing, width: natural + spacing * gaps };
}

/** The size at which this text spans `width` with no tracking help. */
function sizeToSpan(ctx, text, width, { weight = 800, family = DISPLAY, cap = 460 } = {}) {
  ctx.letterSpacing = '0px';
  ctx.font = `${weight} 100px ${family}`;
  const at100 = ctx.measureText(text).width;
  return Math.min(cap, (width / at100) * 100);
}

/** One word, rotated about its own centre. */
function turned(ctx, text, { x, y, size, deg, colour, weight = 800, family = DISPLAY }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = colour;
  ctx.translate(x, y);
  ctx.rotate(deg * Math.PI / 180);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * A line on a curved baseline, from 5426 and 5427.
 *
 * Each glyph is placed and turned along the arc rather than the line
 * being warped as a whole, which is what a curve actually is when it is
 * set rather than filtered.
 */
function arced(ctx, text, { cx, cy, radius, size, colour, spread = 0.55, weight = 800 }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${DISPLAY}`;
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '0px';
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let angle = -spread * (total / 2) / radius;
  for (let i = 0; i < text.length; i++) {
    const step = widths[i] / radius * spread;
    angle += step / 2;
    ctx.save();
    ctx.translate(cx + Math.sin(angle) * radius, cy - Math.cos(angle) * radius);
    ctx.rotate(angle);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    angle += step / 2;
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/* ------------------------------------------------------- the surface */

/*
 * Value noise on a coarse grid, smoothed. Per-pixel randomness gives a
 * dusting; ink takes bites, so the field has to have lumps in it the
 * size of a bite.
 */
function noiseAt(x, y, scale, seed) {
  const h = (i, j) => {
    let n = (i * 374761393 + j * 668265263 + seed * 1274126177) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  const gx = x / scale, gy = y / scale;
  const i = Math.floor(gx), j = Math.floor(gy);
  const fx = gx - i, fy = gy - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

/**
 * Type as printed matter rather than as vector.
 *
 * This is the thing that was missing from every earlier attempt. The
 * references are physical objects: in 5409 the letterforms are eaten by
 * spray, strokes break up and the edges are ragged; 5419 is degraded
 * film; 5405 has smear pulled through the words. Laying 8% noise over
 * perfectly crisp type is a filter sitting on top of a clean render,
 * and it reads as a slide every time.
 *
 * So the glyphs are drawn to their own surface and then bitten into:
 * a coarse noise field knocks holes out of the ink, a finer one frays
 * the edges, and a few specks are thrown outside the letter. What comes
 * back is a shape that was never clean.
 *
 * `bite` is how hungry it is. 0.1 is a good press, 0.4 is a stencil.
 */
function inked(ctx, drawFn, { bite = 0.14, seed = 1, spatter = true, scale = 26 } = {}) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  drawFn(g);

  const img = g.getImageData(0, 0, W, H);
  const px = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = px[i + 3];
      if (a === 0) {
        // ink thrown clear of the letter, sparsely
        if (spatter && noiseAt(x, y, 2.2, seed + 9) > 0.985) {
          px[i] = px[i - 0]; px[i + 3] = 190;
        }
        continue;
      }
      /*
       * Holes at the scale of a bite — and the scale has to travel with
       * the type. A 26px cell against a 240px letter eats whole strokes,
       * and against a 1500px numeral it is confetti. Callers setting big
       * type pass a bigger cell so the ink breaks up in proportion to
       * the letter rather than in proportion to the canvas.
       */
      const coarse = noiseAt(x, y, scale, seed);
      // and a frayed edge, finer, which stays absolute
      const fine = noiseAt(x, y, 3.4, seed + 3);
      const eaten = coarse * 0.68 + fine * 0.32;
      if (eaten < bite) px[i + 3] = 0;
      else if (eaten < bite + 0.09) px[i + 3] = Math.round(a * 0.45);
    }
  }
  g.putImageData(img, 0, 0);
  ctx.drawImage(c, 0, 0);
}

/**
 * The same drawing twice, a few pixels apart, in two inks.
 *
 * Misregistration. A sheet that went through the press slightly out of
 * line, which is half of why a screenprint looks like one.
 */
function misregistered(ctx, drawFn, { offset = 5, under, over, bite = 0.12, seed = 1, scale = 40 }) {
  ctx.save();
  ctx.translate(-offset, offset * 0.6);
  inked(ctx, (g) => { g.fillStyle = under; drawFn(g); }, { bite: bite * 0.7, seed: seed + 40, scale });
  ctx.restore();
  inked(ctx, (g) => { g.fillStyle = over; drawFn(g); }, { bite, seed, scale });
}

/** A photograph, dithered hard to two inks. */
function halftone(ctx, img, { box, shadow, highlight, contrast = 1.4, alpha = 1 }) {
  const BAYER8 = [];
  for (let y = 0; y < 8; y++) { BAYER8[y] = []; for (let x = 0; x < 8; x++) {
    let v = 0, m = 4, xc = x, yc = y;
    while (m) { const bx = (xc & m) ? 1 : 0, by = (yc & m) ? 1 : 0;
      v = (v << 2) | ((bx ^ by) << 1 | bx); m >>= 1; }
    BAYER8[y][x] = v / 64;
  } }
  const c = document.createElement('canvas');
  c.width = box.w; c.height = box.h;
  const g = c.getContext('2d');
  const scale = Math.max(box.w / img.width, box.h / img.height);
  const w = img.width * scale, h = img.height * scale;
  g.drawImage(img, (box.w - w) / 2 + (box.ox || 0), (box.h - h) / 2 + (box.oy || 0), w, h);
  const d = g.getImageData(0, 0, box.w, box.h), px = d.data;
  const hx = (v) => { const t = v.replace('#',''); return [0,2,4].map(i=>parseInt(t.slice(i,i+2),16)); };
  const [sr,sg,sb] = hx(shadow), [hr,hg,hb] = hx(highlight);
  for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
    const i = (y * box.w + x) * 4;
    let l = (0.2126*px[i] + 0.7152*px[i+1] + 0.0722*px[i+2]) / 255;
    l = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5));
    const light = l > BAYER8[y & 7][x & 7];
    px[i] = light ? hr : sr; px[i+1] = light ? hg : sg; px[i+2] = light ? hb : sb;
  }
  g.putImageData(d, 0, 0);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(c, box.x, box.y);
  ctx.restore();
}

/** Remove a plain sweep, leaving the subject with real alpha. */
export function cutOut(img, { tolerance = 58 } = {}) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  const at = (x, y) => { const i = (y*c.width+x)*4; return [px[i],px[i+1],px[i+2]]; };
  const marks = [at(2,2), at(c.width-3,2), at(2,3), at(c.width-3,3)];
  const bg = [0,1,2].map(k => marks.reduce((a,m)=>a+m[k],0)/marks.length);
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i]-bg[0], dg = px[i+1]-bg[1], db = px[i+2]-bg[2];
    const far = Math.sqrt(dr*dr+dg*dg+db*db);
    px[i+3] = far < tolerance ? 0 : (far > tolerance*1.6 ? 255
              : Math.round((far - tolerance)/(tolerance*0.6)*255));
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** Paper, laid over everything at the end so it sits on the whole sheet. */
export function sheet(ctx, texture, { amount = 0.32 } = {}) {
  if (!texture) return;
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'multiply';
  const scale = Math.max(W / texture.width, H / texture.height);
  ctx.drawImage(texture, 0, 0, texture.width * scale, texture.height * scale);
  ctx.restore();
}

/** Film grain. Present on nearly every reference, never the subject. */
let noise = null;
function grain(ctx, amount = 0.07) {
  if (!noise) {
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const g = c.getContext('2d');
    const d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 90 + Math.random() * 165;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    noise = c;
  }
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(noise, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** The bloom on 5424's letters. Drawn under, not filtered over. */
function glow(ctx, draw, { colour, blur }) {
  // three passes, widest first: one shadow pass gives a hard halo the
  // shape of the word rather than light coming off it
  ctx.save();
  // additive: stacked normally the shadow passes darken each other and
  // leave a ring the shape of the word instead of light coming off it
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = colour;
  for (const [b, a] of [[blur * 3, 0.22], [blur * 1.5, 0.3], [blur * 0.6, 0.4]]) {
    ctx.shadowBlur = b;
    ctx.globalAlpha = a;
    draw();
  }
  ctx.restore();
  draw();
}

/** A credit, small and quiet, the way every reference signs itself. */
function credit(ctx, text, { colour, align = 'left', x, y, size = 19 }) {
  ctx.save();
  ctx.font = `${size}px ${MONO}`;
  ctx.letterSpacing = '1.5px';
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.55;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';
}

/* --------------------------------------------------------------- slides */

/*
 * Five drawings. Each one takes its structure from a named reference,
 * and every one of them is a printed thing: the type is bitten into,
 * the photographs are dithered to two inks, and a sheet of paper is
 * laid over the lot at the end.
 */

/**
 * 1 — after 5418 and 5422.
 *
 * A quiet line, one enormous line, and a cut-out figure holding the
 * bottom of the frame. The mass at the bottom is what makes the air in
 * the middle read as confidence rather than as an unfinished slide,
 * which is what the earlier version without a figure looked like.
 */
function hook(ctx, A) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const M = 70, measure = W - M * 2;

  if (A.laptop) {
    const h = H * 0.62, scale = h / A.laptop.height, w = A.laptop.width * scale;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(A.laptop, (W - w) / 2 + 40, H - h + 20, w, h);
    halftone(ctx, c, { x: 0, y: 0, w: W, h: H, box: { x: 0, y: 0, w: W, h: H },
                       shadow: INK, highlight: PAPER, contrast: 1.5 });
  }

  ctx.fillStyle = INK;
  setLine(ctx, 'the form still works.', { width: measure * 0.6, size: 44 });
  ctx.fillText('the form still works.', M, 220);
  ctx.letterSpacing = '0px';

  const big = 'nobody', big2 = 'is reading it';
  const s1 = sizeToSpan(ctx, big, measure, { cap: 330 });
  const s2 = sizeToSpan(ctx, big2, measure, { cap: 330 });
  misregistered(ctx, (g) => {
    setLine(g, big, { width: measure, size: s1 });
    g.fillText(big, M, 220 + s1 * 0.92);
    setLine(g, big2, { width: measure, size: s2 });
    g.fillText(big2, M, 220 + s1 * 0.92 + s2 * 0.9);
    g.letterSpacing = '0px';
  }, { offset: 6, under: RED, over: INK, bite: 0.1, seed: 5, scale: 90 });

  credit(ctx, 'WEB3ASHLEY', { colour: INK, x: M, y: H - 46 });
  credit(ctx, '01', { colour: INK, x: W - M, y: H - 46, align: 'right' });
}

/**
 * 2 — after 5424 and 5419.
 *
 * A sentence fragmented left and right down the page, over a portrait
 * dithered so far down it is almost a texture. The type is far too
 * small for the frame and the darkness is the composition.
 */
function fragments(ctx, A) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);

  if (A.portrait) {
    halftone(ctx, A.portrait, { box: { x: 0, y: 0, w: W, h: H },
                                shadow: INK, highlight: '#5a5852', contrast: 1.9, alpha: 0.85 });
  }
  // pull the middle down so the type has somewhere quiet to sit
  const wash = ctx.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0, 'rgba(10,10,9,0.55)');
  wash.addColorStop(0.55, 'rgba(10,10,9,0.9)');
  wash.addColorStop(1, 'rgba(10,10,9,0.6)');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.font = `19px ${MONO}`; ctx.letterSpacing = '2px'; ctx.fillStyle = '#6b6862';
  ctx.fillText('WEB3ASHLEY', 70, 74);
  ctx.textAlign = 'right'; ctx.fillText('LEAK 02', W - 70, 74);
  ctx.restore(); ctx.textAlign = 'left';

  const lines = [
    { t: 'THE FORM',         x: 110, y: 420 },
    { t: 'SENDS FINE',       x: 110, y: 462 },
    { t: 'THE NOTIFICATION', x: 470, y: 636 },
    { t: 'BROKE IN MARCH',   x: 470, y: 678 },
    { t: 'NOBODY HAS',       x: 110, y: 862 },
    { t: 'SEEN ONE SINCE',   x: 110, y: 904 },
  ];
  ctx.font = `800 34px ${DISPLAY}`; ctx.letterSpacing = '1px';
  for (const l of lines) {
    glow(ctx, () => { ctx.fillStyle = RED; ctx.fillText(l.t, l.x, l.y); }, { colour: RED, blur: 22 });
  }
  ctx.letterSpacing = '0px';
}

/**
 * 3 — after 5405.
 *
 * The figure blown past three edges, printed badly, with the words
 * knocked out of it where they cross.
 */
function knockout(ctx, A) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);

  const glyph = (c) => {
    c.font = `800 1500px ${DISPLAY}`;
    c.textAlign = 'center';
    c.fillText('0', W / 2 + 40, H * 0.87);
    c.textAlign = 'left';
  };
  const M = 66;
  const words = [
    { t: 'enquiries',    y: 420, size: 152 },
    { t: 'that reached', y: 552, size: 118 },
    { t: 'a human',      y: 684, size: 134 },
  ];
  const setWords = (c, colour) => {
    c.fillStyle = colour;
    for (const w of words) {
      c.font = `800 ${w.size}px ${DISPLAY}`;
      c.letterSpacing = '-2px';
      c.fillText(w.t, M, w.y);
    }
    c.letterSpacing = '0px';
  };

  // a 1500px numeral needs a cell to match, or it comes out as confetti
  inked(ctx, (g) => { g.fillStyle = RED; glyph(g); }, { bite: 0.09, seed: 11, scale: 260 });
  inked(ctx, (g) => setWords(g, INK), { bite: 0.08, seed: 2, scale: 60 });

  // and knocked out to paper inside the figure
  const cut = document.createElement('canvas');
  cut.width = W; cut.height = H;
  const cx = cut.getContext('2d');
  setWords(cx, PAPER);
  cx.globalCompositeOperation = 'destination-in';
  cx.fillStyle = '#fff'; glyph(cx);
  inked(ctx, (g) => g.drawImage(cut, 0, 0), { bite: 0.07, seed: 7, spatter: false, scale: 60 });

  turned(ctx, 'since march', { x: W - 92, y: 292, size: 38, deg: 90, colour: INK });
  credit(ctx, '03', { colour: INK, x: W - M, y: H - 46, align: 'right' });
}

/**
 * 4 — after 5409.
 *
 * Lines riding up into each other on negative leading, each starting
 * somewhere else, a couple of them turned, the whole thing sprayed
 * rather than set.
 */
function stagger(ctx, A) {
  ctx.fillStyle = BLUE; ctx.fillRect(0, 0, W, H);
  const M = 56, measure = W - M * 2;

  const rows = [
    { t: 'EVERY',      x: M - 14,  span: 0.66, deg: 0 },
    { t: 'LEAD',       x: M + 250, span: 0.44, deg: -2.5 },
    { t: 'YOU NEVER',  x: M + 90,  span: 0.92, deg: 0 },
    { t: 'SAW',        x: M + 430, span: 0.42, deg: 3 },
    { t: 'IS STILL',   x: M - 30,  span: 0.7,  deg: -1 },
    { t: 'A CUSTOMER', x: M + 20,  span: 1.02, deg: 1.5 },
  ];

  inked(ctx, (g) => {
    g.fillStyle = PAPER;
    let y = 330;
    for (const r of rows) {
      const size = sizeToSpan(g, r.t, measure * r.span, { cap: 240 });
      setLine(g, r.t, { width: measure * r.span, size });
      g.save();
      g.translate(r.x, y);
      if (r.deg) g.rotate(r.deg * Math.PI / 180);
      g.fillText(r.t, 0, 0);
      g.restore();
      y += size * 0.68;
    }
    g.letterSpacing = '0px';
    // sprayed, but it still has to be readable at thumbnail size:
    // 0.3 on a 40px cell ate the strokes and left nothing to read
  }, { bite: 0.15, seed: 21, scale: 110 });

  credit(ctx, '04', { colour: PAPER, x: W / 2, y: H - 46, align: 'center' });
}

/**
 * 5 — after 5404.
 *
 * The magazine page, and the one device that makes it move: the figure
 * breaks out of the colour block it is standing in.
 */
function editorial(ctx, A) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const M = 60;

  ctx.save();
  ctx.font = `19px ${MONO}`; ctx.letterSpacing = '2px';
  ctx.fillStyle = INK; ctx.globalAlpha = 0.6;
  ctx.fillText('WEB3ASHLEY', M, 58);
  ctx.textAlign = 'right'; ctx.fillText('05 / 05', W - M, 58);
  ctx.restore(); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  ctx.fillStyle = INK; ctx.fillRect(M, 74, W - M * 2, 2);

  const big = 'the fix';
  const sz = sizeToSpan(ctx, big, W - M * 2, { cap: 300 });
  inked(ctx, (g) => {
    g.fillStyle = INK;
    setLine(g, big, { width: W - M * 2, size: sz });
    g.fillText(big, M, 108 + sz * 0.82);
    g.letterSpacing = '0px';
  }, { bite: 0.09, seed: 31, scale: 110 });

  // the block, and the figure standing out of it
  const block = { x: M, y: 470, w: W - M * 2, h: 520 };
  ctx.fillStyle = RED;
  ctx.fillRect(block.x, block.y, block.w, block.h);

  if (A.crouch) {
    const h = 660, scale = h / A.crouch.height, w = A.crouch.width * scale;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(A.crouch, W - w - 40, block.y + block.h - h + 90, w, h);
    // dithered over the whole sheet, so it is free to cross the block's
    // edge — which is the move 5404 makes and the reason it is not a
    // picture sitting in a box
    halftone(ctx, c, { box: { x: 0, y: 0, w: W, h: H },
                       shadow: INK, highlight: PAPER, contrast: 1.6, alpha: 0.95 });
  }

  ctx.save();
  ctx.font = `23px ${MONO}`; ctx.letterSpacing = '1.5px'; ctx.fillStyle = PAPER;
  const notes = ['SEND IT TWICE', 'TO AN INBOX', 'SOMEONE OPENS'];
  notes.forEach((n, i) => ctx.fillText(n, M + 36, block.y + 70 + i * 38));
  ctx.restore();

  const close = 'tell me what is broken';
  const cs = sizeToSpan(ctx, close, W - M * 2, { cap: 92 });
  inked(ctx, (g) => {
    g.fillStyle = INK;
    setLine(g, close, { width: W - M * 2, size: cs });
    g.fillText(close, M, H - 96);
    g.letterSpacing = '0px';
  }, { bite: 0.07, seed: 33, scale: 44 });
}

export const SLIDES = [hook, fragments, knockout, stagger, editorial];

const SOURCES = {
  laptop: '/assets/stock/src/figure-laptop.jpg',
  crouch: '/assets/stock/src/figure-crouch.jpg',
  portrait: '/assets/stock/src/portrait-bw.jpg',
  paper: '/assets/stock/src/paper.jpg',
};

let art = null;
async function load() {
  if (art) return art;
  const one = (src) => new Promise((res) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
  });
  const got = {};
  for (const [k, src] of Object.entries(SOURCES)) got[k] = await one(src);
  // the two that stand on colour need their sweep taken off
  if (got.laptop) got.laptop = cutOut(got.laptop, { tolerance: 52 });
  if (got.crouch) got.crouch = cutOut(got.crouch, { tolerance: 46 });
  art = got;
  return art;
}

export async function draw(canvas, i) {
  await loadFaces();
  const A = await load();
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  SLIDES[i](ctx, A);
  grain(ctx, 0.09);
  sheet(ctx, A.paper, { amount: 0.22 });
  return canvas;
}

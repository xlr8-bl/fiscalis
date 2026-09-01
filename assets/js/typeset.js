/**
 * typeset.js — setting the copy over a drawn background.
 *
 * The second half of the free generation layer. paint.js gets Cloudflare
 * to draw a picture with no words in it; this puts the words on, in the
 * site's own typeface, and hands back a finished 1024x1280 slide.
 *
 * Why the type is set here rather than drawn.
 *
 * Asking an image model to spell is the single most common way an
 * AI-made carousel gives itself away: a headline with a dropped letter,
 * or two letters fused, or a word that is nearly the word. imagen.js can
 * only ask nicely and hope. Type drawn from the string is right every
 * time, in the weight and size that were chosen rather than negotiated,
 * and it matches the site because it is literally the site's font file.
 *
 * Why in the browser rather than the Worker.
 *
 * Rasterising type on the edge means shipping a WASM renderer and the
 * font files inside the Worker bundle, against Pages' size limit. In the
 * browser it is Canvas, which is already there, with fonts the page has
 * already loaded. The cost is that a slide is only finished while the
 * studio is open — and that costs nothing, because nothing can post
 * until a person opens the studio and approves it anyway. The
 * compositing happens on a visit that was already required.
 */

/* 1024x1280 is 4:5, inside TikTok's 1080 cap and past Instagram's 320
   floor: the same frame imagen.js asks Google for, so both paths produce
   an identically shaped slide and approval checks one thing. */
export const WIDTH = 1024;
export const HEIGHT = 1280;

/* The site's own tokens, from assets/css/site.css. Not approximations:
   a slide whose beige is a shade off reads as a different brand. */
const INK = '#e8e8e3';        // --swatch--beige-100
const SHADOW = '#080807';     // --swatch--black-400

const MARGIN = 96;            // the type never comes closer than this to an edge

/**
 * Load the display face so Canvas can use it by name.
 *
 * The studio has the font in CSS, but a canvas will silently fall back
 * to a system face if the family has not actually loaded — and a slide
 * set in the wrong typeface looks fine until it is next to a real one.
 * So it is loaded explicitly and awaited.
 */
let loaded = null;
async function face() {
  if (loaded) return loaded;
  loaded = (async () => {
    try {
      const f = new FontFace('Display', 'url(/assets/fonts/bricolage.woff2) format("woff2")',
                             { weight: '800' });
      await f.load();
      document.fonts.add(f);
      return 'Display';
    } catch {
      // better a slide in the wrong face than no slide: the caller is
      // told, and can decide whether to keep it
      return null;
    }
  })();
  return loaded;
}

/** Break a line into as many lines as it takes to fit, at this size. */
function wrap(ctx, text, max) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest size at which the copy still fits the box.
 *
 * Measured rather than guessed. A fixed size has to be small enough for
 * the longest line anyone might write, which makes every short hook look
 * timid; fitting to the box means a three-word hook is big and a
 * twenty-word one is readable, without either being decided in advance.
 */
function fit(ctx, text, family, box) {
  let best = { size: 32, lines: [String(text)] };
  for (let size = 120; size >= 32; size -= 2) {
    ctx.font = `800 ${size}px "${family}", sans-serif`;
    const lines = wrap(ctx, text, box.width);
    if (lines.length * size * 1.15 <= box.height) return { size, lines };
  }
  ctx.font = `800 32px "${family}", sans-serif`;
  best.lines = wrap(ctx, text, box.width);
  return best;
}

/**
 * Set one slide.
 *
 * @param {Blob|string} background  the drawn picture, or a URL to it
 * @param {object} slide            { copy, kind }
 * @returns {Promise<{blob:Blob, width:number, height:number, font:string}>}
 */
export async function typeset(background, slide = {}) {
  const family = (await face()) || 'sans-serif';
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');

  // the ground, before anything else, so a failure to load shows as a
  // flat brand colour rather than transparent pixels that encode black
  ctx.fillStyle = SHADOW;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const img = await load(background);
  if (img) {
    /* Cover, not stretch. Flux Schnell has no width or height and comes
       back square, so it is scaled to fill 4:5 and the overflow is
       cropped evenly. Stretching a face to fit is worse than losing a
       little of the edges. */
    const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
  }

  const copy = String(slide.copy || '').trim();
  if (copy) {
    /* A gradient scrim from the bottom. Type straight onto a photograph
       is legible until the one frame where it is not, and that frame is
       always the one that gets posted. This costs a little of the
       picture and buys every slide being readable. */
    const scrim = ctx.createLinearGradient(0, HEIGHT * 0.25, 0, HEIGHT);
    scrim.addColorStop(0, 'rgba(8,8,7,0)');
    scrim.addColorStop(1, 'rgba(8,8,7,0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const box = { width: WIDTH - MARGIN * 2, height: HEIGHT * 0.42 };
    const { size, lines } = fit(ctx, copy, family, box);

    ctx.font = `800 ${size}px "${family}", sans-serif`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const leading = size * 1.15;
    // sits on the lower third, which is where a thumb is not and where
    // both platforms put their own chrome least often
    let y = HEIGHT - MARGIN - (lines.length - 1) * leading;
    for (const line of lines) {
      ctx.fillText(line, MARGIN, y);
      y += leading;
    }
  }

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
  return { blob, width: WIDTH, height: HEIGHT, font: family };
}

/** A Blob or a URL, either way an image element that has finished loading. */
function load(source) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    img.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(null);          // the caller still gets a slide, on brand colour
    };
    if (typeof source === 'string') img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

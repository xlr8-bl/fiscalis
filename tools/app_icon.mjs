/**
 * app_icon.mjs — the wordmark as a square picture.
 *
 *   node tools/app_icon.mjs
 *
 * Platform dashboards ask for a square app icon and will not take an SVG:
 * TikTok wants 1024×1024, up to 5MB, JPEG or PNG. The site's mark is SVG
 * text in PixelDisplay, so this renders the real font at the real colours
 * rather than approximating it in a drawing tool.
 *
 * Chromium, because it is already here for the check suites and because
 * it is the same engine that draws the wordmark on the site — which is
 * the whole point: the icon and the site's own header cannot disagree.
 *
 * The wordmark is ten letters on one line, which is not a square. It is
 * set as a stacked lockup instead — WEB3 over ASHLEY, each row scaled to
 * the same width — which is the standard answer for a long wordmark in a
 * square and reads as one block rather than two stray lines.
 *
 * Two colourways, because a dashboard's own background is not knowable:
 *
 *   dark      the site's ground (#080807), mark in its beige. What the
 *             site looks like.
 *   light     the same lockup inverted, for a list that is already dark
 *             and would otherwise swallow it.
 *
 * A monogram was tried and dropped. W3A is an abbreviation this brand
 * does not use anywhere, and an icon that invents one is a different
 * brand at small sizes.
 *
 * Both carry the faint grid the site's canvases sit on — enough that the
 * icon is not a flat rectangle, not so much that it muddies at 32px.
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || join(ROOT, 'assets/brand');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SIZE = 1024;

// the site's own values, not an eyeballed match
const GROUND = '#080807';
const MARK = '#e8e8e3';
const GRID = '#1c1a17';

/** The font as a data URI, so the page needs no server to draw it. */
const FONT = readFileSync(join(ROOT, 'assets/fonts/pixel.woff2')).toString('base64');

/**
 * Lines are drawn at a nominal size with the font's own metrics — no
 * `textLength`. The site stretches the wordmark to fill its bar, which
 * is right for a wide strip and wrong here: forcing a four-character
 * word and a six-character one to the same width gives two different
 * glyph widths in the same mark, which is what a stretched logo looks
 * like from across a room.
 *
 * So it is drawn undistorted, then measured in the browser and fitted:
 * scale the whole group to the box, centre it on both axes. Guessing a
 * font size and a baseline is how the first attempt ended up with the
 * descenders of one line sitting inside the other.
 */
const NOMINAL = 200;   // arbitrary; every row is measured and refitted

const lines = (mark) =>
  ROWS
    .map(
      (text) =>
        `<text class="row" x="0" y="0" fill="${mark}"` +
        ` font-family="PixelDisplay, monospace" font-size="${NOMINAL}">${text}</text>`
    )
    .join('');

/*
 * Each row is scaled uniformly to the same width. That is what makes it
 * a lockup rather than two lines that happen to sit above each other —
 * and it is a scale, not a stretch, so no glyph changes shape.
 */
const ROWS = ['WEB3', 'ASHLEY'];
const FILL = 0.84;    // of the square's width
const GAP = 0.09;     // between rows, of that width

const VARIANTS = {
  dark: { ground: GROUND, mark: MARK, grid: GRID },
  light: { ground: MARK, mark: GROUND, grid: '#dfdfd7' },
};

const html = ({ ground, mark, grid }) => `<!doctype html><meta charset="utf-8">
<style>
  @font-face {
    font-family: PixelDisplay;
    src: url(data:font/woff2;base64,${FONT}) format("woff2");
    font-display: block;   /* block, not swap: a fallback would ship */
  }
  html, body { margin: 0; padding: 0; background: ${ground}; }
  .icon { width: ${SIZE}px; height: ${SIZE}px; position: relative; background: ${ground}; }
  /* the grid the site's canvases sit on, at a weight that survives being
     scaled down to 32px without turning into noise */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, ${grid} 1px, transparent 1px),
      linear-gradient(to bottom, ${grid} 1px, transparent 1px);
    background-size: 64px 64px;
  }
  svg { position: absolute; inset: 0; }
</style>
<div class="icon"><div class="grid"></div>
  <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"
       viewBox="0 0 1024 1024"><g id="mark">${lines(mark)}</g></svg>
</div>`;

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage({
  viewport: { width: SIZE, height: SIZE },
  deviceScaleFactor: 1,
});

for (const [name, colours] of Object.entries(VARIANTS)) {
  await page.setContent(html(colours), { waitUntil: 'load' });
  // the face is embedded, but it still has to be parsed before it draws
  await page.evaluate(() => document.fonts.ready);

  /*
   * Lay it out from what was actually drawn rather than from guessed
   * metrics. Each row is measured, scaled to the common width, stacked
   * with a gap proportional to the block, and the whole thing is centred
   * on its ink — not on its em box, which for a display face is a
   * different rectangle and is why a mark looks a few pixels high.
   */
  const box = await page.evaluate(({ want, gapFrac }) => {
    const rows = [...document.querySelectorAll('.row')];
    const boxes = rows.map((r) => r.getBBox());
    const width = Math.max(...boxes.map((b) => b.width));

    let y = 0;
    const heights = [];
    rows.forEach((r, i) => {
      const b = boxes[i];
      const k = width / b.width;               // uniform: no stretching
      const h = b.height * k;
      // put the row's own ink at the running offset
      r.setAttribute('transform', `translate(${-b.x * k} ${y - b.y * k}) scale(${k})`);
      heights.push(h);
      y += h + width * gapFrac;
    });
    const height = y - (rows.length > 1 ? width * gapFrac : 0);

    const g = document.getElementById('mark');
    const scale = (1024 * want) / Math.max(width, height);
    g.setAttribute(
      'transform',
      `translate(${512 - (width * scale) / 2} ${512 - (height * scale) / 2}) scale(${scale})`
    );
    return { w: Math.round(width * scale), h: Math.round(height * scale) };
  }, { want: FILL, gapFrac: GAP });

  const file = join(OUT, `app-icon-${name}.png`);
  await page.locator('.icon').screenshot({ path: file });
  console.log(`  ${file}  ${SIZE}x${SIZE}  (mark ${box.w}x${box.h})`);
}

await browser.close();
console.log('\ntwo 1024x1024 PNGs, drawn with the site\'s own font and colours');

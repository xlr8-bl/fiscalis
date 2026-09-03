/**
 * press_defs.mjs — the plate filters, in one place.
 *
 *   node tools/press_defs.mjs
 *
 * The SVG filters press.css calls have to be in the document, and there
 * are three documents: index.html, book.html and the shell in
 * templates.js that renders the journal, the articles and the legal
 * pages. Hand-editing three copies of a filter chain while tuning a
 * threshold is how two of them end up different.
 *
 * So they live here and get written into all three. Tuning is a number
 * in this file and one command.
 *
 * How the plate works, in four passes:
 *
 *   saturate 0    strip the colour; a screenprint has no hue of its own
 *   linear        stretch the range, and decide the threshold — this is
 *                 the only number worth turning
 *   discrete      crush to flat steps. Two is a real two-ink print;
 *                 three keeps one mid-tone for modelling in a face
 *   table         map those steps onto the two actual inks
 *
 * The threshold is the whole design. `LIGHT_ABOVE` is the input
 * luminance above which a pixel takes the highlight ink: at 0.36 a
 * normally exposed photograph comes out mostly highlight with the
 * shadows drawn in, which is the reference. Raise it and the picture
 * goes dark and muddy; lower it and the subject dissolves.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const LIGHT_ABOVE = 0.36;
const SLOPE = 1.7;

/** discrete splits [0,1] into n equal bands, so the split sits at 0.5. */
const intercept = (0.5 - SLOPE * LIGHT_ABOVE).toFixed(3);

const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3));
};

const INK = '#080807';
const RED = '#ED2024';
const PAPER = '#e8e8e3';

/**
 * @param steps  2 for a flat two-ink plate, 3 to keep one mid-tone
 */
function plate(id, shadow, highlight, steps = 2) {
  const s = rgb(shadow);
  const h = rgb(highlight);
  const band = Array.from({ length: steps }, (_, i) => (i / (steps - 1)).toFixed(2)).join(' ');
  const ramp = (i) =>
    Array.from({ length: steps }, (_, k) => {
      const t = k / (steps - 1);
      return (Number(s[i]) + (Number(h[i]) - Number(s[i])) * t).toFixed(3);
    }).join(' ');

  return (
    `<filter id="${id}" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">`
    + '<feColorMatrix type="saturate" values="0" result="flat"/>'
    + '<feComponentTransfer in="flat" result="stretched">'
    + ['R', 'G', 'B'].map((c) =>
        `<feFunc${c} type="linear" slope="${SLOPE}" intercept="${intercept}"/>`).join('')
    + '</feComponentTransfer>'
    + '<feComponentTransfer in="stretched" result="plates">'
    + ['R', 'G', 'B'].map((c) =>
        `<feFunc${c} type="discrete" tableValues="${band}"/>`).join('')
    + '</feComponentTransfer>'
    + '<feComponentTransfer in="plates">'
    + ['R', 'G', 'B'].map((c, i) =>
        `<feFunc${c} type="table" tableValues="${ramp(i)}"/>`).join('')
    + '</feComponentTransfer>'
    + '</filter>'
  );
}

export const DEFS =
  '<svg width="0" height="0" aria-hidden="true" style="position:absolute" data-press-defs>'
  // the red plate: black linework on a field of red
  + plate('pressPlate', INK, RED, 2)
  // newsprint: black on cream, with one mid-tone so a face still has a
  // cheekbone rather than becoming a stencil of itself
  + plate('pressPlatePaper', INK, PAPER, 3)
  + '</svg>';

/* ----------------------------------------------------------- writing */

const BLOCK = /<svg width="0" height="0" aria-hidden="true" style="position:absolute" data-press-defs>.*?<\/svg>/s;

/**
 * Replace the block if it is already there, or insert it after the
 * document's opening <body> tag.
 *
 * The anchor is a pattern for the whole tag, not a prefix of it. An
 * earlier version matched on `<body data-barba="wrapper"` and inserted
 * after that, which split the tag down the middle and dumped the rest
 * of its attributes onto the page as text.
 *
 * templates.js holds its markup in a template literal, so the same
 * plain-text insert works for the JavaScript file as for the two HTML
 * ones. The defs carry no backtick, no `${`, and no apostrophe, so
 * nothing needs escaping on the way in — worth stating, because it is
 * the assumption that would break this quietly if the inks ever moved
 * to named colours.
 */
const BODY = /<body\b[^>]*>/;

function put(file) {
  const s = readFileSync(file, 'utf8');
  if (BLOCK.test(s)) {
    writeFileSync(file, s.replace(BLOCK, DEFS));
  } else {
    const tag = s.match(BODY);
    if (!tag) throw new Error(`${file}: no <body> tag to insert after`);
    writeFileSync(file, s.replace(tag[0], tag[0] + DEFS));
  }
  console.log(`  ${file}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`plates at threshold ${LIGHT_ABOVE} (slope ${SLOPE}, intercept ${intercept})`);
  for (const f of ['index.html', 'book.html', 'lib/templates.js']) put(f);
}

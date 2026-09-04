/**
 * build_icons.mjs — the site's favicons, from the same lockup as the app icon.
 *
 * index.html has always pointed at assets/icons/favicon.svg, favicon-32.png
 * and apple-touch-icon.png, and none of the three existed: every tab showed
 * a blank icon and "Add to Home Screen" saved a screenshot. Browsers and
 * social scrapers also ask for /favicon.ico by default, which 404'd on
 * every visit.
 *
 * Reuses app_icon.mjs by pointing its OUT at a scratch directory and
 * resizing what it produced, rather than drawing a second lockup that
 * could drift from the first.
 *
 *   node tools/build_icons.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRATCH = 'assets/brand';
const ICONS = 'assets/icons';

if (!existsSync(join(SCRATCH, 'app-icon-dark.png'))) {
  console.log('drawing the lockup first…');
  execFileSync('node', ['tools/app_icon.mjs'], { stdio: 'inherit' });
}

mkdirSync(ICONS, { recursive: true });

/*
 * The SVG favicon is the same stacked wordmark as the app icon, not a
 * monogram. app_icon.mjs records why: "W3A is an abbreviation this brand
 * does not use anywhere, and an icon that invents one is a different
 * brand at small sizes." A favicon that disagreed with the app icon
 * would be the same mistake in a smaller box.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#080807"/>
  <g fill="#EFEDE7" font-family="Helvetica,Arial,sans-serif" font-weight="900"
     text-anchor="middle" letter-spacing="-0.5">
    <text x="32" y="29" font-size="17">WEB3</text>
    <text x="32" y="48" font-size="13">ASHLEY</text>
  </g>
</svg>`;
writeFileSync(join(ICONS, 'favicon.svg'), svg);

// the raster sizes, resized from the 1024 lockup
const { execFileSync: run } = await import('node:child_process');
run('python3', ['-c', `
from PIL import Image
src = Image.open('${SCRATCH}/app-icon-dark.png').convert('RGBA')
src.resize((32, 32), Image.LANCZOS).save('${ICONS}/favicon-32.png')
src.resize((180, 180), Image.LANCZOS).save('${ICONS}/apple-touch-icon.png')
# browsers and scrapers request /favicon.ico whether or not it is declared
src.resize((48, 48), Image.LANCZOS).save('favicon.ico', sizes=[(16,16),(32,32),(48,48)])
print('favicon-32.png, apple-touch-icon.png, favicon.ico')
`], { stdio: 'inherit' });

console.log(`${ICONS}/favicon.svg`);

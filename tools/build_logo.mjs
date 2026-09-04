/**
 * build_logo.mjs — the mark Google shows beside the site.
 *
 * Search Console and the search result itself read `logo` off the
 * Organization in the page's structured data. Google's rules for that
 * image are short and easy to fail: at least 112x112, crawlable, and it
 * has to "look how you intend it to look on a purely white background".
 *
 * That last one is why this is not the favicon scaled up. The wordmark
 * is light type; on a transparent PNG it would vanish into the white
 * card Google draws it on. So the logo ships as a square tile carrying
 * its own dark ground, which reads the same on either.
 *
 * 512x512 rather than the minimum, because the same file is the one a
 * phone saves to a home screen and 112 looks like a thumbnail there.
 *
 *   node tools/build_logo.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

if (!existsSync('assets/brand/app-icon-dark.png')) {
  execFileSync('node', ['tools/app_icon.mjs'], { stdio: 'inherit' });
}
mkdirSync('assets/icons', { recursive: true });

execFileSync('python3', ['-c', `
from PIL import Image
src = Image.open('assets/brand/app-icon-dark.png').convert('RGB')
src.resize((512, 512), Image.LANCZOS).save('assets/icons/logo.png', optimize=True)
# the maskable/PWA size, from the same lockup so the two cannot drift
src.resize((192, 192), Image.LANCZOS).save('assets/icons/icon-192.png', optimize=True)
src.resize((512, 512), Image.LANCZOS).save('assets/icons/icon-512.png', optimize=True)
w, h = Image.open('assets/icons/logo.png').size
assert w >= 112 and h >= 112, 'below the minimum Google accepts'
print(f'logo.png {w}x{h}, icon-192.png, icon-512.png')
`], { stdio: 'inherit' });

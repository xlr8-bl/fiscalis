/**
 * build_theme.mjs — put the light switch on the static pages.
 *
 * index.html and book.html are files, not renders, so they do not get
 * the toggle or the no-flash head script from lib/templates.js the way
 * the journal does. This injects the same two strings rather than a
 * second copy of them, for the same reason build_footer.mjs exists: two
 * copies of a thing is one copy plus a bug waiting.
 *
 *   node tools/build_theme.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { THEME_TOGGLE, THEME_HEAD_SCRIPT } from '../lib/templates.js';

const OPEN = '<!-- theme:start (tools/build_theme.mjs) -->';
const CLOSE = '<!-- theme:end -->';
const PAGES = ['index.html', 'book.html'];

const between = (src, body) => {
  const a = src.indexOf(OPEN);
  if (a === -1) return null;
  const b = src.indexOf(CLOSE) + CLOSE.length;
  return src.slice(0, a) + OPEN + body + CLOSE + src.slice(b);
};

for (const page of PAGES) {
  let src = readFileSync(page, 'utf8');

  // 1. the head script, first thing after <head>, before any paint
  const withHead = between(src, THEME_HEAD_SCRIPT);
  if (withHead) {
    src = withHead;
  } else {
    const at = src.indexOf('<head>') + 6;
    src = src.slice(0, at) + OPEN + THEME_HEAD_SCRIPT + CLOSE + src.slice(at);
  }

  // 2. the button, at the start of the nav's right-hand group, next to
  //    the menu button and the call to action
  if (!src.includes('data-theme-toggle')) {
    const marker = '<div class="navbar_cta_contain">';
    const at = src.indexOf(marker);
    if (at === -1) throw new Error(`${page}: no navbar_cta_contain to sit beside`);
    src = src.slice(0, at) + THEME_TOGGLE + src.slice(at);
  }

  writeFileSync(page, src);
  console.log(`  ${page}`);
}

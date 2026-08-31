/**
 * templates.js — the journal's pages.
 *
 * The markup here is the home page's own: an article is the process
 * section (heading left, prose right) and the index is the works list.
 * Nothing new is invented, because a reader arriving from a search has
 * already learned the site once.
 */

import { escapeHtml, escapeAttr, renderMarkdown, countWords, readingMinutes } from '../assets/js/markdown.js';

export const SITE = 'https://web3ashley.com';
export const SITE_NAME = 'Web3Ashley';
export const AUTHOR = 'Ashley';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 2026-08-04 -> "04 AUG 2026" */
export function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return '';
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function rfc822(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d) ? '' : d.toUTCString();
}

/**
 * Turn a row from D1 into everything the templates need.
 *
 * `media` maps an image path to its pixel size, so the parser can write
 * width and height onto each <img>. Without it the images still render,
 * they just push the text down as they arrive.
 */
export function prepare(row, media = null) {
  const parsed = renderMarkdown(row.body, { media });
  const words = countWords(parsed);
  return {
    ...row,
    tags: String(row.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    intro: parsed.intro,
    sections: parsed.sections,
    words,
    minutes: readingMinutes(words),
    date: row.published_at || String(row.created_at || '').slice(0, 10),
  };
}

/* ------------------------------------------------------------------ chrome */

const ARROW = (extra = '') =>
  '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 12 12" fill="none"' +
  ` class="g_btn_svg${extra}"><path d="M8.90954 9.09046L9 3L2.90954 3.09046L2.90213 4.32367L6.86437` +
  ' 4.25391L2.55914 8.55914L3.44086 9.44086L7.74609 5.13563L7.68708 9.10862L8.90954 9.09046Z"' +
  ' fill="currentColor"></path></svg>';

export function button(href, label) {
  return (
    `<a data-btn-default="" href="${escapeAttr(href)}" class="g_btn_main w-inline-block">` +
    '<div class="g_btn_text_contain"><div class="g_btn_text u-text-style-small u-text-trim-off">' +
    `${escapeHtml(label)}</div></div>` +
    '<div class="g_btn_aside_wrap"><div class="g_btn_aside_bg"></div>' +
    ARROW() + ARROW(' is-absolute') +
    '</div></a>'
  );
}

/**
 * The same items in the same order as the home page and the booking page.
 * A reader who arrives here from a search has to be able to reach the rest
 * of the site, and on a phone the bar carries no links at all — the menu
 * below is the whole navigation.
 *
 * About is a panel the home page carries, so from here it is a link to
 * /#about and the home page opens it on arrival.
 */
const NAV = [
  ['/#about', 'About'],
  ['/#work', 'Work'],
  ['/#services', 'Services'],
  ['/#process', 'Process'],
  ['/journal/', 'Journal'],
];

function navbar() {
  const link = ([href, label]) =>
    `<li class="navbar_links_li"><a href="${href}" data-link-hover="" class="navbar_link w-inline-block">` +
    `<div class="footer_nav_span u-text-style-main">${label}</div></a></li>`;

  return (
    '<header class="navbar_wrap"><div class="navbar_contain u-grid-custom">' +
    '<div id="layout-11" class="navbar_left_contain">' +
    '<a href="/" aria-label="Return to home" id="layout-12" class="navbar_home w-inline-block">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 609 100" fill="none"' +
    ' class="navbar_home_svg"><text x="304.5" y="54" text-anchor="middle"' +
    ' dominant-baseline="central" fill="currentColor" font-family="PixelDisplay, monospace"' +
    ' font-size="72" textLength="595" lengthAdjust="spacingAndGlyphs">WEB3ASHLEY</text></svg></a></div>' +
    '<nav id="layout-13" class="navbar_links u-text-style-small u-text-trim-off">' +
    '<ul class="navbar_links_ul u-gap-small u-hflex-left-center">' +
    NAV.map(link).join('') +
    '</ul></nav>' +
    '<div id="layout-14" class="navbar_cta_wrap u-text-style-small u-text-trim-off">' +
    `<div class="navbar_cta_contain">${button('/book', 'Start a project')}</div></div>` +
    '<button data-nav-toggle="" aria-expanded="false" aria-label="Menu" class="navbar_menu_btn">' +
    '<span class="navbar_menu_span-wrap"><span class="navbar_menu_span">Menu</span>' +
    '<span class="navbar_menu_span is-close">Close</span></span></button>' +
    '</div></header>' + menu()
  );
}

/** The navigation itself, below 768px. */
function menu() {
  const link = ([href, label]) =>
    `<li class="nav_menu_item"><a class="nav_menu_link" href="${href}">` +
    `<span>${label}</span><span class="nav_menu_arrow" aria-hidden="true">&#8594;</span></a></li>`;

  return (
    '<div class="nav_menu" data-nav-menu hidden>' +
    '<button class="nav_menu_scrim" data-nav-close="" type="button" tabindex="-1"' +
    ' aria-label="Close the menu"></button>' +
    '<nav class="nav_menu_panel" aria-label="Site"><ul class="nav_menu_list">' +
    NAV.map(link).join('') +
    '</ul>' +
    `<div class="nav_menu_foot">${button('/book', 'Start a project')}</div>` +
    '</nav></div>'
  );
}

const PRELOADS = ['bricolage.woff2', 'inter-500.woff2', 'pixel.woff2']
  .map((f) => `<link rel="preload" href="/assets/fonts/${f}" as="font" type="font/woff2" crossorigin/>`)
  .join('');

// GSAP plus two plugins for the standfirst highlight. app.js would drag in
// Barba and the hero shader onto a page that exists to be read and to rank.
const SCRIPTS =
  '<script src="/assets/js/gsap.min.js?v=92bb9a9647" defer></script>' +
  '<script src="/assets/js/ScrollTrigger.min.js?v=b0b14d67b5" defer></script>' +
  '<script src="/assets/js/SplitText.min.js?v=419f7027a5" defer></script>' +
  '<script src="/assets/js/journal.js?v=177c358743" defer></script>' +
  '<script src="/assets/js/site.js?v=71ad198561" defer></script>';

function shell({ title, description, canonical, body, ld = '', robots = '' }) {
  return (
    '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"/>' +
    `<title>${escapeHtml(title)}</title>` +
    '<meta content="width=device-width, initial-scale=1" name="viewport"/>' +
    `<meta name="description" content="${escapeAttr(description)}"/>` +
    '<meta name="color-scheme" content="dark"/>' +
    `<meta property="og:site_name" content="${SITE_NAME}"/>` +
    `<meta property="og:title" content="${escapeAttr(title)}"/>` +
    `<meta property="og:description" content="${escapeAttr(description)}"/>` +
    '<meta property="og:type" content="article"/>' +
    '<meta name="twitter:card" content="summary_large_image"/>' +
    `<link rel="canonical" href="${escapeAttr(canonical)}"/>` +
    robots + PRELOADS +
    '<link href="/assets/css/site.css?v=38c63c452e" rel="stylesheet" type="text/css"/>' +
    '<link href="/assets/css/statement.css?v=fa9ba48a14" rel="stylesheet" type="text/css"/>' +
    '<link href="/assets/css/journal.css?v=1b5f08e0ca" rel="stylesheet" type="text/css"/>' +
    '<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"/>' +
    `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} journal" href="/feed.xml"/>` +
    ld + '</head>' +
    `<body data-theme-section="dark" class="body jr-body">${navbar()}${body}${SCRIPTS}</body></html>`
  );
}

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/* ----------------------------------------------------------------- article */

export function renderArticlePage(a, related = [], { preview = false } = {}) {
  const url = `${SITE}/journal/${a.slug}`;

  const ld =
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description: a.description,
      datePublished: a.date,
      dateModified: String(a.updated_at || a.date).slice(0, 10),
      author: { '@type': 'Person', name: AUTHOR, url: SITE },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      wordCount: a.words,
      inLanguage: 'en',
    }) +
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Journal', item: `${SITE}/journal/` },
        { '@type': 'ListItem', position: 3, name: a.title, item: url },
      ],
    });

  // the intro sits in the prose column of a headless row, so the measure
  // never shifts between the opening and the first section
  const introRow = a.intro
    ? `<div class="jr_content-item"><div class="jr_content-left"></div>` +
      `<div class="jr_prose">${a.intro}</div></div>`
    : '';

  const rows = a.sections
    .map(
      (s) =>
        '<section class="jr_content-item"><div class="jr_content-left">' +
        `<h2 id="${escapeAttr(s.id)}" class="jr_content_heading u-text-style-h5">${escapeHtml(s.title)}</h2>` +
        `</div><div class="jr_prose">${s.html}</div></section>`
    )
    .join('');

  const nextBlock = related.length
    ? '<div class="jr_next"><h2 class="jr_next_heading u-text-style-h5">Read next</h2>' +
      '<ul class="jr_next_list">' +
      related
        .map(
          (r) =>
            `<li><a href="/journal/${escapeAttr(r.slug)}">` +
            `<span class="jr_next_date u-text-style-main">${fmtDate(r.published_at)}</span>` +
            `<span class="u-text-style-h6">${escapeHtml(r.title)}</span></a></li>`
        )
        .join('') +
      '</ul></div>'
    : '';

  const banner = preview
    ? '<p class="jr_kicker u-text-style-main" style="color:#dfa24a">Preview — not published</p>'
    : '';

  const body = `<main class="jr_wrap"><article>
  <header class="jr_header">
    ${banner}
    <p class="jr_kicker u-text-style-main">${fmtDate(a.date)} &nbsp;·&nbsp; ${a.minutes} min read</p>
    <h1 class="jr_title u-text-style-h2">${escapeHtml(a.title)}</h1>
    <p class="jr_lede u-text-style-h4" data-highlight-text>${escapeHtml(a.description)}</p>
  </header>
  <div class="jr_content-list">${introRow}${rows}</div>
  <div class="jr_end">
    <h2 class="u-text-style-h5 jr_end_text">Think this is happening on your site?</h2>
    <div class="jr_end_aside">
      <p class="u-text-style-main">One hour on your business and your customers. No pitch.
        We work out where the business is losing customers online, and whether I am
        the right person to fix it.</p>
      ${button('/book', 'Book an intro call')}
    </div>
  </div>
  ${nextBlock}
</article></main>`;

  return shell({
    title: `${a.title} — ${SITE_NAME}`,
    description: a.description,
    canonical: url,
    body,
    ld: preview ? '' : ld,
    robots: preview ? '<meta name="robots" content="noindex"/>' : '',
  });
}

/* ------------------------------------------------------------------- index */

export function renderIndexPage(articles) {
  const rows = articles
    .map(
      (a) =>
        `<li><a href="/journal/${escapeAttr(a.slug)}" class="jr_item_link">` +
        '<div class="jr_item_text">' +
        `<h2 class="u-text-style-h5">${escapeHtml(a.title)}</h2>` +
        `<p class="u-text-style-main">${escapeHtml(a.description)}</p></div>` +
        '<div class="jr_item_meta">' +
        `<span class="u-text-style-main">${fmtDate(a.published_at)}</span>` +
        `<span class="u-text-style-main">${a.minutes} min</span>` +
        '</div></a></li>'
    )
    .join('');

  const ld = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} journal`,
    url: `${SITE}/journal/`,
    description: 'Notes on what actually loses businesses customers online.',
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `${SITE}/journal/${a.slug}`,
      datePublished: a.published_at,
    })),
  });

  const empty = '<p class="jr_index_lede u-text-style-h4">Nothing published yet.</p>';

  const body = `<main class="jr_wrap">
  <h1 class="jr_display">Notes</h1>
  <p class="jr_index_lede u-text-style-h4" data-highlight-text>What actually loses
    businesses customers online, and what each leak costs.</p>
  ${rows ? `<ul class="jr_list">${rows}</ul>` : empty}
</main>`;

  return shell({
    title: `Journal — ${SITE_NAME}`,
    description:
      'Notes on what actually loses businesses customers online: slow pages, broken ' +
      'enquiry forms, menus saved as images, and what each one costs.',
    canonical: `${SITE}/journal/`,
    body,
    ld,
  });
}

/* --------------------------------------------------------- sitemap and feed */

export function renderSitemap(articles) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `<url><loc>${SITE}/</loc><priority>1.0</priority><lastmod>${today}</lastmod></url>`,
    `<url><loc>${SITE}/book</loc><priority>0.8</priority></url>`,
    `<url><loc>${SITE}/journal/</loc><priority>0.9</priority><lastmod>${today}</lastmod></url>`,
    ...articles.map(
      (a) =>
        `<url><loc>${SITE}/journal/${a.slug}</loc>` +
        `<lastmod>${String(a.updated_at || a.published_at).slice(0, 10)}</lastmod>` +
        '<priority>0.7</priority></url>'
    ),
  ];
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ' +
    urls.join('\n  ') +
    '\n</urlset>\n'
  );
}

export function renderFeed(articles) {
  const items = articles
    .slice(0, 20)
    .map(
      (a) =>
        `<item><title>${escapeHtml(a.title)}</title>` +
        `<link>${SITE}/journal/${a.slug}</link>` +
        `<guid isPermaLink="true">${SITE}/journal/${a.slug}</guid>` +
        `<pubDate>${rfc822(a.published_at)}</pubDate>` +
        `<description>${escapeHtml(a.description)}</description></item>`
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>' +
    `<title>${SITE_NAME} journal</title><link>${SITE}/journal/</link>` +
    '<description>Notes on what actually loses businesses customers online.</description>' +
    `<language>en</language>${items}</channel></rss>\n`
  );
}

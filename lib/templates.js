/**
 * templates.js — the journal's pages.
 *
 * The markup here is the home page's own: an article is the process
 * section (heading left, prose right) and the index is the works list.
 * Nothing new is invented, because a reader arriving from a search has
 * already learned the site once.
 */

import { escapeHtml, escapeAttr, renderMarkdown, countWords, readingMinutes } from '../assets/js/markdown.js';
import { COVERS } from './covers.js';

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

/*
 * Every rendered page ends with these two. They are a platform review
 * requirement — TikTok asks for a privacy policy and terms "visible on
 * your official website", reachable without navigating menus — and they
 * are also just where a person looks for them.
 */
/**
 * The cover an article shows in the list, at the top of itself, and as
 * its share card.
 *
 * Drawn from the title by tools/build_covers.mjs rather than uploaded,
 * because the journal had no images at all and a blog without pictures
 * does not read as a blog. An article that later gets a real photograph
 * sets `cover` and this steps out of the way.
 *
 * The COVERS set is what stops this pointing at a file that is not
 * there. This runs on the edge and cannot look at the disk, so an
 * article written in the studio since the last run of the cover script
 * would otherwise get a broken image on its card, its page, and every
 * link preview of it. Those fall back to the site card until somebody
 * runs the script again.
 */
export const coverFor = (a) =>
  a?.cover
  || (COVERS.has(a?.slug) ? `/assets/covers/${a.slug}.jpg` : '/assets/social/og.jpg');

/**
 * A visible breadcrumb.
 *
 * The BreadcrumbList markup was already on articles, but only in the
 * JSON-LD — Google could read the trail and a person could not see it.
 * Search results show breadcrumbs from either, and a reader two levels
 * deep with no way back up is the more common problem of the two.
 */
const crumbs = (trail) =>
  '<nav class="jr_crumbs u-text-style-main" aria-label="Breadcrumb"><ol>' +
  trail.map((c) =>
    `<li>${c.href
      ? `<a href="${escapeAttr(c.href)}">${escapeHtml(c.name)}</a>`
      : `<span aria-current="page">${escapeHtml(c.name)}</span>`}</li>`).join('') +
  '</ol></nav>';

/**
 * The site footer, on every page rather than three links on some of them.
 *
 * It carries the things a footer is actually for: what this is, how to
 * reach a person, where the rest of the site is, and the legal pages a
 * platform review looks for.
 */
export const legalFooter = () =>
  '<footer class="jr_footer site_footer">' +
  '<div class="site_footer_grid">' +
  `<div class="site_footer_col"><p class="site_footer_mark u-text-style-h6">${SITE_NAME}</p>` +
  '<p class="site_footer_line u-text-style-main">I work out what your business is losing ' +
  'online, then build the thing that fixes it.</p></div>' +
  '<div class="site_footer_col"><p class="site_footer_head u-text-style-main">Pages</p>' +
  '<a href="/" class="footer_legal_link u-text-style-main">Home</a>' +
  '<a href="/journal/" class="footer_legal_link u-text-style-main">Journal</a>' +
  '<a href="/book" class="footer_legal_link u-text-style-main">Book a call</a></div>' +
  '<div class="site_footer_col"><p class="site_footer_head u-text-style-main">Elsewhere</p>' +
  '<a href="https://instagram.com/we3.ashley" rel="me noopener" class="footer_legal_link u-text-style-main">Instagram</a>' +
  '<a href="https://tiktok.com/@web3ashley" rel="me noopener" class="footer_legal_link u-text-style-main">TikTok</a>' +
  '<a href="https://x.com/xlr8_bl_" rel="me noopener" class="footer_legal_link u-text-style-main">X</a></div>' +
  '<div class="site_footer_col"><p class="site_footer_head u-text-style-main">Legal</p>' +
  '<a href="/privacy" class="footer_legal_link u-text-style-main">Privacy</a>' +
  '<a href="/terms" class="footer_legal_link u-text-style-main">Terms</a>' +
  '<a href="/feed.xml" class="footer_legal_link u-text-style-main">RSS</a></div>' +
  '</div>' +
  `<p class="site_footer_base u-text-style-main">© ${new Date().getFullYear()} ${SITE_NAME} · GMT+1 · Working worldwide</p>` +
  '</footer>';

/**
 * The site as an organisation, with its logo.
 *
 * Google reads `logo` off an Organization to decide what mark to show
 * beside the site in search and in Search Console. Its rule is that the
 * image is at least 112x112, crawlable, and — the part that catches
 * people out — has to "look how you intend it to look on a purely white
 * background". The mark here is light type, so it ships as a square tile
 * carrying its own dark ground rather than a transparent PNG that would
 * disappear into the white.
 */
export const LOGO = '/assets/icons/logo.png';

export function publisher() {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE,
    logo: { '@type': 'ImageObject', url: `${SITE}${LOGO}`, width: 512, height: 512 },
  };
}

function shell({ title, description, canonical, body, ld = '', robots = '',
                 image = `${SITE}/assets/social/og.jpg`, type = 'website' }) {
  return (
    '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"/>' +
    `<title>${escapeHtml(title)}</title>` +
    '<meta content="width=device-width, initial-scale=1" name="viewport"/>' +
    `<meta name="description" content="${escapeAttr(description)}"/>` +
    '<meta name="color-scheme" content="dark"/>' +
    `<meta property="og:site_name" content="${SITE_NAME}"/>` +
    `<meta property="og:title" content="${escapeAttr(title)}"/>` +
    `<meta property="og:description" content="${escapeAttr(description)}"/>` +
    `<meta property="og:type" content="${type}"/>` +
    `<meta property="og:url" content="${escapeAttr(canonical)}"/>` +
    // the card image is per-page: without it every article shared the one
    // site card, so eleven different links previewed as the same picture
    `<meta property="og:image" content="${escapeAttr(image)}"/>` +
    '<meta property="og:image:width" content="1200"/>' +
    '<meta property="og:image:height" content="630"/>' +
    '<meta name="twitter:card" content="summary_large_image"/>' +
    `<meta name="twitter:image" content="${escapeAttr(image)}"/>` +
    `<link rel="canonical" href="${escapeAttr(canonical)}"/>` +
    robots + PRELOADS +
    '<link href="/assets/css/site.css?v=891f86b074" rel="stylesheet" type="text/css"/>' +
    '<link href="/assets/css/statement.css?v=fa9ba48a14" rel="stylesheet" type="text/css"/>' +
    '<link href="/assets/css/journal.css?v=3e5fbdf3bb" rel="stylesheet" type="text/css"/>' +
    '<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"/>' +
    `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} journal" href="/feed.xml"/>` +
    ld + '</head>' +
    `<body data-theme-section="dark" class="body jr-body">${navbar()}${body}${legalFooter()}${SCRIPTS}</body></html>`
  );
}

const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

/* ----------------------------------------------------------------- article */

export function renderArticlePage(a, related = [], { preview = false } = {}) {
  const url = `${SITE}/journal/${a.slug}`;
  const cover = coverFor(a);

  const ld =
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.description,
      image: [`${SITE}${cover}`],
      datePublished: a.date,
      dateModified: String(a.updated_at || a.date).slice(0, 10),
      author: { '@type': 'Person', name: AUTHOR, url: SITE },
      publisher: publisher(),
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      wordCount: a.words,
      timeRequired: `PT${a.minutes}M`,
      keywords: (a.tags ?? []).join(', ') || undefined,
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

  /*
   * A byline.
   *
   * Google's guidance on helpful content asks who wrote a page and
   * whether a reader can tell; an article signed by nobody answers
   * neither. It also reads differently — a name at the top makes it
   * something a person wrote rather than something the site emitted.
   *
   * A portrait belongs in `.jr_byline_face` and there isn't one yet, so
   * it is left out rather than faked. Nothing about this layout changes
   * when it arrives.
   */
  const byline =
    '<div class="jr_byline">' +
    '<span class="jr_byline_text">' +
    `<span class="jr_byline_name u-text-style-main">${AUTHOR}</span>` +
    '<span class="jr_byline_meta u-text-style-main">' +
    `<time datetime="${escapeAttr(String(a.date).slice(0, 10))}">${fmtDate(a.date)}</time>` +
    ` &nbsp;·&nbsp; ${a.minutes} min read</span>` +
    '</span></div>';

  // The cover runs above the fold rather than under the lede: it is the
  // same picture the card and the share preview use, so a reader arriving
  // from either lands on the image they clicked.
  const hero =
    `<figure class="jr_hero"><img src="${escapeAttr(cover)}" alt="" width="1200" height="630" ` +
    'fetchpriority="high" decoding="async"></figure>';

  const body = `<main class="jr_wrap"><article>
  ${crumbs([{ name: 'Home', href: '/' }, { name: 'Journal', href: '/journal/' }, { name: a.title }])}
  <header class="jr_header">
    ${banner}
    ${a.tags?.length ? `<p class="jr_kicker u-text-style-main">${escapeHtml(a.tags[0])}</p>` : ''}
    <h1 class="jr_title u-text-style-h2">${escapeHtml(a.title)}</h1>
    <p class="jr_lede u-text-style-h4" data-highlight-text>${escapeHtml(a.description)}</p>
    ${byline}
  </header>
  ${hero}
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
    image: `${SITE}${cover}`,
    type: 'article',
    body,
    ld: preview ? '' : ld,
    robots: preview ? '<meta name="robots" content="noindex"/>' : '',
  });
}

/* ------------------------------------------------------------------- index */

export function renderIndexPage(articles) {
  /*
   * Cards with covers rather than a list of headlines.
   *
   * Nielsen's scanning work is the reason: readers scan a page before
   * they read any of it, and they catch on headlines and images. The old
   * list gave them headlines only, in one weight, with nothing to look
   * at — which is why it read as a table of contents rather than a blog.
   *
   * The newest post runs full width as a lead, because a list where
   * every item is the same size tells a reader nothing about where to
   * start.
   */
  const card = (a, lead = false) =>
    `<li class="jr_card${lead ? ' is-lead' : ''}">` +
    `<a href="/journal/${escapeAttr(a.slug)}" class="jr_card_link">` +
    `<span class="jr_card_media"><img src="${escapeAttr(coverFor(a))}" alt="" ` +
    `loading="${lead ? 'eager' : 'lazy'}" decoding="async" width="1200" height="630"></span>` +
    '<span class="jr_card_body">' +
    (a.tags?.length
      ? `<span class="jr_card_tag u-text-style-main">${escapeHtml(a.tags[0])}</span>` : '') +
    `<span class="jr_card_title ${lead ? 'u-text-style-h4' : 'u-text-style-h5'}">` +
    `${escapeHtml(a.title)}</span>` +
    `<span class="jr_card_desc u-text-style-main">${escapeHtml(a.description)}</span>` +
    '<span class="jr_card_meta u-text-style-main">' +
    `<time datetime="${escapeAttr(String(a.published_at).slice(0, 10))}">` +
    `${fmtDate(a.published_at)}</time> · ${a.minutes} min read</span>` +
    '</span></a></li>';

  const [first, ...rest] = articles;
  const rows = articles.length
    ? card(first, true) + rest.map((a) => card(a)).join('')
    : '';

  const ld =
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${SITE_NAME} journal`,
      url: `${SITE}/journal/`,
      description: 'Notes on what actually loses businesses customers online.',
      publisher: publisher(),
      blogPost: articles.map((a) => ({
        '@type': 'BlogPosting',
        headline: a.title,
        url: `${SITE}/journal/${a.slug}`,
        image: `${SITE}${coverFor(a)}`,
        datePublished: a.published_at,
        author: { '@type': 'Person', name: AUTHOR },
      })),
    }) +
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Journal', item: `${SITE}/journal/` },
      ],
    });

  const empty = '<p class="jr_index_lede u-text-style-h4">Nothing published yet.</p>';

  const body = `<main class="jr_wrap">
  ${crumbs([{ name: 'Home', href: '/' }, { name: 'Journal' }])}
  <h1 class="jr_display">Notes</h1>
  <p class="jr_index_lede u-text-style-h4" data-highlight-text>What actually loses
    businesses customers online, and what each leak costs.</p>
  ${rows ? `<ul class="jr_cards">${rows}</ul>` : empty}
</main>`;

  return shell({
    title: `Journal — ${SITE_NAME}`,
    description:
      'Notes on what actually loses businesses customers online: slow pages, broken ' +
      'enquiry forms, menus saved as images, and what each one costs.',
    canonical: `${SITE}/journal/`,
    ...(articles.length ? { image: `${SITE}${coverFor(articles[0])}` } : {}),
    body,
    ld,
  });
}

/* ----------------------------------------------------------------- legal */

/**
 * Privacy and Terms, in the journal's reading layout — the heading in the
 * left column and the prose in the measure beside it, which is already
 * the shape on this site for something meant to be read rather than
 * scanned.
 *
 * `noindex` is deliberately *not* set. TikTok's review requires these to
 * be visible on the site, and a page a search engine is told to ignore is
 * one a reviewer can reasonably call hidden.
 */
export function renderLegalPage(doc, updated) {
  const para = (p) =>
    Array.isArray(p)
      ? `<ul>${p.map((li) => `<li>${escapeHtml(li)}</li>`).join('')}</ul>`
      : `<p>${escapeHtml(p)}</p>`;

  const rows = doc.sections
    .map(
      (s) =>
        '<section class="jr_content-item"><div class="jr_content-left">' +
        `<h2 id="${escapeAttr(slugOf(s.title))}" class="jr_content_heading u-text-style-h5">` +
        `${escapeHtml(s.title)}</h2></div>` +
        `<div class="jr_prose">${s.body.map(para).join('')}</div></section>`
    )
    .join('');

  const body = `<main class="jr_wrap"><article>
  <header class="jr_header">
    <p class="jr_kicker u-text-style-main">Last updated ${escapeHtml(updated)}</p>
    <h1 class="jr_title u-text-style-h2">${escapeHtml(doc.title)}</h1>
    <p class="jr_lede u-text-style-h4" data-highlight-text>${escapeHtml(doc.intro)}</p>
  </header>
  <div class="jr_content-list">${rows}</div>
</article></main>`;

  return shell({
    title: `${doc.title} — ${SITE_NAME}`,
    description: doc.description,
    canonical: `${SITE}/${doc.slug}`,
    body,
  });
}

/**
 * The page Cloudflare Pages serves for a path that does not exist.
 *
 * It has to be a real file at the top of the project. Pages' rule is
 * that a project WITHOUT a top-level 404.html is assumed to be a
 * single-page application, and every unmatched path is then served the
 * root document with a 200 — which is what this site was doing. A
 * mistyped URL silently returned the home page, search engines saw a
 * soft 404 on every wrong link, and a lost visitor got no signal at all.
 *
 * Built from the same shell as the legal pages rather than written out,
 * so it cannot drift away from the site around it, and generated into
 * 404.html by tools/build_404.mjs.
 *
 * It offers the two places a lost visitor might actually have wanted,
 * because somebody who mistyped a URL is still somebody who was looking
 * for you.
 */
export function render404() {
  const body = `<main class="jr_wrap"><article>
  <header class="jr_header">
    <p class="jr_kicker u-text-style-main">404</p>
    <h1 class="jr_title u-text-style-h2">That page is not here.</h1>
    <p class="jr_lede u-text-style-h4" data-highlight-text>Either it moved, or the link was wrong. Nothing is broken \u2014 you are just somewhere that does not exist.</p>
  </header>
  <div class="jr_content-list">
    <section class="jr_content-item">
      <div class="jr_content-left"><h2 class="jr_content_heading u-text-style-h5">Where you might have been going</h2></div>
      <div class="jr_prose">
        <p><a href="/">The home page</a> \u2014 what I do, and the work.</p>
        <p><a href="/journal/">The journal</a> \u2014 what small business websites actually get wrong, and how to check yours.</p>
        <p><a href="/book">Book a call</a> \u2014 if you already know what you need.</p>
      </div>
    </section>
  </div>
</article></main>`;

  return shell({
    title: `Page not found \u2014 ${SITE_NAME}`,
    description: 'That page is not here. The home page, the journal and the booking page are.',
    canonical: `${SITE}/404`,
    robots: '<meta name="robots" content="noindex, follow"/>',
    body,
  });
}

const slugOf = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* --------------------------------------------------------- sitemap and feed */

export function renderSitemap(articles) {
  const today = new Date().toISOString().slice(0, 10);
  // the newest article is the freshest thing on the two index pages, so
  // their lastmod is its date rather than today's — a lastmod that moves
  // every time the sitemap is fetched is a lastmod a crawler learns to
  // ignore
  const newest = articles
    .map((a) => String(a.updated_at || a.published_at).slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop() || today;

  const urls = [
    `<url><loc>${SITE}/</loc><priority>1.0</priority><lastmod>${newest}</lastmod></url>`,
    `<url><loc>${SITE}/book</loc><priority>0.9</priority></url>`,
    `<url><loc>${SITE}/journal/</loc><priority>0.8</priority><lastmod>${newest}</lastmod></url>`,
    // listed, not noindexed: a platform review reads "hidden from search"
    // as "hidden", and these are meant to be found
    `<url><loc>${SITE}/privacy</loc><priority>0.3</priority></url>`,
    `<url><loc>${SITE}/terms</loc><priority>0.3</priority></url>`,
    // Each article carries its cover as an image entry. Google discovers
    // images from the page anyway; the sitemap is what gets them found
    // when the page is deep in the crawl queue, and it is the only place
    // a caption can say what the picture is of.
    ...articles.map(
      (a) =>
        `<url><loc>${SITE}/journal/${a.slug}</loc>` +
        `<lastmod>${String(a.updated_at || a.published_at).slice(0, 10)}</lastmod>` +
        '<priority>0.7</priority>' +
        '<image:image>' +
        `<image:loc>${SITE}${coverFor(a)}</image:loc>` +
        `<image:title>${escapeHtml(a.title)}</image:title>` +
        '</image:image></url>'
    ),
  ];
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n  ' +
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
        `<description>${escapeHtml(a.description)}</description>` +
        // Every post has a picture now, and a reader is looking at this
        // in an app that will show it. media:content is what those apps
        // read; enclosure is what the older ones read. Both, because
        // between them they cover everything anyone actually uses.
        `<media:content url="${escapeAttr(`${SITE}${coverFor(a)}`)}" medium="image"/>` +
        `<enclosure url="${escapeAttr(`${SITE}${coverFor(a)}`)}" type="image/jpeg" length="0"/>` +
        '</item>'
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>' +
    `<title>${SITE_NAME} journal</title><link>${SITE}/journal/</link>` +
    '<description>Notes on what actually loses businesses customers online.</description>' +
    `<language>en</language>${items}</channel></rss>\n`
  );
}

/**
 * studio.js — the CMS.
 *
 * Routed on the hash, so every screen has an address: the back button
 * works, a screen can be bookmarked, and on a phone the browser's own
 * back gesture does what you expect instead of leaving the studio.
 *
 *   #/                     the overview
 *   #/journal              the articles
 *   #/journal/<slug>       one article
 *   #/site/<collection>    the work cards, services, stages, FAQs…
 *   #/site/<collection>/<slug>
 *   #/settings/<group>
 *   #/media
 *
 * The menu and every form are built from the content model the API serves,
 * so a new collection appears in the navigation, gets a form, and becomes
 * editable without a change here.
 */
import { renderMarkdown, countWords, readingMinutes } from '/assets/js/markdown.js?v=55a3dc7d00';
import { attachEditor, attachAll } from '/assets/js/editor.js?v=ac48360925';
import { choosePicture, uploadImage, fileSize, readImageSize } from '/assets/js/picker.js?v=f337b82d38';
import { problems as platformProblems } from '/assets/js/platforms.js?v=4b5476660c';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
/** D1 writes 'YYYY-MM-DD HH:MM:SS' in UTC; show it in the reader's own time. */
const fmtWhen = (stamp) => {
  const d = new Date(String(stamp ?? '').replace(' ', 'T') + 'Z');
  if (isNaN(d)) return fmtDate(stamp);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `Today, ${time}` : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}`;
};

const gate = $('[data-gate]');
const app = $('[data-app]');

let schema = null;
let me = null;
let articles = [];
let current = null;      // the article being edited
let entryCtx = null;     // the entry or settings group being edited
let dirty = false;
let listCtx = null;      // what the list view is showing, and how it is filtered
let socialWaiting = 0;   // carousels sitting in review, for the menu badge

/* --------------------------------------------------------------- plumbing */

async function api(path, options = {}) {
  const res = await fetch(`/api/studio${path}`, {
    credentials: 'same-origin',
    headers: options.body && !(options.body instanceof FormData)
      ? { 'content-type': 'application/json' }
      : undefined,
    ...options,
  });
  if (res.status === 401) { showGate(); throw new Error('Signed out.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `That did not work (${res.status}).`);
  return data;
}

let sayTimer = null;
function say(message, tone = '') {
  const el = $('[data-status]');
  el.textContent = message;
  el.dataset.tone = tone;
  clearTimeout(sayTimer);
  if (message) sayTimer = setTimeout(() => { el.textContent = ''; }, 5000);
}

function showGate() { gate.hidden = false; app.hidden = true; }

const confirmDiscard = () =>
  !dirty || confirm('You have unsaved changes. Leave without saving?');

const pickImage = () => choosePicture({ api });

/* ---------------------------------------------------------------- drafts */

/**
 * A local copy of whatever is being typed, so a closed tab, a dead battery
 * or a stray back gesture does not take the afternoon with it. It is only
 * ever offered back — never applied silently, because the copy on the
 * server may well be the one you want.
 */
const draftKey = (id) => `w3a:draft:${id}`;

const saveDraft = (id, values) => {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify({ at: Date.now(), values }));
  } catch { /* private mode, a full disk — not worth interrupting a write for */ }
};
const readDraft = (id) => {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const clearDraft = (id) => {
  try { localStorage.removeItem(draftKey(id)); } catch { /* as above */ }
};

let draftTimer = null;
function rememberSoon(id, getValues) {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => saveDraft(id, getValues()), 700);
}

/** Offer a local draft back when it differs from what the server holds. */
function offerDraft(host, id, serverValues, apply) {
  host.innerHTML = '';
  const draft = readDraft(id);
  if (!draft) return;
  const differs = Object.keys(draft.values).some(
    (k) => String(draft.values[k] ?? '') !== String(serverValues[k] ?? '')
  );
  if (!differs) { clearDraft(id); return; }

  host.innerHTML =
    `<div class="st-recover">
       <p class="st-recover__text">Unsaved changes from ${escapeHtml(fmtWhen(new Date(draft.at).toISOString().replace('T', ' ').slice(0, 19)))}
         are still on this device.</p>
       <button class="st-link" data-recover type="button">Put them back</button>
       <button class="st-link" data-discard type="button">Discard</button>
     </div>`;
  $('[data-recover]', host).addEventListener('click', () => {
    apply(draft.values);
    host.innerHTML = '';
    dirty = true;
    say('Restored from this device. Save to keep them.', 'ok');
  });
  $('[data-discard]', host).addEventListener('click', () => {
    clearDraft(id);
    host.innerHTML = '';
  });
}

/* ------------------------------------------------------------------- menu */

function closeMenu() {
  $('[data-nav]').classList.remove('is-open');
  $('[data-scrim]').hidden = true;
  $('[data-menu-toggle]').setAttribute('aria-expanded', 'false');
}
function toggleMenu() {
  const nav = $('[data-nav]');
  const open = nav.classList.toggle('is-open');
  $('[data-scrim]').hidden = !open;
  $('[data-menu-toggle]').setAttribute('aria-expanded', String(open));
}
$('[data-menu-toggle]').addEventListener('click', toggleMenu);
$('[data-scrim]').addEventListener('click', closeMenu);

/** The whole menu, built from the content model. */
function renderNav() {
  const waiting = articles.filter((a) => a.status === 'review').length;

  const group = (title, links) =>
    `<div class="st-nav__group"><p class="st-nav__title">${title}</p>` +
    links
      .map(
        ([href, label, badge]) =>
          `<a class="st-nav__link" href="${href}">${escapeHtml(label)}` +
          (badge ? `<span class="st-nav__badge">${badge}</span>` : '') +
          '</a>'
      )
      .join('') +
    '</div>';

  const collections = schema
    ? Object.entries(schema.collections).map(([name, def]) => [`#/site/${name}`, def.label])
    : [];
  const settings = schema
    ? schema.settings.map((g) => [`#/settings/${encodeURIComponent(g.group)}`, g.group])
    : [];

  $('[data-nav-links]').innerHTML =
    group('Studio', [['#/', 'Overview']]) +
    group('Journal', [['#/journal', 'Articles', waiting || null]]) +
    group('Social', [
      ['#/social', 'Carousels', socialWaiting || null],
      ['#/kit/pillars', 'Pillars'],
      ['#/kit/refs', 'Brand kit'],
      ['#/kit/accounts', 'Accounts'],
    ]) +
    (collections.length ? group('The site', collections) : '') +
    (settings.length ? group('Settings', settings) : '') +
    group('Library', [['#/media', 'Pictures']]);

  markActive();
}

function markActive() {
  const here = location.hash || '#/';
  $$('.st-nav__link').forEach((a) => {
    const href = a.getAttribute('href');
    const on = href === '#/' ? here === '#/' : here === href || here.startsWith(href + '/');
    a.classList.toggle('is-on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/* ------------------------------------------------------------------- auth */

$('[data-login]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('[data-login-status]');
  out.textContent = 'Checking…';
  try {
    const { name } = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ name: $('#st-name').value, password: $('#st-pw').value }),
    });
    me = name;
    out.textContent = '';
    gate.hidden = true;
    app.hidden = false;
    await boot();
  } catch (err) {
    out.textContent = err.message;
  }
});

$('[data-logout]').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

/* ------------------------------------------------------------------ views */

function showView(name) {
  $$('[data-view]', $('[data-main]')).forEach((s) => { s.hidden = s.dataset.view !== name; });
  $('[data-main]').scrollTop = 0;
  window.scrollTo(0, 0);
}

/**
 * One line in a list. The row itself is the button; anything that acts on
 * the row sits beside it, because a button inside a button is neither valid
 * nor operable.
 */
const row = ({ title, note, meta, onClick, tools = [] }) => {
  const li = document.createElement('li');
  li.className = 'st-row-wrap';
  li.innerHTML =
    `<button type="button" class="st-row">
       <span class="st-row__text">
         <span class="st-row__title">${escapeHtml(title)}</span>
         ${note ? `<span class="st-row__desc u-text-style-main">${escapeHtml(note)}</span>` : ''}
       </span>
       <span class="st-row__meta u-text-style-main">${
         (meta || []).filter(Boolean).map((m) => `<span>${escapeHtml(m)}</span>`).join('')
       }</span>
     </button>` +
    (tools.length
      ? '<span class="st-row__tools">' +
        tools.map((t) =>
          `<button type="button" class="st-row__tool" data-act="${t.id}"` +
          ` title="${escapeAttr(t.title)}" aria-label="${escapeAttr(t.title)}"` +
          `${t.disabled ? ' disabled' : ''}>${t.label}</button>`).join('') +
        '</span>'
      : '');
  li.querySelector('.st-row').addEventListener('click', onClick);
  tools.forEach((t) => {
    const btn = li.querySelector(`[data-act="${t.id}"]`);
    if (btn && t.onClick) btn.addEventListener('click', t.onClick);
  });
  return li;
};

/* --------------------------------------------------------------- overview */

async function viewHome() {
  await ensureSchema();
  ({ articles } = await api('/articles'));
  renderNav();

  const waiting = articles.filter((a) => a.status === 'review');
  const drafts = articles.filter((a) => a.status === 'draft');
  const live = articles.filter((a) => a.status === 'published');

  $('[data-home-lede]').textContent = waiting.length
    ? `${waiting.length} article${waiting.length === 1 ? '' : 's'} waiting for you to read.`
    : `${live.length} article${live.length === 1 ? '' : 's'} live, ${drafts.length} in progress.`;

  const host = $('[data-home-body]');
  host.innerHTML = '';

  if (waiting.length) {
    const sec = document.createElement('section');
    sec.className = 'st-group';
    sec.innerHTML =
      '<h2 class="st-group__head">Waiting for you ' +
      `<span class="st-group__count">${waiting.length}</span></h2>` +
      '<p class="st-note u-text-style-main">Drafted by Spark. Nothing is live until you publish it.</p>' +
      '<ul class="st-rows"></ul>';
    const list = sec.querySelector('.st-rows');
    waiting.forEach((a) => list.appendChild(row({
      title: a.title,
      note: a.description || 'No description yet.',
      meta: [fmtDate(String(a.updated_at || '').slice(0, 10))],
      onClick: () => { location.hash = `#/journal/${encodeURIComponent(a.slug)}`; },
    })));
    host.appendChild(sec);
  }

  // everything the site is made of, with what is in each
  const counts = {};
  await Promise.all(
    Object.keys(schema.collections).map(async (name) => {
      try {
        const { entries } = await api(`/content/${name}`);
        counts[name] = entries.filter((e) => e.status === 'published').length;
      } catch { counts[name] = null; }
    })
  );

  const sections = document.createElement('section');
  sections.className = 'st-group';
  sections.innerHTML =
    '<h2 class="st-group__head">The site</h2><ul class="st-rows"></ul>';
  const slist = sections.querySelector('.st-rows');

  slist.appendChild(row({
    title: 'Articles',
    note: 'The journal.',
    meta: [`${live.length} live`],
    onClick: () => { location.hash = '#/journal'; },
  }));
  for (const [name, def] of Object.entries(schema.collections)) {
    slist.appendChild(row({
      title: def.label,
      note: def.note || '',
      meta: [counts[name] == null ? '' : `${counts[name]} showing`],
      onClick: () => { location.hash = `#/site/${name}`; },
    }));
  }
  host.appendChild(sections);

  const settings = document.createElement('section');
  settings.className = 'st-group';
  settings.innerHTML = '<h2 class="st-group__head">Words and settings</h2><ul class="st-rows"></ul>';
  const glist = settings.querySelector('.st-rows');
  for (const g of schema.settings) {
    glist.appendChild(row({
      title: g.group,
      note: `${g.fields.length} field${g.fields.length === 1 ? '' : 's'}`,
      meta: [],
      onClick: () => { location.hash = `#/settings/${encodeURIComponent(g.group)}`; },
    }));
  }
  glist.appendChild(row({
    title: 'Pictures',
    note: 'Everything uploaded.',
    meta: [],
    onClick: () => { location.hash = '#/media'; },
  }));
  host.appendChild(settings);

  showView('home');
}

/* ----------------------------------------------------------- list: shared */

/** Search and status tabs. A journal meant to reach hundreds needs both. */
function renderFilters() {
  const box = $('[data-list-filters]');
  if (!listCtx?.tabs?.length) { box.hidden = true; return; }
  box.hidden = false;
  $('[data-list-search]').placeholder = listCtx.searchLabel || 'Search';
  $('[data-list-tabs]').innerHTML = listCtx.tabs
    .map((t) =>
      `<button type="button" role="tab" class="st-toggle__btn${t.id === listCtx.filter ? ' is-on' : ''}"` +
      ` data-filter="${t.id}" aria-selected="${t.id === listCtx.filter}">` +
      `${escapeHtml(t.label)}${t.count == null ? '' : ` <span class="st-toggle__n">${t.count}</span>`}</button>`)
    .join('');
}

$('[data-list-tabs]').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn || !listCtx) return;
  listCtx.filter = btn.dataset.filter;
  renderFilters();
  listCtx.paint();
});

$('[data-list-search]').addEventListener('input', (e) => {
  if (!listCtx) return;
  listCtx.term = e.target.value.trim().toLowerCase();
  listCtx.paint();
});

const matches = (term, ...fields) =>
  !term || fields.filter(Boolean).join(' ').toLowerCase().includes(term);

/* --------------------------------------------------------- journal: list */

const ARTICLE_TABS = [
  { id: 'all', label: 'Everything' },
  { id: 'review', label: 'Waiting' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Live' },
];

async function viewJournal() {
  ({ articles } = await api('/articles'));
  renderNav();

  const live = articles.filter((a) => a.status === 'published').length;
  const waiting = articles.filter((a) => a.status === 'review').length;

  $('[data-list-crumb]').textContent = 'Journal';
  $('[data-list-title]').textContent = 'Articles';
  $('[data-list-lede]').textContent = waiting
    ? `${waiting} waiting for you, ${live} live.`
    : `${live} article${live === 1 ? '' : 's'} live.`;
  $('[data-list-new]').hidden = false;
  $('[data-list-new-label]').textContent = 'Write something';
  $('[data-list-new]').onclick = () => { location.hash = '#/journal/new'; };

  listCtx = {
    filter: listCtx?.kind === 'journal' ? listCtx.filter : 'all',
    term: '',
    kind: 'journal',
    searchLabel: 'Search titles, descriptions and tags',
    tabs: ARTICLE_TABS.map((t) => ({
      ...t,
      count: t.id === 'all' ? articles.length : articles.filter((a) => a.status === t.id).length,
    })),
    paint: paintJournal,
  };
  $('[data-list-search]').value = '';
  renderFilters();
  paintJournal();
  showView('list');
}

const STATUS_WORD = { review: 'Waiting for you', draft: 'Draft', published: 'Live' };

function paintJournal() {
  const { filter, term } = listCtx;
  const shown = articles.filter(
    (a) => (filter === 'all' || a.status === filter) &&
           matches(term, a.title, a.description, a.tags, a.slug)
  );

  const host = $('[data-list-body]');
  host.innerHTML = '';
  if (!shown.length) {
    host.innerHTML = `<p class="st-lede u-text-style-h4">${
      articles.length ? 'Nothing matches that.' : 'Nothing here yet. Write the first one.'
    }</p>`;
    return;
  }

  const list = document.createElement('ul');
  list.className = 'st-rows';
  for (const a of shown) {
    const by = a.status === 'published' ? (a.last_editor || a.author) : a.author;
    list.appendChild(row({
      title: a.title,
      note: a.description || 'No description yet.',
      meta: [
        filter === 'all' ? STATUS_WORD[a.status] : '',
        fmtDate(a.published_at || String(a.updated_at || '').slice(0, 10)),
        by,
      ],
      onClick: () => { location.hash = `#/journal/${encodeURIComponent(a.slug)}`; },
    }));
  }
  host.appendChild(list);
}

/* -------------------------------------------------------- journal: editor */

const field = (name) => $(`[data-f="${name}"]`);
let bodyEditor = null;

/** The headline box grows to fit rather than scrolling the words away. */
function fitTitle() {
  const el = field('title');
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
field('title').addEventListener('input', fitTitle);
// Enter in a headline means "done", not a second line
field('title').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); field('description').focus(); }
});

function fillArticle(a) {
  current = a;
  dirty = false;
  for (const n of ['title', 'description', 'slug', 'tags', 'body']) field(n).value = a[n] ?? '';

  const live = a.status === 'published';
  const parts = [];
  if (live) parts.push(`Live since ${fmtDate(a.published_at)}`);
  else if (a.status === 'review') parts.push('Drafted by Spark, waiting for you');
  else if (a.slug) parts.push('Draft');
  else parts.push('New article');
  if (a.author) parts.push(`written by ${a.author}`);
  if (a.last_editor && a.last_editor !== a.author) parts.push(`last edited by ${a.last_editor}`);
  $('[data-meta]').textContent = parts.join(' · ');
  $('[data-article-crumb]').textContent = a.title || 'New article';

  $('[data-publish]').hidden = live;
  $('[data-unpublish]').hidden = !live;
  field('slug').disabled = live;
  $('[data-slug-note]').textContent = live
    ? 'Locked. Renaming a live article throws away the ranking it earned.'
    : 'Becomes /journal/… — permanent once published.';
  $('[data-view]').href = live ? `/journal/${a.slug}` : `/journal/${a.slug}?preview=1`;
  $('[data-view]').hidden = !a.slug;
  $('[data-delete]').hidden = !a.slug;
  $('[data-history-toggle]').hidden = !a.slug;
  $('[data-history]').hidden = true;

  refreshArticle();
  showView('article');
  // after the view is shown: a hidden element has no scrollHeight to measure
  fitTitle();
}

async function viewArticle(slug) {
  if (!bodyEditor) bodyEditor = attachEditor(field('body'), { pickImage });

  if (slug === 'new') {
    fillArticle({ title: '', description: '', slug: '', tags: '', body: '', status: 'draft', author: me });
    offerDraft($('[data-recover-host]'), 'article:new', {}, applyArticleValues);
    field('title').focus();
    return;
  }
  const { article } = await api(`/articles/${encodeURIComponent(slug)}`);
  fillArticle(article);
  // compared against what was just loaded, so an untouched draft is dropped
  offerDraft($('[data-recover-host]'), `article:${slug}`, articleValues(), applyArticleValues);
}

function applyArticleValues(values) {
  for (const [k, v] of Object.entries(values)) if (field(k)) field(k).value = v;
  fitTitle();
  refreshArticle();
}

function refreshArticle() {
  const parsed = renderMarkdown(field('body').value);
  const words = countWords(parsed);

  const len = field('description').value.length;
  const note = $('[data-desc-note]');
  if (!len) { note.textContent = 'Required before publishing.'; note.dataset.tone = ''; }
  else if (len > 160) { note.textContent = `${len} characters — Google cuts it off around 160.`; note.dataset.tone = 'warn'; }
  else { note.textContent = `${len} of about 160 characters.`; note.dataset.tone = ''; }

  if (words) {
    const base = $('[data-meta]').textContent.split(' — ')[0];
    $('[data-meta]').textContent = `${base} — ${words} words, ${readingMinutes(words)} min read`;
  }

  const box = $('[data-preview]');
  if (box.hidden) return;
  box.innerHTML =
    `<h1 class="st-preview__title">${escapeHtml(field('title').value || 'The headline')}</h1>` +
    `<p class="st-preview__lede">${escapeHtml(field('description').value)}</p>` +
    (parsed.intro
      ? `<div class="st-preview__row"><div style="flex:1"></div><div class="st-preview__prose">${parsed.intro}</div></div>`
      : '') +
    parsed.sections
      .map((s) =>
        '<div class="st-preview__row">' +
        `<h2 class="st-preview__h2">${escapeHtml(s.title)}</h2>` +
        `<div class="st-preview__prose">${s.html}</div></div>`)
      .join('');
}

$$('[data-f]').forEach((el) =>
  el.addEventListener('input', () => {
    dirty = true;
    refreshArticle();
    rememberSoon(`article:${current?.slug || 'new'}`, articleValues);
  })
);

$$('[data-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    const write = tab.dataset.tab === 'write';
    $$('[data-tab]').forEach((t) => t.classList.toggle('is-on', t === tab));
    $('[data-editor-host]').hidden = !write;
    $('[data-preview]').hidden = write;
    refreshArticle();
  })
);
$('[data-back]').addEventListener('click', () => { if (confirmDiscard()) { dirty = false; location.hash = '#/journal'; } });
$('[data-board-back]').addEventListener('click', () => { location.hash = '#/social'; });

const articleValues = () => ({
  title: field('title').value.trim(),
  description: field('description').value.trim(),
  slug: field('slug').value.trim(),
  tags: field('tags').value.trim(),
  body: field('body').value,
});

async function saveArticle({ quiet = false } = {}) {
  const v = articleValues();
  if (!v.title) { say('It needs a title first.', 'err'); return null; }
  if (!quiet) say('Saving…');
  const wasNew = !current?.slug;
  const saved = current?.slug
    ? await api(`/articles/${encodeURIComponent(current.slug)}`, { method: 'PUT', body: JSON.stringify(v) })
    : await api('/articles', { method: 'POST', body: JSON.stringify(v) });
  dirty = false;
  clearDraft(`article:${wasNew ? 'new' : current.slug}`);
  const { article } = await api(`/articles/${encodeURIComponent(saved.slug)}`);
  ({ articles } = await api('/articles'));
  renderNav();
  fillArticle(article);
  if (location.hash !== `#/journal/${article.slug}`) {
    history.replaceState(null, '', `#/journal/${article.slug}`);
  }
  if (!quiet) say('Saved.', 'ok');
  return article;
}

$('[data-save]').addEventListener('click', () => saveArticle().catch((e) => say(e.message, 'err')));

$('[data-publish]').addEventListener('click', async () => {
  try {
    const a = (dirty || !current?.slug) ? await saveArticle({ quiet: true }) : current;
    if (!a) return;
    if (!a.description) { say('Add a description first — it is the search result.', 'err'); return; }
    if (!confirm(`Publish "${a.title}"?\n\nIt goes live at /journal/${a.slug} and into the sitemap.`)) return;
    await api(`/articles/${encodeURIComponent(a.slug)}/publish`, { method: 'POST' });
    const { article } = await api(`/articles/${encodeURIComponent(a.slug)}`);
    ({ articles } = await api('/articles'));
    renderNav();
    fillArticle(article);
    say('Published. It is live and in the sitemap.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-unpublish]').addEventListener('click', async () => {
  if (!confirm('Take this off the site? The URL will stop working.')) return;
  try {
    await api(`/articles/${encodeURIComponent(current.slug)}/unpublish`, { method: 'POST' });
    const { article } = await api(`/articles/${encodeURIComponent(current.slug)}`);
    ({ articles } = await api('/articles'));
    renderNav();
    fillArticle(article);
    say('Taken offline.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-delete]').addEventListener('click', async () => {
  if (!confirm(`Delete "${current.title}" permanently? This cannot be undone.`)) return;
  try {
    await api(`/articles/${encodeURIComponent(current.slug)}`, { method: 'DELETE' });
    clearDraft(`article:${current.slug}`);
    dirty = false;
    location.hash = '#/journal';
    say('Deleted.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

/* ---------------------------------------------------------------- history */

async function loadHistory(listEl, path, onRestore) {
  listEl.innerHTML = '<li class="st-note u-text-style-main">Loading…</li>';
  try {
    const { revisions } = await api(path);
    listEl.innerHTML = '';
    if (!revisions.length) {
      listEl.innerHTML =
        '<li class="st-note u-text-style-main">No earlier versions yet. One is kept each time you save.</li>';
      return;
    }
    for (const r of revisions) {
      listEl.appendChild(row({
        title: fmtWhen(r.created_at),
        note: `${r.note}${r.editor ? ` · ${r.editor}` : ''}`,
        meta: [],
        onClick: () => onRestore(r),
        tools: [{ id: 'restore', label: 'Restore', title: 'Put this version back',
                  onClick: () => onRestore(r) }],
      }));
    }
  } catch (e) {
    listEl.innerHTML = `<li class="st-note u-text-style-main">${escapeHtml(e.message)}</li>`;
  }
}

$('[data-history-toggle]').addEventListener('click', async () => {
  const panel = $('[data-history]');
  panel.hidden = !panel.hidden;
  if (panel.hidden || !current?.slug) return;
  await loadHistory(
    $('[data-history-list]'),
    `/articles/${encodeURIComponent(current.slug)}/history`,
    async (r) => {
      if (!confirm(`Put back the version from ${fmtWhen(r.created_at)}?\n\nWhat is there now is kept, so this can be undone.`)) return;
      try {
        await api(`/articles/${encodeURIComponent(current.slug)}/restore`, {
          method: 'POST', body: JSON.stringify({ id: r.id }),
        });
        const { article } = await api(`/articles/${encodeURIComponent(current.slug)}`);
        fillArticle(article);
        say('Restored.', 'ok');
      } catch (e) { say(e.message, 'err'); }
    }
  );
});

/* ------------------------------------------------------------- collections */

async function viewCollection(name) {
  await ensureSchema();
  const def = schema.collections[name];
  if (!def) { location.hash = '#/'; return; }

  const { entries } = await api(`/content/${name}`);

  $('[data-list-crumb]').textContent = 'The site';
  $('[data-list-title]').textContent = def.label;
  $('[data-list-lede]').textContent = def.note || '';
  $('[data-list-new]').hidden = false;
  $('[data-list-new-label]').textContent = `New ${def.singular.toLowerCase()}`;
  $('[data-list-new]').onclick = () => { location.hash = `#/site/${name}/new`; };

  listCtx = {
    kind: 'collection',
    name,
    def,
    entries,
    filter: 'all',
    term: '',
    searchLabel: `Search ${def.label.toLowerCase()}`,
    tabs: [
      { id: 'all', label: 'Everything', count: entries.length },
      { id: 'published', label: 'Showing', count: entries.filter((e) => e.status === 'published').length },
      { id: 'draft', label: 'Hidden', count: entries.filter((e) => e.status !== 'published').length },
    ],
    paint: paintCollection,
  };
  $('[data-list-search]').value = '';
  renderFilters();
  paintCollection();
  showView('list');
}

/** Move one entry and save the whole order. */
async function moveEntry(from, to) {
  const { name, entries } = listCtx;
  if (to < 0 || to >= entries.length) return;
  const next = entries.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  listCtx.entries = next;
  paintCollection();
  try {
    await api(`/content/${name}/reorder`, {
      method: 'POST', body: JSON.stringify({ slugs: next.map((e) => e.slug) }),
    });
    say('Order saved. The page is already showing it.', 'ok');
  } catch (e) {
    say(e.message, 'err');
    await viewCollection(name);   // put the list back the way the server has it
  }
}

function paintCollection() {
  const { def, entries, filter, term } = listCtx;
  const host = $('[data-list-body]');
  host.innerHTML = '';

  // Reordering only makes sense against the real sequence, so it is offered
  // on the unfiltered, unsearched list and not on a subset of it.
  const sortable = filter === 'all' && !term;

  const shown = entries
    .map((e, index) => ({ e, index }))
    .filter(({ e }) =>
      (filter === 'all' ||
       (filter === 'published' ? e.status === 'published' : e.status !== 'published')) &&
      matches(term, ...Object.values(e.data || {}), e.slug));

  if (!shown.length) {
    host.innerHTML = `<p class="st-lede u-text-style-h4">${
      entries.length ? 'Nothing matches that.' : 'Nothing here yet.'
    }</p>`;
    return;
  }

  const list = document.createElement('ul');
  list.className = 'st-rows';
  shown.forEach(({ e, index }) => {
    list.appendChild(row({
      title: e.data[def.titleField] || '(untitled)',
      note: e.status === 'published' ? '' : 'Hidden from the site',
      meta: [String(index + 1)],
      onClick: () => { location.hash = `#/site/${listCtx.name}/${encodeURIComponent(e.slug)}`; },
      tools: sortable
        ? [
            { id: 'up', label: '↑', title: 'Move up', disabled: index === 0,
              onClick: () => moveEntry(index, index - 1) },
            { id: 'down', label: '↓', title: 'Move down', disabled: index === entries.length - 1,
              onClick: () => moveEntry(index, index + 1) },
          ]
        : [],
    }));
  });
  host.appendChild(list);

  if (!sortable && entries.length > 1) {
    const note = document.createElement('p');
    note.className = 'st-note u-text-style-main';
    note.textContent = 'Clear the search and the filter to change the order.';
    host.appendChild(note);
  }
}

/* --------------------------------------------------------------- one form */

/**
 * A field, from its definition. Long text gets the formatting bar, image
 * fields get the picker, and required ones say so before a save is refused
 * rather than after.
 */
function fieldHtml(f, value) {
  const id = `f-${f.name.replace(/\W/g, '-')}`;
  const help = f.help ? `<p class="st-note u-text-style-main">${escapeHtml(f.help)}</p>` : '';
  const val = escapeHtml(value ?? '');
  const req = f.required ? '<span class="st-req" title="Required">needed</span>' : '';

  let control;
  if (f.type === 'markdown' || f.type === 'textarea') {
    control =
      `<div class="st-editor"><textarea id="${id}" class="st-input st-input--area"` +
      ` data-field="${f.name}" data-rich="${f.type === 'markdown' ? 'full' : 'compact'}"` +
      ` rows="${f.type === 'markdown' ? 8 : 3}">${val}</textarea></div>`;
  } else if (f.type === 'media') {
    control =
      '<div class="st-media-field">' +
      `<img class="st-media-field__thumb" data-thumb="${f.name}" alt=""` +
      `${value ? ` src="${escapeAttr(value)}"` : ' hidden'}>` +
      `<input id="${id}" class="st-input" data-field="${f.name}" type="text" value="${val}"` +
      ' placeholder="Nothing chosen">' +
      `<button type="button" class="st-link" data-choose="${f.name}">Choose</button>` +
      // always present, so choosing a picture for an empty field does not
      // leave you with no way to take it back out again
      `<button type="button" class="st-link" data-clear="${f.name}"${value ? '' : ' hidden'}>Clear</button>` +
      '</div>';
  } else {
    control =
      `<input id="${id}" class="st-input" data-field="${f.name}" type="text" value="${val}"` +
      (f.type === 'url' ? ' placeholder="https://…"' : '') + '>';
  }

  return (
    '<div class="st-field" data-field-wrap="' + escapeAttr(f.name) + '">' +
    `<label class="st-label u-text-style-main" for="${id}">${escapeHtml(f.label)}${req}</label>` +
    help + control +
    '<p class="st-note st-field__error u-text-style-main" data-error hidden></p>' +
    '</div>'
  );
}

/** Wire the picker, the previews and the toolbars into a freshly built form. */
function wireForm(host) {
  attachAll(host, { pickImage });

  host.addEventListener('input', (e) => {
    if (e.target.matches('[data-field]')) {
      dirty = true;
      const wrap = e.target.closest('[data-field-wrap]');
      if (wrap) { wrap.classList.remove('is-wrong'); $('[data-error]', wrap).hidden = true; }
      if (entryCtx) rememberSoon(entryDraftId(), entryValues);
    }
  });

  host.addEventListener('click', async (e) => {
    const choose = e.target.closest('[data-choose]');
    if (choose) {
      const picked = await pickImage();
      if (!picked?.url) return;
      const name = choose.dataset.choose;
      const input = $(`[data-field="${name}"]`, host);
      input.value = picked.url;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const thumb = $(`[data-thumb="${name}"]`, host);
      if (thumb) { thumb.src = picked.url; thumb.hidden = false; }
      const clearBtn = $(`[data-clear="${name}"]`, host);
      if (clearBtn) clearBtn.hidden = false;
      return;
    }
    const clear = e.target.closest('[data-clear]');
    if (clear) {
      const name = clear.dataset.clear;
      const input = $(`[data-field="${name}"]`, host);
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const thumb = $(`[data-thumb="${name}"]`, host);
      if (thumb) { thumb.hidden = true; thumb.removeAttribute('src'); }
      clear.hidden = true;
    }
  });
}

/** Highlight what the server would reject, before asking it. */
function missingFields(fields) {
  const wrong = [];
  for (const f of fields) {
    const wrap = $(`[data-field-wrap="${f.name}"]`);
    if (!wrap) continue;
    const el = $(`[data-field="${f.name}"]`);
    const empty = !String(el?.value ?? '').trim();
    const bad = Boolean(f.required && empty);
    wrap.classList.toggle('is-wrong', bad);
    const err = $('[data-error]', wrap);
    err.hidden = !bad;
    if (bad) { err.textContent = `${f.label} is needed.`; wrong.push(f.label); }
  }
  return wrong;
}

const entryDraftId = () =>
  entryCtx?.settings
    ? `settings:${entryCtx.group.group}`
    : `entry:${entryCtx.collection}:${entryCtx.slug || 'new'}`;

async function viewEntry(name, slug) {
  await ensureSchema();
  const def = schema.collections[name];
  if (!def) { location.hash = '#/'; return; }

  let entry = null;
  if (slug !== 'new') ({ entry } = await api(`/content/${name}/${encodeURIComponent(slug)}`));
  entryCtx = { collection: name, slug: slug === 'new' ? null : slug, def };

  $('[data-entry-crumb]').textContent = def.label;
  $('[data-entry-back]').onclick = () => { location.hash = `#/site/${name}`; };
  $('[data-entry-heading]').textContent =
    entry ? (entry.data[def.titleField] || def.singular) : `New ${def.singular.toLowerCase()}`;
  $('[data-entry-note]').textContent = def.note || '';

  const host = $('[data-entry-form]');
  host.innerHTML = def.fields.map((f) => fieldHtml(f, entry?.data?.[f.name])).join('');
  wireForm(host);
  dirty = false;

  const live = entry?.status === 'published';
  $('[data-entry-hide]').hidden = !entry || !live;
  $('[data-entry-show]').hidden = !entry || live;
  $('[data-entry-delete]').hidden = !entry;
  $('[data-entry-history-toggle]').hidden = !entry;
  $('[data-entry-history]').hidden = true;

  const recover = document.createElement('div');
  host.prepend(recover);
  offerDraft(recover, entryDraftId(), entry?.data || {}, (values) => {
    for (const [k, v] of Object.entries(values)) {
      const el = $(`[data-field="${k}"]`, host);
      if (el) el.value = v;
    }
  });

  showView('entry');
}

async function viewSettings(groupName) {
  await ensureSchema();
  const group = schema.settings.find((g) => g.group === groupName);
  if (!group) { location.hash = '#/'; return; }

  const { settings } = await api('/content/settings');
  entryCtx = { settings: true, group };

  $('[data-entry-crumb]').textContent = 'Settings';
  $('[data-entry-back]').onclick = () => { location.hash = '#/'; };
  $('[data-entry-heading]').textContent = group.group;
  $('[data-entry-note]').textContent = '';

  const host = $('[data-entry-form]');
  host.innerHTML = group.fields.map((f) => fieldHtml(f, settings[f.name])).join('');
  wireForm(host);
  dirty = false;

  $('[data-entry-hide]').hidden = true;
  $('[data-entry-show]').hidden = true;
  $('[data-entry-delete]').hidden = true;
  $('[data-entry-history-toggle]').hidden = true;
  $('[data-entry-history]').hidden = true;
  showView('entry');
}

const entryValues = () =>
  Object.fromEntries($$('[data-field]', $('[data-entry-form]')).map((el) => [el.dataset.field, el.value]));

$('[data-entry-save]').addEventListener('click', async () => {
  if (!entryCtx) return;
  const fields = entryCtx.settings ? entryCtx.group.fields : entryCtx.def.fields;
  const wrong = missingFields(fields);
  if (wrong.length) { say(`Still needs: ${wrong.join(', ')}`, 'err'); return; }

  say('Saving…');
  try {
    if (entryCtx.settings) {
      await api('/content/settings', { method: 'PUT', body: JSON.stringify(entryValues()) });
    } else if (entryCtx.slug) {
      await api(`/content/${entryCtx.collection}/${encodeURIComponent(entryCtx.slug)}`, {
        method: 'PUT', body: JSON.stringify(entryValues()),
      });
    } else {
      const created = await api(`/content/${entryCtx.collection}`, {
        method: 'POST', body: JSON.stringify(entryValues()),
      });
      clearDraft(entryDraftId());
      history.replaceState(null, '', `#/site/${entryCtx.collection}/${created.slug}`);
      entryCtx.slug = created.slug;
      $('[data-entry-history-toggle]').hidden = false;
    }
    clearDraft(entryDraftId());
    dirty = false;
    say('Saved. The page is already showing it.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

const setEntryStatus = async (status) => {
  try {
    await api(`/content/${entryCtx.collection}/${encodeURIComponent(entryCtx.slug)}/status`, {
      method: 'POST', body: JSON.stringify({ status }),
    });
    await viewEntry(entryCtx.collection, entryCtx.slug);
    say(status === 'published' ? 'Showing on the site.' : 'Hidden from the site.', 'ok');
  } catch (e) { say(e.message, 'err'); }
};
$('[data-entry-hide]').addEventListener('click', () => setEntryStatus('draft'));
$('[data-entry-show]').addEventListener('click', () => setEntryStatus('published'));

$('[data-entry-delete]').addEventListener('click', async () => {
  if (!confirm('Delete this permanently?')) return;
  try {
    await api(`/content/${entryCtx.collection}/${encodeURIComponent(entryCtx.slug)}`, { method: 'DELETE' });
    clearDraft(entryDraftId());
    dirty = false;
    location.hash = `#/site/${entryCtx.collection}`;
    say('Deleted.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-entry-history-toggle]').addEventListener('click', async () => {
  const panel = $('[data-entry-history]');
  panel.hidden = !panel.hidden;
  if (panel.hidden || !entryCtx?.slug) return;
  const base = `/content/${entryCtx.collection}/${encodeURIComponent(entryCtx.slug)}`;
  await loadHistory($('[data-entry-history-list]'), `${base}/history`, async (r) => {
    if (!confirm(`Put back the version from ${fmtWhen(r.created_at)}?`)) return;
    try {
      await api(`${base}/restore`, { method: 'POST', body: JSON.stringify({ id: r.id }) });
      await viewEntry(entryCtx.collection, entryCtx.slug);
      say('Restored.', 'ok');
    } catch (e) { say(e.message, 'err'); }
  });
});

/* --------------------------------------------------------------- first run */

/**
 * Shown when the database is bound but empty, so a deployment can be
 * finished from the studio rather than from a terminal.
 */
async function viewSetup(info) {
  const missing = !info.bound;
  $('[data-setup-lede]').textContent = missing
    ? 'The site is live, but there is no database behind it yet.'
    : 'The database is connected. It just needs its tables and your content.';

  $('[data-setup-steps]').innerHTML = missing
    ? `<li>In the Cloudflare dashboard, open <b>Storage &amp; Databases</b> &rarr; <b>D1 SQL Database</b> and create one called <code>web3ashley</code>.</li>
       <li>Open <b>R2</b> and create a bucket called <code>web3ashley-media</code>.</li>
       <li>Send me the database ID and I will wire it up, then reload this page.</li>`
    : `<li>Press the button. It creates the tables and loads everything the site currently says.</li>
       <li>Nothing on the site changes — the page already says all of it. It just becomes editable.</li>`;

  $('[data-setup-run]').hidden = missing;
  showView('setup');
}

$('[data-setup-run]').addEventListener('click', async () => {
  say('Setting up…');
  try {
    const r = await api('/setup', { method: 'POST' });
    const put = r.corrected?.length
      ? ` ${r.corrected.length} value${r.corrected.length === 1 ? '' : 's'} put right.`
      : '';
    say(
      `Done — ${r.counts.articles} articles, ${r.counts.entries} items, ` +
      `${r.counts.settings} settings.${put}`,
      'ok'
    );
    schema = null;
    await boot();
  } catch (e) { say(e.message, 'err'); }
});

/* ------------------------------------------------------------------ media */

let mediaItems = [];

async function viewMedia() {
  showView('media');
  try {
    ({ media: mediaItems } = await api('/media'));
    paintMedia();
  } catch (e) {
    $('[data-media]').innerHTML = `<li class="st-note u-text-style-main">${escapeHtml(e.message)}</li>`;
  }
}

function paintMedia() {
  // an upload repaints the whole list, and a description half-typed in
  // another row would go with it. Carry it across.
  const editing = document.activeElement?.matches?.('[data-alt]')
    ? { key: document.activeElement.closest('[data-key]')?.dataset.key,
        value: document.activeElement.value,
        at: document.activeElement.selectionStart }
    : null;

  const term = $('[data-media-search]').value.trim().toLowerCase();
  const shown = term
    ? mediaItems.filter((m) => matches(term, m.filename, m.alt, m.key))
    : mediaItems;

  const host = $('[data-media]');
  if (!shown.length) {
    host.innerHTML = `<li class="st-note u-text-style-main">${
      mediaItems.length ? 'Nothing matches that.' : 'Nothing uploaded yet.'
    }</li>`;
    return;
  }

  host.innerHTML = shown
    .map((m) => {
      const url = `/media/${escapeAttr(m.key)}`;
      const size = m.width && m.height ? `${m.width}×${m.height}` : '';
      return `<li class="st-media__item" data-key="${escapeAttr(m.key)}">
        <img src="${url}" alt="" loading="lazy">
        <div class="st-media__body">
          <input class="st-input st-media__alt" data-alt value="${escapeAttr(m.alt || '')}"
                 placeholder="Describe this picture" aria-label="Description">
          <p class="st-note u-text-style-main">
            ${escapeHtml(m.filename)} · ${fileSize(m.bytes)}${size ? ` · ${size}` : ''}
          </p>
          <div class="st-media__acts">
            <button class="st-link" type="button" data-copy>Copy path</button>
            <a class="st-link" href="${url}" target="_blank" rel="noopener">Open</a>
            <button class="st-link is-danger" type="button" data-remove>Delete</button>
          </div>
        </div>
      </li>`;
    })
    .join('');

  if (editing?.key) {
    const back = $(`[data-key="${CSS.escape(editing.key)}"] [data-alt]`, host);
    if (back) {
      back.value = editing.value;
      back.focus();
      back.setSelectionRange(editing.at, editing.at);
    }
  }
}

$('[data-media-search]').addEventListener('input', paintMedia);

$('[data-media]').addEventListener('click', async (e) => {
  const item = e.target.closest('[data-key]');
  if (!item) return;
  const key = item.dataset.key;

  if (e.target.closest('[data-copy]')) {
    const path = `/media/${key}`;
    try { await navigator.clipboard.writeText(path); say('Path copied.', 'ok'); }
    catch { say(path); }
    return;
  }
  if (e.target.closest('[data-remove]')) {
    if (!confirm('Delete this picture?\n\nAnywhere already using it will show a broken image.')) return;
    try {
      await api(`/media/${key}`, { method: 'DELETE' });
      mediaItems = mediaItems.filter((m) => m.key !== key);
      paintMedia();
      say('Deleted.', 'ok');
    } catch (err) { say(err.message, 'err'); }
  }
});

// alt text saves when you leave the box, so it is one action rather than a
// request per keystroke
$('[data-media]').addEventListener('change', async (e) => {
  if (!e.target.matches('[data-alt]')) return;
  const key = e.target.closest('[data-key]').dataset.key;
  const alt = e.target.value.trim();
  try {
    await api(`/media/${key}`, { method: 'PUT', body: JSON.stringify({ alt }) });
    const found = mediaItems.find((m) => m.key === key);
    if (found) found.alt = alt;
    say('Description saved.', 'ok');
  } catch (err) { say(err.message, 'err'); }
});

$('[data-upload]').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  if (!files.length) return;
  let done = 0;
  for (const file of files) {
    say(`Uploading ${done + 1} of ${files.length}…`);
    try {
      await uploadImage(file, { api });
      done++;
    } catch (err) { say(err.message, 'err'); return; }
  }
  say(done === 1 ? 'Uploaded.' : `Uploaded ${done}.`, 'ok');
  viewMedia();
});

/* ----------------------------------------------------------------- router */

/* ================================================================== social
 *
 * The back of the house. Spark researches, plans and generates; this is
 * where a person looks at what came back and either lets it out or sends
 * particular slides back. It replaces a staging folder and a review email
 * with a screen that knows what state everything is in.
 *
 * None of it is public. No site route renders any of it.
 */

const CAR_STATES = {
  planned:    { label: 'Planned',    note: 'Filed by Spark. No pictures yet.' },
  generating: { label: 'Making',     note: 'The slides are being drawn.' },
  review:     { label: 'Waiting on you', note: 'Everything is drawn. Your turn.' },
  changes:    { label: 'Being redone', note: 'Spark is redoing the slides you flagged.' },
  approved:   { label: 'Approved',   note: 'Cleared to post. Give it a slot.' },
  scheduled:  { label: 'Scheduled',  note: 'It goes out at its slot.' },
  posted:     { label: 'Posted',     note: '' },
  rejected:   { label: 'Killed',     note: '' },
};

const BOARD_TABS = [
  ['review', 'Waiting on you'],
  ['', 'Everything'],
  ['planned', 'Planned'],
  ['approved', 'Approved'],
  ['scheduled', 'Scheduled'],
  ['posted', 'Posted'],
];

let boardCtx = { status: 'review', query: '', carousels: [] };
let carousel = null;

async function viewBoard() {
  await ensureSchema();
  showView('board');
  const { carousels } = await api('/carousels');
  boardCtx.carousels = carousels;
  socialWaiting = carousels.filter((c) => c.status === 'review').length;
  renderNav();

  const tabs = $('[data-board-tabs]');
  tabs.innerHTML = BOARD_TABS.map(
    ([value, label]) =>
      `<button type="button" role="tab" class="st-toggle__btn${
        value === boardCtx.status ? ' is-on' : ''
      }" data-tab="${value}" aria-selected="${value === boardCtx.status}">${label}</button>`
  ).join('');
  $$('[data-tab]', tabs).forEach((b) =>
    b.addEventListener('click', () => { boardCtx.status = b.dataset.tab; viewBoard(); })
  );

  const search = $('[data-board-search]');
  search.value = boardCtx.query;
  search.oninput = () => { boardCtx.query = search.value; paintBoard(); };

  $('[data-board-new]').onclick = startByHand;
  paintBoard();
}

/**
 * A carousel made here rather than by Spark.
 *
 * Everything in this pipeline assumed the agent would fill it, which left
 * no way to put one post out on your own — and the first thing anybody
 * needs, before a day of automation is worth trusting, is to watch one
 * post go all the way through by hand.
 *
 * Two slides, because two is the floor on both platforms. More can be
 * added; a plan filed by Spark is the same shape.
 */
async function startByHand() {
  const title = prompt('What is this one called?');
  if (!title || !title.trim()) return;
  try {
    const out = await api('/carousels', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        slides: [
          { kind: 'hook', copy: '' },
          { kind: 'cta', copy: '' },
        ],
      }),
    });
    location.hash = `#/social/${encodeURIComponent(out.slug)}`;
  } catch (e) { say(e.message, 'err'); }
}

function paintBoard() {
  const host = $('[data-board-body]');
  const q = boardCtx.query.trim().toLowerCase();
  const shown = boardCtx.carousels.filter(
    (c) =>
      (!boardCtx.status || c.status === boardCtx.status) &&
      (!q || `${c.title} ${c.topic} ${c.pillar}`.toLowerCase().includes(q))
  );

  if (!shown.length) {
    host.innerHTML =
      `<p class="st-lede u-text-style-h4">${
        boardCtx.status === 'review'
          ? 'Nothing is waiting on you.'
          : 'Nothing here yet.'
      }</p>`;
    return;
  }

  const list = document.createElement('ul');
  list.className = 'st-rows';
  shown.forEach((c) => {
    const state = CAR_STATES[c.status] || { label: c.status };
    const pics = c.slides ? `${c.ready}/${c.slides} drawn` : 'no slides';
    list.append(
      row({
        title: c.title || c.slug,
        note: c.topic,
        meta: [
          c.pillar || null,
          pics,
          c.redo ? `${c.redo} to redo` : null,
          c.slot ? `slot ${c.slot}` : null,
          state.label,
        ],
        onClick: () => { location.hash = `#/social/${encodeURIComponent(c.slug)}`; },
      })
    );
  });
  host.replaceChildren(list);
}

/** One carousel: the slides as a filmstrip, and what you can do about them. */
async function viewCarousel(slug) {
  showView('carousel');
  ({ carousel } = await api(`/carousels/${encodeURIComponent(slug)}`));
  $('[data-car-crumb]').textContent = carousel.title || carousel.slug;
  paintCarousel();
}

function paintCarousel() {
  const c = carousel;
  const state = CAR_STATES[c.status] || { label: c.status, note: '' };
  const host = $('[data-car-body]');

  const ready = c.slides.filter((s) => s.state === 'ready').length;
  const redo = c.slides.filter((s) => s.state === 'redo').length;

  host.innerHTML =
    `<div class="st-head">
       <div>
         <h1 class="st-display">${escapeHtml(c.title || c.slug)}</h1>
       </div>
     </div>
     <p class="st-lede u-text-style-h4">${escapeHtml(state.note || '')}</p>

     <dl class="st-facts">
       <div><dt>State</dt><dd>${escapeHtml(state.label)}</dd></div>
       <div><dt>Pillar</dt><dd>${escapeHtml(c.pillar || '—')}</dd></div>
       <div><dt>Slides</dt><dd>${ready} of ${c.slides.length} drawn${
         redo ? `, ${redo} to redo` : ''
       }</dd></div>
       <div><dt>Goes to</dt><dd>${escapeHtml(c.targets.join(', ') || '—')}</dd></div>
       <div><dt>Slot</dt><dd>${
         c.slot ? `${c.slot}${c.scheduled_for ? ` — ${escapeHtml(c.scheduled_for)}` : ''}` : '—'
       }</dd></div>
     </dl>

     ${c.topic ? `<p class="st-note st-note--topic u-text-style-main">${escapeHtml(c.topic)}</p>` : ''}

     <div class="st-field">
       <label class="st-label u-text-style-main" for="car-caption">Caption</label>
       <textarea class="st-input st-input--area" id="car-caption" rows="5"
                 data-car-caption>${escapeHtml(c.caption)}</textarea>
     </div>
     <div class="st-field">
       <label class="st-label u-text-style-main" for="car-tags">Hashtags</label>
       <input class="st-input" id="car-tags" data-car-tags value="${escapeAttr(c.hashtags)}">
     </div>
     <div class="st-acts">
       <button class="st-link" type="button" data-car-save>Save the words</button>
     </div>

     <h2 class="st-h2">The slides</h2>
     <ul class="st-strip" data-car-slides></ul>

     ${c.status === 'posted' ? '<h2 class="st-h2">How it did</h2><div data-car-stats></div>' : ''}

     <h2 class="st-h2">What happens next</h2>
     <div class="st-acts" data-car-acts></div>`;

  const strip = $('[data-car-slides]', host);
  c.slides.forEach((s) => {
    const li = document.createElement('li');
    li.className = `st-slide is-${s.state}`;
    li.innerHTML =
      `<div class="st-slide__frame">${
        s.url
          ? `<img src="${escapeAttr(s.url)}" alt="${escapeAttr(s.copy || `Slide ${s.position + 1}`)}" loading="lazy">`
          : '<span class="st-slide__blank">not drawn</span>'
      }</div>
       <p class="st-slide__no u-text-style-main">${s.position + 1} · ${escapeHtml(s.kind)}${
         s.attempts > 1 ? ` · take ${s.attempts}` : ''
       }</p>
       ${s.copy ? `<p class="st-slide__copy">${escapeHtml(s.copy)}</p>` : ''}
       ${s.note ? `<p class="st-slide__note u-text-style-main">Asked again: ${escapeHtml(s.note)}</p>` : ''}
       <div class="st-slide__acts">
         <label class="st-link">
           ${s.url ? 'Replace it' : 'Add a picture'}
           <input type="file" accept="image/jpeg,image/webp,image/png" hidden
                  data-slide-file="${s.position}">
         </label>
         <button class="st-link" type="button" data-redo="${s.position}">${
           s.state === 'redo' ? 'Change the note' : 'Ask for this one again'
         }</button>
         ${s.url ? `<a class="st-link" href="${escapeAttr(s.url)}" target="_blank" rel="noopener">Full size</a>` : ''}
       </div>`;
    strip.append(li);
  });

  $$('[data-redo]', host).forEach((b) =>
    b.addEventListener('click', () => askAgain(Number(b.dataset.redo)))
  );

  $$('[data-slide-file]', host).forEach((input) =>
    input.addEventListener('change', () => putPicture(Number(input.dataset.slideFile), input.files[0]))
  );

  // the approve button turns on as soon as there is something to approve,
  // rather than after a save nobody was told to make
  const acts = $('[data-car-acts]', host);
  ['[data-car-caption]', '[data-car-tags]'].forEach((sel) =>
    $(sel, host)?.addEventListener('input', () => paintCarouselActions(acts))
  );

  $('[data-car-save]', host).addEventListener('click', async () => {
    try {
      await api(`/carousels/${encodeURIComponent(c.slug)}`, {
        method: 'PUT',
        body: JSON.stringify({
          caption: $('[data-car-caption]', host).value,
          hashtags: $('[data-car-tags]', host).value,
        }),
      });
      say('Saved.');
      await viewCarousel(c.slug);
    } catch (e) { say(e.message, 'err'); }
  });

  paintCarouselActions($('[data-car-acts]', host));
  if (c.status === 'posted') paintStats($('[data-car-stats]', host), c.slug);
}

/**
 * The numbers, once it has gone out.
 *
 * Reading is free and asking the platforms is not, so opening this shows
 * what is stored and the button is what spends a call. A count that came
 * back null is printed as a dash with the platform's reason under it —
 * never as a zero, because "nobody liked it" and "this token cannot read
 * likes" would otherwise look identical and only one of them is a reason
 * to change what gets posted.
 */
async function paintStats(host, slug, { refresh = false } = {}) {
  if (!host) return;
  host.innerHTML = `<p class="st-note u-text-style-main">${
    refresh ? 'Asking the platforms…' : 'Reading…'
  }</p>`;

  let post = null;
  try {
    const out = refresh
      ? await api('/carousels/-/stats', { method: 'POST', body: JSON.stringify({ slug }) })
      : await api(`/carousels/-/stats?slug=${encodeURIComponent(slug)}`);
    post = out.posts?.[0] || null;
  } catch (e) {
    host.innerHTML = `<p class="st-note u-text-style-main">${escapeHtml(e.message)}</p>`;
    return;
  }

  const platforms = Object.entries(post?.platforms || {});
  const n = (v) => (v === null || v === undefined ? '—' : String(v));

  host.innerHTML = platforms.length
    ? `<dl class="st-facts">
         <div><dt>Likes</dt><dd>${n(post.totals.likes)}</dd></div>
         <div><dt>Comments</dt><dd>${n(post.totals.comments)}</dd></div>
         <div><dt>Saves</dt><dd>${n(post.totals.saves)}</dd></div>
         <div><dt>Shares</dt><dd>${n(post.totals.shares)}</dd></div>
         <div><dt>Views</dt><dd>${n(post.totals.views)}</dd></div>
         <div><dt>Reach</dt><dd>${n(post.totals.reach)}</dd></div>
       </dl>
       ${platforms.map(([name, p]) =>
         `<h3 class="st-h3">${escapeHtml(name)}</h3>
          <p class="st-note u-text-style-main">${
            [`${n(p.likes)} likes`, `${n(p.comments)} comments`,
             p.views !== null && p.views !== undefined ? `${p.views} views` : '',
             p.permalink
               ? `<a class="st-link" href="${escapeAttr(p.permalink)}" target="_blank" rel="noopener">See it</a>`
               : ''].filter(Boolean).join(' · ')
          }</p>
          ${p.note ? `<p class="st-note u-text-style-main">${escapeHtml(p.note)}</p>` : ''}`
       ).join('')}`
    : '<p class="st-note u-text-style-main">Nothing has been read back yet.</p>';

  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'st-link';
  b.textContent = 'Check the numbers again';
  b.addEventListener('click', () => paintStats(host, slug, { refresh: true }));
  const acts = document.createElement('div');
  acts.className = 'st-acts';
  acts.append(b);
  host.append(acts);
}

/** What is in the boxes right now, which is not always what is stored. */
const typedWords = () => ({
  caption: $('[data-car-caption]')?.value ?? carousel.caption,
  hashtags: $('[data-car-tags]')?.value ?? carousel.hashtags,
});

const wordsUnsaved = () => {
  const t = typedWords();
  return t.caption !== carousel.caption || t.hashtags !== carousel.hashtags;
};

/** Only the moves the API will actually accept, so nothing offered fails. */
function paintCarouselActions(host) {
  const c = carousel;
  const move = async (status, ask) => {
    if (ask && !confirm(ask)) return;
    try {
      // A caption typed and not saved is still only in the box. Approving
      // would refuse on a caption the screen is plainly showing, which
      // reads as the studio calling you a liar — so the words go first.
      if (wordsUnsaved()) {
        await api(`/carousels/${encodeURIComponent(c.slug)}`, {
          method: 'PUT',
          body: JSON.stringify(typedWords()),
        });
      }
      await api(`/carousels/${encodeURIComponent(c.slug)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await viewCarousel(c.slug);
      say('Done.');
    } catch (e) { say(e.message, 'err'); }
  };

  // Why it cannot be approved yet, in the order the API checks. Offering a
  // button that is certain to fail is worse than not offering it, and worse
  // still is offering it with no word about what is missing.
  const blocked = (() => {
    if (c.slides.length < 2) return 'It needs at least two slides.';
    const unready = c.slides.filter((s) => s.state !== 'ready');
    if (unready.length) {
      return `${unready.length} slide${unready.length > 1 ? 's are' : ' is'} not drawn yet` +
             `${unready.some((s) => s.state === 'redo') ? ' — Spark has the notes' : ''}.`;
    }
    if (!typedWords().caption.trim()) return 'Write a caption first.';
    // and what the platforms themselves will refuse, from their own docs.
    // Every one of them, not the first: fixing them one screen at a time
    // when they are all about the same pictures is four round trips.
    const said = platformProblems({ ...c, ...typedWords() });
    return said.length ? said.join(' ') : null;
  })();

  // planned and generating are here for a carousel you made yourself:
  // review is where the agent hands work over, and there is nobody to
  // hand your own pictures to
  const readyToApprove = ['review', 'changes', 'planned', 'generating'];
  const acts = [];
  if (readyToApprove.includes(c.status) && !blocked) {
    acts.push(['Approve it', () => move('approved')]);
  }
  if (c.status === 'approved') {
    acts.push(['Give it a slot', schedule]);
    acts.push(['Send it back', () => move('changes')]);
  }
  if (c.status === 'scheduled') {
    acts.push(['Unschedule', () => move('approved')]);
  }
  if (c.status !== 'posted' && c.status !== 'rejected') {
    acts.push(['Kill it', () => move('rejected', 'Kill this carousel? Spark will stop proposing it.')]);
  }
  if (c.status === 'rejected') acts.push(['Put it back', () => move('planned')]);

  host.replaceChildren();
  acts.forEach(([label, fn]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'st-link';
    b.textContent = label;
    b.addEventListener('click', fn);
    host.append(b);
  });
  if (blocked && readyToApprove.includes(c.status)) {
    const p = document.createElement('p');
    p.className = 'st-note u-text-style-main';
    p.textContent = `Not ready to approve. ${blocked}`;
    host.append(p);
  } else if (!acts.length) {
    host.innerHTML = '<p class="st-note u-text-style-main">Nothing left to do here.</p>';
  }
}

/**
 * A picture onto one slide, from the phone.
 *
 * The pixel size is measured here rather than guessed at the other end,
 * because it is what approval checks against — Instagram's ratio and
 * TikTok's 1080p cap — and a slide with no size recorded passes both
 * checks by being unknown, then fails at the moment it was due to post.
 */
async function putPicture(position, file) {
  if (!file) return;
  const c = carousel;
  say('Uploading…');
  try {
    const { width, height } = await readImageSize(file);
    const form = new FormData();
    form.append('file', file);
    form.append('width', String(width));
    form.append('height', String(height));
    const res = await fetch(
      `/api/studio/carousels/${encodeURIComponent(c.slug)}/slides/${position}`,
      { method: 'PUT', body: form, credentials: 'same-origin' }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed (${res.status}).`);
    }
    await viewCarousel(c.slug);
    say(`Slide ${position + 1}: ${width}×${height}.`);
  } catch (e) { say(e.message, 'err'); }
}

/**
 * The feedback loop, in one call: mark this slide and let Spark find it.
 * Per slide rather than per carousel, because asking for one again must
 * not cost the nine that were already right.
 */
async function askAgain(position) {
  const s = carousel.slides.find((x) => x.position === position);
  const note = prompt(`What is wrong with slide ${position + 1}?`, s?.note || '');
  if (note === null) return;
  try {
    await api(
      `/carousels/${encodeURIComponent(carousel.slug)}/slides/${position}/redo`,
      { method: 'POST', body: JSON.stringify({ note }) }
    );
    await viewCarousel(carousel.slug);
    say(`Slide ${position + 1} goes back to Spark.`);
  } catch (e) { say(e.message, 'err'); }
}

async function schedule() {
  const slot = prompt('Which slot, 1 to 5?', String(carousel.slot || 1));
  if (slot === null) return;
  const at = prompt('When? YYYY-MM-DDTHH:MM:SSZ, or leave blank.', carousel.scheduled_for || '');
  if (at === null) return;
  try {
    await api(`/carousels/${encodeURIComponent(carousel.slug)}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ slot: Number(slot), at }),
    });
    await viewCarousel(carousel.slug);
    say('Scheduled.');
  } catch (e) { say(e.message, 'err'); }
}

/* ------------------------------------------------------- pillars and kit */

/**
 * The platform tokens. A screen rather than a dashboard secret, because
 * both platforms expire them and a Worker cannot rewrite its own secret
 * — so they live in the database and get refreshed on use. This is where
 * the first one is pasted, and where you find out one has lapsed.
 */
async function viewAccounts() {
  showView('kit');
  $('[data-kit-title]').textContent = 'Accounts';
  $('[data-kit-lede]').textContent =
    'Where the posts go. Both platforms expire their tokens, so these are kept here '
    + 'and renewed automatically — you only come back if one lapses.';
  const host = $('[data-kit-body]');
  host.replaceChildren();

  const state = await api('/carousels/-/accounts');

  const ig = state.instagram;
  const tt = state.tiktok;
  const line = (label, ok, detail) =>
    `<div><dt>${escapeHtml(label)}</dt><dd>${ok ? '' : 'Not connected'}${
      escapeHtml(detail || '')}</dd></div>`;

  host.innerHTML =
    `<dl class="st-facts">
       ${line('Instagram', ig.connected,
              ig.connected
                ? (ig.expires_in_days === null ? 'Connected'
                   : `Connected — ${ig.expires_in_days} days left, renews itself`)
                : '')}
       ${line('TikTok', tt.connected,
              tt.connected
                ? [tt.username ? `@${tt.username}` : 'Connected',
                   tt.can_renew ? 'renews itself'
                     : 'cannot renew: add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET',
                   tt.audited ? null : 'not audited, so posts are private',
                  ].filter(Boolean).join(' — ')
                : '')}
     </dl>

     <h2 class="st-h2">Instagram</h2>
     <p class="st-note u-text-style-main">A professional account. No Facebook Page needed
       if you use Instagram Login.</p>
     <div class="st-field">
       <label class="st-label u-text-style-main" for="ig-id">Instagram user ID</label>
       <input class="st-input" id="ig-id" data-f="ig_user_id" value="${escapeAttr(ig.user_id || '')}">
     </div>
     <div class="st-field">
       <label class="st-label u-text-style-main" for="ig-tok">Long-lived access token</label>
       <textarea class="st-input st-input--area" id="ig-tok" rows="3" data-f="ig_token"
                 placeholder="${ig.connected ? 'Connected — paste a new one only to replace it' : 'Paste it here'}"></textarea>
     </div>

     <h2 class="st-h2">TikTok</h2>
     <p class="st-note u-text-style-main">TikTok has no token to copy out of a dashboard —
       it hands one over at the end of an approval. This does that round trip for you.
       ${tt.connected
         ? 'The access token lasts a day and renews itself; the refresh token lasts a year.'
         : ''}</p>
     <div class="st-field">
       <label class="st-label u-text-style-main" for="tt-key">Client key</label>
       <input class="st-input" id="tt-key" data-f="tiktok_client_key"
              placeholder="${tt.can_connect
                ? `set in ${tt.client_from}, ending ${escapeAttr(tt.client_key_ends)}`
                : 'From the app\u2019s Credentials panel'}">
     </div>
     <div class="st-field">
       <label class="st-label u-text-style-main" for="tt-sec">Client secret</label>
       <input class="st-input" id="tt-sec" data-f="tiktok_client_secret"
              placeholder="${tt.can_connect ? 'Set — paste a new one only to replace it' : 'From the same panel'}">
     </div>
     <p class="st-note u-text-style-main">A sandbox and the live app are separate
       clients with separate credentials. Setting them here rather than in the
       deployment is what lets you swap between the two without waiting for a
       build — which the approval path needs, since the demo is recorded against
       a sandbox and the real posting runs against the live app.</p>

     ${tt.can_connect
       ? `<div class="st-acts">
            <a class="st-link" href="/oauth/tiktok/start">${
              tt.connected ? 'Connect TikTok again' : 'Connect TikTok'}</a>
            <a class="st-link" href="/oauth/tiktok/start?check=1">Check the setup</a>
          </div>`
       : `<p class="st-note u-text-style-main">Add <code>TIKTOK_CLIENT_KEY</code> and
          <code>TIKTOK_CLIENT_SECRET</code> to the Pages project first, under both
          Production and Preview, and retry the deployment.</p>`}
     ${tt.connected && !tt.scopes.includes('video.publish')
       ? `<p class="st-note u-text-style-main">This token does not carry
          <code>video.publish</code>, so it cannot post. Add the Content Posting API
          product to the app and connect again.</p>`
       : ''}
     ${tt.connected ? `
       <label class="st-check">
         <input type="checkbox" data-acc-audited ${tt.audited ? 'checked' : ''}>
         <span>TikTok has audited this app</span>
       </label>
       <p class="st-note u-text-style-main">Leave this off until the audit actually
         passes. An unaudited app may only post at <code>SELF_ONLY</code> — TikTok
         refuses anything else outright — so posts go out where only you can see them,
         and the board says so against each one.</p>` : ''}

     <div class="st-acts">
       <button class="st-link" type="button" data-acc-save>Save</button>
       <button class="st-link" type="button" data-acc-post>Post anything that is due</button>
     </div>
     <p class="st-note u-text-style-main" data-acc-out></p>`;

  $('[data-acc-save]', host).addEventListener('click', async () => {
    const body = {};
    $$('[data-f]', host).forEach((el) => { if (el.value.trim()) body[el.dataset.f] = el.value.trim(); });
    // the checkbox is a state rather than a value, so it is sent whenever
    // it disagrees with what is stored — including when it is turned off
    const audit = $('[data-acc-audited]', host);
    if (audit && audit.checked !== tt.audited) body.tiktok_audited = audit.checked;
    if (!Object.keys(body).length) { say('Nothing to save.'); return; }
    try {
      const out = await api('/carousels/-/accounts', { method: 'PUT', body: JSON.stringify(body) });
      say(`Saved ${out.saved.length} field${out.saved.length === 1 ? '' : 's'}.`);
      await viewAccounts();
    } catch (e) { say(e.message, 'err'); }
  });

  $('[data-acc-post]', host).addEventListener('click', async () => {
    $('[data-acc-out]', host).textContent = 'Posting…';
    try {
      const out = await api('/carousels/-/post', { method: 'POST', body: '{}' });
      $('[data-acc-out]', host).textContent = out.ran
        ? `${out.ran} carousel${out.ran === 1 ? '' : 's'} handled. Check the board for what went where.`
        : 'Nothing was due.';
    } catch (e) { $('[data-acc-out]', host).textContent = e.message; }
  });
}

async function viewKit(which) {
  showView('kit');
  const host = $('[data-kit-body]');
  host.replaceChildren();

  if (which === 'pillars') {
    $('[data-kit-title]').textContent = 'Pillars';
    $('[data-kit-lede]').textContent =
      'The buckets a day is spread across. Spark reads these before it researches anything, ' +
      'so the brief here is what steers what it writes about.';
    const { pillars } = await api('/carousels/-/pillars');
    const rows = pillars.length ? pillars : [{ slug: '', name: '', brief: '' }];
    host.innerHTML =
      `<div data-pillars>${rows.map(pillarRow).join('')}</div>
       <div class="st-acts">
         <button class="st-link" type="button" data-pillar-add>Add one</button>
         <button class="st-link" type="button" data-pillars-save>Save</button>
       </div>`;
    $('[data-pillar-add]', host).addEventListener('click', () => {
      $('[data-pillars]', host).insertAdjacentHTML('beforeend', pillarRow({ name: '', brief: '' }));
    });
    $('[data-pillars-save]', host).addEventListener('click', async () => {
      const pillars = $$('[data-pillar]', host).map((r) => ({
        name: $('[data-pillar-name]', r).value,
        brief: $('[data-pillar-brief]', r).value,
      })).filter((p) => p.name.trim());
      try {
        await api('/carousels/-/pillars', { method: 'PUT', body: JSON.stringify({ pillars }) });
        say(`Saved ${pillars.length} pillar${pillars.length === 1 ? '' : 's'}.`);
      } catch (e) { say(e.message, 'err'); }
    });
    return;
  }

  $('[data-kit-title]').textContent = 'Brand kit';
  $('[data-kit-lede]').textContent =
    'The reference pictures the image model is given: you, for the likeness, and the look. ' +
    'Spark fetches these by URL at the start of every cycle, so changing one here changes ' +
    'every carousel made after it.';

  const [{ refs }, { media }] = await Promise.all([
    api('/carousels/-/refs'),
    api('/media'),
  ]);
  const chosen = new Map(refs.map((r) => [r.media_key, r.role]));

  host.innerHTML =
    `<p class="st-note u-text-style-main" data-kit-count></p>
     <ul class="st-media" data-kit-pics></ul>
     <div class="st-acts"><button class="st-link" type="button" data-kit-save>Save the kit</button></div>`;

  const count = () => {
    const roles = [...chosen.values()];
    $('[data-kit-count]', host).textContent =
      `${roles.filter((r) => r === 'likeness').length} of you, ` +
      `${roles.filter((r) => r === 'aesthetic').length} for the look.`;
  };

  const pics = $('[data-kit-pics]', host);
  media.forEach((m) => {
    const li = document.createElement('li');
    li.className = 'st-media__item';
    const role = chosen.get(m.key) || '';
    li.innerHTML =
      `<img src="/media/${escapeAttr(m.key)}" alt="${escapeAttr(m.alt)}" loading="lazy">
       <div class="st-media__body">
         <select class="st-input" data-role data-key="${escapeAttr(m.key)}">
           <option value=""${role ? '' : ' selected'}>Not a reference</option>
           <option value="likeness"${role === 'likeness' ? ' selected' : ''}>You</option>
           <option value="aesthetic"${role === 'aesthetic' ? ' selected' : ''}>The look</option>
         </select>
       </div>`;
    li.querySelector('[data-role]').addEventListener('change', (e) => {
      if (e.target.value) chosen.set(m.key, e.target.value);
      else chosen.delete(m.key);
      count();
    });
    pics.append(li);
  });
  count();

  $('[data-kit-save]', host).addEventListener('click', async () => {
    const body = { refs: [...chosen].map(([media_key, role]) => ({ media_key, role })) };
    try {
      await api('/carousels/-/refs', { method: 'PUT', body: JSON.stringify(body) });
      say(`Saved ${body.refs.length} reference${body.refs.length === 1 ? '' : 's'}.`);
    } catch (e) { say(e.message, 'err'); }
  });
}

const pillarRow = (p) =>
  `<div class="st-field" data-pillar>
     <input class="st-input" data-pillar-name placeholder="Name"
            value="${escapeAttr(p.name || '')}" aria-label="Pillar name">
     <textarea class="st-input st-input--area" rows="2" data-pillar-brief
               placeholder="What Spark should aim at here"
               aria-label="Brief">${escapeHtml(p.brief || '')}</textarea>
   </div>`;

async function ensureSchema() {
  if (!schema) { schema = await api('/content/schema'); renderNav(); }
  return schema;
}

async function route() {
  closeMenu();
  // land on a real address, so the menu marks where you are and the first
  // back press leaves the studio rather than doing nothing
  if (!location.hash) { history.replaceState(null, '', '#/'); }
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').map(decodeURIComponent);
  const [area, a, b] = parts;
  markActive();

  try {
    if (!area) return await viewHome();
    if (area === 'journal') return a ? await viewArticle(a) : await viewJournal();
    if (area === 'site' && a) return b ? await viewEntry(a, b) : await viewCollection(a);
    if (area === 'settings' && a) return await viewSettings(a);
    if (area === 'media') return await viewMedia();
    if (area === 'social') return a ? await viewCarousel(a) : await viewBoard();
    if (area === 'kit') {
      return a === 'accounts' ? await viewAccounts() : await viewKit(a || 'refs');
    }
    location.hash = '#/';
  } catch (e) {
    say(e.message, 'err');
  }
}

window.addEventListener('hashchange', () => {
  // leaving a half-written article should ask, and stay put if refused
  if (!confirmDiscard()) { history.forward(); return; }
  dirty = false;
  route();
});

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (!$('[data-view="article"]').hidden) saveArticle().catch((err) => say(err.message, 'err'));
    else if (!$('[data-view="entry"]').hidden) $('[data-entry-save]').click();
  }
  if (e.key === 'Escape') closeMenu();
});

/* ------------------------------------------------------------------- boot */

async function boot() {
  // this must throw when signed out, so the caller shows the gate — catching
  // it here would let an unauthenticated visitor straight through to setup
  const who = await api('/me');
  if (who?.name) me = who.name;
  $('[data-who]').textContent = me || '';

  // Reveal before rendering anything. A view built inside a hidden container
  // measures zero — the headline box sized itself to nothing on every reload
  // and the title became invisible — and that is true of any layout question
  // a view might ask, not just this one.
  gate.hidden = true;
  app.hidden = false;

  // a database with no tables is a deployment that is not finished, not an
  // error — offer to finish it rather than failing at the reader
  const setup = await api('/setup').catch(() => ({ bound: false, ready: false }));
  if (!setup.ready) {
    renderNav();
    return viewSetup(setup);
  }

  await ensureSchema();
  ({ articles } = await api('/articles'));
  // the badge is the only reason to ask on load; a pipeline that is not set
  // up yet must not stop the studio opening, so this failing is not fatal
  socialWaiting = await api('/carousels?status=review')
    .then((r) => r.carousels.length)
    .catch(() => 0);
  renderNav();
  await route();
}

// boot reveals the app itself, as soon as it knows who is signed in
boot().catch(() => showGate());

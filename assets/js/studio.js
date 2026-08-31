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
import { choosePicture, uploadImage, fileSize } from '/assets/js/picker.js?v=f337b82d38';

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
  renderNav();
  await route();
}

// boot reveals the app itself, as soon as it knows who is signed in
boot().catch(() => showGate());

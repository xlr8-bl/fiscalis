/**
 * studio.js — the CMS.
 *
 * Routed on the hash, so every screen has an address: the back button
 * works, a screen can be bookmarked, and on a phone the browser's own
 * back gesture does what you expect instead of leaving the studio.
 *
 *   #/journal              the articles
 *   #/journal/<slug>       one article
 *   #/site/<collection>    the work cards, services, stages, FAQs…
 *   #/site/<collection>/<slug>
 *   #/settings/<group>
 *   #/media
 *
 * The menu is built from the content model the API serves, so a new
 * collection appears in the navigation without a change here.
 */
import { renderMarkdown, countWords, readingMinutes } from '/assets/js/markdown.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};

const gate = $('[data-gate]');
const app = $('[data-app]');

let schema = null;
let me = null;
let articles = [];
let current = null;      // the article being edited
let entryCtx = null;     // the entry or settings group being edited
let dirty = false;

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
    group('Journal', [['#/journal', 'Articles', waiting || null]]) +
    (collections.length ? group('The site', collections) : '') +
    (settings.length ? group('Settings', settings) : '') +
    group('Library', [['#/media', 'Images']]);

  markActive();
}

function markActive() {
  const here = location.hash || '#/journal';
  $$('.st-nav__link').forEach((a) => {
    const on = here === a.getAttribute('href') || here.startsWith(a.getAttribute('href') + '/');
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

const row = ({ title, note, meta, onClick }) => {
  const li = document.createElement('li');
  li.innerHTML =
    `<button type="button" class="st-row">
       <span class="st-row__text">
         <span class="st-row__title">${escapeHtml(title)}</span>
         ${note ? `<span class="st-row__desc u-text-style-main">${escapeHtml(note)}</span>` : ''}
       </span>
       <span class="st-row__meta u-text-style-main">${
         (meta || []).map((m) => `<span>${escapeHtml(m)}</span>`).join('')
       }</span>
     </button>`;
  li.querySelector('button').addEventListener('click', onClick);
  return li;
};

/* --------------------------------------------------------- journal: list */

const ARTICLE_GROUPS = [
  { key: 'review', title: 'Waiting for you', note: 'Drafted by Spark. Nothing is live until you publish it.' },
  { key: 'draft', title: 'Drafts', note: '' },
  { key: 'published', title: 'Live', note: '' },
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

  const host = $('[data-list-body]');
  host.innerHTML = '';
  for (const g of ARTICLE_GROUPS) {
    const rows = articles.filter((a) => a.status === g.key);
    if (!rows.length) continue;
    const section = document.createElement('section');
    section.className = 'st-group';
    section.innerHTML =
      `<h2 class="st-group__head">${g.title} <span class="st-group__count">${rows.length}</span></h2>` +
      (g.note ? `<p class="st-note u-text-style-main">${g.note}</p>` : '') +
      '<ul class="st-rows"></ul>';
    const list = section.querySelector('.st-rows');
    for (const a of rows) {
      const by = a.status === 'published' ? (a.last_editor || a.author) : a.author;
      list.appendChild(row({
        title: a.title,
        note: a.description || 'No description yet.',
        meta: [fmtDate(a.published_at || String(a.updated_at || '').slice(0, 10)), by].filter(Boolean),
        onClick: () => { location.hash = `#/journal/${encodeURIComponent(a.slug)}`; },
      }));
    }
    host.appendChild(section);
  }
  if (!host.children.length) {
    host.innerHTML = '<p class="st-lede u-text-style-h4">Nothing here yet. Write the first one.</p>';
  }
  showView('list');
}

/* -------------------------------------------------------- journal: editor */

const field = (name) => $(`[data-f="${name}"]`);

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

  refreshArticle();
  showView('article');
}

async function viewArticle(slug) {
  if (slug === 'new') {
    fillArticle({ title: '', description: '', slug: '', tags: '', body: '', status: 'draft', author: me });
    field('title').focus();
    return;
  }
  const { article } = await api(`/articles/${encodeURIComponent(slug)}`);
  fillArticle(article);
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

$$('[data-f]').forEach((el) => el.addEventListener('input', () => { dirty = true; refreshArticle(); }));
$$('[data-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    const write = tab.dataset.tab === 'write';
    $$('[data-tab]').forEach((t) => t.classList.toggle('is-on', t === tab));
    field('body').hidden = !write;
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
  const saved = current?.slug
    ? await api(`/articles/${encodeURIComponent(current.slug)}`, { method: 'PUT', body: JSON.stringify(v) })
    : await api('/articles', { method: 'POST', body: JSON.stringify(v) });
  dirty = false;
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
    dirty = false;
    location.hash = '#/journal';
    say('Deleted.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

/* ------------------------------------------------------------- collections */

async function viewCollection(name) {
  await ensureSchema();
  const def = schema.collections[name];
  if (!def) { location.hash = '#/journal'; return; }

  const { entries } = await api(`/content/${name}`);

  $('[data-list-crumb]').textContent = 'The site';
  $('[data-list-title]').textContent = def.label;
  $('[data-list-lede]').textContent = def.note || '';
  $('[data-list-new]').hidden = false;
  $('[data-list-new-label]').textContent = `New ${def.singular.toLowerCase()}`;
  $('[data-list-new]').onclick = () => { location.hash = `#/site/${name}/new`; };

  const host = $('[data-list-body]');
  host.innerHTML = '<ul class="st-rows"></ul>';
  const list = host.querySelector('.st-rows');

  entries.forEach((e, i) => {
    list.appendChild(row({
      title: e.data[def.titleField] || '(untitled)',
      note: e.status === 'published' ? '' : 'Hidden from the site',
      meta: [String(i + 1)],
      onClick: () => { location.hash = `#/site/${name}/${encodeURIComponent(e.slug)}`; },
    }));
  });

  if (!entries.length) {
    host.innerHTML = `<p class="st-lede u-text-style-h4">Nothing here yet.</p>`;
  }
  showView('list');
}

function fieldHtml(f, value) {
  const id = `f-${f.name.replace(/\W/g, '-')}`;
  const help = f.help ? `<p class="st-note u-text-style-main">${escapeHtml(f.help)}</p>` : '';
  const val = escapeHtml(value ?? '');
  const control =
    f.type === 'textarea' || f.type === 'markdown'
      ? `<textarea id="${id}" class="st-input st-input--area" data-field="${f.name}" rows="${f.type === 'markdown' ? 8 : 3}">${val}</textarea>`
      : `<input id="${id}" class="st-input" data-field="${f.name}" type="text" value="${val}"` +
        (f.type === 'media' ? ' placeholder="/media/… or assets/stock/…"' : '') +
        (f.type === 'url' ? ' placeholder="https://…"' : '') + '>';
  return `<div class="st-field"><label class="st-label u-text-style-main" for="${id}">${escapeHtml(f.label)}</label>${help}${control}</div>`;
}

async function viewEntry(name, slug) {
  await ensureSchema();
  const def = schema.collections[name];
  if (!def) { location.hash = '#/journal'; return; }

  let entry = null;
  if (slug !== 'new') ({ entry } = await api(`/content/${name}/${encodeURIComponent(slug)}`));
  entryCtx = { collection: name, slug: slug === 'new' ? null : slug, def };

  $('[data-entry-crumb]').textContent = def.label;
  $('[data-entry-back]').onclick = () => { location.hash = `#/site/${name}`; };
  $('[data-entry-heading]').textContent =
    entry ? (entry.data[def.titleField] || def.singular) : `New ${def.singular.toLowerCase()}`;
  $('[data-entry-note]').textContent = def.note || '';
  $('[data-entry-form]').innerHTML = def.fields.map((f) => fieldHtml(f, entry?.data?.[f.name])).join('');

  const live = entry?.status === 'published';
  $('[data-entry-hide]').hidden = !entry || !live;
  $('[data-entry-show]').hidden = !entry || live;
  $('[data-entry-delete]').hidden = !entry;
  showView('entry');
}

async function viewSettings(groupName) {
  await ensureSchema();
  const group = schema.settings.find((g) => g.group === groupName);
  if (!group) { location.hash = '#/journal'; return; }

  const { settings } = await api('/content/settings');
  entryCtx = { settings: true, group };

  $('[data-entry-crumb]').textContent = 'Settings';
  $('[data-entry-back]').onclick = () => { location.hash = '#/journal'; };
  $('[data-entry-heading]').textContent = group.group;
  $('[data-entry-note]').textContent = '';
  $('[data-entry-form]').innerHTML = group.fields.map((f) => fieldHtml(f, settings[f.name])).join('');
  $('[data-entry-hide]').hidden = true;
  $('[data-entry-show]').hidden = true;
  $('[data-entry-delete]').hidden = true;
  showView('entry');
}

const entryValues = () =>
  Object.fromEntries($$('[data-field]', $('[data-entry-form]')).map((el) => [el.dataset.field, el.value]));

$('[data-entry-save]').addEventListener('click', async () => {
  if (!entryCtx) return;
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
      history.replaceState(null, '', `#/site/${entryCtx.collection}/${created.slug}`);
      entryCtx.slug = created.slug;
    }
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
    location.hash = `#/site/${entryCtx.collection}`;
    say('Deleted.', 'ok');
  } catch (e) { say(e.message, 'err'); }
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
    say(`Done — ${r.counts.articles} articles, ${r.counts.entries} items, ${r.counts.settings} settings.`, 'ok');
    schema = null;
    await boot();
  } catch (e) { say(e.message, 'err'); }
});

/* ------------------------------------------------------------------ media */

async function viewMedia() {
  showView('media');
  try {
    const { media } = await api('/media');
    $('[data-media]').innerHTML = media.length
      ? media.map((m) =>
          `<li class="st-media__item">
             <img src="/media/${escapeHtml(m.key)}" alt="" loading="lazy">
             <code>/media/${escapeHtml(m.key)}</code>
           </li>`).join('')
      : '<li class="st-note u-text-style-main">Nothing uploaded yet.</li>';
  } catch (e) {
    $('[data-media]').innerHTML = `<li class="st-note u-text-style-main">${escapeHtml(e.message)}</li>`;
  }
}

$('[data-upload]').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  say('Uploading…');
  try {
    const { url } = await api('/media', { method: 'POST', body: form });
    await navigator.clipboard?.writeText(url).catch(() => {});
    say('Uploaded. The path is on your clipboard.', 'ok');
    viewMedia();
  } catch (err) { say(err.message, 'err'); }
  e.target.value = '';
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
  if (!location.hash) { history.replaceState(null, '', '#/journal'); }
  const parts = (location.hash.replace(/^#\/?/, '') || 'journal').split('/').map(decodeURIComponent);
  const [area, a, b] = parts;
  markActive();

  try {
    if (area === 'journal') return a ? await viewArticle(a) : await viewJournal();
    if (area === 'site' && a) return b ? await viewEntry(a, b) : await viewCollection(a);
    if (area === 'settings' && a) return await viewSettings(a);
    if (area === 'media') return await viewMedia();
    location.hash = '#/journal';
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

  // a database with no tables is a deployment that is not finished, not an
  // error — offer to finish it rather than failing at the reader
  const setup = await api('/setup').catch(() => ({ bound: false, ready: false }));
  if (!setup.ready) {
    gate.hidden = true;
    app.hidden = false;
    renderNav();
    return viewSetup(setup);
  }

  await ensureSchema();
  ({ articles } = await api('/articles'));
  renderNav();
  await route();
}

boot()
  .then(() => { gate.hidden = true; app.hidden = false; })
  .catch(() => showGate());

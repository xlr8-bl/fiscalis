/**
 * studio.js — the CMS front end.
 *
 * Talks to /api/studio/*. The live preview renders through the same parser
 * the Worker uses, so what you see is what publishes.
 */
import { renderMarkdown, countWords, readingMinutes } from '/assets/js/markdown.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const gate = $('[data-gate]');
const app = $('[data-app]');
const itemsEl = $('[data-items]');
const editor = $('[data-editor]');
const emptyEl = $('[data-empty]');
const statusEl = $('[data-status]');

let articles = [];
let current = null;      // the row being edited
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
  if (res.status === 401) { showGate(); throw new Error('Not signed in.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let sayTimer = null;
function say(message, tone = '') {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
  clearTimeout(sayTimer);
  if (message) sayTimer = setTimeout(() => { statusEl.textContent = ''; }, 4000);
}

function showGate() {
  gate.hidden = false;
  app.hidden = true;
}

/* ------------------------------------------------------------------- auth */

$('[data-login]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('[data-login-status]');
  out.textContent = 'Checking…';
  try {
    await api('/login', { method: 'POST', body: JSON.stringify({ password: $('#st-pw').value }) });
    out.textContent = '';
    gate.hidden = true;
    app.hidden = false;
    await load();
  } catch (err) {
    out.textContent = err.message;
  }
});

$('[data-logout]').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

/* ------------------------------------------------------------------- list */

const STATUS_LABEL = { draft: 'Draft', review: 'From Spark', published: 'Live' };

function renderList() {
  $('[data-count]').textContent =
    `${articles.filter((a) => a.status === 'published').length} live · ${articles.length} total`;

  itemsEl.innerHTML = '';
  for (const a of articles) {
    const li = document.createElement('li');
    li.className = 'st-item';
    if (current && a.slug === current.slug) li.classList.add('is-on');
    li.innerHTML =
      `<button type="button" class="st-item__btn">
         <span class="st-item__title">${escapeHtml(a.title)}</span>
         <span class="st-item__meta">
           <span class="st-pill is-${a.status}">${STATUS_LABEL[a.status] || a.status}</span>
           <span>${a.published_at || String(a.updated_at || '').slice(0, 10)}</span>
         </span>
       </button>`;
    li.querySelector('button').addEventListener('click', () => open(a.slug));
    itemsEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function load() {
  const data = await api('/articles');
  articles = data.articles || [];
  renderList();
}

/* ----------------------------------------------------------------- editor */

const field = (name) => $(`[data-f="${name}"]`);

function fill(row) {
  current = row;
  dirty = false;
  for (const name of ['title', 'description', 'slug', 'tags', 'body']) {
    field(name).value = row[name] ?? '';
  }
  $('[data-pill]').textContent = STATUS_LABEL[row.status] || row.status;
  $('[data-pill]').className = `st-pill is-${row.status}`;
  $('[data-slug-display]').textContent = row.slug ? `/journal/${row.slug}` : '';

  const live = row.status === 'published';
  $('[data-publish]').hidden = live;
  $('[data-unpublish]').hidden = !live;
  // a live URL is permanent; renaming it discards the ranking it earned
  field('slug').disabled = live;
  $('[data-view]').href = live ? `/journal/${row.slug}` : `/journal/${row.slug}?preview=1`;
  $('[data-view]').hidden = !row.slug;
  $('[data-delete]').hidden = !row.slug;

  editor.hidden = false;
  emptyEl.hidden = true;
  updateCounts();
  renderPreview();
  renderList();
}

async function open(slug) {
  if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
  const { article } = await api(`/articles/${encodeURIComponent(slug)}`);
  fill(article);
}

$('[data-new]').addEventListener('click', () => {
  if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
  fill({ title: '', description: '', slug: '', tags: '', body: '', status: 'draft' });
  field('title').focus();
});

function updateCounts() {
  const parsed = renderMarkdown(field('body').value);
  const words = countWords(parsed);
  $('[data-words]').textContent = words ? `${words} words · ${readingMinutes(words)} min` : '';
  const desc = field('description').value.length;
  $('[data-desc-count]').textContent = desc;
  $('.st-meter').dataset.over = desc > 160 ? 'true' : 'false';
}

function renderPreview() {
  const box = $('[data-preview]');
  if (box.hidden) return;
  const parsed = renderMarkdown(field('body').value);
  box.innerHTML =
    `<h1 class="st-preview__title">${escapeHtml(field('title').value || 'Untitled')}</h1>` +
    `<p class="st-preview__lede">${escapeHtml(field('description').value)}</p>` +
    (parsed.intro ? `<div class="st-preview__prose">${parsed.intro}</div>` : '') +
    parsed.sections
      .map(
        (s) =>
          `<h2 class="st-preview__h2">${escapeHtml(s.title)}</h2>` +
          `<div class="st-preview__prose">${s.html}</div>`
      )
      .join('');
}

$$('[data-f]').forEach((el) =>
  el.addEventListener('input', () => {
    dirty = true;
    updateCounts();
    renderPreview();
  })
);

$$('[data-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    const write = tab.dataset.tab === 'write';
    $$('[data-tab]').forEach((t) => t.classList.toggle('is-on', t === tab));
    field('body').hidden = !write;
    $('[data-preview]').hidden = write;
    renderPreview();
  })
);

/* ---------------------------------------------------------------- actions */

function values() {
  return {
    title: field('title').value.trim(),
    description: field('description').value.trim(),
    slug: field('slug').value.trim(),
    tags: field('tags').value.trim(),
    body: field('body').value,
  };
}

async function save() {
  const v = values();
  if (!v.title) { say('A title is required.', 'err'); return null; }
  say('Saving…');
  const saved = current?.slug
    ? await api(`/articles/${encodeURIComponent(current.slug)}`, {
        method: 'PUT', body: JSON.stringify(v),
      })
    : await api('/articles', { method: 'POST', body: JSON.stringify(v) });
  dirty = false;
  await load();
  const { article } = await api(`/articles/${encodeURIComponent(saved.slug)}`);
  fill(article);
  say('Saved.', 'ok');
  return article;
}

$('[data-save]').addEventListener('click', () => save().catch((e) => say(e.message, 'err')));

$('[data-publish]').addEventListener('click', async () => {
  try {
    const article = (dirty || !current?.slug) ? await save() : current;
    if (!article) return;
    if (!confirm(`Publish "${article.title}"?\n\nIt goes live at /journal/${article.slug} and into the sitemap.`)) return;
    await api(`/articles/${encodeURIComponent(article.slug)}/publish`, { method: 'POST' });
    await load();
    const { article: fresh } = await api(`/articles/${encodeURIComponent(article.slug)}`);
    fill(fresh);
    say('Published.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-unpublish]').addEventListener('click', async () => {
  if (!confirm('Take this off the site? The URL will 404.')) return;
  try {
    await api(`/articles/${encodeURIComponent(current.slug)}/unpublish`, { method: 'POST' });
    await load();
    const { article } = await api(`/articles/${encodeURIComponent(current.slug)}`);
    fill(article);
    say('Unpublished.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-delete]').addEventListener('click', async () => {
  if (!confirm(`Delete "${current.title}" permanently?`)) return;
  try {
    await api(`/articles/${encodeURIComponent(current.slug)}`, { method: 'DELETE' });
    current = null;
    editor.hidden = true;
    emptyEl.hidden = false;
    await load();
    say('Deleted.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

/* ------------------------------------------------------------------ media */

$('[data-upload]').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const form = new FormData();
  form.append('file', file);
  say('Uploading…');
  try {
    const { url } = await api('/media', { method: 'POST', body: form });
    await navigator.clipboard?.writeText(`![](${url})`).catch(() => {});
    say('Uploaded — markdown copied to the clipboard.', 'ok');
    loadMedia();
  } catch (err) { say(err.message, 'err'); }
  e.target.value = '';
});

async function loadMedia() {
  try {
    const { media } = await api('/media');
    $('[data-media]').innerHTML = media
      .map((m) => `<li><code>![](/media/${escapeHtml(m.key)})</code></li>`)
      .join('');
  } catch { /* the panel is optional */ }
}
$('.st-media').addEventListener('toggle', (e) => { if (e.target.open) loadMedia(); });

/* ------------------------------------------------------------------- boot */

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (!editor.hidden) save().catch((err) => say(err.message, 'err'));
  }
});

// a valid cookie means straight in; otherwise the gate
load()
  .then(() => { gate.hidden = true; app.hidden = false; })
  .catch(() => showGate());

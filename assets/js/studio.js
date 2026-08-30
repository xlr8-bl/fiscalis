/**
 * studio.js — where the journal gets written.
 *
 * Two views: an index of everything grouped by status, and an editor. The
 * preview renders through the same parser the live page uses, laid out the
 * same way, so what you see is what publishes.
 */
import { renderMarkdown, countWords, readingMinutes } from '/assets/js/markdown.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const gate = $('[data-gate]');
const app = $('[data-app]');
const indexView = $('[data-index]');
const editor = $('[data-editor]');
const statusEl = $('[data-status]');

let articles = [];
let current = null;
let dirty = false;
let me = null;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
  clearTimeout(sayTimer);
  if (message) sayTimer = setTimeout(() => { statusEl.textContent = ''; }, 5000);
}

function showGate() { gate.hidden = false; app.hidden = true; }

function showIndex() {
  current = null;
  dirty = false;
  editor.hidden = true;
  indexView.hidden = false;
  window.scrollTo(0, 0);
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
    await load();
  } catch (err) {
    out.textContent = err.message;
  }
});

$('[data-logout]').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

/* ------------------------------------------------------------------ index */

// Status is a group heading rather than a badge on every row: quieter, and
// it answers "what needs me" before you read a single title.
const GROUPS = [
  { key: 'review', title: 'Waiting for you', note: 'Drafted by Spark. Nothing is live until you publish it.' },
  { key: 'draft', title: 'Drafts', note: '' },
  { key: 'published', title: 'Live', note: '' },
];

function renderIndex() {
  const live = articles.filter((a) => a.status === 'published').length;
  const waiting = articles.filter((a) => a.status === 'review').length;
  $('[data-summary]').textContent = waiting
    ? `${waiting} waiting for you, ${live} live.`
    : `${live} article${live === 1 ? '' : 's'} live.`;

  const host = $('[data-groups]');
  host.innerHTML = '';

  for (const group of GROUPS) {
    const rows = articles.filter((a) => a.status === group.key);
    if (!rows.length) continue;

    const section = document.createElement('section');
    section.className = 'st-group';
    section.innerHTML =
      `<h2 class="st-group__head">${group.title} <span class="st-group__count">${rows.length}</span></h2>` +
      (group.note ? `<p class="st-note u-text-style-main">${group.note}</p>` : '') +
      '<ul class="st-rows"></ul>';

    const list = section.querySelector('.st-rows');
    for (const a of rows) {
      const by = a.status === 'published'
        ? (a.last_editor || a.author || '')
        : (a.author || '');
      const when = a.published_at || String(a.updated_at || '').slice(0, 10);

      const li = document.createElement('li');
      li.innerHTML =
        `<button type="button" class="st-row">
           <span class="st-row__text">
             <span class="st-row__title">${escapeHtml(a.title)}</span>
             <span class="st-row__desc u-text-style-main">${escapeHtml(a.description || 'No description yet.')}</span>
           </span>
           <span class="st-row__meta u-text-style-main">
             <span>${fmtDate(when)}</span>
             ${by ? `<span>${escapeHtml(by)}</span>` : ''}
           </span>
         </button>`;
      li.querySelector('button').addEventListener('click', () => open(a.slug));
      list.appendChild(li);
    }
    host.appendChild(section);
  }

  if (!host.children.length) {
    host.innerHTML =
      '<p class="u-text-style-h5" style="color:var(--swatch--black-50)">Nothing here yet. Write the first one.</p>';
  }
}

async function load() {
  const [{ articles: rows }, who] = await Promise.all([
    api('/articles'),
    api('/me').catch(() => null),
  ]);
  articles = rows || [];
  if (who?.name) me = who.name;
  $('[data-who]').textContent = me ? `Signed in as ${me}` : '';
  renderIndex();
}

/* ----------------------------------------------------------------- editor */

const field = (name) => $(`[data-f="${name}"]`);

function fill(row) {
  current = row;
  dirty = false;
  for (const name of ['title', 'description', 'slug', 'tags', 'body']) {
    field(name).value = row[name] ?? '';
  }

  const live = row.status === 'published';
  const parts = [];
  if (live) parts.push(`Live since ${fmtDate(row.published_at)}`);
  else if (row.status === 'review') parts.push('Drafted by Spark, waiting for you');
  else if (row.slug) parts.push('Draft');
  else parts.push('New article');
  if (row.author) parts.push(`written by ${row.author}`);
  if (row.last_editor && row.last_editor !== row.author) parts.push(`last edited by ${row.last_editor}`);
  $('[data-meta]').textContent = parts.join(' · ');

  $('[data-publish]').hidden = live;
  $('[data-unpublish]').hidden = !live;
  field('slug').disabled = live;
  $('[data-slug-note]').textContent = live
    ? 'Locked. Renaming a live article throws away the ranking it earned.'
    : 'Becomes /journal/… — it is permanent once published.';
  $('[data-view]').href = live ? `/journal/${row.slug}` : `/journal/${row.slug}?preview=1`;
  $('[data-view]').hidden = !row.slug;
  $('[data-delete]').hidden = !row.slug;

  indexView.hidden = true;
  editor.hidden = false;
  window.scrollTo(0, 0);
  refresh();
}

async function open(slug) {
  if (!confirmDiscard()) return;
  try {
    const { article } = await api(`/articles/${encodeURIComponent(slug)}`);
    fill(article);
  } catch (e) { say(e.message, 'err'); }
}

const confirmDiscard = () =>
  !dirty || confirm('You have unsaved changes. Leave without saving?');

$('[data-back]').addEventListener('click', () => { if (confirmDiscard()) showIndex(); });

$('[data-new]').addEventListener('click', () => {
  fill({ title: '', description: '', slug: '', tags: '', body: '', status: 'draft', author: me });
  field('title').focus();
});

/** Word count, description length, and the preview if it is showing. */
function refresh() {
  const parsed = renderMarkdown(field('body').value);
  const words = countWords(parsed);

  const desc = field('description').value.length;
  const note = $('[data-desc-note]');
  if (!desc) {
    note.textContent = 'Required before publishing.';
    note.dataset.tone = '';
  } else if (desc > 160) {
    note.textContent = `${desc} characters — Google will cut it off around 160.`;
    note.dataset.tone = 'warn';
  } else {
    note.textContent = `${desc} of about 160 characters.`;
    note.dataset.tone = '';
  }

  if (current && words) {
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
      .map(
        (s) =>
          '<div class="st-preview__row">' +
          `<h2 class="st-preview__h2">${escapeHtml(s.title)}</h2>` +
          `<div class="st-preview__prose">${s.html}</div></div>`
      )
      .join('');
}

$$('[data-f]').forEach((el) =>
  el.addEventListener('input', () => { dirty = true; refresh(); })
);

$$('[data-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    const write = tab.dataset.tab === 'write';
    $$('[data-tab]').forEach((t) => t.classList.toggle('is-on', t === tab));
    field('body').hidden = !write;
    $('[data-preview]').hidden = write;
    refresh();
  })
);

/* ---------------------------------------------------------------- actions */

const values = () => ({
  title: field('title').value.trim(),
  description: field('description').value.trim(),
  slug: field('slug').value.trim(),
  tags: field('tags').value.trim(),
  body: field('body').value,
});

async function save({ quiet = false } = {}) {
  const v = values();
  if (!v.title) { say('It needs a title first.', 'err'); return null; }
  if (!quiet) say('Saving…');

  const saved = current?.slug
    ? await api(`/articles/${encodeURIComponent(current.slug)}`, { method: 'PUT', body: JSON.stringify(v) })
    : await api('/articles', { method: 'POST', body: JSON.stringify(v) });

  dirty = false;
  const { article } = await api(`/articles/${encodeURIComponent(saved.slug)}`);
  const { articles: rows } = await api('/articles');
  articles = rows || [];
  fill(article);
  if (!quiet) say('Saved.', 'ok');
  return article;
}

$('[data-save]').addEventListener('click', () => save().catch((e) => say(e.message, 'err')));

$('[data-publish]').addEventListener('click', async () => {
  try {
    const article = (dirty || !current?.slug) ? await save({ quiet: true }) : current;
    if (!article) return;
    if (!confirm(`Publish "${article.title}"?\n\nIt goes live at /journal/${article.slug} and into the sitemap.`)) return;
    await api(`/articles/${encodeURIComponent(article.slug)}/publish`, { method: 'POST' });
    const { article: fresh } = await api(`/articles/${encodeURIComponent(article.slug)}`);
    const { articles: rows } = await api('/articles');
    articles = rows || [];
    fill(fresh);
    say('Published. It is live and in the sitemap.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-unpublish]').addEventListener('click', async () => {
  if (!confirm('Take this off the site? The URL will stop working.')) return;
  try {
    await api(`/articles/${encodeURIComponent(current.slug)}/unpublish`, { method: 'POST' });
    const { article } = await api(`/articles/${encodeURIComponent(current.slug)}`);
    const { articles: rows } = await api('/articles');
    articles = rows || [];
    fill(article);
    say('Taken offline.', 'ok');
  } catch (e) { say(e.message, 'err'); }
});

$('[data-delete]').addEventListener('click', async () => {
  if (!confirm(`Delete "${current.title}" permanently? This cannot be undone.`)) return;
  try {
    await api(`/articles/${encodeURIComponent(current.slug)}`, { method: 'DELETE' });
    await load();
    showIndex();
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
    const snippet = `![](${url})`;
    await navigator.clipboard?.writeText(snippet).catch(() => {});
    say('Uploaded. The markdown is on your clipboard.', 'ok');
    loadMedia();
  } catch (err) { say(err.message, 'err'); }
  e.target.value = '';
});

async function loadMedia() {
  try {
    const { media } = await api('/media');
    $('[data-media]').innerHTML = media.length
      ? media.map((m) => `<li><code>![](/media/${escapeHtml(m.key)})</code></li>`).join('')
      : '<li class="st-note">Nothing uploaded yet.</li>';
  } catch { /* the panel is optional */ }
}
$('.st-images').addEventListener('toggle', (e) => { if (e.target.open) loadMedia(); });

/* ------------------------------------------------------------------- boot */

window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (!editor.hidden) save().catch((err) => say(err.message, 'err'));
  }
  if (e.key === 'Escape' && !editor.hidden && confirmDiscard()) showIndex();
});

// a valid cookie means straight in; otherwise the gate
load()
  .then(() => { gate.hidden = true; app.hidden = false; })
  .catch(() => showGate());

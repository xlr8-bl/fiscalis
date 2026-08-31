/**
 * picker.js — choosing a picture, and putting one there.
 *
 * Every image field and the editor's picture button open the same dialog,
 * so a path is never typed by hand. Typing one is how you get a live page
 * pointing at a file that does not exist.
 *
 * Dimensions are read here, in the browser, before the bytes are sent. The
 * image has to be decoded anyway to show the preview, and this is the only
 * place in the stack where the pixels are already in hand — the Worker would
 * have to decode a JPEG by hand to learn the same thing.
 */

const $ = (sel, root = document) => root.querySelector(sel);
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const fileSize = (n) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB`
  : n >= 1024 ? `${Math.round(n / 1024)} KB`
  : `${n || 0} B`;

/** Natural size, or zeros if the browser will not decode it. */
export function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    img.src = url;
  });
}

/**
 * @param {File} file
 * @param {{alt?: string, api: Function}} options
 */
export async function uploadImage(file, { alt = '', api }) {
  const { width, height } = await readImageSize(file);
  const form = new FormData();
  form.append('file', file);
  form.append('width', String(width));
  form.append('height', String(height));
  form.append('alt', alt);
  return api('/media', { method: 'POST', body: form });
}

/* ----------------------------------------------------------------- dialog */

let dialog = null;
let state = null;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'st-picker';
  dialog.innerHTML = `
    <form method="dialog" class="st-picker__head">
      <h2 class="st-picker__title">Pictures</h2>
      <button class="st-link" value="cancel" type="submit">Close</button>
    </form>

    <div class="st-picker__bar">
      <input class="st-input st-picker__search" type="search" placeholder="Search by name"
             aria-label="Search pictures" data-search>
      <label class="st-link st-picker__upload">
        Upload
        <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden data-upload>
      </label>
    </div>

    <p class="st-note u-text-style-main" data-picker-status role="status"></p>
    <div class="st-picker__grid" data-grid></div>

    <div class="st-picker__foot" hidden data-chosen-row>
      <div class="st-field st-picker__caption">
        <label class="st-label u-text-style-main" for="st-pick-caption">Caption</label>
        <p class="st-note u-text-style-main">Optional. Printed under the picture.</p>
        <input id="st-pick-caption" class="st-input" data-caption placeholder="Leave empty for none">
      </div>
      <button class="g_btn_main st-picker__insert" type="button" data-insert>
        <div class="g_btn_text_contain"><div class="g_btn_text u-text-style-small u-text-trim-off">Use this one</div></div>
        <div class="g_btn_aside_wrap"><div class="g_btn_aside_bg"></div></div>
      </button>
    </div>`;
  document.body.appendChild(dialog);

  dialog.addEventListener('close', () => {
    state?.resolve(dialog.returnValue === 'chosen' ? state.chosen : null);
    state = null;
  });

  $('[data-search]', dialog).addEventListener('input', paint);

  $('[data-grid]', dialog).addEventListener('click', (e) => {
    const cell = e.target.closest('[data-key]');
    if (!cell) return;
    state.chosen = state.items.find((m) => m.key === cell.dataset.key) || null;
    state.chosen = state.chosen && {
      ...state.chosen,
      url: `/media/${state.chosen.key}`,
    };
    paint();
  });

  $('[data-insert]', dialog).addEventListener('click', () => {
    if (!state?.chosen) return;
    state.chosen.caption = $('[data-caption]', dialog).value.trim();
    dialog.close('chosen');
  });

  $('[data-upload]', dialog).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const status = $('[data-picker-status]', dialog);
    status.textContent = 'Uploading…';
    try {
      const created = await uploadImage(file, { api: state.api });
      status.textContent = '';
      state.items = (await state.api('/media')).media || [];
      state.chosen = { ...state.items.find((m) => m.key === created.key), url: created.url };
      paint();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

function paint() {
  const term = $('[data-search]', dialog).value.trim().toLowerCase();
  const items = term
    ? state.items.filter((m) =>
        `${m.filename} ${m.alt || ''} ${m.key}`.toLowerCase().includes(term))
    : state.items;

  $('[data-grid]', dialog).innerHTML = items.length
    ? items
        .map((m) => {
          const on = state.chosen?.key === m.key;
          const size = m.width && m.height ? `${m.width}×${m.height}` : fileSize(m.bytes);
          return `<button type="button" class="st-picker__cell${on ? ' is-on' : ''}" data-key="${escapeHtml(m.key)}"
                    aria-pressed="${on}">
                    <img src="/media/${escapeHtml(m.key)}" alt="" loading="lazy">
                    <span class="st-picker__name">${escapeHtml(m.alt || m.filename)}</span>
                    <span class="st-picker__size u-text-style-main">${size}</span>
                  </button>`;
        })
        .join('')
    : `<p class="st-note u-text-style-main">${
        state.items.length ? 'Nothing matches that.' : 'No pictures yet. Upload one.'
      }</p>`;

  const row = $('[data-chosen-row]', dialog);
  row.hidden = !state.chosen;
  if (state.chosen) $('[data-caption]', dialog).placeholder = 'Leave empty for none';
}

/**
 * Open it and wait.
 *
 * @param {{api: Function}} options
 * @returns {Promise<null|{url:string, alt:string, caption:string, width:number, height:number}>}
 */
export async function choosePicture({ api }) {
  if (!dialog) build();
  const status = $('[data-picker-status]', dialog);
  $('[data-search]', dialog).value = '';
  $('[data-caption]', dialog).value = '';
  status.textContent = 'Loading…';

  return new Promise(async (resolve) => {
    state = { api, items: [], chosen: null, resolve };
    dialog.returnValue = '';
    dialog.showModal();
    try {
      state.items = (await api('/media')).media || [];
      status.textContent = '';
    } catch (e) {
      status.textContent = e.message;
    }
    if (state) paint();
  });
}

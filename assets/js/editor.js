/**
 * editor.js — the formatting bar, over a plain textarea.
 *
 * Markdown stays the stored format. It is what the agent writes, what the
 * renderer reads, and what a person can still read years from now if all of
 * this is gone. What was missing was never the format; it was having to know
 * it. So this is a toolbar and a set of shortcuts over the text, not a
 * rich-text surface pretending the markup is not there.
 *
 * A textarea also keeps the things contenteditable quietly breaks: the
 * browser's own undo stack, spellcheck, autocorrect, dictation, and select
 * on a phone. Edits go through execCommand where it exists precisely so that
 * undo still works afterwards.
 *
 * Attach it to anything:
 *
 *     attachEditor(textarea, { pickImage })   // full bar
 *     attachEditor(textarea, { compact: true })  // inline fields
 */

const SVG = (d, extra = '') =>
  `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" class="st-tool__icon"${extra}>${d}</svg>`;

const STROKE = 'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';

const ICON = {
  link: SVG(`<path d="M6.5 9.5a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-.8.8" ${STROKE}/>
             <path d="M9.5 6.5a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l.8-.8" ${STROKE}/>`),
  quote: SVG(`<path d="M6 5.5C4.6 6.2 3.8 7.4 3.8 8.9c0 1.1.7 1.8 1.6 1.8.8 0 1.5-.6 1.5-1.5
              0-.8-.6-1.4-1.3-1.4-.1 0-.3 0-.4.1.2-.7.7-1.3 1.4-1.7L6 5.5Z" fill="currentColor"/>
             <path d="M11.2 5.5c-1.4.7-2.2 1.9-2.2 3.4 0 1.1.7 1.8 1.6 1.8.8 0 1.5-.6 1.5-1.5
              0-.8-.6-1.4-1.3-1.4-.1 0-.3 0-.4.1.2-.7.7-1.3 1.4-1.7l-.6-.7Z" fill="currentColor"/>`),
  bullet: SVG(`<path d="M6 4.5h7M6 8h7M6 11.5h7" ${STROKE}/>
               <circle cx="3.2" cy="4.5" r="1" fill="currentColor"/>
               <circle cx="3.2" cy="8" r="1" fill="currentColor"/>
               <circle cx="3.2" cy="11.5" r="1" fill="currentColor"/>`),
  number: SVG(`<path d="M6.5 4.5h6.5M6.5 8h6.5M6.5 11.5h6.5" ${STROKE}/>
               <path d="M2.4 3.6l.9-.5v2.6M2.2 7.2h1.7L2.2 9.5h1.9M2.2 10.6h1.7l-1 1.2h.2c.5 0 .9.3.9.8
                s-.4.8-.9.8c-.4 0-.7-.1-.9-.4" ${STROKE}/>`),
  image: SVG(`<rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1" ${STROKE}/>
              <circle cx="5.9" cy="6.4" r="1.1" fill="currentColor"/>
              <path d="M2.6 11.2l3-3 2.3 2.3 2-2 3.4 3.4" ${STROKE}/>`),
  code: SVG(`<path d="M5.6 5.2L2.8 8l2.8 2.8M10.4 5.2L13.2 8l-2.8 2.8M9.2 3.6l-2.4 8.8" ${STROKE}/>`),
};

/** Nothing here is a chip or a boxed panel; the letterform is the button. */
const TOOLS = [
  { id: 'h2', label: 'H2', title: 'Section heading', kind: 'line', marker: '## ', heading: true },
  { id: 'h3', label: 'H3', title: 'Sub-heading', kind: 'line', marker: '### ', heading: true },
  { id: 'bold', label: 'B', title: 'Bold  (Ctrl B)', kind: 'wrap', open: '**', close: '**', cls: 'is-bold' },
  { id: 'italic', label: 'I', title: 'Italic  (Ctrl I)', kind: 'wrap', open: '*', close: '*', cls: 'is-italic' },
  { id: 'link', icon: ICON.link, title: 'Link  (Ctrl K)', kind: 'link' },
  { id: 'quote', icon: ICON.quote, title: 'Pulled line', kind: 'line', marker: '> ' },
  { id: 'bullet', icon: ICON.bullet, title: 'List', kind: 'line', marker: '- ' },
  { id: 'number', icon: ICON.number, title: 'Numbered list', kind: 'line', numbered: true },
  { id: 'image', icon: ICON.image, title: 'Picture', kind: 'image' },
  { id: 'code', icon: ICON.code, title: 'Code', kind: 'wrap', open: '`', close: '`' },
];

/** The short bar for one-line and small fields: emphasis and links only. */
const COMPACT = new Set(['bold', 'italic', 'link']);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LIST_LINE = /^(\s*)([-*]|\d+\.)(\s+)(.*)$/;
const HEADING_LINE = /^#{2,4}\s+/;

/* ------------------------------------------------------------------ edits */

/**
 * Replace a range, keeping the browser's undo history.
 *
 * execCommand is deprecated and still the only way to write into a textarea
 * such that Ctrl-Z afterwards undoes one edit rather than everything since
 * the page loaded. setRangeText is the correct API and clears the stack, so
 * it is the fallback rather than the default.
 */
function replaceRange(ta, start, end, text) {
  ta.focus();
  ta.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = text === ''
      ? document.execCommand('delete')
      : document.execCommand('insertText', false, text);
  } catch { ok = false; }
  if (!ok) {
    ta.setRangeText(text, start, end, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** The full lines the selection touches, and where they start and end. */
function lineSpan(ta) {
  const v = ta.value;
  const start = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let end = v.indexOf('\n', ta.selectionEnd);
  if (end === -1) end = v.length;
  // a selection ending exactly at a line start should not pull in the next line
  if (ta.selectionEnd > start && v[ta.selectionEnd - 1] === '\n' && ta.selectionEnd - 1 >= start) {
    end = ta.selectionEnd - 1;
  }
  return { start, end, lines: v.slice(start, end).split('\n') };
}

function wrap(ta, open, close) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e);

  // already wrapped, just outside the selection — take it off
  if (v.slice(s - open.length, s) === open && v.slice(e, e + close.length) === close) {
    replaceRange(ta, s - open.length, e + close.length, sel);
    ta.setSelectionRange(s - open.length, e - open.length);
    return;
  }
  // already wrapped, inside the selection — take it off
  if (sel.length >= open.length + close.length && sel.startsWith(open) && sel.endsWith(close)) {
    const inner = sel.slice(open.length, sel.length - close.length);
    replaceRange(ta, s, e, inner);
    ta.setSelectionRange(s, s + inner.length);
    return;
  }
  replaceRange(ta, s, e, open + sel + close);
  // with nothing selected, sit between the markers ready to type
  if (s === e) ta.setSelectionRange(s + open.length, s + open.length);
  else ta.setSelectionRange(s + open.length, e + open.length);
}

function prefix(ta, { marker, numbered, heading }) {
  const { start, end, lines } = lineSpan(ta);
  const re = numbered ? /^\s*\d+\.\s+/ : new RegExp(`^\\s*${escapeRe(marker.trim())}\\s+`);
  const filled = lines.filter((l) => l.trim());
  const on = filled.length > 0 && filled.every((l) => re.test(l));

  let n = 0;
  const next = lines.map((line) => {
    if (!line.trim()) return line;
    // a line only ever carries one block marker, so clear any other first
    const bare = line.replace(/^\s*(?:#{2,4}|>|[-*]|\d+\.)\s+/, '');
    if (on) return bare;
    if (heading && re.test(line)) return bare;
    return numbered ? `${++n}. ${bare}` : marker + bare;
  });

  replaceRange(ta, start, end, next.join('\n'));
  ta.setSelectionRange(start, start + next.join('\n').length);
}

function insertBlock(ta, text) {
  const v = ta.value;
  const s = ta.selectionStart;
  // a block needs its own line, and a blank one above it unless it starts the field
  const before = s === 0 ? '' : v.slice(0, s).endsWith('\n\n') ? '' : v.slice(0, s).endsWith('\n') ? '\n' : '\n\n';
  const after = v.slice(ta.selectionEnd).startsWith('\n') ? '\n' : '\n\n';
  replaceRange(ta, s, ta.selectionEnd, before + text + after);
  const at = s + before.length + text.length + after.length;
  ta.setSelectionRange(at, at);
}

/* ------------------------------------------------------------------ links */

const looksLikeUrl = (s) => /^(https?:\/\/|mailto:|\/)\S+$/i.test(String(s).trim());

async function linkAction(ta, ask) {
  const { selectionStart: s, selectionEnd: e, value: v } = ta;
  const sel = v.slice(s, e);

  // pasting a URL over selected words is the common case, so if the
  // selection is itself a URL it becomes the target, not the label
  if (sel && looksLikeUrl(sel)) {
    replaceRange(ta, s, e, `[](${sel})`);
    ta.setSelectionRange(s + 1, s + 1);
    return;
  }
  const href = await ask('Link to', 'https://');
  if (!href) return;
  const label = sel || 'the words that link';
  replaceRange(ta, s, e, `[${label}](${href.trim()})`);
  if (sel) {
    const at = s + label.length + href.trim().length + 4;
    ta.setSelectionRange(at, at);
  } else {
    ta.setSelectionRange(s + 1, s + 1 + label.length);
  }
}

/* --------------------------------------------------- typing that helps out */

/**
 * Enter inside a list or a quote continues it, and Enter on an empty item
 * ends it. Without this a list is only a list until the first newline, which
 * is the moment most people give up on the markers.
 */
function handleEnter(ta, event) {
  const v = ta.value;
  const from = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  const line = v.slice(from, ta.selectionStart);

  const list = LIST_LINE.exec(line);
  if (list) {
    const [, indent, bullet, gap, content] = list;
    event.preventDefault();
    if (!content.trim()) {
      replaceRange(ta, from, ta.selectionStart, indent);  // empty item: leave the list
      return true;
    }
    const nextBullet = /^\d+\.$/.test(bullet) ? `${parseInt(bullet, 10) + 1}.` : bullet;
    replaceRange(ta, ta.selectionStart, ta.selectionEnd, `\n${indent}${nextBullet}${gap}`);
    return true;
  }

  const quote = /^(\s*)>(\s+)(.*)$/.exec(line);
  if (quote) {
    event.preventDefault();
    if (!quote[3].trim()) {
      replaceRange(ta, from, ta.selectionStart, quote[1]);
      return true;
    }
    replaceRange(ta, ta.selectionStart, ta.selectionEnd, `\n${quote[1]}>${quote[2]}`);
    return true;
  }
  return false;
}

/* --------------------------------------------------------------- the thing */

/**
 * @param {HTMLTextAreaElement} ta
 * @param {{compact?: boolean, pickImage?: () => Promise<null|{url:string, alt?:string, caption?:string}>,
 *          ask?: (label:string, value:string) => Promise<string|null>}} options
 */
export function attachEditor(ta, { compact = false, pickImage = null, ask = null } = {}) {
  if (ta.dataset.editor === 'on') return null;
  ta.dataset.editor = 'on';

  const prompter = ask || (async (label, value) => window.prompt(label, value));
  const tools = TOOLS.filter((t) => {
    if (t.kind === 'image' && !pickImage) return false;
    return compact ? COMPACT.has(t.id) : true;
  });

  const bar = document.createElement('div');
  bar.className = `st-tools${compact ? ' st-tools--compact' : ''}`;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Formatting');
  bar.innerHTML = tools
    .map(
      (t) =>
        `<button type="button" class="st-tool${t.cls ? ' ' + t.cls : ''}" data-tool="${t.id}"` +
        ` title="${t.title}" aria-label="${t.title.split('  ')[0]}" tabindex="-1">` +
        (t.icon || `<span class="st-tool__letter">${t.label}</span>`) +
        '</button>'
    )
    .join('');
  ta.parentNode.insertBefore(bar, ta);

  const byId = Object.fromEntries(tools.map((t) => [t.id, t]));

  async function run(id) {
    const tool = byId[id];
    if (!tool) return;
    if (tool.kind === 'wrap') wrap(ta, tool.open, tool.close);
    else if (tool.kind === 'line') prefix(ta, tool);
    else if (tool.kind === 'link') await linkAction(ta, prompter);
    else if (tool.kind === 'image') {
      const picked = await pickImage();
      if (!picked?.url) return;
      const caption = picked.caption ? ` "${picked.caption.replace(/"/g, "'")}"` : '';
      insertBlock(ta, `![${(picked.alt || '').replace(/[[\]]/g, '')}](${picked.url}${caption})`);
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    refresh();
  }

  // mousedown, not click: the textarea must not lose its selection first
  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.st-tool')) e.preventDefault();
  });
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.st-tool');
    if (btn) run(btn.dataset.tool);
  });

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      if (handleEnter(ta, e)) { ta.dispatchEvent(new Event('input', { bubbles: true })); refresh(); }
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    const shortcut = { b: 'bold', i: 'italic', k: 'link' }[key];
    if (shortcut && byId[shortcut]) { e.preventDefault(); run(shortcut); }
  });

  /** Light the buttons that describe where the caret already is. */
  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (document.activeElement !== ta) {
        bar.querySelectorAll('.st-tool').forEach((b) => b.classList.remove('is-on'));
        return;
      }
      const { lines } = lineSpan(ta);
      const line = lines[0] || '';
      const state = {
        h2: /^##\s/.test(line),
        h3: /^###\s/.test(line),
        quote: /^\s*>\s/.test(line),
        bullet: /^\s*[-*]\s/.test(line),
        number: /^\s*\d+\.\s/.test(line),
      };
      // `### x` matches the `##` test too; the deeper one wins
      if (state.h3) state.h2 = false;
      for (const [id, on] of Object.entries(state)) {
        bar.querySelector(`[data-tool="${id}"]`)?.classList.toggle('is-on', on);
      }
    });
  }

  ta.addEventListener('select', refresh);
  ta.addEventListener('click', refresh);
  ta.addEventListener('keyup', refresh);
  ta.addEventListener('focus', refresh);
  ta.addEventListener('blur', refresh);

  return { bar, run, refresh, detach() { bar.remove(); delete ta.dataset.editor; } };
}

/** Attach to every markdown-ish field inside a container, once. */
export function attachAll(root, options = {}) {
  const out = [];
  for (const ta of root.querySelectorAll('textarea[data-rich]')) {
    out.push(attachEditor(ta, { ...options, compact: ta.dataset.rich === 'compact' }));
  }
  return out.filter(Boolean);
}

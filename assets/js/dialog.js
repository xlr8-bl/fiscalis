/**
 * dialog.js — asking a question without leaving the studio.
 *
 * `prompt()` and `confirm()` are the browser's own chrome: a grey slab
 * with the origin printed at the top, a system font, and buttons in the
 * OS's order rather than yours. On a phone they are worse — they take the
 * whole screen and look like a warning from the browser rather than a
 * question from the page. Half a dozen of them across one studio is the
 * fastest way to make a thing look unfinished.
 *
 * So: one <dialog>, styled like the rest, returning a promise. Same
 * shapes as the natives it replaces, so the call sites read the same:
 *
 *   const name = await ask('What is this one called?');   // string | null
 *   if (!await sure('Kill this carousel?')) return;       // boolean
 *
 * A native <dialog> rather than a div, because the browser already does
 * the focus trap, the top layer, Escape to close and the backdrop — and
 * every one of those is a thing to get wrong by hand.
 */

let node = null;

function build() {
  node = document.createElement('dialog');
  node.className = 'st-ask';
  node.innerHTML = `
    <form method="dialog" class="st-ask__form">
      <h2 class="st-ask__title" data-title></h2>
      <p class="st-note u-text-style-main" data-body hidden></p>
      <div class="st-field" data-field hidden>
        <label class="st-label u-text-style-main" for="st-ask-input" data-label></label>
        <input class="st-input" id="st-ask-input" data-input>
      </div>
      <div class="st-ask__acts">
        <button class="st-link" type="submit" value="cancel" data-no>Cancel</button>
        <button class="st-btn" type="submit" value="ok" data-yes>OK</button>
      </div>
    </form>`;
  document.body.append(node);

  // clicking the backdrop is a cancel, the same as Escape
  node.addEventListener('click', (e) => {
    if (e.target === node) { node.returnValue = 'cancel'; node.close(); }
  });
  return node;
}

/**
 * @param {string} title  the question
 * @param {object} opts   body: a line under it. value/label/placeholder for
 *                        a text answer. yes/no: the button words. danger:
 *                        marks the confirming button as the destructive one.
 * @returns {Promise<string|boolean|null>} the text, or true/false when
 *          there is no field. null when cancelled, so an empty answer and
 *          a cancelled one stay different things.
 */
export function ask(title, opts = {}) {
  const {
    body = '', value = null, label = '', placeholder = '',
    yes = 'OK', no = 'Cancel', danger = false,
  } = opts;

  const el = node || build();
  const wants = value !== null;

  el.querySelector('[data-title]').textContent = title;
  const bodyEl = el.querySelector('[data-body]');
  bodyEl.textContent = body;
  bodyEl.hidden = !body;

  const field = el.querySelector('[data-field]');
  const input = el.querySelector('[data-input]');
  const labelEl = el.querySelector('[data-label]');
  field.hidden = !wants;
  // a label that restates the title is noise — the title already asked.
  // Without one the input still needs a name, so it borrows the title.
  labelEl.textContent = label;
  labelEl.hidden = !label;
  input.setAttribute('aria-label', label || title);
  input.value = wants ? String(value) : '';
  input.placeholder = placeholder;

  const yesBtn = el.querySelector('[data-yes]');
  yesBtn.textContent = yes;
  yesBtn.classList.toggle('is-danger', Boolean(danger));
  el.querySelector('[data-no]').textContent = no;

  return new Promise((resolve) => {
    el.addEventListener('close', function done() {
      el.removeEventListener('close', done);
      if (el.returnValue !== 'ok') return resolve(null);
      resolve(wants ? input.value : true);
    });
    el.returnValue = 'cancel';
    el.showModal();
    // the field if there is one, otherwise the safe button — never the
    // destructive one, which is how Enter deletes something by accident
    (wants ? input : el.querySelector('[data-no]')).focus();
    if (wants) input.select();
  });
}

/** The yes/no half, so a call site that wants a boolean reads like one. */
export async function sure(title, opts = {}) {
  return (await ask(title, { yes: 'Yes', no: 'Cancel', ...opts })) === true;
}

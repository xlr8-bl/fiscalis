/* ==================================================================
   book.js — intro call request page
   Constraint-aware validation: one date per request, capped slot
   count, working days only, sensible lead time and horizon.
   ================================================================== */
(function () {
  'use strict';

  var MAX_SLOTS = 3;      // preferences, not a scattergun
  var MIN_LEAD_DAYS = 1;  // never same-day
  var MAX_AHEAD_DAYS = 60;
  var MSG_MIN = 10;
  var MSG_MAX = 1200;
  var HOURS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

  var form = document.querySelector('[data-book]');
  if (!form) return;

  var status = document.querySelector('[data-book-status]');
  var slotsWrap = document.querySelector('[data-slots]');
  var dateEl = document.getElementById('bk-date');
  var msgEl = document.getElementById('bk-msg');
  var countEl = document.querySelector('[data-count]');
  var meterEl = document.querySelector('.bk__meter');
  var summary = document.querySelector('[data-summary-duration]');
  var maxLabel = document.querySelector('[data-max-slots]');
  var endpoint = form.getAttribute('data-endpoint') || '';

  if (maxLabel) maxLabel.textContent = String(MAX_SLOTS);

  /* --- helpers ---------------------------------------------------- */
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var addDays = function (n) { return new Date(Date.now() + n * 86400000); };
  var isWeekend = function (ymd) {
    var d = new Date(ymd + 'T12:00:00Z').getUTCDay();
    return d === 0 || d === 6;
  };
  var nextWorkday = function (from) {
    var d = new Date(from.getTime());
    while (isWeekend(iso(d))) d = new Date(d.getTime() + 86400000);
    return d;
  };

  var setErr = function (field, msg) {
    var el = form.querySelector('[data-err-for="' + field + '"]');
    if (el) {
      el.textContent = msg || '';
      if (msg) el.setAttribute('data-show', ''); else el.removeAttribute('data-show');
    }
    var input = form.querySelector('[name="' + field + '"]');
    if (input && input.setAttribute) {
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  };
  var clearErrs = function () {
    ['date', 'slot', 'name', 'email', 'message'].forEach(function (f) { setErr(f, ''); });
  };
  var say = function (m, s) {
    if (!status) return;
    status.textContent = m || '';
    if (s) status.setAttribute('data-state', s); else status.removeAttribute('data-state');
  };

  /* --- clock ------------------------------------------------------ */
  var clock = document.querySelector('[data-clock]');
  if (clock) {
    var fmt = null;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Etc/GMT-1'
      });
    } catch (e) {}
    var tick = function () {
      if (fmt) { clock.textContent = fmt.format(new Date()); return; }
      var d = new Date(Date.now() + 3600000), p = function (n) { return (n < 10 ? '0' : '') + n; };
      clock.textContent = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
    };
    tick();
    setTimeout(function () { tick(); setInterval(tick, 1000); }, 1000 - (Date.now() % 1000));
  }

  /* --- date bounds ------------------------------------------------ */
  if (dateEl) {
    var first = nextWorkday(addDays(MIN_LEAD_DAYS));
    dateEl.min = iso(addDays(MIN_LEAD_DAYS));
    dateEl.max = iso(addDays(MAX_AHEAD_DAYS));
    dateEl.value = iso(first);
  }

  /* --- slots ------------------------------------------------------ */
  if (slotsWrap) {
    slotsWrap.innerHTML = HOURS.map(function (h) {
      return '<label class="bk__slot"><input type="checkbox" name="slot" value="' + h + '">' +
             '<span>' + h + '</span></label>';
    }).join('');
  }
  var slotInputs = function () {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="slot"]'));
  };
  var chosen = function () { return slotInputs().filter(function (i) { return i.checked; }); };

  // Cap the selection: once MAX_SLOTS are picked the rest go disabled,
  // so the limit is visible rather than only enforced on submit.
  var syncSlotCap = function () {
    var n = chosen().length;
    slotInputs().forEach(function (i) { i.disabled = !i.checked && n >= MAX_SLOTS; });
    if (n) setErr('slot', '');
  };
  form.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'slot') syncSlotCap();
    if (e.target && e.target.name === 'duration' && summary) summary.textContent = e.target.value;
    if (e.target && e.target.name === 'date') validateDate();
  });

  /* --- per-field validation --------------------------------------- */
  function validateDate() {
    if (!dateEl) return true;
    var v = dateEl.value;
    if (!v) { setErr('date', 'Pick a date.'); return false; }
    if (v < dateEl.min) { setErr('date', 'I need at least a day of notice — pick a later date.'); return false; }
    if (v > dateEl.max) { setErr('date', 'That is further out than I book. Choose a date within two months.'); return false; }
    if (isWeekend(v)) { setErr('date', 'Calls run on working days. Pick Monday to Friday.'); return false; }
    setErr('date', '');
    return true;
  }
  function validateSlots() {
    var n = chosen().length;
    if (!n) { setErr('slot', 'Pick at least one time on that date.'); return false; }
    if (n > MAX_SLOTS) { setErr('slot', 'Up to ' + MAX_SLOTS + ' times, all on the one date.'); return false; }
    setErr('slot', '');
    return true;
  }
  function validateName() {
    var v = (form.name && form.name.value || '').trim();
    if (v.length < 2) { setErr('name', 'Your name, so I know who I am replying to.'); return false; }
    setErr('name', ''); return true;
  }
  function validateEmail() {
    var v = (form.email && form.email.value || '').trim();
    if (!v) { setErr('email', 'I need an email to confirm the slot.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setErr('email', 'That address does not look right.'); return false; }
    setErr('email', ''); return true;
  }
  function validateMessage() {
    var v = (msgEl && msgEl.value || '').trim();
    if (v.length < MSG_MIN) { setErr('message', 'A line or two about what is broken.'); return false; }
    if (v.length > MSG_MAX) { setErr('message', 'That is longer than this form takes — email me instead.'); return false; }
    setErr('message', ''); return true;
  }

  // Re-check a field once it has been touched, not while first typing into it.
  ['name', 'email', 'message'].forEach(function (f) {
    var el = form.querySelector('[name="' + f + '"]');
    if (!el) return;
    var fn = f === 'name' ? validateName : f === 'email' ? validateEmail : validateMessage;
    el.addEventListener('blur', fn);
    el.addEventListener('input', function () {
      if (el.getAttribute('aria-invalid')) fn();
    });
  });

  var count = function () {};
  if (msgEl && countEl) {
    count = function () {
      var n = msgEl.value.trim().length;
      countEl.textContent = n + ' / ' + MSG_MAX;
      if (meterEl) {
        if (n > MSG_MAX) meterEl.setAttribute('data-state', 'over');
        else meterEl.removeAttribute('data-state');
      }
    };
    msgEl.addEventListener('input', count);
    count();
  }

  syncSlotCap();
  validateDate();

  /* --- submit ------------------------------------------------------ */
  var busy = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;

    clearErrs();
    var checks = [validateDate(), validateSlots(), validateName(), validateEmail(), validateMessage()];
    if (checks.indexOf(false) !== -1) {
      say('Some details need a look.', 'err');
      var bad = form.querySelector('[aria-invalid="true"]') || form.querySelector('[data-err-for][data-show]');
      if (bad && bad.scrollIntoView) bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    var data = new FormData(form);
    var picked = data.getAll('slot');
    var btn = form.querySelector('.bk__submit');

    var body =
      'Intro call request\n\n' +
      'Name: ' + data.get('name') + '\n' +
      'Email: ' + data.get('email') + '\n' +
      'Duration: ' + (data.get('duration') || '') + '\n' +
      'Date: ' + (data.get('date') || '') + '\n' +
      'Times (GMT+1): ' + picked.join(', ') + '\n\n' +
      'What is broken:\n' + data.get('message');

    if (!endpoint) {
      window.location.href = 'mailto:ashleymbaht@icloud.com?subject=' +
        encodeURIComponent('Intro call request — ' + data.get('name')) +
        '&body=' + encodeURIComponent(body);
      say('Opening your mail app…', 'ok');
      return;
    }

    busy = true;
    if (btn) btn.disabled = true;
    say('Sending…');

    fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw j; });
        form.reset();
        syncSlotCap();
        count();
        if (dateEl) dateEl.value = iso(nextWorkday(addDays(MIN_LEAD_DAYS)));
        say('Request sent. I confirm the slot by email within one working day.', 'ok');
      })
      .catch(function (j) {
        if (j && j.fields && j.fields.length) {
          j.fields.forEach(function (f) { setErr(f, 'Check this one.'); });
          say('Some details need a look.', 'err');
        } else {
          say('That did not send. Email ashleymbaht@icloud.com instead.', 'err');
        }
      })
      .then(function () {
        busy = false;
        if (btn) btn.disabled = false;
      });
  });
})();

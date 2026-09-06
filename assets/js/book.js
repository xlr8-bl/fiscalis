/* ==================================================================
   book.js — ask for one hour, and hold it.

   The old version asked for a date and up to three preferred times and
   sent them off: a contact form wearing a calendar's clothes. Two people
   could ask for the same hour, nobody could see what was free, and the
   answer always needed a second message.

   This asks the site what is actually free, offers that, and holds the
   one you pick. Three steps, no account, and every time on the page is a
   time you can have.

   THE SHAPE COMES FROM THE RESEARCH, not from taste.
     A short window books better than a long one. The server decides how
     many days; the page just draws what it is given.
     Five to eight times at once. Fewer reads as shut, more is a decision
     nobody wants to make. A day with more than eight is trimmed and says
     so, rather than becoming a wall.
     Scarcity only where it is true. A thin day looks thin because it is.

   Written in ES5, like the rest of the site's front end, so it needs no
   build step and runs on whatever somebody is holding.
   ================================================================== */
(function () {
  'use strict';

  var SHOW_TIMES = 8;      // per day, before "show the rest"
  var MSG_MAX = 1500;

  var form = document.querySelector('[data-book]');
  if (!form) return;

  var status = document.querySelector('[data-book-status]');
  var daysWrap = document.querySelector('[data-days]');
  var timesField = document.querySelector('[data-times-field]');
  var slotsWrap = document.querySelector('[data-slots]');
  var msgEl = document.getElementById('bk-msg');
  var countEl = document.querySelector('[data-count]');
  var summary = document.querySelector('[data-summary-duration]');
  var openedAt = form.querySelector('[name="opened_at"]');
  var endpoint = form.getAttribute('data-endpoint') || '/api/request';

  /* How long the form was open. A person cannot read the page, pick a
     day, pick a time and type their name in three seconds; a script can.
     The server is what enforces it, this only reports it. */
  if (openedAt) openedAt.value = String(Date.now());

  var state = { days: [], day: '', start: '', minutes: 45, expanded: {} };

  var say = function (text, kind) {
    if (!status) return;
    status.textContent = text || '';
    status.className = 'bk__status' + (kind ? ' is-' + kind : '');
  };

  var pretty = function (ymd) {
    var d = new Date(ymd + 'T12:00:00Z');
    return d.toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
    });
  };

  /* --- what is free ------------------------------------------------ */

  function load() {
    fetch('/api/slots', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        state.days = j.days || [];
        state.minutes = j.minutes || 45;
        if (summary) summary.textContent = state.minutes + ' minutes';
        drawDays();
      })
      .catch(function () {
        if (daysWrap) {
          daysWrap.innerHTML =
            '<p class="bk__hint u-text-style-small">The diary is not answering. ' +
            'Email me and I will sort it out by hand.</p>';
        }
      });
  }

  function drawDays() {
    if (!daysWrap) return;
    if (!state.days.length) {
      daysWrap.innerHTML =
        '<p class="bk__hint u-text-style-small">Nothing free in the next few days. ' +
        'Email me and we will find something.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < state.days.length; i++) {
      var d = state.days[i];
      var n = d.times.length;
      html +=
        '<label class="bk__chip bk__day">' +
        '<input type="radio" name="day" value="' + d.day + '"' +
        (d.day === state.day ? ' checked' : '') + '>' +
        '<span class="u-text-style-small">' + pretty(d.day) +
        '<b class="bk__day-n">' + n + (n === 1 ? ' time' : ' times') + '</b>' +
        '</span></label>';
    }
    daysWrap.innerHTML = html;
  }

  function drawTimes() {
    if (!slotsWrap || !timesField) return;
    var day = null;
    for (var i = 0; i < state.days.length; i++) {
      if (state.days[i].day === state.day) day = state.days[i];
    }
    if (!day) { timesField.hidden = true; return; }

    timesField.hidden = false;
    var all = day.times;
    var open = state.expanded[day.day];
    var show = open ? all : all.slice(0, SHOW_TIMES);

    var html = '';
    for (var j = 0; j < show.length; j++) {
      html +=
        '<label class="bk__slot">' +
        '<input type="radio" name="start" value="' + show[j] + '"' +
        (show[j] === state.start ? ' checked' : '') + '>' +
        '<span>' + show[j] + '</span></label>';
    }
    if (!open && all.length > SHOW_TIMES) {
      html +=
        '<button type="button" class="st-link bk__more" data-more>' +
        (all.length - SHOW_TIMES) + ' more</button>';
    }
    slotsWrap.innerHTML = html;
  }

  /* --- picking ------------------------------------------------------ */

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.name) return;
    if (t.name === 'day') {
      state.day = t.value;
      state.start = '';
      drawTimes();
      say('');
    }
    if (t.name === 'start') { state.start = t.value; say(''); }
  });

  form.addEventListener('click', function (e) {
    var more = e.target.closest ? e.target.closest('[data-more]') : null;
    if (!more) return;
    state.expanded[state.day] = true;
    drawTimes();
  });

  if (msgEl && countEl) {
    var count = function () {
      countEl.textContent = String(msgEl.value.length);
      if (msgEl.value.length > MSG_MAX) {
        msgEl.value = msgEl.value.slice(0, MSG_MAX);
        countEl.textContent = String(MSG_MAX);
      }
    };
    msgEl.addEventListener('input', count);
    count();
  }

  /* --- sending ------------------------------------------------------ */

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!state.day) { say('Pick a day first.', 'err'); return; }
    if (!state.start) { say('Pick a time.', 'err'); return; }

    var data = {
      day: state.day,
      start: state.start,
      name: (form.querySelector('[name="name"]') || {}).value || '',
      email: (form.querySelector('[name="email"]') || {}).value || '',
      about: (form.querySelector('[name="about"]') || {}).value || '',
      company: (form.querySelector('[name="company"]') || {}).value || '',
      opened_at: openedAt ? openedAt.value : ''
    };
    var cf = form.querySelector('[name="cf-turnstile-response"]');
    if (cf) data['cf-turnstile-response'] = cf.value;

    var button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    say('Holding that time…');

    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (out) {
        if (button) button.disabled = false;
        if (out.j && out.j.ok) {
          form.innerHTML =
            '<div class="bk__done">' +
            '<p class="jr_lede u-text-style-h4">' + pretty(state.day) + ', ' +
            state.start + ' is held for you.</p>' +
            '<p>I read these myself, so the answer comes from me and not from a ' +
            'robot. If it does not suit me I will say so and the time goes back ' +
            'on the page for somebody else.</p></div>';
          return;
        }
        /* A slot that went while the page was open is not an error the
           visitor made. Reload what is free and let them pick again,
           rather than telling them off. */
        if (out.s === 409) {
          say((out.j.problems || ['That one has gone.'])[0], 'err');
          state.start = '';
          load();
          return;
        }
        say((out.j && out.j.problems ? out.j.problems[0] : 'That did not send.'), 'err');
      })
      .catch(function () {
        if (button) button.disabled = false;
        say('That did not send. Email me instead and I will sort it out.', 'err');
      });
  });

  load();
})();

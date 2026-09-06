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
  var waysWrap = document.querySelector('[data-ways]');
  var phoneField = document.querySelector('[data-phone-field]');
  var msgEl = document.getElementById('bk-msg');
  var countEl = document.querySelector('[data-count]');
  var summary = document.querySelectorAll('[data-summary-duration]');
  var openedAt = form.querySelector('[name="opened_at"]');
  var endpoint = form.getAttribute('data-endpoint') || '/api/request';

  /* How long the form was open. A person cannot read the page, pick a
     day, pick a time and type their name in three seconds; a script can.
     The server is what enforces it, this only reports it. */
  if (openedAt) openedAt.value = String(Date.now());

  var state = { days: [], today: '', day: '', start: '', how: '',
               ways: [], minutes: 45, expanded: {} };

  /* A step that is behind you looks different from one still ahead.
     Nothing here changes what the form does; it is the only feedback
     between picking a day and reaching the button, and without it the
     three numbered headings are decoration. */
  function markSteps() {
    var mark = function (which, done) {
      var el = form.querySelector('[data-step-field="' + which + '"]');
      if (!el) return;
      if (done) el.setAttribute('data-done', '');
      else el.removeAttribute('data-done');
    };
    mark('day', !!state.day);
    mark('time', !!state.start);
    mark('how', !!state.how);
    var name = (form.querySelector('[name="name"]') || {}).value || '';
    var mail = (form.querySelector('[name="email"]') || {}).value || '';
    mark('you', !!(name.trim() && mail.trim()));
  }

  /* Bring the next step onto the screen, gently and only when it is not
     already there. Scrolling somebody who can see the thing already is
     as disorienting as not scrolling them at all. */
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reveal(el) {
    if (!el || el.hidden) return;
    var box = el.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= (window.innerHeight || 0)) return;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
  }

  var say = function (text, kind) {
    if (!status) return;
    status.textContent = text || '';
    status.className = 'bk__status' + (kind ? ' is-' + kind : '');
  };

  /* --- saying which day, so nobody has to work it out ---------------

     "Mon, Sep 7" on its own asks a question it does not answer: which
     week is that? A person reading a list of five dates has to hold
     today's date in their head and count, and the whole point of the
     page is that it does the counting.

     So the rows are grouped under This week and Next week, and the two
     that have names get them: Today and Tomorrow, with the date still
     beside them rather than instead of them.

     All of it against the diary's own clock, which comes down with the
     slots. A visitor in another timezone reading their own device would
     get labels that disagree with the dates beside them. */

  var atNoon = function (ymd) { return new Date(ymd + 'T12:00:00Z'); };
  var daysApart = function (a, b) {
    return Math.round((atNoon(b) - atNoon(a)) / 86400000);
  };

  var pretty = function (ymd) {
    return atNoon(ymd).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
    });
  };

  /** "Tomorrow, 8 Sep", or "Tue 8 Sep" once it stops having a name. */
  function dayLabel(ymd) {
    var date = atNoon(ymd).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', timeZone: 'UTC'
    });
    if (!state.today) return pretty(ymd);
    var off = daysApart(state.today, ymd);
    if (off === 0) return 'Today, ' + date;
    if (off === 1) return 'Tomorrow, ' + date;
    return pretty(ymd);
  }

  /**
   * 0 for the week today is in, 1 for the one after, and so on.
   *
   * Weeks start on SUNDAY here, and not because of any calendar
   * convention. Monday-start weeks put Sunday at the end of the week it
   * is in, so on a Sunday tomorrow falls into the next one and the page
   * says "Next week" above a row that says "Tomorrow". Nobody on a
   * Sunday evening thinks of the next morning as next week.
   *
   * Sunday-start gets both edges right: tomorrow is this week on a
   * Sunday, and a Monday three days out is next week on a Friday.
   */
  function weekOf(ymd) {
    if (!state.today) return 0;
    var t = atNoon(state.today);
    t.setUTCDate(t.getUTCDate() - t.getUTCDay());
    return Math.floor((atNoon(ymd) - t) / (7 * 86400000));
  }

  function weekLabel(n, ymd) {
    if (n <= 0) return 'This week';
    if (n === 1) return 'Next week';
    // past that, counting weeks stops meaning anything: name the days
    return 'The week of ' + atNoon(ymd).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', timeZone: 'UTC'
    });
  }

  /* --- what is free ------------------------------------------------ */

  function load() {
    fetch('/api/slots', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        state.days = j.days || [];
        state.today = j.today || '';
        state.ways = j.platforms || [];
        state.minutes = j.minutes || 45;
        // the length is said twice on the page, once above the form and
        // once in the particulars below it
        for (var s = 0; s < summary.length; s++) {
          summary[s].textContent = state.minutes + ' minutes';
        }
        drawDays();
        drawWays();
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
    /* The date and the count are two separate elements, and they were
       not. Both went into one span, the count immediately after the
       date, with nothing between them and no rule to separate them:
       "Mon, Sep 7" followed by "6 times" read on the page as
       "Mon, Sep 76 times". Every row said a number that did not exist.

       They are laid out now rather than concatenated, which is also
       what lets the count sit at the end of the row where a person
       reads it as a property of the day rather than as part of it. */
    var html = '';
    var week = null;
    for (var i = 0; i < state.days.length; i++) {
      var d = state.days[i];
      var n = d.times.length;

      var w = weekOf(d.day);
      if (w !== week) {
        week = w;
        html += '<p class="bk__week u-text-style-small">' +
                weekLabel(w, d.day) + '</p>';
      }

      html +=
        '<label class="bk__day">' +
        '<input type="radio" name="day" value="' + d.day + '"' +
        (d.day === state.day ? ' checked' : '') + '>' +
        '<span class="bk__day-in">' +
        '<span class="bk__day-when">' + dayLabel(d.day) + '</span>' +
        '<span class="bk__day-n">' + n + ' free</span>' +
        '</span></label>';
    }
    daysWrap.innerHTML = html;
  }

  /* How the call happens. Drawn from what the diary offers rather than
     hard coded, so turning Zoom off in the studio turns it off here. The
     first one is picked for them: a required choice with nothing chosen
     is a step somebody can walk past and then be told off for. */
  function drawWays() {
    if (!waysWrap) return;
    if (!state.ways.length) { waysWrap.innerHTML = ''; return; }
    if (!state.how) state.how = state.ways[0].id;

    var html = '';
    for (var i = 0; i < state.ways.length; i++) {
      var w = state.ways[i];
      html +=
        '<label class="bk__way">' +
        '<input type="radio" name="platform" value="' + w.id + '"' +
        (w.id === state.how ? ' checked' : '') + '>' +
        '<span class="bk__way-in">' +
        '<span class="bk__way-name">' + w.label + '</span>' +
        '<span class="bk__way-note">' + w.note + '</span>' +
        '</span></label>';
    }
    waysWrap.innerHTML = html;
    showPhone();
  }

  /* The number is asked for only when it is the thing I would dial, and
     it is required then. A WhatsApp call to an email address does not
     exist, and finding that out after confirming means another email. */
  function showPhone() {
    if (!phoneField) return;
    var picked = null;
    for (var i = 0; i < state.ways.length; i++) {
      if (state.ways[i].id === state.how) picked = state.ways[i];
    }
    var need = !!(picked && picked.needs);
    phoneField.hidden = !need;
    var input = phoneField.querySelector('input');
    if (input) {
      input.required = need;
      if (!need) input.value = '';
    }
  }

  function drawTimes() {
    if (!slotsWrap || !timesField) return;
    var day = null;
    for (var i = 0; i < state.days.length; i++) {
      if (state.days[i].day === state.day) day = state.days[i];
    }
    /* Step two stays on the page with nothing in it yet, rather than
       being hidden until step one is done. Hiding it numbered the form
       1, 3: a person saw two steps, did the first, and a third appeared
       between them. Showing it empty says what the whole job is before
       anybody starts, which is the only reason to number steps at all. */
    if (!day) {
      timesField.removeAttribute('data-picked');
      slotsWrap.innerHTML =
        '<p class="bk__waiting u-text-style-small">Pick a day and the times ' +
        'will show here.</p>';
      return;
    }
    timesField.setAttribute('data-picked', '');

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
        // st-link is a studio class and the studio's stylesheet is not
        // loaded here, so this button used to render as a raw browser
        // control on a dark page
        '<button type="button" class="bk__more" data-more>' +
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
      /* The times appear below the fold on a phone, so without this you
         tap a day and the screen does not change: the next step is
         there, it is just off the bottom. Nothing looks more broken
         than a control that appears to do nothing. */
      reveal(timesField);
    }
    if (t.name === 'start') { state.start = t.value; say(''); }
    if (t.name === 'platform') { state.how = t.value; showPhone(); say(''); }
    markSteps();
  });

  form.addEventListener('input', markSteps);

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
      platform: state.how,
      phone: (form.querySelector('[name="phone"]') || {}).value || '',
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
            // jr_lede belongs to the journal's stylesheet, which is not
            // loaded here either
            '<div class="bk__done">' +
            '<p class="bk__done-when u-text-style-h4">' + pretty(state.day) + ', ' +
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

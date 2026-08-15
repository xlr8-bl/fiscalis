/* ==================================================================
   book.js — intro call request page
   ================================================================== */
(function () {
  'use strict';

  /* live GMT+1 clock ------------------------------------------------ */
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

  /* time slots ------------------------------------------------------ */
  var slots = document.querySelector('[data-slots]');
  if (slots) {
    var hours = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'];
    slots.innerHTML = hours.map(function (h, i) {
      return '<label class="bk__slot"><input type="checkbox" name="slot" value="' + h + '">' +
             '<span>' + h + '</span></label>';
    }).join('');
  }

  /* date: default tomorrow, no past dates --------------------------- */
  var date = document.getElementById('bk-date');
  if (date) {
    var t = new Date(Date.now() + 86400000);
    var iso = t.toISOString().slice(0, 10);
    date.min = new Date().toISOString().slice(0, 10);
    date.value = iso;
  }

  /* duration summary ------------------------------------------------ */
  var summary = document.querySelector('[data-summary-duration]');
  document.querySelectorAll('input[name="duration"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (summary && r.checked) summary.textContent = r.value;
    });
  });

  /* submit ---------------------------------------------------------- */
  var form = document.querySelector('[data-book]');
  if (!form) return;
  var status = document.querySelector('[data-book-status]');
  var endpoint = form.getAttribute('data-endpoint') || '';

  var say = function (m, s) {
    if (!status) return;
    status.textContent = m;
    if (s) status.setAttribute('data-state', s); else status.removeAttribute('data-state');
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(form);
    var name = (d.get('name') || '').toString().trim();
    var email = (d.get('email') || '').toString().trim();
    var msg = (d.get('message') || '').toString().trim();
    var picked = d.getAll('slot');

    if (!name || !email || !msg) { say('Add your name, email and a line about what is broken.', 'err'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That email address does not look right.', 'err'); return; }
    if (!picked.length) { say('Pick at least one time that suits you.', 'err'); return; }

    var body =
      'Intro call request\n\n' +
      'Name: ' + name + '\n' +
      'Email: ' + email + '\n' +
      'Duration: ' + (d.get('duration') || '') + '\n' +
      'Date: ' + (d.get('date') || '') + '\n' +
      'Times (GMT+1): ' + picked.join(', ') + '\n\n' +
      'What is broken:\n' + msg;

    if (!endpoint) {
      window.location.href = 'mailto:ashleymbaht@icloud.com?subject=' +
        encodeURIComponent('Intro call request — ' + name) + '&body=' + encodeURIComponent(body);
      say('Opening your mail app…', 'ok');
      return;
    }

    say('Sending…');
    fetch(endpoint, { method: 'POST', body: d, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(); form.reset(); say('Request sent. I confirm by email within one working day.', 'ok'); })
      .catch(function () { say('That did not send. Email ashleymbaht@icloud.com instead.', 'err'); });
  });
})();

/* ==================================================================
   site.js — small site behaviours
   Live clock and contact form. No dependencies.
   ================================================================== */
(function () {
  'use strict';

  /* --- live clock, fixed to GMT+1 -------------------------------- */
  var clock = document.querySelector('[data-clock]');
  if (clock) {
    var fmt;
    try {
      // Etc/GMT-1 is UTC+1 (POSIX sign convention is inverted).
      fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Etc/GMT-1'
      });
    } catch (e) {
      fmt = null;
    }

    var tick = function () {
      var text;
      if (fmt) {
        text = fmt.format(new Date());
      } else {
        // Fallback: shift UTC by one hour by hand.
        var d = new Date(Date.now() + 60 * 60 * 1000);
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        text = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
      }
      clock.textContent = text;
    };

    tick();
    // Align to the next whole second, then tick once per second.
    window.setTimeout(function () {
      tick();
      window.setInterval(tick, 1000);
    }, 1000 - (Date.now() % 1000));
  }

  /* --- contact form ---------------------------------------------- */
  var form = document.querySelector('[data-contact-form]');
  if (!form) return;

  var status = form.querySelector('[data-contact-status]');
  var endpoint = form.getAttribute('data-endpoint') || '';

  var say = function (msg, state) {
    if (!status) return;
    status.textContent = msg;
    if (state) status.setAttribute('data-state', state);
    else status.removeAttribute('data-state');
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var name = (data.get('name') || '').toString().trim();
    var email = (data.get('email') || '').toString().trim();
    var message = (data.get('message') || '').toString().trim();

    if (!name || !email || !message) {
      say('Add your name, email and a line about what is broken.', 'err');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      say('That email address does not look right.', 'err');
      return;
    }

    if (!endpoint) {
      // No backend configured: hand off to the visitor's mail client.
      var subject = 'Project enquiry — ' + (data.get('project_type') || 'Website');
      var body =
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n' +
        'Type: ' + (data.get('project_type') || '') + '\n\n' +
        message;
      window.location.href =
        'mailto:ashleymbaht@icloud.com?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      say('Opening your mail app…', 'ok');
      return;
    }

    say('Sending…');
    fetch(endpoint, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('bad response');
        form.reset();
        say('Sent. I reply within one working day.', 'ok');
      })
      .catch(function () {
        say('That did not send. Email ashleymbaht@icloud.com instead.', 'err');
      });
  });
})();

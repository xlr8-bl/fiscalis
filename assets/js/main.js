/* ==================================================================
   web3ashley — main.js
   No dependencies. The page is fully readable without it.
   ================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* sticky masthead ------------------------------------------------ */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 30);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* mobile nav ----------------------------------------------------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (toggle && nav) {
    var setNav = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', function () {
      setNav(!nav.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
    });
  }

  /* reveal on enter ------------------------------------------------ */
  var targets = document.querySelectorAll('[data-reveal]');
  if (targets.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var d = parseInt(el.getAttribute('data-reveal-delay'), 10) || 0;
          window.setTimeout(function () { el.classList.add('is-in'); }, d);
          io.unobserve(el);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
      targets.forEach(function (el) { io.observe(el); });
    }
  }

  /* contact form --------------------------------------------------- */
  var form = document.querySelector('[data-form]');
  var status = document.querySelector('[data-form-status]');
  if (form && status) {
    // No endpoint configured -> compose an email instead of POSTing.
    var action = form.getAttribute('data-endpoint') || '';
    var unconfigured = !action;

    form.addEventListener('submit', function (e) {
      if (unconfigured) {
        e.preventDefault();
        var data = new FormData(form);
        var subject = 'Project enquiry — ' + (data.get('project_type') || 'Website');
        var body =
          'Name: ' + (data.get('name') || '') + '\n' +
          'Email: ' + (data.get('email') || '') + '\n' +
          'Type: ' + (data.get('project_type') || '') + '\n\n' +
          (data.get('message') || '');
        window.location.href =
          'mailto:ashleymbaht@icloud.com?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(body);
        status.textContent = 'Opening your mail app…';
        status.setAttribute('data-state', 'ok');
        return;
      }

      e.preventDefault();
      status.textContent = 'Sending…';
      status.removeAttribute('data-state');

      fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then(function (res) {
          if (!res.ok) throw new Error('bad response');
          form.reset();
          status.textContent = 'Sent. I reply within one working day.';
          status.setAttribute('data-state', 'ok');
        })
        .catch(function () {
          status.textContent = 'That did not send. Email ashleymbaht@icloud.com instead.';
          status.setAttribute('data-state', 'err');
        });
    });
  }

  /* footer year ---------------------------------------------------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();

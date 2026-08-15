/* ==================================================================
   transition.js — route wipe between the home page and /book

   These are two separate documents, so there is no single-page router
   to animate between them. The illusion is carried across the load
   instead: the outgoing page wipes a panel up over itself, then hands
   over a sessionStorage flag; the incoming page reads that flag in the
   head, paints already covered, and wipes the panel off in the same
   direction. The motion reads as one continuous pass.
   ================================================================== */
(function () {
  'use strict';

  var FLAG = 'rt-wipe';
  var panel = document.querySelector('[data-route-wipe]');
  if (!panel) return;

  var label = panel.querySelector('[data-route-wipe-label]');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* --- arriving: the head script already put us under the panel ----- */
  if (root.classList.contains('rt-arriving')) {
    var stored = null;
    try { stored = sessionStorage.getItem(FLAG); sessionStorage.removeItem(FLAG); } catch (e) {}
    if (label && stored) label.textContent = stored;

    var reveal = function () {
      root.classList.remove('rt-arriving');
      panel.classList.add('is-reveal');
      window.setTimeout(function () {
        panel.classList.remove('is-reveal');
        panel.removeAttribute('style');
      }, reduced ? 0 : 700);
    };
    // hold the cover until the page has something to reveal
    if (reduced) reveal();
    else window.setTimeout(reveal, 120);
  }

  /* --- leaving: cover, then navigate -------------------------------- */
  var routeFor = function (href) {
    if (href === '/book' || href === 'book.html' || href === '/book.html') return 'Booking';
    if (href === '/' || href === 'index.html' || href === '/index.html') return 'web3ashley';
    return null;
  };

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

    var href = a.getAttribute('href') || '';
    var name = routeFor(href);
    if (!name) return;

    // Barba is bound on the home page and will navigate on its own if the
    // event reaches it, cutting the wipe short. Capture phase plus a hard
    // stop keeps this handler the only one that acts on the click.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (label) label.textContent = name;
    try { sessionStorage.setItem(FLAG, name); } catch (err) {}

    if (reduced) { window.location.href = a.href; return; }

    panel.classList.add('is-cover');
    var went = false;
    var go = function () { if (!went) { went = true; window.location.href = a.href; } };
    panel.addEventListener('transitionend', go, { once: true });
    // the navigation must happen even if the transition never fires
    window.setTimeout(go, 700);
  }, true);
})();

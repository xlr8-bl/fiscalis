/* ==================================================================
   site.js — page-level behaviour that sits alongside the bundle
   Video governor, nav scrim, the menu, live clock, back-to-top.

   This file loads on every page. The bundle does not: app.js is only
   on the home page, which is why the menu lives here instead. Its own
   menu needed three elements that were removed with the template it
   came from, so it bailed out on the pages that had the button.
   ================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     Video governor

     The bundle starts clips on scroll but never reliably stops them, so
     several decode at once and the scroll stutters. Only the clip
     closest to the middle of the viewport is allowed to run; everything
     else is paused, and off-screen clips are rewound so they do not
     resume mid-frame.
     ------------------------------------------------------------------ */
  var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
  if (videos.length) {
    var visible = new Map();
    var active = null;
    var queued = false;

    // Starting playback mid-scroll costs a decode spike, and that spike is
    // what reads as a stutter through the work section. Nothing starts while
    // the page is actually moving; the active clip starts once scrolling
    // settles, which keeps the scroll itself free of decode work.
    var scrolling = false;
    var idleTimer = null;

    var settle = function () {
      queued = false;
      // While the page is moving, touch nothing. Every play(), pause() or
      // seek on a <video> can force decoder work, and issuing that from a
      // scroll-driven callback is precisely the stutter being avoided. The
      // idle timer re-runs this once the page stops.
      if (scrolling) return;

      var best = null, bestScore = 0;
      visible.forEach(function (ratio, v) {
        if (ratio > bestScore) { bestScore = ratio; best = v; }
      });
      active = best;

      videos.forEach(function (v) {
        if (v === active && !reduced) {
          if (v.paused) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        } else if (!v.paused) {
          try { v.pause(); } catch (e) {}
        }
        // no rewind: clips loop, and a seek costs a decode
      });
    };

    window.addEventListener('scroll', function () {
      if (!scrolling) {
        scrolling = true;
        // one pause of the single active clip; nothing else runs mid-scroll
        if (active && !active.paused) { try { active.pause(); } catch (e) {} }
      }
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(function () {
        scrolling = false;
        schedule();
      }, 160);
    }, { passive: true });
    var schedule = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(settle);
    };

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && en.intersectionRatio > 0.15) visible.set(en.target, en.intersectionRatio);
          else visible.delete(en.target);
        });
        schedule();
      }, { threshold: [0, 0.15, 0.4, 0.7, 1] });
      videos.forEach(function (v) {
        v.preload = 'none';
        io.observe(v);
      });
    }

    // A hidden tab should not be decoding anything.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) videos.forEach(function (v) { try { v.pause(); } catch (e) {} });
      else schedule();
    });
  }

  /* ------------------------------------------------------------------
     Nav scrim — a soft dark gradient that fades in under the navbar
     once the page has moved, and fades back out at the top.
     ------------------------------------------------------------------ */
  var nav = document.querySelector('.navbar_wrap');
  if (nav) {
    var scrim = document.createElement('div');
    scrim.className = 'nav_scrim';
    scrim.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(scrim, document.body.firstChild);

    var lastOn = null;
    var onScroll = function () {
      var on = window.scrollY > 60;
      if (on !== lastOn) {
        lastOn = on;
        scrim.classList.toggle('is-on', on);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------
     The menu

     Below 768px the navbar links are hidden and this is the only way
     around the site, so it has to work on every page and it has to get
     out of the way the moment you have chosen something. Tapping a link
     and being left staring at the menu, with the page locked behind it,
     is the failure people remember.
     ------------------------------------------------------------------ */
  var menu = document.querySelector('[data-nav-menu]');
  var toggle = document.querySelector('[data-nav-toggle]');

  if (menu && toggle) {
    var openedFrom = null;

    var lockScroll = function (on) {
      document.documentElement.style.overflow = on ? 'hidden' : '';
      document.body.style.overflow = on ? 'hidden' : '';
      // the smooth-scroll wrapper watches for this
      if (on) document.body.setAttribute('data-lenis-prevent', '');
      else document.body.removeAttribute('data-lenis-prevent');
    };

    var hideTimer = null;

    var setOpen = function (on) {
      if (on === menu.classList.contains('is-open')) return;
      window.clearTimeout(hideTimer);

      if (on) {
        // `hidden` is the resting state in the markup, so that a stylesheet
        // that fails to arrive leaves the panel closed rather than spilling
        // its links down the top of the page. Drop it, let the browser lay
        // the panel out, and only then animate — same frame means no
        // transition at all.
        menu.hidden = false;
        void menu.offsetWidth;
      } else {
        hideTimer = window.setTimeout(function () { menu.hidden = true; }, 380);
      }

      menu.classList.toggle('is-open', on);
      toggle.setAttribute('aria-expanded', String(on));
      // closed, it is out of the tab order and invisible to a screen reader
      if (on) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
      lockScroll(on);
      document.body.dataset.navigationStatus = on ? 'is-open' : 'is-closed';

      if (on) {
        openedFrom = document.activeElement;
        var first = menu.querySelector('a, button');
        if (first) first.focus({ preventScroll: true });
      } else if (openedFrom && openedFrom.focus) {
        openedFrom.focus({ preventScroll: true });
        openedFrom = null;
      }
    };

    // the starting state, set directly: setOpen does nothing when asked for
    // the state it is already in
    menu.hidden = true;
    menu.setAttribute('inert', '');
    toggle.setAttribute('aria-expanded', 'false');

    toggle.addEventListener('click', function () {
      setOpen(!menu.classList.contains('is-open'));
    });

    // Anything chosen inside the menu closes it. An in-page anchor is not a
    // navigation, so nothing else would.
    //
    // On the capture phase, because the bundle intercepts anchor clicks to
    // scroll smoothly and stops them propagating — a listener waiting for
    // the bubble never hears about the one link most likely to be tapped.
    menu.addEventListener('click', function (e) {
      if (e.target.closest('[data-nav-close]') || e.target.closest('a, button')) setOpen(false);
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
    });

    // keep the tab ring inside the panel while it is open
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !menu.classList.contains('is-open')) return;
      var stops = menu.querySelectorAll('a[href], button:not([disabled])');
      if (!stops.length) return;
      var first = stops[0];
      var last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // a back gesture, or a transition that swaps the page under it
    window.addEventListener('pagehide', function () { setOpen(false); });
    window.addEventListener('popstate', function () { setOpen(false); });

    // it belongs to small screens; growing past the breakpoint should not
    // leave an invisible panel holding the scroll lock
    var wide = window.matchMedia('(min-width: 768px)');
    var onWide = function (m) { if (m.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* --- where you are ------------------------------------------------
     Marked on both navigations, so the answer does not depend on which
     one you happen to be looking at.
     ------------------------------------------------------------------ */
  (function () {
    var here = location.pathname.replace(/\/+$/, '') || '/';
    var links = document.querySelectorAll('.navbar_link[href], .nav_menu_link[href]');
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' || href.indexOf('/#') === 0) return;  // a place on the home page
      var path = href.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
      var on = path !== '/' && (here === path || here.indexOf(path + '/') === 0);
      if (on) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('is-here');
      }
    });
  })();

  /* --- About, from a page that does not have the modal ---------------
     Every other item in the menu is a place. About is a panel that only
     the home page carries, so elsewhere it links to /#about and the home
     page opens it on arrival.
     ------------------------------------------------------------------ */
  if (location.hash === '#about') {
    var opener = document.querySelector('[data-open-modal]');
    if (opener) {
      // after the bundle has bound its handler
      window.addEventListener('load', function () {
        setTimeout(function () {
          history.replaceState(null, '', location.pathname + location.search);
          opener.click();
        }, 350);
      });
    }
  }

  /* --- live GMT+1 clock -------------------------------------------- */
  var clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    var fmt = null;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Etc/GMT-1'
      });
    } catch (e) {}
    var tickClock = function () {
      var text;
      if (fmt) text = fmt.format(new Date());
      else {
        var d = new Date(Date.now() + 3600000), p = function (n) { return (n < 10 ? '0' : '') + n; };
        text = p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
      }
      Array.prototype.forEach.call(clocks, function (c) { c.textContent = text; });
    };
    tickClock();
    window.setInterval(tickClock, 15000);
  }

  /* --- footer date -------------------------------------------------- */
  var dateEl = document.querySelector('[data-today]');
  if (dateEl) {
    try {
      var stamp = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Etc/GMT-1'
      }).format(new Date()).toUpperCase().replace(/,/g, '');
      dateEl.textContent = stamp + ' (GMT +01)';
    } catch (e) {}
  }
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* --- back to top -------------------------------------------------- */
  var toTop = document.querySelector('[data-to-top]');
  if (toTop) {
    var bar = toTop.querySelector('[data-to-top-bar]');
    // the bundle already binds #to-top through the smooth-scroller,
    // so only the progress indicator is ours
    if (bar) {
      var progress = function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var pct = h > 0 ? Math.min(1, window.scrollY / h) : 0;
        bar.style.transform = 'scaleX(' + pct.toFixed(3) + ')';
      };
      window.addEventListener('scroll', progress, { passive: true });
      progress();
    }
  }

})();

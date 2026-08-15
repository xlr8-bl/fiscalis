/* ==================================================================
   site.js — page-level behaviour that sits alongside the bundle
   Video governor, nav scrim, live clock, back-to-top.
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

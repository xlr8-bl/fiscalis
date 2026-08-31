/* ------------------------------------------------------------------
   The approach — controller

   Lights one statement at a time and turns the word in the heading with
   it, from a single clock. Pauses off-screen, and hands over to the
   pointer while you are reading a particular line. Honours
   reduced-motion, where nothing moves and the first line simply stays
   lit. Vanilla — no dependency on the animation bundle.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var root = document.querySelector('[data-ash-statement]');
  if (!root) return;

  var rotator = root.querySelector('[data-ash-rotator]');
  var words = rotator ? Array.prototype.slice.call(rotator.children) : [];
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-ash-row]'));
  if (!rows.length) return;

  var DWELL = parseInt(root.getAttribute('data-ash-dwell'), 10) || 3400;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var index = 0;
  var timer = null;
  var visible = false;
  var held = false;

  root.style.setProperty('--ash-dwell', DWELL + 'ms');

  // Size the rotator to the active word so the headline reflows cleanly.
  function fitRotator(i) {
    if (!rotator || !words[i]) return;
    rotator.style.width = words[i].getBoundingClientRect().width + 'px';
  }

  function paint(next) {
    var prev = index;
    index = (next + rows.length) % rows.length;

    rows.forEach(function (row, i) {
      if (i === index) row.setAttribute('data-active', '');
      else row.removeAttribute('data-active');
    });

    if (words.length) {
      words.forEach(function (w, i) {
        w.removeAttribute('data-leaving');
        if (i === index) {
          w.setAttribute('data-active', '');
        } else {
          if (i === prev && prev !== index) w.setAttribute('data-leaving', '');
          w.removeAttribute('data-active');
        }
      });
      fitRotator(index);
    }
  }

  function tick() {
    paint(index + 1);
  }

  function start() {
    if (timer || reduced || !visible || held) return;
    timer = window.setInterval(tick, DWELL);
  }

  function stop() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  // Reading with the pointer takes over from the clock. These are
  // statements rather than controls, so there is nothing to click — the
  // rows used to be buttons that only lit themselves, which is an
  // affordance offering nothing.
  rows.forEach(function (row, i) {
    row.addEventListener('mouseenter', function () {
      held = true;
      stop();
      paint(i);
    });
    row.addEventListener('mouseleave', function () {
      held = false;
      start();
    });
  });

  // Only run while the section is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0.15 }
    ).observe(root);
  } else {
    visible = true;
    start();
  }

  window.addEventListener('resize', function () {
    fitRotator(index);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      fitRotator(index);
    });
  }

  paint(0);
})();

/* ------------------------------------------------------------------
   Statement section controller
   Drives the rotating word, the index and the image panel from one
   clock. Pauses off-screen and on hover; honours reduced-motion.
   Vanilla — no dependency on the animation bundle.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var root = document.querySelector('[data-ash-statement]');
  if (!root) return;

  var rotator = root.querySelector('[data-ash-rotator]');
  var words = rotator ? Array.prototype.slice.call(rotator.children) : [];
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-ash-row]'));
  var imgs = Array.prototype.slice.call(root.querySelectorAll('[data-ash-img]'));
  var caption = root.querySelector('[data-ash-caption]');
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
      // re-trigger the progress hairline by replaying the attribute
      if (i === index) {
        row.removeAttribute('data-active');
        void row.offsetWidth;
        row.setAttribute('data-active', '');
      } else {
        row.removeAttribute('data-active');
      }
    });

    imgs.forEach(function (img, i) {
      if (i === index) img.setAttribute('data-active', '');
      else img.removeAttribute('data-active');
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

    if (caption) {
      var label = rows[index].getAttribute('data-ash-caption-text');
      if (label) caption.textContent = label;
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

  // Hover / focus takes over from the clock.
  rows.forEach(function (row, i) {
    var select = function () {
      held = true;
      stop();
      paint(i);
    };
    row.addEventListener('mouseenter', select);
    var btn = row.querySelector('button');
    if (btn) {
      btn.addEventListener('focus', select);
      btn.addEventListener('click', select);
    }
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

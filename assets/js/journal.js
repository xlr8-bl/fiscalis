/* ==================================================================
   journal.js — the home page's scroll-highlight, on its own.

   Article pages want one effect from the bundle: the standfirst that
   lights up character by character as it scrolls into view. Loading
   app.js to get it would pull in Barba, Three.js and the whole hero
   shader for a page whose job is to be read and to rank, so the effect
   is reproduced here against the same GSAP plugins.
   ================================================================== */
(function () {
  'use strict';

  var targets = document.querySelectorAll('[data-highlight-text]');
  if (!targets.length) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ready = window.gsap && window.ScrollTrigger && window.SplitText;

  // Without GSAP, or with motion turned down, the text simply sits at
  // full strength — the copy is the point, the animation is not.
  if (!ready || reduced) {
    Array.prototype.forEach.call(targets, function (el) { el.style.opacity = '1'; });
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  Array.prototype.forEach.call(targets, function (el) {
    new SplitText(el, {
      type: 'lines, words, chars',
      autoSplit: true,
      onSplit: function (self) {
        return gsap.context(function () {
          var byLine = self.lines.map(function (line) {
            return self.chars.filter(function (ch) { return line.contains(ch); });
          });
          var tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: el.getAttribute('data-highlight-scroll-start') || 'top 90%',
              end: el.getAttribute('data-highlight-scroll-end') || 'center 55%',
              scrub: true,
            },
          });
          byLine.forEach(function (chars, i) {
            tl.from(chars, {
              opacity: 0.2,
              stagger: 0.1,
              ease: 'none',
            }, i * 0.3);
          });
        }, el);
      },
    });
  });
})();

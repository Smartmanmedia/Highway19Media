/* THE BUSINESS CONSULTING PAGE - consulting-body.html, consulting.css.
 * Two things only: the signs rise into place as they reach the screen, and
 * the road in the hero drifts a little slower than the page. Both are off for
 * a reader who has asked for less motion (no cs-anim class - see the shell).
 */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('cs-anim')) return;

  /* everything that should arrive rather than simply be there */
  var sel = '.cs-marker, .cs-exit, .cs-legs li, .cs-lanes, .cs-plan, .cs-open, .cs-miles li, .cs-why-say, ' +
            '.cs-session-img, .cs-session-say, .cs-ai-say, .cs-sign--close';
  var els = [].slice.call(document.querySelectorAll(sel));
  if ('IntersectionObserver' in window) {
    els.forEach(function (el, i) {
      el.setAttribute('data-in', '');
      /* siblings in a row arrive one after another, not all at once */
      var n = [].indexOf.call(el.parentNode.children, el);
      el.style.transitionDelay = Math.min(n, 6) * 70 + 'ms';
    });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* the hero road, a touch of depth */
  var bg = document.querySelector('.cs-hero-bg');
  if (!bg) return;
  var ticking = false;
  addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = Math.min(scrollY, innerHeight);
      bg.style.transform = 'translate3d(0,' + (y * 0.25).toFixed(1) + 'px,0) scale(1.06)';
      ticking = false;
    });
  }, { passive: true });
})();

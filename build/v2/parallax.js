/* Parallax for his clouds, signs and boat. One passive scroll listener, one
 * rAF, and nothing touched but `translate` - so the scaleX his squeezed copy
 * carries survives, and so does anything else with a transform.
 *
 * Amplitude comes from --par on the element, as a share of its section's
 * width. An element entering at the bottom of the screen sits --par below the
 * mark his artboard gives it, crosses the mark at the middle of the screen,
 * and leaves --par above it. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = [].map.call(document.querySelectorAll('.par'), function (el) {
    return { el: el, sec: el.closest('section'),
             par: parseFloat(getComputedStyle(el).getPropertyValue('--par')) || 0 };
  });
  if (!els.length) return;

  var queued = false;
  function frame() {
    queued = false;
    var h = innerHeight;
    for (var i = 0; i < els.length; i++) {
      var e = els[i], r = e.el.getBoundingClientRect();
      /* where the element's middle sits on the screen: 1 at the bottom, 0 at
         the top. Outside that, hold the end value rather than running away. */
      var t = (r.top + r.height / 2) / h;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      var amp = e.sec.clientWidth * e.par / 100;
      e.el.style.translate = '0 ' + ((t - 0.5) * 2 * amp).toFixed(2) + 'px';
    }
  }
  function ping() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', ping, { passive: true });
  addEventListener('resize', ping);
  ping();
})();

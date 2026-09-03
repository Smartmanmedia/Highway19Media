/* Parallax for his clouds, signs, gantries and boat. One passive scroll
 * listener, one rAF, and nothing touched but `translate` - so the scaleX his
 * squeezed copy carries survives, and so does anything else with a transform.
 *
 * PROGRESS IS THE SECTION'S, NOT THE ELEMENT'S. Keyed off each element's own
 * centre, two things that must travel together - his sign and the gantry it
 * hangs from - end up a couple of pixels apart, because their boxes are
 * different heights and so cross the screen at different moments. One progress
 * per section fixes that outright: everything in a scene moves in lockstep and
 * only the amplitude differs, which is what parallax is anyway.
 *
 * --par is that amplitude, as a share of the section's width. The section
 * enters at the bottom of the screen with its art --par low, crosses his mark
 * as the section passes the middle, and leaves --par high. */
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
    var h = innerHeight, seen = new Map();
    for (var i = 0; i < els.length; i++) {
      var e = els[i], p = seen.get(e.sec);
      if (p === undefined) {
        var r = e.sec.getBoundingClientRect();
        /* 0 the moment the section's top reaches the bottom of the screen,
           1 the moment its bottom leaves the top */
        p = (h - r.top) / (h + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        seen.set(e.sec, p);
      }
      e.el.style.translate =
        '0 ' + ((0.5 - p) * 2 * e.sec.clientWidth * e.par / 100).toFixed(2) + 'px';
    }
  }
  function ping() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', ping, { passive: true });
  addEventListener('resize', ping);
  ping();
})();

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
 * as the section passes the middle, and leaves --par high.
 *
 * --par-bias slides that whole travel down the screen without slowing it: at
 * 0.25 the art starts a quarter of the travel lower and never rides as far up,
 * which is how a cloud can drift a long way without sliding out of the top of
 * its own section.
 *
 * And whatever is asked for, an amplitude that WOULD carry a piece off the top
 * or bottom of its section is capped to what fits. A cloud sliding out of the
 * top of the ocean shows a straight cut across it, which is worse than a
 * slower cloud - and the cap is on the amplitude, not the frame, so what
 * motion is left stays smooth. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var i = 0;
  var els = [].map.call(document.querySelectorAll('.par'), function (el) {
    var cs = getComputedStyle(el);
    return { el: el, sec: el.closest('section'),
             want: parseFloat(cs.getPropertyValue('--par')) || 0,
             bias: parseFloat(cs.getPropertyValue('--par-bias')) || 0, amp: 0,
             key: (cs.getPropertyValue('--par-lock').trim() || 'solo:' + i++) +
                  '@' + el.closest('section').className };
  });
  if (!els.length) return;

  /* What actually fits. Measured off the untransformed box - so the translate
   * comes off first - and off getBoundingClientRect rather than offsetTop,
   * because his hero sign is an inline <svg> and SVG elements do not carry
   * offsetTop at all: reading it gave NaN and froze the sign while its own
   * gantry kept moving.
   *
   * The cap is worked out per LOCK GROUP: the sign, its copy and the gantry it
   * hangs from are one object, so capping them separately would separate them
   * again - they take the tightest cap among them. Anything without a
   * --par-lock is capped on its own, so a low cloud that has run out of room
   * does not drag a high one down with it. */
  function fit() {
    for (var j0 = 0; j0 < els.length; j0++) els[j0].el.style.translate = '';
    var caps = {};
    for (var j = 0; j < els.length; j++) {
      var e = els[j], sr = e.sec.getBoundingClientRect(), r = e.el.getBoundingClientRect();
      var want = sr.width * e.want / 100;
      var up = (0.5 - e.bias) * 2, down = (0.5 + e.bias) * 2;
      if (up   > 0) want = Math.min(want, (r.top - sr.top) / up);
      if (down > 0) want = Math.min(want, (sr.bottom - r.bottom) / down);
      e.amp = Math.max(0, want);
      var k = e.key;
      caps[k] = caps[k] === undefined ? e.amp : Math.min(caps[k], e.amp);
    }
    for (j = 0; j < els.length; j++) els[j].amp = caps[els[j].key];
  }
  fit();

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
      e.el.style.translate = '0 ' +
        ((0.5 + e.bias - p) * 2 * e.amp).toFixed(2) + 'px';
    }
  }
  function ping() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', ping, { passive: true });
  addEventListener('resize', function () { fit(); ping(); });
  ping();
})();

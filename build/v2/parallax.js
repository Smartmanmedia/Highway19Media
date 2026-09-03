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
 * --par is that amplitude, as a share of the section's width.
 *
 * NOTHING IS DISPLACED AT THE TOP OF THE PAGE. Each section remembers the
 * progress it had when the page was at scroll zero, and that is the point
 * where its art sits exactly on his marks. It is re-taken every frame the page
 * IS at scroll zero, and on any resize, so it cannot go stale: measured once
 * at load it was wrong inside the artifact frame, which is sized by its host
 * after the script has run, and the hero sign opened low enough to land on the
 * copy underneath it. Anchored to the middle of the pass instead, the hero sign
 * loaded a hundred pixels low and landed on the copy underneath it - his
 * artboard leaves it 68px of clearance, and no amount of tuning gets round
 * that. Anchored to the load, the page opens as he drew it and only moves
 * once you scroll.
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
  var i = 0, p0 = new Map();
  var els = [].map.call(document.querySelectorAll('.par'), function (el) {
    var cs = getComputedStyle(el);
    return { el: el, sec: el.closest('section'),
             want: parseFloat(cs.getPropertyValue('--par')) || 0,
             bias: parseFloat(cs.getPropertyValue('--par-bias')) || 0, amp: 0,
             key: (cs.getPropertyValue('--par-lock').trim() || 'solo:' + i++) +
                  '@' + el.closest('section').className };
  });
  if (!els.length) return;

  function progress(sec) {
    var r = sec.getBoundingClientRect(), h = innerHeight;
    var p = (h - r.top) / (h + r.height);
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /* Where a section's art sits exactly on his marks. For a section you can see
   * when the page opens, that is wherever it is at that moment - the hero has
   * to open as he drew it. For one below the fold nobody is looking, so anchor
   * it at the middle of its pass and let it use its travel both ways. */
  function anchor(sec) {
    var r = sec.getBoundingClientRect();
    return (r.top < innerHeight && r.bottom > 0) ? progress(sec) : 0.5;
  }

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
    for (var j0 = 0; j0 < els.length; j0++) {
      els[j0].el.style.translate = '';
      if (!p0.has(els[j0].sec)) p0.set(els[j0].sec, anchor(els[j0].sec));
    }
    var caps = {};
    for (var j = 0; j < els.length; j++) {
      var e = els[j], sr = e.sec.getBoundingClientRect(), r = e.el.getBoundingClientRect();
      var want = sr.width * e.want / 100, z = p0.get(e.sec) + e.bias;
      var up = (1 - z) * 2, down = z * 2;
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
    /* at the top of the page, the anchor IS the current progress - so any
       resize the script did not hear about corrects itself */
    if (!scrollY) p0.clear();
    var seen = new Map();
    for (var i = 0; i < els.length; i++) {
      var e = els[i], p = seen.get(e.sec);
      if (p === undefined) { p = progress(e.sec); seen.set(e.sec, p); }
      if (!p0.has(e.sec)) p0.set(e.sec, anchor(e.sec));
      e.el.style.translate = '0 ' +
        ((p0.get(e.sec) + e.bias - p) * 2 * e.amp).toFixed(2) + 'px';
    }
  }
  function ping() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', ping, { passive: true });
  function relayout() { p0.clear(); fit(); ping(); }
  addEventListener('resize', relayout);
  addEventListener('load', relayout);
  /* the artifact frame is sized by its host, sometimes after this has run */
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.documentElement);
  ping();
})();

/* His surf swells on four CSS animations that never end (section-02.css). Left
 * alone they keep running when the beach is nowhere near the screen, which on a
 * page this long is most of the time. Six lines of IntersectionObserver park
 * them instead - no scroll listener, no work per frame, and the CSS decides
 * what "parked" means. */
(function () {
  var w = document.querySelectorAll('.waves, .cruise');
  if (!w.length || !window.IntersectionObserver) return;
  var io = new IntersectionObserver(function (rows) {
    for (var i = 0; i < rows.length; i++)
      rows[i].target.classList.toggle('still', !rows[i].isIntersecting);
  }, { rootMargin: '10%' });
  /* NOT parked up front: observe() reports the current state straight away,
     so an element that is already on screen never stops. If the observer
     somehow never fires, the failure is motion rather than no motion. */
  for (var i = 0; i < w.length; i++) io.observe(w[i]);
})();

/* THE READER IS THE SUN.
 *
 * A light at the reader, so a shadow is cast directly away from it, and scroll
 * and every shadow on the page swings because the thing casting it has moved
 * relative to you.
 *
 * THE LIGHT IS AT THE TOP EDGE OF THE SCREEN, NOT ITS MIDDLE, and that is his
 * call rather than mine. With it at the middle, anything in the upper half of
 * the first screen - the hero sign above all - is already past the light before
 * you have scrolled at all, so its shadow can only ever go UP, into the gantry
 * and the sky. At the top edge, the sun starts above everything: a thing below
 * you throws its shadow down, it shortens to nothing as you scroll level with
 * it, and then it stretches up behind. Which is exactly what he described - the
 * sign's shadow starting below it and travelling up past it as you scroll.
 *
 * It writes two numbers per element, --sun-x and --sun-y, which is the same
 * pair the fixed sun uses - so the CSS does not know or care which is driving,
 * and with the script off, or under reduced motion, everything falls back to
 * the -4 degrees he drew.
 *
 * Rides the parallax's own rAF: one listener, one frame, for all of it.
 */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var lit = document.querySelectorAll('[style*="--lift"]');
  if (!lit.length) return;

  function place() {
    var cx = innerWidth / 2, h = innerHeight;
    for (var i = 0; i < lit.length; i++) {
      var el = lit[i], r = el.getBoundingClientRect();
      /* how far from the light, as a share of the screen, capped at 1 so a
         shadow far off the page does not run away to nothing sensible */
      var dx = (r.left + r.width / 2 - cx) / cx;
      var dy = (r.top + r.height / 2) / h;
      var m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      el.style.setProperty('--sun-x', dx.toFixed(3));
      el.style.setProperty('--sun-y', dy.toFixed(3));
    }
  }
  var queued = false;
  function ping() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; place(); });
  }
  addEventListener('scroll', ping, { passive: true });
  addEventListener('resize', ping);
  addEventListener('load', ping);
  place();
})();

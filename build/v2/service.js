/* ============================================================================
   HIS SCROLL SCENE on the service pages (Social Media & Paid Ads' What We Do).
   The section pins one stage for as long as it takes to scroll through it, and
   the scroll position turns that stage from one state to the next:
     - the background changes under everything
     - the card stays where it is and its words change
     - the phone stays: it turns to his next tilt while its screen changes
       (his three phones are one handset in his file, so the new picture is
       laid over the old one exactly, turned the same way, and faded in)
     - on Facebook & Instagram their two marks drift in behind the phone
     - then the light: the phone and the marks go, the card slides across,
       and Google's A and his chart come in
     - then black: Google goes, the card slides back left, and the ChatGPT
       phone flies in with OpenAI's mark turning slowly behind it.
   One state per panel he drew; each holds for a while before it turns.
   Without this script, on a phone or for a reader who asked for less motion,
   the section is simply the four panels one after another.
   ========================================================================= */
(function () {
  var sec = document.querySelector('.wwd');
  if (!sec) return;
  var wide = window.matchMedia('(min-width:821px) and (min-height:561px)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var P = [].slice.call(sec.querySelectorAll('.wwd-p'));
  var N = P.length;
  if (N < 2) return;

  var parts = P.map(function (p) {
    return {
      bg: p.querySelector('.wwd-bg'),
      h: p.querySelector('.wwd-h'),
      card: p.querySelector('.wwd-card'),
      say: [].slice.call(p.querySelectorAll('.wwd-card > *')),
      phone: p.querySelector('.wwd-phone'),
      shadow: p.querySelector('.wwd-shadow'),
      glyphs: [].slice.call(p.querySelectorAll('.wwd-glyph')),
      logo: p.querySelector('.wwd-logo'),
      chart: p.querySelector('.wwd-chart'),
      at: 0                       /* where his card sits in this state: --cx */
    };
  });
  parts.forEach(function (x) {
    if (!x.phone) return;
    var c = x.phone.getAttribute('data-c').split(',');
    x.cx = +c[0]; x.cy = +c[1]; x.rot = +x.phone.getAttribute('data-rot');
  });

  var live = false, u = 1, raf = 0;
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (t) { return t * t * (3 - 2 * t); };
  var set = function (el, o, t) {
    if (!el) return;
    el.style.opacity = o;
    el.style.visibility = o <= 0.001 ? 'hidden' : '';
    el.style.transform = t || '';
  };

  /* every card as tall as the tallest, so a card never changes size when its
     words change */
  function sizeCards() {
    parts.forEach(function (x) { x.card.style.minHeight = ''; });
    if (!live) return;
    var h = 0;
    parts.forEach(function (x) { h = Math.max(h, x.card.offsetHeight); });
    parts.forEach(function (x) { x.card.style.minHeight = h + 'px'; });
  }

  function frame() {
    raf = 0;
    if (!live) return;
    var r = sec.getBoundingClientRect();
    var span = r.height - window.innerHeight;
    var p = span > 0 ? clamp(-r.top / span) * (N - 1) : 0;
    /* q: how far the section has come up into the window before it pins */
    var q = ease(clamp(1 - r.top / window.innerHeight));
    /* e[k]: how far the change from state k to k+1 has gone. Each change
       runs over the middle half of its stretch; the rest is the hold. */
    var e = [];
    for (var k = 0; k < N - 1; k++) e.push(ease(clamp((p - k - 0.25) / 0.5)));
    var into = function (i) { return i === 0 ? 1 : e[i - 1]; };
    var outOf = function (i) { return i === N - 1 ? 0 : e[i]; };

    parts.forEach(function (x, i) {
      var a = into(i), b = outOf(i);
      var next = parts[i + 1], prev = parts[i - 1];
      /* the background: each lays over the last and stays until covered */
      set(x.bg, b >= 1 ? 0 : a);

      /* the card and the heading cross the stage when the next state keeps
         its card somewhere else (right for Google, back left for AI) */
      var mx = 0;
      if (next && b > 0) mx = (next.at - x.at) * b;
      if (prev && a < 1) mx = (prev.at - x.at) * (1 - a);
      var slide = mx ? 'translateX(' + mx * u + 'px)' : '';
      /* the section's heading - the same words each time, so each lays over
         the last; when the card crosses, it fades across with it */
      var moves = next && next.at !== x.at;
      set(x.h, b >= 1 ? 0 : (moves ? Math.min(a, 1 - b) : a), slide);

      /* the card: one white card whose words change. The old words go in the
         first half of the change, the new ones come in the second. */
      var cardOn, sayO;
      if (i > 0 && a < 1) { cardOn = a >= 0.5; sayO = (a - 0.5) * 2; }
      else if (b > 0) { cardOn = b < 0.5; sayO = 1 - b * 2; }
      else { cardOn = a >= 1; sayO = 1; }
      set(x.card, cardOn ? 1 : 0, slide);
      x.say.forEach(function (s) { s.style.opacity = clamp(sayO); });

      /* the phone: turned and moved to meet the next one while the next one's
         screen fades in over it; leaving for the light, it drops away */
      if (x.phone) {
        var o = 1, dx = 0, dy = 0, dr = 0;
        if (i > 0 && prev && prev.phone && a < 1) {
          o = a; dx = (prev.cx - x.cx) * (1 - a); dy = (prev.cy - x.cy) * (1 - a); dr = (prev.rot - x.rot) * (1 - a);
        } else if (i > 0 && prev && !prev.phone && a < 1) {
          /* after a state with no phone, it flies in the way the first one did */
          o = a; dx = 560 * (1 - a); dy = 300 * (1 - a); dr = 30 * (1 - a);
        } else if (i > 0 && a <= 0) o = 0;
        if (next && next.phone && b > 0) {
          o = b >= 1 ? 0 : o; dx = (next.cx - x.cx) * b; dy = (next.cy - x.cy) * b; dr = (next.rot - x.rot) * b;
        }
        if (next && !next.phone && b > 0) { o = 1 - b; dy = 260 * b; dr = 12 * b; }
        /* the first phone flies in from the right and turns upright as the
           section scrolls up into the window, and lands as it pins */
        if (i === 0 && q < 1) { o = q; dx += 560 * (1 - q); dy += 300 * (1 - q); dr += 30 * (1 - q); }
        set(x.phone, o, 'translate(' + dx * u + 'px,' + dy * u + 'px) rotate(' + dr + 'deg)');
        set(x.shadow, o > 0 ? Math.min(o, next && !next.phone ? 1 - b : 1) : 0,
            'translateX(' + dx * u + 'px)');
      }

      /* the marks behind the phone - Facebook and Instagram, then OpenAI's:
         in with their state, gone with it */
      x.glyphs.forEach(function (g, n) {
        var w = Math.min(a, 1 - b);
        set(g, w, 'translate(' + (n ? 60 : -60) * (1 - a) * u + 'px,' + (90 * (1 - a) - 140 * b) * u + 'px) scale(' + (0.85 + 0.15 * a) + ')');
      });

      /* the light: Google's A in from the right, his chart from the left, and
         out the same ways when the next state comes */
      if (x.logo) set(x.logo, Math.min(a, 1 - b), 'translateX(' + 420 * (1 - a + b) * u + 'px)');
      if (x.chart) set(x.chart, Math.min(a, 1 - b), 'translateX(' + -360 * (1 - a + b) * u + 'px)');
    });
  }

  function clear() {
    sec.querySelectorAll('[style]').forEach(function (el) {
      ['opacity', 'visibility', 'transform', 'minHeight'].forEach(function (k) { el.style[k] = ''; });
    });
  }

  function mode() {
    var on = wide.matches && !still.matches;
    if (on !== live) {
      live = on;
      sec.classList.toggle('is-live', live);
      if (!live) clear();
    }
    /* a screen of scrolling for each state */
    sec.style.height = live ? N * 100 + 'vh' : '';
    P.forEach(function (p, i) { parts[i].at = parseFloat(getComputedStyle(p).getPropertyValue('--cx')) || 0; });
    u = Math.min(1, window.innerHeight / 900, (window.innerWidth - 40) / 1110);
    sizeCards();
    frame();
  }
  var tick = function () { if (!raf) raf = requestAnimationFrame(frame); };

  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', mode);
  if (wide.addEventListener) { wide.addEventListener('change', mode); still.addEventListener('change', mode); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(mode);
  mode();
})();

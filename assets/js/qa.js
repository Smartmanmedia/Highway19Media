/* Highway 19 Media — Q&A behaviour.
   Answers are shut by default, one open at a time per section. His artboard is
   never redrawn: sections whose ground is flat between the cards and the CTA
   close or open that flat band as the column changes height; the rest keep his
   exact height and the column stays inside the room he drew for it. */
(function () {
  'use strict';

  var cols = [].slice.call(document.querySelectorAll('.col'));

  cols.forEach(function (col) {
    var sec   = col.closest('.sec');
    var items = [].slice.call(col.querySelectorAll('.qa'));
    var isFlex = sec.hasAttribute('data-flex');

    /* his drawn room: from the first card down to the top of his CTA panel,
       in his own artboard pixels - converted through the page unit */
    var room = parseFloat(col.dataset.room || '0');
    var drawn = parseFloat(col.dataset.drawn || '0');
    function unit() {
      var a = sec.querySelector('.art, .art-a');
      return a ? a.getBoundingClientRect().width / 3088 : 1;
    }

    function fit() {
      var u = unit();
      var h = col.getBoundingClientRect().height / u;
      if (isFlex) {
        /* open or close his flat band so the CTA keeps the gap he drew */
        sec.style.setProperty('--flex', 'calc(' + (h - drawn).toFixed(1) + '*var(--u))');
        col.style.transform = '';
      } else if (room) {
        /* fixed height: never let the column reach his CTA */
        var over = h - room;
        col.style.transform = over > 0 ? 'translateY(' + (-over * u).toFixed(1) + 'px)' : '';
      }
    }

    items.forEach(function (qa) {
      var btn = qa.querySelector('.qa-q');
      btn.addEventListener('click', function () {
        var wasOpen = qa.classList.contains('is-open');
        items.forEach(function (o) {
          o.classList.remove('is-open');
          o.querySelector('.qa-q').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          qa.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
        fit();
      });
    });

    /* the column's height animates as an answer opens, so follow it frame by
       frame rather than reading it once and landing on the stale number */
    if (window.ResizeObserver) new ResizeObserver(fit).observe(col);

    col.__fit = fit;
    fit();
  });

  addEventListener('resize', function () {
    cols.forEach(function (c) { if (c.__fit) c.__fit(); });
  });

  /* ---------- his signs, on parallax ----------
     Driven by where the sign itself is on screen, not by how far through his
     section we are: he drew one sign across the 05/06 seam, and two halves
     each riding their own section's progress tore it in half. */
  /* his signs, and his clouds above them. A cloud is the highest thing he
     drew, so it overtakes everything on the page; the shadow it throws is on
     his ground and stays there, which is what makes the pair read as height. */
  var signs = [].slice.call(document.querySelectorAll('[data-sign],[data-para]'));
  signs.forEach(function (g) {
    g.style.willChange = 'transform';
    g.__sec = g.closest('.sec');
    g.__amt = g.getAttribute('data-para') === 'cloud' ? 760
            : parseFloat(g.getAttribute('data-sign-travel') || '520');
    try {
      var bb = g.getBBox();
      g.__cx = (bb.x + bb.width / 2).toFixed(1);
      g.__cy = (bb.y + bb.height / 2).toFixed(1);
      var sr = g.__sec.getBoundingClientRect(), gr = g.getBoundingClientRect();
      /* its middle, as a fraction of his section, so it survives any resize */
      g.__frac = sr.height ? ((gr.top - sr.top) + gr.height / 2) / sr.height : 0.5;
    } catch (e) { g.__cx = 1064; g.__cy = 0; g.__frac = 0.5; }
    var sr2 = g.__sec.getBoundingClientRect();
    g.__secTop = sr2.top + scrollY;
    g.__secH = sr2.height || 1;
    g.__page = g.__secTop + g.__frac * g.__secH;     /* his sign on the page */
  });

  /* a sign he drew across a seam arrives as two halves in two sections; they
     share one anchor so they move as the single sign he drew */
  signs.slice().sort(function (a, b) { return a.__page - b.__page; })
    .forEach(function (g, i, list) {
      var prev = list[i - 1];
      if (!prev || g.__page - prev.__page > 220) return;
      if ((prev.getAttribute('data-para') || '') !== (g.getAttribute('data-para') || '')) return;
      var mid = (prev.__anchor || prev.__page + g.__page) / (prev.__anchor ? 1 : 2);
      prev.__anchor = mid; g.__anchor = mid;
      var cx = (parseFloat(prev.__cx) + parseFloat(g.__cx)) / 2;
      [prev, g].forEach(function (h) {
        h.__frac = (h.__anchor - h.__secTop) / h.__secH;
        /* both halves swell about the one point, or the scale slides them
           apart and his sign shows a step where he drew none */
        var a = h.__sec.querySelector('.art, .art-a');
        var u = a ? a.getBoundingClientRect().width / 3088 : 1;
        h.__cx = cx.toFixed(1);
        h.__cy = (u ? (h.__anchor - h.__secTop) / u : 0).toFixed(1);
      });
      g.__leader = prev.__leader || prev;
    });

  var queued = false;
  function frame() {
    queued = false;
    var vh = innerHeight;
    for (var i = 0; i < signs.length; i++) {
      var g = signs[i], r = g.__sec.getBoundingClientRect();
      if (r.bottom < -700 || r.top > vh + 700) continue;
      var lead = g.__leader;
      var p;
      if (lead && lead.__p != null) { p = lead.__p; }
      else {
        var mid = r.top + r.height * g.__frac;      /* the sign's own middle */
        p = (vh - mid) / vh;                        /* 1 at the top, 0 at the foot */
        if (p < -0.4) p = -0.4; else if (p > 1.4) p = 1.4;
        g.__p = p;
      }
      /* the sign rides well above the ground it is bolted over, and leans in
         a little as it passes, so it reads as the nearest thing on the page */
      /* it starts below where he drew it, sits exactly on it halfway up the
         screen and carries on above it - and it TRAVELS. Nothing swells: a
         sign that grows reads as a zoom, not as something close by. */
      var off = (0.5 - p) * g.__amt;
      g.setAttribute('transform', 'translate(0 ' + off.toFixed(2) + ')');
    }
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  if (signs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    frame();
  }
})();

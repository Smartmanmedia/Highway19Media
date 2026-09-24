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

  /* ---------- his signs, on parallax ---------- */
  var signs = [].slice.call(document.querySelectorAll('[data-sign]'));
  signs.forEach(function (g) {
    g.style.willChange = 'transform';
    g.__sec = g.closest('.sec');
    g.__amt = parseFloat(g.getAttribute('data-sign-travel') || '190');
    try { var bb = g.getBBox(); g.__cx = (bb.x + bb.width / 2).toFixed(1);
          g.__cy = (bb.y + bb.height / 2).toFixed(1); }
    catch (e) { g.__cx = 1064; g.__cy = 0; }
  });

  var queued = false;
  function frame() {
    queued = false;
    var vh = innerHeight;
    for (var i = 0; i < signs.length; i++) {
      var g = signs[i], r = g.__sec.getBoundingClientRect();
      if (r.bottom < -400 || r.top > vh + 400) continue;
      var p = (vh - r.top) / (vh + r.height);          /* 0 entering → 1 leaving */
      /* the sign rides well above the ground it is bolted over, and leans in
         a little as it passes, so it reads as the nearest thing on the page */
      var off = (p - 0.5) * g.__amt;
      var sc = 1 + (0.5 - Math.abs(p - 0.5)) * 0.055;
      g.setAttribute('transform',
        'translate(0 ' + off.toFixed(2) + ') translate(' + g.__cx + ' ' + g.__cy +
        ') scale(' + sc.toFixed(4) + ') translate(' + (-g.__cx) + ' ' + (-g.__cy) + ')');
    }
  }
  function onScroll() { if (!queued) { queued = true; requestAnimationFrame(frame); } }

  if (signs.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    frame();
  }
})();

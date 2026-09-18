/* =============================================================
   Carpenter Rick — reveal on scroll

   Elements marked data-reveal rise a little and fade in the first
   time they reach the viewport, then stop being watched. Repeated
   items (spec rows, option columns) get their stagger index here so
   the markup stays clean.

   The motion is on opacity and the `translate` property — never
   `transform`, which the layout already uses for the artwork's
   horizontal scaling.
   ============================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (!items.length) return;

  /* Stagger the repeated groups by position within their own list. */
  [['.s3__specs li', 0], ['.s5__options li', 2]].forEach(function (pair) {
    [].forEach.call(document.querySelectorAll(pair[0]), function (el, i) {
      el.style.setProperty('--i', i + pair[1]);
    });
  });

  var show = function (el) { el.classList.add('is-in'); };

  /* No IntersectionObserver, or the visitor asked for less motion:
     show everything and skip the animation entirely. */
  if (!('IntersectionObserver' in window) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.remove('reveal');
    items.forEach(show);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      show(e.target);
      io.unobserve(e.target);
    });
  }, {
    /* fires a little before the element is fully in frame, so the
       movement finishes as it settles rather than after */
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.08
  });

  items.forEach(function (el) { io.observe(el); });

  /* Section 3 gallery: advances on its own, and can be dragged or
     stepped with the arrows. Any interaction parks the timer for a
     while so it does not yank the photo out from under you. */
  var track = document.getElementById('s3-slides');
  if (track) {
    var slides = track.querySelectorAll('img').length;
    var at = 0, timer = null, idle = null, width = 0;
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    var place = function () { track.style.translate = (at * -100) + '% 0'; };
    var to = function (i) { at = (i + slides) % slides; place(); };
    var go = function () { to(at + 1); };

    var play = function () { if (!timer && !still) timer = setInterval(go, 4200); };
    var stop = function () { clearInterval(timer); timer = null; };
    /* after a manual move, hold off for 9s before resuming */
    var hold = function () { stop(); clearTimeout(idle); idle = setTimeout(play, 9000); };

    var onscreen = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { onscreen = e.isIntersecting; onscreen ? play() : stop(); });
    }, { threshold: 0.25 }).observe(track);

    track.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') stop();
    });
    track.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' && onscreen) play();
    });

    [['.s3__arrow--prev', -1], ['.s3__arrow--next', 1]].forEach(function (pair) {
      var btn = document.querySelector(pair[0]);
      if (btn) btn.addEventListener('click', function () { to(at + pair[1]); hold(); });
    });

    /* drag / swipe */
    var down = false, startX = 0, dx = 0;
    track.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = true; startX = e.clientX; dx = 0;
      width = track.getBoundingClientRect().width || 1;
      track.classList.add('is-dragging');
      track.setPointerCapture(e.pointerId);
      stop();
    });
    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      dx = e.clientX - startX;
      track.style.translate = 'calc(' + (at * -100) + '% + ' + dx + 'px) 0';
    });
    var release = function () {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
      if (Math.abs(dx) > Math.min(70, width * 0.12)) to(at + (dx < 0 ? 1 : -1));
      else place();
      hold();
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
  }

  /* The looping video only runs while it is on screen — 3.5MB of
     decoding in a section nobody is looking at is wasted battery. */
  var vid = document.querySelector('.s7__video');
  if (vid) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { var p = vid.play(); if (p) p.catch(function () {}); }
        else vid.pause();
      });
    }, { threshold: 0.12 });
    vio.observe(vid);
  }

  /* Failsafe. The observer only runs while the page is actually
     rendering, so a throttled or restored tab could otherwise leave
     content sitting at opacity 0. Anything already in frame gets
     shown regardless. */
  var sweep = function () {
    items.forEach(function (el) {
      if (el.classList.contains('is-in')) return;
      var b = el.getBoundingClientRect();
      if (b.top < innerHeight && b.bottom > 0) { show(el); io.unobserve(el); }
    });
  };

  addEventListener('load', sweep);
  addEventListener('pageshow', function (e) { if (e.persisted) sweep(); });
  setTimeout(sweep, 1500);
})();

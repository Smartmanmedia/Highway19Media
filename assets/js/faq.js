/* Highway 19 Media — Questions & Answers page behaviour.
   Same posture as site.js: as little JavaScript as the page can get away with.

   Progressive enhancement is the rule here. Every answer is OPEN in the
   markup, so a visitor with no JavaScript — and every crawler that does not
   run it — gets the whole page as plain readable text. This script is what
   closes them. If it never loads, nothing is lost but the folding.

   Three jobs:
     1. the accordions, one answer open at a time within a section
     2. the sticky offsets, measured rather than hard-coded
     3. the category nav: smooth scroll, and which exit you are currently on
*/
(function () {
  'use strict';

  var reduce = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function slow() { return !reduce.matches; }
  function behavior() { return reduce.matches ? 'auto' : 'smooth'; }
  function list(nodes) { return Array.prototype.slice.call(nodes || []); }

  /* ======================================================================
     1. STICKY OFFSETS
     ----------------------------------------------------------------------
     The header and the category nav are both sticky, and the second has to
     sit under the first. Both heights change with the breakpoint (the header
     drops its nav at 1040px, the pills get smaller at 720px), so they are
     measured and written to the page rather than guessed. The CSS carries
     fallbacks for the case where this never runs.
     ==================================================================== */

  var header = document.querySelector('.site-header');
  var catnav = document.querySelector('.qa-exits');   /* the exit gantry */

  function measure() {
    var root = document.documentElement;
    if (header) root.style.setProperty('--hdr-h', header.offsetHeight + 'px');
    if (catnav) root.style.setProperty('--qa-exits-h', catnav.offsetHeight + 'px');
  }

  /* ======================================================================
     2. ACCORDION
     ----------------------------------------------------------------------
     Opening an answer makes the page taller, which moves every section below
     it — and the road is measured from those sections. Nothing here has to
     tell the road: road.js keeps a ResizeObserver on .page and re-fits when
     the height moves by more than a hair, and its debounce is longer than
     this transition, so a burst of opens settles into one re-fit.
     ==================================================================== */

  function panelOf(item)   { return item.querySelector('.qa-panel'); }
  function triggerOf(item) { return item.querySelector('.qa-q'); }

  function open(item) {
    if (!item || item.classList.contains('is-open')) return;
    var panel = panelOf(item), trigger = triggerOf(item);
    if (!panel || !trigger) return;

    window.clearTimeout(item._h19t);
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');

    if (!slow()) { item.classList.add('is-open'); return; }
    /* Two frames, not one: the panel has to be laid out at 0fr and painted
       before the class change to 1fr can be a transition rather than a jump. */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { item.classList.add('is-open'); });
    });
  }

  function close(item) {
    if (!item || !item.classList.contains('is-open')) return;
    var panel = panelOf(item), trigger = triggerOf(item);
    if (!panel || !trigger) return;

    window.clearTimeout(item._h19t);
    item.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    /* Hidden only once it has finished collapsing, so the answer leaves the
       tab order and the screen-reader flow instead of lingering at 0 height.
       A timer rather than transitionend: with reduced motion there is no
       transition to end. */
    item._h19t = window.setTimeout(function () { panel.hidden = true; }, slow() ? 320 : 0);
  }

  function toggle(item) {
    if (item.classList.contains('is-open')) { close(item); return; }
    /* One answer at a time, per section — not per page, so jumping to a
       category never silently folds away what you were reading above it. */
    var group = item.closest('.qa-list');
    if (group) {
      list(group.querySelectorAll('.qa-item')).forEach(function (other) {
        if (other !== item) close(other);
      });
    }
    open(item);
  }

  list(document.querySelectorAll('.qa-item')).forEach(function (item) {
    var trigger = triggerOf(item), panel = panelOf(item);
    if (!trigger || !panel) return;

    /* Every answer starts SHUT. The first one of each list was open here
       because his artboard draws it that way — but he drew it open to show
       what an answer looks like inside, not to say the page loads like that.
       Closed is the default; a question opens when someone asks it. */
    item.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    panel.hidden = true;

    trigger.addEventListener('click', function () { toggle(item); });
  });

  /* A link straight to one question — /faq.html#q-landing-page — opens it. */
  function openFromHash() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var target;
    try { target = document.querySelector(hash); } catch (e) { return; }
    if (!target || !target.closest) return;
    var item = target.closest('.qa-item');
    if (!item) return;
    toggle(item);
    item.scrollIntoView({ behavior: behavior(), block: 'center' });
  }

  /* ======================================================================
     3. CATEGORY NAV
     ==================================================================== */

  var navList = document.querySelector('.qa-exits__list');
  var links = list(document.querySelectorAll('.qa-exits__link'));

  function keepInView(link) {
    if (!navList || !link) return;
    var row = navList.getBoundingClientRect();
    var pill = link.getBoundingClientRect();
    if (pill.left >= row.left && pill.right <= row.right) return;
    navList.scrollTo({
      left: navList.scrollLeft + (pill.left - row.left) - (row.width - pill.width) / 2,
      behavior: behavior()
    });
  }

  /* The edge fade is a scroll affordance; with every pill already visible it
     is just a white smudge over the last one. */
  function fade() {
    if (!navList || !catnav) return;
    catnav.classList.toggle('is-complete', navList.scrollWidth <= navList.clientWidth + 1);
  }

  var linkFor = {};

  links.forEach(function (link) {
    var id = (link.getAttribute('href') || '').replace(/^#/, '');
    if (!id) return;
    linkFor[id] = link;

    link.addEventListener('click', function (e) {
      var section = document.getElementById(id);
      if (!section) return;                       /* let the browser try */
      e.preventDefault();
      section.scrollIntoView({ behavior: behavior(), block: 'start' });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#' + id);
      }
      /* Keyboard and screen-reader users land on the heading, not back at the
         top of the document — without a second scroll undoing the first. */
      var h = section.querySelector('h2');
      if (h) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
      }
    });
  });

  var sections = list(document.querySelectorAll('.qa-sec')).filter(function (s) {
    return s.id && linkFor[s.id];
  });

  if (sections.length && 'IntersectionObserver' in window) {
    var showing = {};
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { showing[entry.target.id] = entry.isIntersecting; });
      /* LAST section crossing the band under the two sticky bars wins. Two
         sections overlap that band at every boundary, and the lower one is
         the one being scrolled into — taking the first marked the exit you
         had just left. */
      for (var i = sections.length - 1; i >= 0; i--) {
        if (showing[sections[i].id]) {
          var id = sections[i].id;
          links.forEach(function (link) {
            if (link === linkFor[id]) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
          keepInView(linkFor[id]);
          return;
        }
      }
    }, { rootMargin: '-22% 0px -62% 0px', threshold: 0 });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ======================================================================
     BOOT
     ==================================================================== */

  measure();
  fade();
  openFromHash();

  var resizeT;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(function () { measure(); fade(); }, 120);
  });
  if (navList) navList.addEventListener('scroll', fade, { passive: true });
  window.addEventListener('hashchange', openFromHash);


  /* ── Day and night on the bar ───────────────────────────────────────────
     The header is sticky and the ground under it goes black for two sections,
     so it goes with it. The night stretches are the blocks that already tell
     road.js his asphalt turns black there, read once and on resize. */
  (function () {
    var header = document.getElementById('site-header');
    if (!header) return;
    var bands = [];
    function measure() {
      bands = Array.prototype.map.call(
        document.querySelectorAll('[data-asphalt="#161616"]'), function (n) {
          var r = n.getBoundingClientRect();
          return [r.top + window.pageYOffset, r.bottom + window.pageYOffset];
        });
      paint();
    }
    var on = false;
    function paint() {
      var y = window.pageYOffset + header.offsetHeight * 0.6, night = false, i;
      for (i = 0; i < bands.length; i++)
        if (y >= bands[i][0] && y <= bands[i][1]) { night = true; break; }
      if (night === on) return;
      on = night;
      header.classList.toggle('is-night', night);
    }
    measure();
    window.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', measure);
    /* Opening an answer moves everything below it. */
    document.addEventListener('click', function (e) {
      if (e.target.closest('.qa-q')) setTimeout(measure, 420);
    });
  })();

})();

/* ============================================================================
   HIS SIGNS, ON THE PARALLAX
   ----------------------------------------------------------------------------
   A sign on a gantry stands closer to the camera than the ground behind it, so
   it should not travel with the ground. Each one drifts against the scroll by a
   fraction of its own distance through the viewport — the plate and the truss
   together, because they are one object — and the shadow it throws opens up as
   it does. Nothing here runs per frame: the position is written on scroll,
   through one rAF, and only for the signs actually on screen.
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var signs = [].slice.call(document.querySelectorAll(
    '.hwy-sign--section, .hwy-exits__panel, #qa-hero .hwy-sign'));
  if (!signs.length) return;

  /* How far each kind of sign lags the ground, as a fraction of the distance
     it travels through the viewport. The gantry is the nearest object on the
     page and moves most; a section sign hangs a little further back. */
  function depthOf(el) {
    if (el.classList.contains('hwy-exits__panel')) return 0.085;
    if (el.closest('#qa-hero')) return 0.10;
    return 0.055;
  }

  var items = signs.map(function (el) {
    return { el: el, depth: depthOf(el), on: false, last: null };
  });
  var ticking = false, vh = window.innerHeight;

  function place() {
    ticking = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], r = it.el.getBoundingClientRect();
      it.on = r.bottom > -240 && r.top < vh + 240;
      if (!it.on) continue;
      /* -1 at the bottom of the screen, +1 at the top. */
      var t = 1 - 2 * ((r.top + r.height / 2) / vh);
      var y = (t * vh * 0.5 * it.depth).toFixed(1);
      if (y === it.last) continue;
      it.last = y;
      it.el.style.setProperty('--sign-lift', y + 'px');
    }
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(place);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { vh = window.innerHeight; onScroll(); });
  /* Answers opening move every sign below them, so re-place on that too. */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.qa-q')) setTimeout(onScroll, 360);
  });
  window.addEventListener('load', place);
  place();
})();

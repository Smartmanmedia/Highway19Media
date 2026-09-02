/* ============================================================================
   HIGHWAY 19 MEDIA — SCENERY
   ============================================================================

   Two jobs, both independent of how the artwork itself is cut up.

   1. OCCLUSION.  Vehicles are DOM nodes in one layer above the road. Anything
      that should pass IN FRONT of a vehicle -- a tunnel mouth, a rock the road
      ducks behind, the near face of a truss -- goes in #fg-layer, which sits
      above the traffic and below the copy. A car drives in, the tunnel mouth
      paints over it, it comes out the far side. No masks, no clip paths, and
      nothing to compute per frame.

        section backgrounds        (flow)
        #scene-layer   z-index 0   painted scenery
        #road-layer    z-index 1   asphalt + traffic
        #fg-layer      z-index 2   whatever passes in front of a car
        .sec__inner    z-index 3   copy, always on top

   2. MOTION.  Two kinds, both opt-in by data attribute so the artwork decides
      what moves rather than this file:

        data-parallax="0.18"   drifts against the scroll. The SIGN sets the
                               direction and is the whole control:
                                 positive lags behind the page, sinking as you
                                 scroll down — that reads as distance, which is
                                 what clouds and scenery want (0.08 to 0.3,
                                 smaller the further back);
                                 negative runs ahead, rising as you scroll down
                                 — that reads as nearness, which is what a sign
                                 standing in front of the scene wants (-0.2).
                               0 pins it to the page.
        data-drift="30,9,26"   travels on its own clock: horizontal reach in
                               px, vertical bob in px, seconds for a full
                               cycle. The boat.

      Both are measured from the element's designed position, and both stop
      dead under prefers-reduced-motion -- the page is still readable when
      nothing moves, which is the point.
   ========================================================================= */

(function () {
  'use strict';

  var page = document.getElementById('main');
  if (!page) return;

  var still = window.matchMedia &&
              window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================================
     1. Mount whatever artwork the build inlined.
     Parsed through DOMParser, not innerHTML, so the SVG namespace and the
     xlink hrefs survive. Absent artwork is not an error: the page is built to
     stand up without it, and the layers stay empty until the art lands.
     ====================================================================== */

  function mount(markup, into) {
    var host = document.getElementById(into);
    if (!host || !markup) return null;
    var doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    var svg = doc.documentElement;
    if (!svg || svg.nodeName === 'parsererror') return null;
    host.appendChild(document.importNode(svg, true));
    return host;
  }

  mount(window.H19_SCENE, 'scene-layer');
  mount(window.H19_FG, 'fg-layer');

  /* ==========================================================================
     2. Collect what moves.
     Read once. Each entry keeps its own designed position so the maths never
     accumulates drift, and so a resize can just re-measure.
     ====================================================================== */

  var movers = [];

  function collect() {
    movers.length = 0;
    if (still) return;

    var nodes = page.querySelectorAll('[data-parallax],[data-drift]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var box = n.getBoundingClientRect();
      var m = {
        node: n,
        /* centre in page coordinates, so the piece sits exactly where it was
           drawn at the moment it is centred in the window */
        mid: box.top + window.pageYOffset + box.height / 2,
        rate: parseFloat(n.getAttribute('data-parallax')) || 0,
        cap: Math.max(60, box.height * 0.6),
        drift: null,
        x: 0, y: 0, rot: 0
      };
      var d = n.getAttribute('data-drift');
      if (d) {
        var p = d.split(',').map(parseFloat);
        m.drift = {
          reach: p[0] || 0,
          bob: p.length > 1 ? p[1] : 0,
          period: (p.length > 2 ? p[2] : 24) || 24,
          phase: Math.random() * Math.PI * 2
        };
      }
      /* An element carrying a multiply shadow must NOT be moved by transform:
         a transform creates a stacking context, the blend is isolated, and the
         shadow renders flat grey instead of darkening what it sits on. Those
         are moved by top/left instead, which costs a little layout and is
         worth it. Measured both ways over the same blue: #022751 by top,
         #666666 by transform. */
      m.byTop = n.getAttribute('data-move') === 'top';
      if (m.byTop) {
        m.baseTop  = parseFloat(n.style.top)  || 0;
        m.baseLeft = parseFloat(n.style.left) || 0;
      } else {
        n.style.willChange = 'transform';
      }
      movers.push(m);
    }
  }

  /* ==========================================================================
     3. One loop for all of it.
     Scroll-driven pieces only need a frame when the page has actually moved;
     the drifting ones need one every frame, so the loop only runs at all when
     something on the page drifts or the scroll position changed.
     ====================================================================== */

  var lastY = -1, drifting = false, running = true, started = false;

  /* The loop starts on demand rather than at boot. There is nothing to paint
     until artwork with data-parallax or data-drift on it exists, and artwork
     can arrive after this file runs — so anything that changes the mover list
     calls this, and an empty page never spins a frame loop for nothing. */
  function ensureLoop() {
    drifting = movers.some(function (m) { return !!m.drift; });
    if (started || !movers.length) return;
    started = true;
    requestAnimationFrame(paint);
  }

  function paint(t) {
    var y = window.pageYOffset;
    var moved = y !== lastY;
    lastY = y;

    if (running && (moved || drifting)) {
      var mid = y + window.innerHeight / 2;
      var secs = t / 1000;

      for (var i = 0; i < movers.length; i++) {
        var m = movers[i];

        /* Off screen by more than a screen: leave it where it is. */
        if (Math.abs(m.mid - mid) > window.innerHeight * 1.5) continue;

        /* Assign, never accumulate: the bob below adds to this, and a piece
           that drifts without a parallax rate would otherwise creep down the
           page a few pixels every frame. */
        /* Offset is measured from the viewport centre, so an unusually tall
           window would shove a piece hundreds of pixels off its mark — a
           full-page screenshot at 9000px lifted the hero sign clean out of
           frame. Cap the travel against the piece's own height so it can
           drift but never leave. */
        m.y = m.rate ? (mid - m.mid) * m.rate : 0;
        if (m.y > m.cap) m.y = m.cap; else if (m.y < -m.cap) m.y = -m.cap;

        if (m.drift) {
          var a = (secs / m.drift.period) * Math.PI * 2 + m.drift.phase;
          m.x = Math.sin(a) * m.drift.reach;
          m.y += Math.sin(a * 2.3) * m.drift.bob;
          /* a boat leans into its own travel; tiny, or it reads as a wobble */
          m.rot = Math.cos(a) * 1.2;
        }

        if (m.byTop) {
          m.node.style.top  = (m.baseTop  + m.y).toFixed(1) + 'px';
          m.node.style.left = (m.baseLeft + m.x).toFixed(1) + 'px';
        } else {
          m.node.style.transform =
            'translate3d(' + m.x.toFixed(1) + 'px,' + m.y.toFixed(1) + 'px,0)' +
            (m.rot ? ' rotate(' + m.rot.toFixed(2) + 'deg)' : '');
        }
      }
    }
    requestAnimationFrame(paint);
  }

  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
  });

  collect();
  ensureLoop();

  /* Re-measure after a resize settles: every designed position has moved. */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      collect();
      lastY = -1;
      ensureLoop();
    }, 140);
  }, { passive: true });

  /* Test hook, same shape as the traffic one. */
  window.__scene = {
    get movers() { return movers; },
    recollect: function () { collect(); lastY = -1; ensureLoop(); }
  };
})();

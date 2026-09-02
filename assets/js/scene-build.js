/* ============================================================================
   HIGHWAY 19 MEDIA — BUILDING THE SCENE FROM THE OWNER'S CANVAS
   ============================================================================

   THE PROBLEM THIS SOLVES
   -----------------------
   His artwork is composed on a canvas 2472 x 5120. The live page is about
   twice that tall in proportion, because the copy takes far more room than a
   comp allows — and it changes again every time a line is edited or the window
   is resized. So every Y position in his file is exact on his canvas and
   meaningless on ours.

   Chopping the scenery into per-section backgrounds was the wrong answer: it
   puts a hard edge at every section boundary, and his design has none — his
   pieces overlap and flow past each other.

   THE ANSWER
   ----------
   His own copy is the registration. "A Clear Road" sits at y 650 on his
   canvas and somewhere else entirely on the page; the same is true of four
   more headings. Line those five up and you have a piecewise map from his
   canvas to this page — one that re-derives itself on every resize, so it is
   never stale.

   Everything then places through that map, into ONE layer spanning the whole
   page. Pieces keep their own proportions (scaled by page width, never
   stretched); only their vertical position is remapped. The two gradient
   bands stretch to fill whatever is left between them, which is invisible
   because a gradient has no proportions to distort.

       role "back"   behind the traffic          — waves, desert, forest, trees
       role "front"  in front of it              — the end rocks
       role "float"  free, parallaxes            — clouds, the boat
       role "sign"   his gantry and plate        — carry live HTML copy
   ========================================================================= */

(function () {
  'use strict';

  var scene = window.H19_SCENE_DATA;
  var back  = document.getElementById('scene-layer');
  var front = document.getElementById('fg-layer');
  if (!scene || !back || !front) return;

  var ART_X = scene.art.x, ART_W = scene.art.w;
  var nodes = [];          /* {el, piece} */
  var bandEls = [];

  /* ==========================================================================
     1. Build the piecewise map from his canvas Y to page Y.
     Between two anchors it interpolates; outside them it carries on at the
     rate of the nearest pair, so pieces above the first heading and below the
     last still land somewhere sensible.
     ====================================================================== */

  function buildMap() {
    var pts = [];
    for (var i = 0; i < scene.anchors.length; i++) {
      var a = scene.anchors[i];
      var el = document.querySelector(a.sel);
      if (!el) continue;
      var r = el.getBoundingClientRect();
      pts.push({ src: a.y, dst: r.top + window.pageYOffset });
    }
    if (pts.length < 2) return null;
    pts.sort(function (p, q) { return p.src - q.src; });
    return pts;
  }

  function mapY(pts, y) {
    var n = pts.length;
    if (y <= pts[0].src) {
      var k0 = (pts[1].dst - pts[0].dst) / (pts[1].src - pts[0].src);
      return pts[0].dst + (y - pts[0].src) * k0;
    }
    if (y >= pts[n-1].src) {
      var k1 = (pts[n-1].dst - pts[n-2].dst) / (pts[n-1].src - pts[n-2].src);
      return pts[n-1].dst + (y - pts[n-1].src) * k1;
    }
    for (var i = 0; i < n - 1; i++) {
      if (y >= pts[i].src && y <= pts[i+1].src) {
        var t = (y - pts[i].src) / (pts[i+1].src - pts[i].src);
        return pts[i].dst + t * (pts[i+1].dst - pts[i].dst);
      }
    }
    return pts[0].dst;
  }

  /* ==========================================================================
     2. Create the elements once. Only their position changes afterwards.
     ====================================================================== */

  function create() {
    scene.bands.forEach(function (b) {
      var d = document.createElement('div');
      d.className = 'scene-band';
      d.style.background = b.css;
      d.dataset.name = b.name;
      back.appendChild(d);
      bandEls.push({ el: d, band: b });
    });

    /* Appended in paint order: DOM order is the only way to stack these
       without a z-index, and a z-index would isolate the blending. */
    scene.pieces.slice().sort(function (a, b) {
      return (a.z == null ? 80 : a.z) - (b.z == null ? 80 : b.z);
    }).forEach(function (p) {
      var el;
      if (p.markup) {
        /* Inlined, not an <img>. An <img> renders its SVG in an isolated
           context, so the multiply shadows inside his clouds and boat blend
           against nothing and come out flat grey. Inlined, they darken the
           water and the grass they actually sit on. */
        el = document.createElement('div');
        el.innerHTML = p.markup;
        var svg = el.querySelector('svg');
        if (svg) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
                   svg.setAttribute('preserveAspectRatio', 'none'); }
      } else {
        el = document.createElement('img');
        el.src = p.src || ('assets/scene/' + p.file);
        el.alt = '';
      }
      el.className = 'scene-piece';
      el.dataset.name = p.name;
      /* NO z-index, and never a transform. Both create a stacking context, and
         a stacking context isolates blending — his multiply shadows then blend
         against nothing and render flat grey. Measured over the same blue:
         #022751 plain, #666666 with either. Paint order comes from DOM order
         instead (pieces are appended sorted by p.z), and parallax moves them
         by top/left, which costs a little layout and keeps the shadows. */
      if (p.parallax || p.drift) el.setAttribute('data-move', 'top');
      if (p.parallax) el.setAttribute('data-parallax', p.parallax);
      if (p.drift) el.setAttribute('data-drift', p.drift);
      (p.role === 'front' ? front : back).appendChild(el);
      nodes.push({ el: el, piece: p });
    });
  }

  /* ==========================================================================
     3. Place everything. Width drives the scale, so nothing is ever stretched;
     his vertical order and overlaps come through unchanged.
     ====================================================================== */

  function place() {
    var pts = buildMap();
    if (!pts) return;
    var pageW = back.clientWidth || window.innerWidth;
    var S = pageW / ART_W;

    nodes.forEach(function (n) {
      var p = n.piece, top = mapY(pts, p.y);
      n.el.style.left  = ((p.x - ART_X) * S).toFixed(1) + 'px';
      n.el.style.top   = top.toFixed(1) + 'px';
      n.el.style.width = (p.w * S).toFixed(1) + 'px';
      /* A piece that keeps its own aspect falls short of the next one as soon
         as the page is taller than his canvas, and the gap shows through. The
         two landscape bands are flagged to stretch to their mapped extent
         instead — they are horizontal strata, so a little vertical give is
         invisible. Nothing with a recognisable shape is ever stretched. */
      n.el.style.height = (p.fit === 'stretch'
        ? Math.max(p.h * S, mapY(pts, p.y + p.h) - top)
        : p.h * S).toFixed(1) + 'px';
    });

    /* Bands stretch between their own mapped start and end — that is where all
       the slack from a taller page goes, and a gradient absorbs it silently. */
    bandEls.forEach(function (b) {
      var top = mapY(pts, b.band.y), bot = mapY(pts, b.band.y + b.band.h);
      /* A band that starts at the top of HIS canvas starts at the top of the
         page. Mapping y=0 lands it below the fold by however much the first
         heading has moved, which showed as a white strip under the header. */
      if (b.band.y === 0) top = 0;
      b.el.style.top    = top.toFixed(1) + 'px';
      b.el.style.height = Math.max(0, bot - top).toFixed(1) + 'px';
    });

    if (window.__scene && window.__scene.recollect) window.__scene.recollect();
  }

  create();

  /* Fonts change line wrapping, which moves every anchor. Place once now so
     nothing flashes, and again once the fonts have actually landed. */
  place();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  window.addEventListener('load', place);

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t); t = setTimeout(place, 140);
  }, { passive: true });
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function () { clearTimeout(t); t = setTimeout(place, 140); });
    ro.observe(document.getElementById('main'));
  }

  window.__sceneBuild = { place: place, map: buildMap, pieces: nodes, bands: bandEls };
})();

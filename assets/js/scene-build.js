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
  /* Declared up here, not beside the road code below. place() runs before that
     point, and a `var` hoists as undefined — so placeRoad threw on
     roadParts.length and the whole builder died before laying a single tile. */
  var roadData = window.H19_ROAD_DATA, roadParts = [];

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
      /* An anchor normally pins his y to the TOP of the element. "edge":
         "bottom" pins it to the foot instead, which is what the shoreline
         needs: he wants the waves to start right after the copy, and the copy
         is taller here than on his canvas. */
      var dst = (a.edge === 'bottom' ? r.bottom : r.top) + window.pageYOffset;
      pts.push({ src: a.y, dst: dst });
    }
    if (pts.length < 2) return null;
    pts.sort(function (p, q) { return p.src - q.src; });
    return pts;
  }

  /* THE LAYER'S OWN ORIGIN.
     mapY answers in PAGE coordinates, because that is what the anchors are
     measured in — getBoundingClientRect().top + pageYOffset. But a piece is
     positioned inside #scene-layer, an absolutely-positioned box inside
     .page, and .page starts below the header. Setting a piece's `top` to a
     page coordinate therefore put the whole scene a header's height too low:
     measured 77px at every width, which is exactly why his waves were landing
     77px past the foot of the copy when he asked for them to start right
     after it. Every `top` goes through layerY instead; differences (a mapped
     span, a band's height) are unaffected either way. */
  var originY = 0;

  function layerY(pts, y) { return mapY(pts, y) - originY; }

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
      if (p.tile) {
        /* A TILED piece: one drawing repeated across the page with an overlap,
           so a tree line reaches the edge of any screen without stretching and
           without shipping a forest. The container is empty here; place() fills
           it, because how many copies fit is a function of the page width. */
        el = document.createElement('div');
        el.className = 'scene-tiles';
      } else if (p.markup) {
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
      el.className += (el.className ? ' ' : '') + 'scene-piece';
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

  /* One drawing, repeated. His own idea, and the right one: a single tree set
     stepped across the page with a 150px overlap reads as a continuous tree
     line at any width, where one enormous forest could only be stretched.
     The overlap is what hides the seam — step by less than the tile is wide
     and each copy's ragged right edge is buried under the next copy's trees.

     Rasterised on purpose. His set is 4,185 shapes; three across as vector
     would be 12,555, worse than the 10,112-shape forest this replaces. As an
     image the browser decodes it once and every repeat after that is free.

     The container spans the full page, not his art column: a tree line that
     stops at the column edge shows the grass behind it. */
  function tile(n, p, S, pageW) {
    var tileW = p.w * S;
    var step  = Math.max(1, (p.w - (p.tile.overlap || 0)) * S);
    var left  = (p.x - ART_X) * S;
    /* Start the run left of the page edge so the first copy's own left edge,
       which is as ragged as any other, is never the thing you see first, and
       lay enough copies to reach past the right edge from there. */
    var x0    = Math.min(left, 0) - step;
    var count = Math.ceil((pageW - x0) / step) + 1;

    n.el.style.left   = '0px';
    n.el.style.width  = pageW.toFixed(1) + 'px';
    n.el.style.height = (p.h * S).toFixed(1) + 'px';

    /* Rebuild only when the count changes — a resize otherwise churns the DOM
       on every frame of a drag for no visible difference. */
    if (n.count !== count) {
      n.el.innerHTML = '';
      for (var i = 0; i < count; i++) {
        var img = document.createElement('img');
        img.src = p.src || ('assets/scene/' + p.file);
        img.alt = '';
        n.el.appendChild(img);
      }
      n.count = count;
    }
    for (var j = 0; j < n.el.children.length; j++) {
      var c = n.el.children[j];
      c.style.left  = (x0 + j * step).toFixed(1) + 'px';
      c.style.width = tileW.toFixed(1) + 'px';
    }
  }

  function place() {
    var pts = buildMap();
    if (!pts) return;
    var pageW = back.clientWidth || window.innerWidth;
    var S = pageW / ART_W;
    /* Measured with the clip cleared, or last frame's height moves the box. */
    back.style.height = '';
    if (front) front.style.height = '';
    originY = back.getBoundingClientRect().top + window.pageYOffset;

    nodes.forEach(function (n) {
      var p = n.piece, top = layerY(pts, p.y);
      n.el.style.left  = ((p.x - ART_X) * S).toFixed(1) + 'px';
      n.el.style.top   = top.toFixed(1) + 'px';
      n.el.style.width = (p.w * S).toFixed(1) + 'px';
      /* A piece that keeps its own aspect falls short of the next one as soon
         as the page is taller than his canvas, and the gap shows through. The
         two landscape bands are flagged to stretch to their mapped extent
         instead — they are horizontal strata, so a little vertical give is
         invisible. Nothing with a recognisable shape is ever stretched. */
      /* stretch: never shorter than he drew it, so a band in the middle of the
         scene cannot leave a gap when the page is taller than his canvas.
         span:    exactly the mapped extent, longer OR shorter. That is what
                  the closing band needs — it has to meet the handover to the
                  page's own design precisely, and on a page wider than his
                  canvas his height times the page scale overshoots it badly
                  (1685px against 842 at 3840). */
      n.el.style.height = (
        p.fit === 'span'    ? Math.max(1, layerY(pts, p.y + p.h) - top) :
        p.fit === 'stretch' ? Math.max(p.h * S, layerY(pts, p.y + p.h) - top)
                            : p.h * S).toFixed(1) + 'px';

      if (p.tile) tile(n, p, S, pageW);
    });

    /* Bands stretch between their own mapped start and end — that is where all
       the slack from a taller page goes, and a gradient absorbs it silently. */
    bandEls.forEach(function (b) {
      var top = layerY(pts, b.band.y), bot = layerY(pts, b.band.y + b.band.h);
      /* A band that starts at the top of HIS canvas starts at the top of the
         page. Mapping y=0 lands it below the fold by however much the first
         heading has moved, which showed as a white strip under the header. */
      if (b.band.y === 0) top = 0;
      b.el.style.top    = top.toFixed(1) + 'px';
      b.el.style.height = Math.max(0, bot - top).toFixed(1) + 'px';
    });

    placeRoad(pts, S);

    /* Stop the scene where HIS CANVAS stops.
       The layer is inset:0 on a relatively-positioned page, so it covers the
       whole document — and it paints ABOVE the section backgrounds, which are
       in flow with no z-index of their own. Below his artwork that is a layer
       of nothing, which costs nothing, until the page is wider than his canvas
       and every piece scales up with it: at 3840 his end rocks are 1685px tall
       instead of 842 and reach down into the section past them, where they
       painted green and grey over a white ground and put "Pick Your Lane" on a
       2.6:1 background.

       Clipping to the foot of his canvas is not a patch for that one piece —
       it is the honest statement of what the layer is. His composition ends at
       the rocks; everything below is the page's own design and owns its own
       ground. overflow:hidden is already on the layer, so this clips rather
       than just shrinking the box. */
    var foot = layerY(pts, scene.canvas.h);
    [back, front].forEach(function (layer) {
      if (layer) layer.style.height = Math.max(0, foot).toFixed(1) + 'px';
    });

    if (window.__scene && window.__scene.recollect) window.__scene.recollect();

    /* Tell the traffic the road has moved. road.js reads H19_ROAD_PATHS once
       per fit, and it fits on load and on resize — neither of which covers
       this: the fonts landing re-wraps the copy, which moves every anchor,
       which moves the road under cars that are still driving the old line.
       Silent when it goes wrong, too — the cars just quietly leave the
       asphalt. A plain 'resize' would do it but would also re-enter place()
       through scene.js's own resize handler, so this is its own event. */
    window.dispatchEvent(new Event('h19:road-moved'));
  }

  create();
  createRoad();

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

  /* ==========================================================================
     4. His road.
     Laid tile by tile rather than scaled as one picture, because his road IS a
     tile set and that is what makes it survive a page twice the height of his
     canvas: a straight may stretch along its own axis and nobody can tell, a
     curve may not. Curves are placed at their own size; the straights either
     side take up whatever slack the map introduces.

     Three runs, which is his design — the coast, the horizontal at the edge of
     the mountains, and the one down in the grass. Nothing crosses the forest.
     ====================================================================== */

  function createRoad() {
    if (!roadData) return;
    roadData.runs.forEach(function (run) {
      run.parts.forEach(function (p) {
        var el = document.createElement('div');
        el.innerHTML = p.markup;
        var svg = el.querySelector('svg');
        if (svg) { svg.setAttribute('width','100%'); svg.setAttribute('height','100%'); }
        el.className = 'scene-piece road-tile-art';
        el.dataset.run = run.name;
        back.appendChild(el);
        roadParts.push({ el: el, part: p, run: run.name });
      });
    });
  }

  /* Lay a run as a CHAIN, not as a set of independently positioned tiles.
     Each part sits directly after the one before it, so the road cannot come
     apart. All the slack the map introduces is handed to the vertical
     straights — a straight stretched along its own axis is indistinguishable
     from a longer straight, whereas a stretched curve goes visibly oval. Place
     the parts independently and the curves disconnect from their neighbours by
     exactly the amount the page is taller than his canvas, which is what put
     half the traffic in the ocean. */
  function placeRoad(pts, S) {
    if (!roadParts.length) return;

    roadData.runs.forEach(function (run) {
      var mine = roadParts.filter(function (r) { return r.run === run.name; });
      if (!mine.length) return;

      var first = mine[0].part, last = mine[mine.length - 1].part;
      var naturalH = (last.y + last.h - first.y) * S;
      var mappedH  = layerY(pts, last.y + last.h) - layerY(pts, first.y);
      var slack    = Math.max(0, mappedH - naturalH);

      var vTotal = mine.reduce(function (a, r) {
        return a + (r.part.kind === 'straight-v' ? r.part.h * S : 0);
      }, 0);

      var top0 = layerY(pts, first.y), shift = 0;
      mine.forEach(function (r) {
        var natural = r.part.h * S;
        var grow = (r.part.kind === 'straight-v' && vTotal > 0)
          ? slack * (natural / vTotal) : 0;

        r.left = (r.part.x - ART_X) * S;
        r.w    = r.part.w * S;
        r.top  = top0 + (r.part.y - first.y) * S + shift;
        r.h    = natural + grow;
        shift += grow;

        r.el.style.left   = r.left.toFixed(1) + 'px';
        r.el.style.top    = r.top.toFixed(1) + 'px';
        r.el.style.width  = r.w.toFixed(1) + 'px';
        r.el.style.height = r.h.toFixed(1) + 'px';
      });

      run.d = centreline(mine);
    });
  }

  /* The centreline of a laid run, in page pixels.
     Every part carries its own line as points normalised to its box, read from
     the dashed stripe he actually drew — so a curve is his arc rather than my
     approximation of one, and a straight that has been stretched carries its
     line with it. Each part is oriented to start at whichever end is nearer
     where the previous one finished, which is all the chaining needed.
     ====================================================================== */
  function centreline(parts) {
    var out = [];
    parts.forEach(function (r) {
      var L = r.part.line;
      if (!L || L.length < 2) return;
      var pts = L.map(function (p) {
        return { x: r.left + p.u * r.w, y: r.top + p.v * r.h };
      });
      if (out.length) {
        var last = out[out.length - 1];
        var dFirst = Math.pow(pts[0].x - last.x, 2) + Math.pow(pts[0].y - last.y, 2);
        var dLast  = Math.pow(pts[pts.length-1].x - last.x, 2) +
                     Math.pow(pts[pts.length-1].y - last.y, 2);
        if (dLast < dFirst) pts.reverse();
      }
      out = out.concat(pts);
    });
    if (out.length < 2) return '';

    /* His tiles overlap by design, so a straight's line ends INSIDE the curve
       that follows it. Concatenated raw, that shows as a short diagonal
       doubling back across the road at every join — and any car on it is off
       the asphalt. Drop points that reverse direction: what is left is the
       line going one way round. */
    var clean = [out[0]], i;
    for (i = 1; i < out.length; i++) {
      var prev = clean[clean.length - 1];
      var dx = out[i].x - prev.x, dy = out[i].y - prev.y;
      if (dx * dx + dy * dy < 4) continue;                 /* duplicate */
      if (clean.length > 1) {
        var b = clean[clean.length - 2];
        var px = prev.x - b.x, py = prev.y - b.y;
        /* reversal: the new step points back the way we came */
        if (px * dx + py * dy < 0) { clean.pop(); i--; continue; }
      }
      clean.push(out[i]);
    }
    if (clean.length < 2) return '';
    return 'M' + clean.map(function (p) {
      return p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' L');
  }

  /* The traffic engine asks for these; they are rebuilt on every resize. */
  window.H19_ROAD_PATHS = function () {
    return roadData ? roadData.runs.map(function (r) {
      return { name: r.name, d: r.d || '' };
    }).filter(function (r) { return r.d; }) : [];
  };

  window.__sceneBuild = { place: place, map: buildMap, pieces: nodes, bands: bandEls,
                          road: roadParts };
})();

/* ============================================================================
   Highway 19 Media — the living road, threaded through the whole page.
   ----------------------------------------------------------------------------
   Ported from Highway-19-Living-Road-REAL.html. The traffic physics and the
   road geometry are carried over unchanged; what is new here is everything
   needed to run the road down a full page instead of one hero-sized stage:

     * the road weaves between sections instead of jogging once
     * it is drawn into stacked SVG tiles (~1 per 2 sections) so no single
       composited layer is ever the height of the page  — Safari memory
     * every vehicle is simulated every frame (cheap arithmetic), but only the
       ones near the viewport hold a DOM node, so per-frame cost is flat no
       matter how long the page gets
     * the road's x position per section is MEASURED from the empty grid
       column the layout reserves for it, so the artwork and the copy can
       never drift apart at any viewport width

   Deliberately NOT scroll-driven. The loop runs on its own clock; a road that
   only moves when you scroll reads as broken. Do not reintroduce that.
   ========================================================================= */

(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';

  /* -- The twenty vehicles, all drawn facing right. ------------------------ */
  var NAMES = [
    'Green_Car', 'Grey_Sadan', 'Red_Van', 'Brown_Jeep', 'Green_Truck',
    'Semitrailer', 'Blue_Minivan', 'Pink_Sadan', 'Gas_Truck', 'Blue_bus',
    'Brown_Truck', 'Grey_Jeep', 'Yellow_truck', 'Red_Sports_car', 'Yellow_Cab',
    'Blue_Van', 'Pink_Mini', 'Blue_Minivan-2', 'Brown_Big_Truck', 'Grey_Minivan'
  ];

  /* -- Road geometry. MEASURED from the owner's Illustrator file. ----------
     Four stacked strokes on one path: asphalt 125.88 -> white 110.36 ->
     asphalt 101.64 (which is what exposes the two 4.36 edge lines) ->
     dashed white centreline 4.68. This is why the road can be any length and
     still match the source tiles exactly. Do not "tidy" these numbers.       */
  var W_ROAD = 125.88,
      EDGE_OUT = 55.18,          /* 110.36 / 2 */
      EDGE_IN = 50.82,           /* 101.64 / 2 */
      DASH_W = 4.68,
      DASH = '37.43 25.21',
      ASPHALT = '#575757',
      LINE = '#ffffff',
      R_MAX = 190,               /* source art is ~270; 190 reads better here */
      LANE = 31;                 /* lane centres at +/-31 from the centreline */

  /* -- Simulation constants, carried over unchanged. ----------------------- */
  var STEP = 5,                  /* path sample spacing, px                   */
      LOOK = 26,                 /* curvature lookahead: 26 * 5 = 130px       */
      BASE = 190,                /* base free-flow speed, px/s                */
      CAR_H = 37,                /* median vehicle height on screen, px       */
      SPACING = 112,             /* px of lane per vehicle at full load       */
      TRAFFIC = 0.5,             /* global density trim — 1 = the demo's load */
      CULL_MARGIN = 340,         /* px above/below viewport still rendered    */
      NARROW_W = 900,            /* at or below: one lane, no weave           */
      MOBILE_W = 720;            /* at or below: lane also bleeds off-canvas  */

  var page = document.querySelector('.page');
  var layer = document.getElementById('road-layer');
  if (!page || !layer || !window.H19_SPRITE) return;

  /* Two ways to lay a road down a page — see section 6b for why the second
     one exists. A page that declares road runs gets those; everything else
     gets the weave. */
  var ROUTES = Array.prototype.slice.call(page.querySelectorAll('[data-road-run]'));
  var BAND_MODE = ROUTES.length > 0;

  /* ==========================================================================
     1. Mount the artwork once.
     Parsed through DOMParser rather than innerHTML so the SVG namespace and
     the xlink hrefs survive intact in every browser. The Illustrator
     blend-mode repair is already baked into the sprite source; nothing here
     may rewrite it.
     ====================================================================== */

  var defsHost = el('svg', { id: 'road-defs', 'aria-hidden': 'true', focusable: 'false' });
  defsHost.setAttribute('style',
    'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
  var probeHost = el('svg', { id: 'road-probe', 'aria-hidden': 'true', focusable: 'false' });
  probeHost.setAttribute('style',
    'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:0;top:0');
  var probe = el('g', {});
  probeHost.appendChild(probe);
  document.body.appendChild(defsHost);
  document.body.appendChild(probeHost);

  (function mountSprite() {
    var doc = new DOMParser().parseFromString(
      '<svg xmlns="' + SVGNS + '" xmlns:xlink="' + XLINK + '">' + window.H19_SPRITE + '</svg>',
      'image/svg+xml');
    var root = doc.documentElement;
    if (root.getElementsByTagName('parsererror').length) return;
    /* importNode COPIES: it does not detach the source node. Snapshot the
       child list first — walking root.firstChild here never terminates. */
    Array.prototype.slice.call(root.childNodes).forEach(function (k) {
      defsHost.appendChild(document.importNode(k, true));
    });
  })();

  function el(n, a) {
    var e = document.createElementNS(SVGNS, n);
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) e.setAttribute(k, a[k]);
    return e;
  }
  function useOf(id) {
    var u = el('use', {});
    u.setAttributeNS(XLINK, 'xlink:href', '#' + id);
    u.setAttribute('href', '#' + id);
    return u;
  }

  /* ==========================================================================
     2. Measure the vehicles.
     getBBox is unreliable inside <defs>, so each sprite is measured on a
     rendered probe layer, then everything is scaled off the median height so
     relative sizes between a hatchback and a semi are preserved.
     ====================================================================== */

  var BOX = {};
  NAMES.forEach(function (id) {
    var u = useOf(id);
    probe.appendChild(u);
    var b = null;
    try { b = u.getBBox(); } catch (e) { b = null; }
    if (!b || !b.width) {
      var src = defsHost.querySelector('#' + CSS.escape(id));
      try { b = src.getBBox(); } catch (e2) { b = { x: 0, y: 0, width: 100, height: 40 }; }
    }
    BOX[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    probe.removeChild(u);
  });
  var MEDH = NAMES.map(function (n) { return BOX[n].h; })
    .sort(function (a, b) { return a - b; })[NAMES.length >> 1] || 40;

  /* ==========================================================================
     3. Where the road goes.

     The road is now TWO separate runs with a deliberate break between them:

       run A   enters above the hero, weaves down past the problem and the
               objection, and at the end of "We Handle the Marketing" turns
               right and drives off the right edge of the screen.

       (services runs full width with no road at all — the break is the point)

       run B   comes back in from the left edge at "Your Success Is Our
               Destination", hooks around that section — across the top, down
               the right, back along the bottom — then carries on down through
               the payoff and the close and into the footer.

     Each run has its own traffic. Both ends of both runs sit off-canvas, so
     the loop point where a vehicle wraps is never visible.

     A section declares which run it belongs to with data-run, and where the
     road sits inside it with data-road. The x position is MEASURED from the
     empty lane the layout reserves (.road-slot), so the artwork and the copy
     cannot drift apart at any width.
     ====================================================================== */

  var SECS = [];
  function activeSections() {
    return Array.prototype.slice.call(page.querySelectorAll('[data-road]'))
      .filter(function (s) {
        return s.offsetParent !== null && s.offsetHeight > 40 &&
               s.getAttribute('data-road') !== 'none';
      });
  }

  /* A pen that walks the road out of straights and quarter turns.
     Headings are axis-aligned: th 0 = right, PI/2 = down, PI = left.
     sign +1 turns clockwise on screen (a right turn), -1 anticlockwise. */
  function pen(x0, y0, th0) {
    var segs = [], P = { x: x0, y: y0 }, th = th0;
    function n(t) { return { x: Math.sin(t), y: -Math.cos(t) }; }   /* left of travel */

    var api = {
      at: function () { return { x: P.x, y: P.y, th: th }; },

      straight: function (L) {
        if (!(L > 0.5)) return api;
        segs.push({ t: 'L', p: { x: P.x, y: P.y }, th: th, L: L });
        P = { x: P.x + L * Math.cos(th), y: P.y + L * Math.sin(th) };
        return api;
      },
      downTo:  function (y) { return api.straight(y - P.y); },
      rightTo: function (x) { return api.straight(x - P.x); },
      leftTo:  function (x) { return api.straight(P.x - x); },

      turn: function (sign, rad) {
        var nn = n(th), C = { x: P.x - sign * rad * nn.x, y: P.y - sign * rad * nn.y };
        var a0 = Math.atan2(P.y - C.y, P.x - C.x), a1 = a0 + sign * Math.PI / 2;
        segs.push({ t: 'A', C: C, R: rad, a0: a0, a1: a1, s: sign });
        P = { x: C.x + rad * Math.cos(a1), y: C.y + rad * Math.sin(a1) };
        th += sign * Math.PI / 2;
        return api;
      },

      /* Sidestep to a new x while travelling down, straddling y. */
      jog: function (x, y, radMax) {
        var dx = x - P.x;
        if (Math.abs(dx) < 2) return api;
        var jogY = Math.max(y, P.y + 30);
        var rad = Math.max(30, Math.min(radMax, Math.abs(dx) / 2, (jogY - P.y) / 2));
        api.downTo(jogY - rad);
        var s1 = dx > 0 ? -1 : 1;
        api.turn(s1, rad).straight(Math.abs(dx) - 2 * rad).turn(-s1, rad);
        return api;
      },

      /* Emit a `d` string at any lateral offset. o > 0 is to the driver's left. */
      path: function () {
        return function (o) {
          var d = '', first = true;
          for (var i = 0; i < segs.length; i++) {
            var sg = segs[i];
            if (sg.t === 'L') {
              var nn = n(sg.th), a = { x: sg.p.x + o * nn.x, y: sg.p.y + o * nn.y };
              var bb = { x: a.x + sg.L * Math.cos(sg.th), y: a.y + sg.L * Math.sin(sg.th) };
              if (first) { d += 'M' + a.x.toFixed(2) + ',' + a.y.toFixed(2); first = false; }
              d += 'L' + bb.x.toFixed(2) + ',' + bb.y.toFixed(2);
            } else {
              var r = sg.s < 0 ? sg.R - o : sg.R + o;
              var p0 = { x: sg.C.x + r * Math.cos(sg.a0), y: sg.C.y + r * Math.sin(sg.a0) };
              var p1 = { x: sg.C.x + r * Math.cos(sg.a1), y: sg.C.y + r * Math.sin(sg.a1) };
              if (first) { d += 'M' + p0.x.toFixed(2) + ',' + p0.y.toFixed(2); first = false; }
              d += 'A' + r.toFixed(2) + ',' + r.toFixed(2) + ' 0 0 ' +
                   (sg.s < 0 ? 0 : 1) + ' ' + p1.x.toFixed(2) + ',' + p1.y.toFixed(2);
            }
          }
          return d;
        };
      }
    };
    return api;
  }

  /* ==========================================================================
     4. Measure the page, then draw the two runs.
     ====================================================================== */

  function measure(W, scale) {
    var pageTop = page.getBoundingClientRect().top + window.pageYOffset;
    var half = (W_ROAD * scale) / 2;
    var mobile = W <= MOBILE_W, narrow = W <= NARROW_W;

    /* Narrow layouts run one lane down the left margin — see fit(). */
    var laneX = null;
    if (narrow) {
      var ref = page.querySelector('.sec__inner');
      if (ref) {
        var rr = ref.getBoundingClientRect();
        var cl = rr.left + parseFloat(getComputedStyle(ref).paddingLeft || 0);
        laneX = mobile ? (cl - 12 - half) : ((rr.left + cl) / 2);
      } else laneX = half * 0.9;
    }

    var out = { list: [], byId: {}, half: half, narrow: narrow, mobile: mobile,
                pageTop: pageTop, height: page.offsetHeight, W: W };

    SECS.forEach(function (sec) {
      var r = sec.getBoundingClientRect();
      var slot = sec.querySelector('.road-slot');
      var x;
      if (narrow) x = laneX;
      else if (slot && slot.getBoundingClientRect().width > 0) {
        var sr = slot.getBoundingClientRect();
        x = sr.left + sr.width / 2;
      } else x = W / 2;

      var box = {
        el: sec,
        run: sec.getAttribute('data-run') || 'a',
        wrap: sec.getAttribute('data-road') === 'wrap',
        top: r.top + window.pageYOffset - pageTop,
        bottom: r.bottom + window.pageYOffset - pageTop,
        x: Math.max(-half * 0.9, Math.min(W + half * 0.9, x)),
        jogAt: null
      };
      if (!narrow && sec.getAttribute('data-jog') === 'slot' && slot) {
        var st = slot.getBoundingClientRect().top + window.pageYOffset - pageTop;
        box.jogAt = st - W_ROAD * scale * 0.6;
      }
      out.list.push(box);
      out.byId[sec.id] = box;
    });
    return out;
  }

  function runSections(g, key) {
    return g.list.filter(function (b) { return b.run === key; });
  }

  /* Hook the road around a whole section: in across the top, down the far
     side, back along the bottom, then on down its own lane — so the block
     sits inside the loop instead of beside it.

     This is the move run B already made around "Your Success Is Our
     Destination"; it was written inline there because that section is the
     first in its run and the road arrives from the left edge. Entered mid-run
     the road arrives heading DOWN instead, which is the only difference, so
     the geometry is the same four turns from a different start. Any section
     can now ask for it with data-road="wrap".

     A section has to be big enough to hold the loop. When it is not — a short
     block, or a narrow window — the road jogs past it as usual rather than
     drawing a hook that grazes the copy. */
  function hookDown(p, box, g, R) {
    var inset = g.half + 34;
    var topY = box.top + inset;
    var botY = box.bottom - inset;
    var rightX = g.W - inset - 6;
    var leftX = box.x;
    var rad = Math.max(g.half * 1.35,
      Math.min(R, (botY - topY) / 2 - 8, (rightX - leftX) / 2 - 8));

    if (!(botY - topY > 2 * rad + 40) || !(rightX - leftX > 2 * rad + 40)) {
      p.jog(leftX, box.top, R);
      return false;
    }

    p.jog(leftX, box.top - 40, R);       /* onto this section's own lane     */
    p.downTo(topY - rad).turn(-1, rad)   /* down the left, right at the top  */
     .rightTo(rightX - rad).turn(1, rad) /* across, then down the far side   */
     .downTo(botY - rad).turn(1, rad)    /* down, then back along the bottom */
     .leftTo(leftX + rad).turn(-1, rad); /* and away down its own lane       */
    return true;
  }

  /* Run A — in above the hero, out through the right edge at the promise. */
  function buildRunA(g, scale) {
    var list = runSections(g, 'a');
    if (!list.length) return null;
    var R = R_MAX * scale, half = g.half;
    var p = pen(list[0].x, -320, Math.PI / 2);

    for (var i = 1; i < list.length; i++) {
      if (!g.narrow && list[i].wrap) hookDown(p, list[i], g, R);
      else p.jog(list[i].x, list[i - 1].bottom, R);
    }

    var last = list[list.length - 1];
    if (g.narrow) {
      /* No room to swing out sideways; just run off the bottom of the block. */
      p.downTo(last.bottom + 260);
    } else {
      /* Turn right and drive off the right edge — end of the first animation. */
      var exitY = last.bottom - (half + 34);
      var rad = Math.max(half * 1.35, Math.min(R, (exitY - p.at().y) / 1.1));
      p.downTo(exitY - rad).turn(-1, rad).rightTo(g.W + half + 300);
    }
    return p.path();
  }

  /* Run B — back in from the left edge, hooked around the why-us band, then
     down through the payoff and the close and under the footer. */
  function buildRunB(g, scale) {
    var list = runSections(g, 'b');
    if (!list.length) return null;
    var R = R_MAX * scale, half = g.half, wrap = list[0], p;

    if (g.narrow) {
      p = pen(wrap.x, wrap.top - 260, Math.PI / 2);
    } else {
      var inset = half + 34;                       /* clear air the road needs */
      var topY = wrap.top + inset;
      var botY = wrap.bottom - inset;
      var rightX = g.W - inset - 6;
      /* The hook exits into this section's OWN lane, not the next section's.
         Handing it straight to the payoff's centre lane put the road under
         that section's headline, because the jog the payoff asks for
         (data-jog="slot") then had nothing left to do. */
      var rad = Math.max(half * 1.35,
        Math.min(R, (botY - topY) / 2 - 8, (rightX - wrap.x) / 2 - 8));

      p = pen(-half - 300, topY, 0)                /* in from the left edge   */
        .rightTo(rightX - rad).turn(1, rad)        /* across, then down       */
        .downTo(botY - rad).turn(1, rad)           /* down the right, then    */
        .leftTo(wrap.x + rad).turn(-1, rad);       /* back left, then down    */
    }

    /* From i = 1: list[0] is the section the run enters around, and the
       left-edge entry above has already hooked it. */
    for (var i = 1; i < list.length; i++) {
      var prev = list[i - 1];
      if (!g.narrow && list[i].wrap) { hookDown(p, list[i], g, R); continue; }
      p.jog(list[i].x, list[i].jogAt != null ? list[i].jogAt : prev.bottom, R);
    }
    p.downTo(g.height + 320);
    return p.path();
  }

  /* ==========================================================================
     5. Sampling + the curvature speed limit.
     Each sample carries the tightest curve within the next ~130px, so a
     vehicle slows into a bend before it reaches it rather than on top of it.
     ====================================================================== */

  /* Walk a centreline and step sideways by `off` at every sample. The two lane
     paths come out of the same line the asphalt was laid on, so they cannot
     drift from it however the page has stretched. A polyline is enough: the
     step is small against the tightest radius he draws. */
  function offsetPath(d, off) {
    var probe = offsetPath._p;
    if (!probe) {
      var host = el('svg', { width: '0', height: '0',
                             style: 'position:absolute;visibility:hidden' });
      probe = el('path', {});
      host.appendChild(probe);
      document.body.appendChild(host);
      offsetPath._p = probe;
    }
    probe.setAttribute('d', d);
    var L = probe.getTotalLength();
    if (!L) return d;
    var step = 6, out = [], s;
    for (s = 0; s <= L; s += step) {
      var a = probe.getPointAtLength(Math.max(0, s - 1.5));
      var b = probe.getPointAtLength(Math.min(L, s + 1.5));
      var dx = b.x - a.x, dy = b.y - a.y;
      var m = Math.sqrt(dx * dx + dy * dy) || 1;
      var pt = probe.getPointAtLength(s);
      out.push((pt.x - dy / m * off).toFixed(1) + ',' + (pt.y + dx / m * off).toFixed(1));
    }
    return 'M' + out.join(' L');
  }

  function sample(p, rev) {
    var L = p.getTotalLength(), n = Math.floor(L / STEP);
    var x = [], y = [], a = [], lim = [], i;
    for (i = 0; i <= n; i++) { var pt = p.getPointAtLength(i * STEP); x.push(pt.x); y.push(pt.y); }
    if (rev) { x.reverse(); y.reverse(); }
    for (i = 0; i <= n; i++) {
      var i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1);
      a.push(Math.atan2(y[i1] - y[i0], x[i1] - x[i0]));
    }
    for (i = 0; i <= n; i++) {
      var j0 = Math.max(0, i - 2), j1 = Math.min(n, i + 2), dd = a[j1] - a[j0];
      while (dd > Math.PI) dd -= 2 * Math.PI;
      while (dd < -Math.PI) dd += 2 * Math.PI;
      var c = Math.abs(dd) / ((j1 - j0) * STEP);
      lim.push(c < 1e-5 ? 999 : Math.sqrt(2600 / c));
    }
    var win = [];
    for (i = 0; i <= n; i++) {
      var m = lim[i];
      for (var k = 1; k <= LOOK; k++) { var q = i + k; if (q > n) break; if (lim[q] < m) m = lim[q]; }
      win.push(m);
    }
    return { L: L, n: n, x: x, y: y, a: a, lim: win };
  }

  /* ==========================================================================
     6. Tiles and the traffic layer.
     Every tile carries both runs' full paths but clips to its own slice, so no
     tile ever rasterises more than its own box. Traffic lives in one layer
     above them all, in the same page coordinates, so nothing is sliced in half
     at a seam and no tile can paint over its neighbour's cars.
     ====================================================================== */

  var tiles = [], fleetSvg = null, fleetG = null;

  function makeTiles(W, H, ds) {
    tiles.forEach(function (t) { t.svg.remove(); });
    tiles = [];
    if (fleetSvg) fleetSvg.remove();

    var pageTop0 = page.getBoundingClientRect().top + window.pageYOffset;
    var cuts = [0];
    for (var i = 1; i < SECS.length; i += 2) {
      var r = SECS[i].getBoundingClientRect();
      var y = Math.round(r.bottom + window.pageYOffset - pageTop0);
      if (y > cuts[cuts.length - 1] + 200 && y < H - 200) cuts.push(y);
    }
    cuts.push(H);

    var dash = DASH.split(' ').map(function (v) { return (+v * scaleNow).toFixed(2); }).join(' ');

    for (var k = 0; k < cuts.length - 1; k++) {
      var y0 = cuts[k], h = cuts[k + 1] - y0;
      var svg = el('svg', {
        'class': 'road-tile',
        viewBox: '0 ' + y0 + ' ' + W + ' ' + h,
        'aria-hidden': 'true', focusable: 'false'
      });
      svg.setAttribute('style', 'top:' + y0 + 'px;height:' + h + 'px');

      var guides = el('g', {});
      ds.forEach(function (d) {
        var road = el('g', {});
        /* The widest asphalt stroke doubles as the tap target — hit-tested on
           the stroke, so only the road itself is clickable, never the gaps. */
        road.appendChild(el('path', { 'class': 'road-hit', d: d, fill: 'none',
                                      stroke: DRAW_ROAD ? ASPHALT : 'transparent',
                                      'stroke-width': W_ROAD * scaleNow }));
        if (DRAW_ROAD) {
          road.appendChild(el('path', { d: d, fill: 'none', stroke: LINE, 'stroke-width': EDGE_OUT * 2 * scaleNow }));
          road.appendChild(el('path', { d: d, fill: 'none', stroke: ASPHALT, 'stroke-width': EDGE_IN * 2 * scaleNow }));
          road.appendChild(el('path', { d: d, fill: 'none', stroke: LINE, 'stroke-width': DASH_W * scaleNow,
                                        'stroke-dasharray': dash }));
        }
        svg.appendChild(road);
        guides.appendChild(el('path', { 'class': 'lane-guide', d: '' }));
        guides.appendChild(el('path', { 'class': 'lane-guide', d: '' }));
      });
      svg.appendChild(guides);
      layer.appendChild(svg);
      tiles.push({ svg: svg, guides: guides, y0: y0, y1: cuts[k + 1] });
    }

    fleetSvg = el('svg', {
      'class': 'road-fleet',
      viewBox: '0 0 ' + W + ' ' + H,
      'aria-hidden': 'true', focusable: 'false'
    });
    fleetSvg.setAttribute('style', 'top:0;height:' + H + 'px');
    fleetG = el('g', {});
    fleetSvg.appendChild(fleetG);
    layer.appendChild(fleetSvg);
  }

  /* ==========================================================================
     6b. RUN MODE — the road as a route assembled from the page's own boxes
     --------------------------------------------------------------------------
     The weave above threads one road down the whole page in PAGE coordinates.
     That is right for the home page, where the copy is fixed. It is wrong for
     a page whose copy expands: open an accordion and every section below it
     moves, so the entire road — both runs, every tile — has to be rebuilt mid
     animation. Measured at 64ms of sampling alone, before the tiles.

     Here the page is divided into ROUTES. A route is an ordinary element with
     data-road-run on it, and the road inside it is drawn in THAT ELEMENT'S own
     coordinates, into one SVG pinned to its box. Two things follow:

       * a route that grows is the only thing that gets rebuilt. Everything
         below it just moves, because its geometry is local — measured at
         ~15ms for a route spanning two sections, against 64ms for the page.
       * a route that has not changed size is never touched at all, however
         much the page above it moved.

     A route's shape comes from its children: each child carrying data-road
     contributes one move, in document order, using its own box. Rails run
     down a margin and can carry on past several sections; the moves between
     them cross to the other margin, or leave and re-enter at a page edge.

     The one rule the engine needs: EVERY ROUTE STARTS AND ENDS OFF CANVAS.
     A vehicle that reaches the end of a route reappears at its start, and
     that has to happen where nobody can see it. It is also why the route is
     cut wherever the road leaves the page — the break is already invisible,
     so it costs nothing and buys a shorter rebuild.
     ====================================================================== */

  var OFF = 340;                       /* how far past the edge a stub runs */

  /* Two rails a side, as he drew them: the inner one where the margin is
     empty, the outer one where a sign plate reaches into the margin and the
     road has to pass outside it. A move asks for the outer rail by name —
     "rail-left-out". */
  function railX(side, g, out) {
    var i = out ? g.insetOut : g.inset;
    return side === 'left' ? i : g.W - i;
  }

  /* The moves. Each is handed the pen already heading down at its side's rail,
     and walks it to the bottom of its own box. */
  var MOVES = {
    /* Straight down a margin, for as long as this box is tall — but if this
       box asks for the other rail on the same side, step across to it first.
       That is how his road gets outside the exit gantry without a crossing. */
    rail: function (p, m, g) {
      var a = p.at().x, x = railX(m.side, g, m.out), dx = x - a, R = g.R;
      if (Math.abs(dx) < 1) { p.downTo(m.b); return; }
      var s = dx < 0 ? 1 : -1, r = Math.min(R, Math.abs(dx) / 2, (m.b - m.t) / 2);
      var run = Math.abs(dx) - 2 * r;
      p.downTo(m.t + r).turn(s, r);
      if (run > 0.5) p.straight(run);
      p.turn(-s, r).downTo(m.b);
    },

    /* Over to the other margin, turning in this box's middle. */
    cross: function (p, m, g) {
      var a = p.at().x, x = railX(m.to, g, m.out), mid = (m.t + m.b) / 2, R = g.R;
      var dx = x - a, s = dx < 0 ? 1 : -1;      /* heading down, +1 turns left */
      var run = Math.abs(dx) - 2 * R;
      p.downTo(mid - R).turn(s, R);
      if (run > 0.5) p.straight(run);
      p.turn(-s, R).downTo(m.b);
    },

    /* Off a page edge. Always the last move of its route. The near edge by
       default; "far" turns the other way and crosses the page first, which is
       the long horizontal run he draws at the foot of a section. */
    leave: function (p, m, g) {
      var y = m.t + (m.b - m.t) * 0.55, R = g.R;
      var near = m.side === 'left' ? 1 : -1;
      p.downTo(y - R).turn(m.far ? -near : near, R).straight(g.W + OFF);
    }
  };

  /* Assemble one route's centreline from its children. */
  function buildRoute(g) {
    var list = g.moves;
    if (!list.length) return null;
    var first = list[0], p, i;

    if (first.kind === 'arrive') {
      /* In off a page edge, then down. The pen has to be created out there.
         "far" comes in off the OPPOSITE edge and runs the width of the page
         before it turns — his long entry across the top of a section. */
      var x = railX(first.side, g, first.out), y = first.t + (first.b - first.t) * 0.45;
      var from = first.far ? (first.side === 'left' ? 'right' : 'left') : first.side;
      var s = from === 'left' ? 1 : -1;
      p = from === 'left' ? pen(-OFF, y, 0) : pen(g.W + OFF, y, Math.PI);
      if (from === 'left') p.rightTo(x - g.R); else p.leftTo(x + g.R);
      p.turn(s, g.R).downTo(first.b);
      i = 1;
    } else if (first.kind === 'pass') {
      /* Straight across and out the far side, at this box's middle. His
         desert road: no turn in it anywhere, both ends off canvas. */
      p = pen(-OFF, (first.t + first.b) / 2, 0);
      p.straight(g.W + OFF * 2);
      return p.path();
    } else if (first.kind === 'track') {
      /* A track is a route on its own: in off an edge, down, back out the
         same edge. Both ends off canvas, so it loops unseen. */
      var tx = railX(first.side, g, first.out);
      var t1 = first.t + Math.min((first.b - first.t) * 0.2, 110);
      var t2 = first.b - Math.min((first.b - first.t) * 0.2, 110);
      /* The two turns of a bracket must not eat the whole run between them,
         or the shape closes into a ring instead of reading as a road going
         down the margin and back out. */
      var tR = Math.min(g.R, (t2 - t1) / 3.2);
      var ts = first.side === 'left' ? 1 : -1;
      p = first.side === 'left' ? pen(-OFF, t1, 0) : pen(g.W + OFF, t1, Math.PI);
      if (first.side === 'left') p.rightTo(tx - tR); else p.leftTo(tx + tR);
      p.turn(ts, tR).downTo(t2 - tR).turn(ts, tR).straight(g.W + OFF);
      return p.path();
    } else {
      /* In off the top of the page. */
      p = pen(railX(first.side, g, first.out), first.t - OFF, Math.PI / 2);
      i = 0;
    }

    for (; i < list.length; i++) {
      var m = list[i];
      (MOVES[m.kind] || MOVES.rail)(p, m, g);
    }
    /* A route that does not leave by an edge leaves by the bottom. */
    if (list[list.length - 1].kind !== 'leave') p.straight(OFF);
    return p.path();
  }

  /* Read one route's boxes. Local coordinates: the wrapper's own top is 0, so
     nothing here changes when the page above it moves. */
  function measureRoute(el) {
    var box = el.getBoundingClientRect();
    /* Measured off a probe element, not read off the custom property.
       getPropertyValue on a custom property hands back the RAW TOKEN — for
       min(400px,21vw) that is the string "min(400px,21vw)", which parseFloat
       turns into NaN. Every rail on this page had been silently falling back
       to the default while the stylesheet said something else entirely. The
       probe carries width:var(--rail-inset), so the browser resolves it. */
    var probe = document.getElementById('road-rail-probe');
    var probeOut = document.getElementById('road-rail-probe-out');
    var inset = probe ? probe.offsetWidth : 0;
    var insetOut = probeOut ? probeOut.offsetWidth : 0;
    if (!inset) inset = 226;
    if (!insetOut) insetOut = Math.round(inset * 0.55);
    var g = { el: el, W: Math.round(box.width), H: Math.round(box.height),
              /* The turns between a page edge and a rail have only the margin
                 to complete in, so the radius cannot exceed the inset — at
                 150 against a 118 inset the apex of every entry curve sat off
                 the screen and the road appeared to start mid-bend. The inset
                 is already viewport-relative in CSS, so it is not scaled
                 again here. */
              inset: inset, insetOut: insetOut,
              R: Math.min(150, insetOut), moves: [] };
    var kids = el.hasAttribute('data-road')
      ? [el]
      : Array.prototype.slice.call(el.children).filter(function (k) {
          return k.hasAttribute('data-road');
        });
    kids.forEach(function (k) {
      var r = k.getBoundingClientRect();
      var spec = k.getAttribute('data-road').split('-');
      g.moves.push({
        kind: spec[0], side: spec[1] || 'left', to: spec[1] || 'left',
        out: spec.indexOf('out') > 1, far: spec.indexOf('far') > 1,
        /* His asphalt is not one grey: it goes black through the night and
           warm through the desert, and the line on it turns yellow out there.
           A block says what it is and the route builds a gradient from it. */
        asphalt: k.getAttribute('data-asphalt') || null,
        line: k.getAttribute('data-line') || null,
        /* A block that says it has a verge gets his shoulder, his grass and
           his trees drawn along the road for exactly its own height. */
        verge: k.hasAttribute('data-verge'),
        t: r.top - box.top, b: r.bottom - box.top
      });
    });
    return g;
  }

  /* One route's SVG: his four stacked strokes, the two lane centrelines the
     traffic drives, and a fleet layer above them. */
  function drawRoute(g, d) {
    var old = g.el.querySelector(':scope > .road-run__art');
    if (old) old.remove();

    var svg = el('svg', {
      'class': 'road-run__art',
      viewBox: '0 0 ' + g.W + ' ' + g.H,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true', focusable: 'false'
    });
    var dash = DASH.split(' ').map(function (v) { return (+v * scaleNow).toFixed(2); }).join(' ');

    /* One vertical gradient per route, built from whatever its blocks say the
       asphalt and the line are along the way. Where nothing says otherwise it
       is his ordinary grey on white, and the gradient is not emitted at all. */
    function ramp(prop, base) {
      var any = false, i, m;
      for (i = 0; i < g.moves.length; i++) if (g.moves[i][prop]) { any = true; break; }
      if (!any) return base;
      var id = 'rd-' + prop + '-' + (++rampN);
      var lg = el('linearGradient', { id: id, gradientUnits: 'userSpaceOnUse',
                                      x1: '0', y1: '0', x2: '0', y2: String(g.H) });
      var at = base;
      for (i = 0; i < g.moves.length; i++) {
        m = g.moves[i];
        var col = m[prop] || base;
        lg.appendChild(el('stop', { offset: (Math.max(0, m.t) / g.H).toFixed(4), 'stop-color': at }));
        lg.appendChild(el('stop', { offset: (Math.max(0, m.t) / g.H).toFixed(4), 'stop-color': col }));
        at = col;
      }
      lg.appendChild(el('stop', { offset: '1', 'stop-color': at }));
      defs.appendChild(lg);
      return 'url(#' + id + ')';
    }
    var defs = el('defs', {});
    svg.appendChild(defs);
    var ASPH = ramp('asphalt', ASPHALT), LN = ramp('line', LINE);

    /* ── His verge ──────────────────────────────────────────────────────
       Grey shoulder 255 across and grass 185 across, both laid along the
       road's own centreline so they follow every turn it makes, and clipped
       to the blocks that asked for them. Drawn under the asphalt; the trees
       go on top of the grass further down. */
    var vRanges = g.moves.filter(function (m) { return m.verge; });
    if (vRanges.length) {
      var cid = 'vc-' + (++rampN);
      var cp = el('clipPath', { id: cid });
      vRanges.forEach(function (m) {
        cp.appendChild(el('rect', { x: '-500', y: String(m.t),
                                    width: String(g.W + 1000), height: String(m.b - m.t) }));
      });
      defs.appendChild(cp);
      var verge = el('g', { 'clip-path': 'url(#' + cid + ')' });
      verge.appendChild(el('path', { d: d(0), fill: 'none', stroke: '#9b9b9b',
                                     'stroke-width': 255 * scaleNow }));
      verge.appendChild(el('path', { d: d(0), fill: 'none', stroke: '#fff',
                                     'stroke-width': 187 * scaleNow }));
      verge.appendChild(el('path', { d: d(0), fill: 'none', stroke: '#1c9022',
                                     'stroke-width': 183 * scaleNow }));
      svg.appendChild(verge);
    }

    var road = el('g', {});
    road.appendChild(el('path', { 'class': 'road-hit', d: d(0), fill: 'none',
                                  stroke: ASPH, 'stroke-width': W_ROAD * scaleNow }));
    road.appendChild(el('path', { d: d(0), fill: 'none', stroke: LN, 'stroke-width': EDGE_OUT * 2 * scaleNow }));
    road.appendChild(el('path', { d: d(0), fill: 'none', stroke: ASPH, 'stroke-width': EDGE_IN * 2 * scaleNow }));
    road.appendChild(el('path', { d: d(0), fill: 'none', stroke: LN, 'stroke-width': DASH_W * scaleNow,
                                  'stroke-dasharray': dash }));
    svg.appendChild(road);
    /* His trees, planted down both sides of the grass wherever the verge
       runs. Placed once per route build, off the centreline itself, so they
       sit where the road actually goes. */
    if (vRanges.length) {
      var probe = el('path', { d: d(0), fill: 'none' });
      svg.appendChild(probe);
      var L = probe.getTotalLength(), step = 86 * scaleNow, off = 70 * scaleNow;
      var trees = el('g', {});
      for (var q = step * 0.5; q < L; q += step) {
        var a = probe.getPointAtLength(q - 1), c2 = probe.getPointAtLength(q + 1);
        var mid = probe.getPointAtLength(q);
        var inAny = false;
        for (var vi = 0; vi < vRanges.length; vi++)
          if (mid.y > vRanges[vi].t && mid.y < vRanges[vi].b) { inAny = true; break; }
        if (!inAny) continue;
        var dx = c2.x - a.x, dy = c2.y - a.y, len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var which = ((q / step) | 0) % 2 ? TREE_B : TREE_A;
          var tw = which.w * scaleNow, th = which.h * scaleNow;
          trees.appendChild(el('image', {
            href: which.src, 'xlink:href': which.src,
            x: (mid.x + nx * off * sgn - tw / 2).toFixed(1),
            y: (mid.y + ny * off * sgn - th / 2).toFixed(1),
            width: tw.toFixed(1), height: th.toFixed(1)
          }));
        }
      }
      probe.remove();
      svg.appendChild(trees);
    }

    var gA = el('path', { 'class': 'lane-guide', d: d(-LANE * scaleNow) });
    var gB = el('path', { 'class': 'lane-guide', d: d(LANE * scaleNow) });
    svg.appendChild(gA); svg.appendChild(gB);
    var fleet = el('g', {});
    svg.appendChild(fleet);
    g.el.appendChild(svg);
    return { guides: [gA, gB], fleet: fleet };
  }

  /* Build or rebuild one route. Vehicles keep their position ALONG the road as
     a fraction, so a rebuild slides them rather than scattering them. */
  function fitRoute(run) {
    var g = measureRoute(run.el);
    if (!g.W || !g.H || !g.moves.length) return;
    var d = buildRoute(g);
    if (!d) return;

    var keep = run.cars.map(function (c) {
      if (c.node) unbind(c.node);
      return { c: c, f: run.lanes.length ? c.d / run.lanes[c.lane].L : 0 };
    });

    var art = drawRoute(g, d);
    run.lanes = [sample(art.guides[0], false), sample(art.guides[1], true)];
    run.fleet = art.fleet;
    run.h = g.H; run.w = g.W;
    run.capacity = Math.max(4, Math.min(110,
      Math.round(TRAFFIC * (run.lanes[0].L * 2) / (SPACING * scaleNow))));

    keep.forEach(function (k) { k.c.d = k.f * run.lanes[k.c.lane].L; });
  }

  /* He redrew the asphalt at 95 across where the home page runs 125.88. The
     whole run-mode drawing takes that ratio, traffic included, so the cars
     stay the size of the lane they are in. */
  var HIS_ROAD = 95 / W_ROAD;

  function fitRoutes(W) {
    scaleNow = (W <= MOBILE_W ? 0.62 : (W <= NARROW_W ? 0.82 : 1)) * HIS_ROAD;
    carScale = (CAR_H * scaleNow) / MEDH;

    runs.forEach(function (r) {
      r.cars.forEach(function (c) { if (c.node) unbind(c.node); });
    });
    pool.forEach(function (p) { p.id = null; });
    incidents.length = 0;

    runs = ROUTES.map(function (el) {
      return { el: el, host: el, lanes: [], cars: [], byLane: [[], []],
               capacity: 40, fleet: null, onScreen: true, w: 0, h: 0 };
    });
    /* Where his ground is black. Read once per fit, in page coordinates, so
       a car can be asked whether it is out there without touching the DOM. */
    var pTop = page.getBoundingClientRect().top + window.pageYOffset;
    NIGHT = Array.prototype.map.call(
      page.querySelectorAll('[data-asphalt="#161616"]'), function (n) {
        var r = n.getBoundingClientRect();
        return [r.top + window.pageYOffset - pTop, r.bottom + window.pageYOffset - pTop];
      });

    runs.forEach(function (r) {
      var rr = r.el.getBoundingClientRect();
      r.pageTop = rr.top + window.pageYOffset - pTop;
    });
    runs.forEach(fitRoute);
    runs = runs.filter(function (r) { return r.lanes.length === 2; });

    sizePool();
    if (auto) applyAuto(); else applyManual();
  }

  /* ==========================================================================
     7. The fleet.
     Vehicles are logical objects belonging to a run. DOM nodes are a recycled
     pool handed only to the vehicles currently near the viewport, so a
     nine-section page with two roads costs the same per frame as the original
     single-stage hero.
     ====================================================================== */

  var VAN = { Red_Van: 1, Blue_Van: 1, Blue_Minivan: 1, 'Blue_Minivan-2': 1, Grey_Minivan: 1 };
  var BIG = { Green_Truck: 1, Semitrailer: 1, Gas_Truck: 1, Blue_bus: 1,
              Brown_Truck: 1, Yellow_truck: 1, Brown_Big_Truck: 1 };

  /* Who paints the asphalt.
     On the home page it is the owner: scene-build.js lays his own road tiles
     from the runs he drew, and hands this engine a centreline per run. This
     engine then keeps only the traffic and the physics — painting a second
     road of its own underneath his would double every edge line. The hit
     target for tap-to-pause still has to exist, so that one stroke stays,
     transparent.

     On a page with no scene of his — the Q&A page — nothing else lays a road,
     so the engine draws its own from the lane slots the layout reserves. It
     is the same road either way: the four stacked strokes at the top of this
     file are measured from his Illustrator artwork, not invented to match it.
     scene-build.js defines H19_ROAD_PATHS at load time and loads before this
     file, so its presence is a reliable test for which page we are on. */
  var DRAW_ROAD = !window.H19_ROAD_PATHS;

  var runs = [], pool = [], scaleNow = 1, gmul = 1, carScale = 1, rampN = 0;
  /* Which way a sprite faces in its own box. Flip this if the beams come out
     of the boot. */
  var HL_DIR = 1;
  var NIGHT = [];
  function inNight(y) {
    for (var i = 0; i < NIGHT.length; i++)
      if (y >= NIGHT[i][0] && y <= NIGHT[i][1]) return true;
    return false;
  }
  var TREE_A = { src: 'assets/scene/qa-tree-a.png', w: 55, h: 50 },
      TREE_B = { src: 'assets/scene/qa-tree-b.png', w: 71, h: 62 };

  /* Tap the road to pull the traffic up, tap again to let it go. Nothing is
     frozen: paused just sets every vehicle's target speed to zero and lets the
     existing car-following model brake them, so a semi takes noticeably longer
     to come to rest than a hatchback, and they pull away in the same order.
     Once everything has actually stopped the simulation idles. */
  var paused = false, settled = false;

  function metrics(c) {
    var len = c.base.w * carScale;
    c.len = len + 12 * scaleNow;
    var byLen = Math.min(1, Math.max(0, (len - 72 * scaleNow) / (92 * scaleNow)));
    var byType = BIG[c.id] ? 1 : (VAN[c.id] ? 0.5 : 0);
    var big = Math.max(byLen, byType);            /* 0 = small car, 1 = semi */
    c.gapMin = (24 + big * 22) * scaleNow + len * 0.34;   /* standing gap    */
    c.headTime = 0.42 + big * 0.62;                       /* seconds headway */
    c.acc = (108 - big * 58) * scaleNow;                  /* heavy pulls away slowly */
    c.dec = (310 - big * 140) * scaleNow;                 /* and stops slowly, so it hangs back */
    c.top = c.topRaw * (1 - big * 0.24);
  }

  function makeCar(lane) {
    var id = NAMES[(Math.random() * NAMES.length) | 0];
    var c = {
      id: id, lane: lane, base: BOX[id], node: null,
      topRaw: BASE * scaleNow * (0.88 + Math.random() * 0.26), d: 0, v: 0
    };
    metrics(c);
    c.v = c.top * 0.8;
    return c;
  }

  /* The beam's own gradient, parked in a hidden host so every car can point
     at it whichever route it is driving. */
  function beamDefs() {
    if (beamDefs._done) return;
    beamDefs._done = true;
    var host = el('svg', { width: '0', height: '0',
                           style: 'position:absolute;visibility:hidden' });
    var defs = el('defs', {});
    var lg = el('linearGradient', { id: 'car-beam', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg.appendChild(el('stop', { offset: '0',   'stop-color': '#ffeec2', 'stop-opacity': '.55' }));
    lg.appendChild(el('stop', { offset: '.45', 'stop-color': '#ffe9ae', 'stop-opacity': '.20' }));
    lg.appendChild(el('stop', { offset: '1',   'stop-color': '#ffe4a0', 'stop-opacity': '0' }));
    defs.appendChild(lg);
    host.appendChild(defs);
    document.body.appendChild(host);
  }

  function makeNode() {
    beamDefs();
    var g = el('g', { style: 'isolation:isolate' });   /* keeps multiply/screen
                                                          layers off the road
                                                          and off neighbours */
    /* The beams a car throws once it is out on the night stretch. Drawn under
       the car and shown only where the ground is black; in daylight they cost
       nothing but an element that never paints. */
    var hl = el('g', { 'class': 'car-hl' });
    hl.appendChild(el('path', { d: 'M0,-11 L150,-46 L150,46 L0,11 Z', fill: 'url(#car-beam)' }));
    g.appendChild(hl);
    var inner = el('g', { 'class': 'car-body' });
    var u = useOf(NAMES[0]);
    inner.appendChild(u);
    g.appendChild(inner);
    return { g: g, inner: inner, hl: hl, use: u, id: null, car: null };
  }

  function bind(node, c) {
    if (node.id !== c.id) {
      node.use.setAttributeNS(XLINK, 'xlink:href', '#' + c.id);
      node.use.setAttribute('href', '#' + c.id);
      var b = c.base;
      node.inner.setAttribute('transform',
        'scale(' + carScale.toFixed(4) + ') translate(' +
        (-(b.x + b.w / 2)).toFixed(2) + ',' + (-(b.y + b.h / 2)).toFixed(2) + ')');
      node.id = c.id;
    }
    /* The beam is thrown from the car's nose and scales with it. */
    if (node.hl) node.hl.setAttribute('transform',
      'translate(' + (c.len * HL_DIR * 0.46).toFixed(1) + ' 0)' +
      (HL_DIR < 0 ? ' scale(-1 1)' : '') +
      ' scale(' + (c.len / 92).toFixed(3) + ')');
    node.car = c; c.node = node;
  }
  function unbind(node) {
    if (node.car) node.car.node = null;
    node.car = null;
    if (node.g.parentNode) node.g.parentNode.removeChild(node.g);
  }

  function setRunCount(run, n) {
    if (!run.lanes.length) return;
    n = Math.max(4, n | 0);
    while (run.cars.length < n) run.cars.push(makeCar(run.cars.length % 2));
    while (run.cars.length > n) {
      var c = run.cars.pop();
      if (c.node) unbind(c.node);
    }
    run.byLane = [[], []];
    run.cars.forEach(function (c) { run.byLane[c.lane].push(c); });
    run.byLane.forEach(function (list, li) {
      var L = run.lanes[li].L;
      list.forEach(function (c, i) { c.d = (i / list.length) * L; c.v = c.top * 0.85; });
    });
  }

  /* Split a total vehicle count between the runs by how much road each has. */
  function spread(total) {
    var lens = runs.map(function (r) { return r.lanes.length ? r.lanes[0].L : 0; });
    var sum = lens.reduce(function (a, b) { return a + b; }, 0) || 1;
    runs.forEach(function (r, i) {
      setRunCount(r, Math.max(4, Math.round(total * lens[i] / sum)));
    });
  }
  function totalCapacity() {
    return runs.reduce(function (a, r) { return a + r.capacity; }, 0);
  }
  function totalCars() {
    return runs.reduce(function (a, r) { return a + r.cars.length; }, 0);
  }

  function sizePool() {
    var visible = window.innerHeight + CULL_MARGIN * 2;
    var want = Math.ceil(TRAFFIC * (visible * 2.6) / (SPACING * scaleNow)) + 14;
    want = Math.max(16, Math.min(90, want));
    while (pool.length < want) pool.push(makeNode());
    while (pool.length > want) { var p = pool.pop(); unbind(p); }
  }

  /* ==========================================================================
     7b. Incidents. A stretch of one lane where the limit drops for a while —
     a stalled van on the verge, someone slowing for a look. Nothing is
     scripted onto individual vehicles: the zone caps the speed limit and the
     queue that builds behind it, and the way it unwinds afterwards, falls out
     of the same car-following model that already stacks traffic behind a semi.
     They form where the visitor is looking, once they have stopped to read.
     Nobody watches the road for its own sake; they stop on a section, and that
     is the moment a queue building in the corner of the eye is worth anything.
     A blind timer put them somewhere along twenty screens of road, which
     almost always meant somewhere nobody was.
     ====================================================================== */

  var DWELL = 5,          /* seconds held still before one forms      */
      COOL  = 18;         /* seconds of quiet afterwards, plus 0-12   */
  var incidents = [], dwell = 0, cool = 0, lastScrollY = -1;

  /* Every point of road currently on screen, by run and lane. */
  function onScreenSpots() {
    var pageTop = page.getBoundingClientRect().top + window.pageYOffset;
    var top = window.pageYOffset - pageTop + 80;
    var bot = top + window.innerHeight - 160;
    var spots = [];
    for (var ri = 0; ri < runs.length; ri++) {
      var lanes = runs[ri].lanes;
      for (var li = 0; li < lanes.length; li++) {
        var y = lanes[li].y, hit = [], i;
        /* Band mode: the lane's y is band-local, and render() has already
           worked out whether that band is in view this frame. */
        if (BAND_MODE) {
          if (!runs[ri].onScreen) continue;
          for (i = 0; i <= lanes[li].n; i++) hit.push(i);
        } else {
          for (i = 0; i <= lanes[li].n; i++) if (y[i] > top && y[i] < bot) hit.push(i);
        }
        if (hit.length) spots.push({ run: ri, lane: li, idx: hit });
      }
    }
    return spots;
  }

  /* On screen is not enough on its own — a zone with nothing coming towards it
     is just an empty piece of road. Try a handful of visible points and take
     the one with the most traffic approaching, so a queue actually forms. */
  function pickSpot() {
    var spots = onScreenSpots();
    if (!spots.length) return null;
    var reach = 900 * scaleNow, best = null, bestScore = -1;
    for (var k = 0; k < 12; k++) {
      var sp = spots[(Math.random() * spots.length) | 0];
      var d = sp.idx[(Math.random() * sp.idx.length) | 0] * STEP;
      var list = runs[sp.run].byLane[sp.lane], L = runs[sp.run].lanes[sp.lane].L;
      var score = 0;
      for (var i = 0; i < list.length; i++) {
        if ((d - list[i].d + L) % L < reach) score++;   /* on its way here */
      }
      score += Math.random() * 0.5;                     /* break ties quietly */
      if (score > bestScore) { bestScore = score; best = { run: sp.run, lane: sp.lane, d: d }; }
    }
    return best;
  }

  function spawnIncident(opts) {
    if (!runs.length) return null;
    opts = opts || {};
    var ri = opts.run, li = opts.lane, d = opts.d;
    if (ri == null || li == null || d == null) {
      var pick = pickSpot();
      /* Section five is full-width with no road through it. Park there and
         there is nothing to hold up, so let it be rather than starting a jam
         two sections away that nobody will ever see. */
      if (!pick) return null;
      if (ri == null) ri = pick.run;
      if (li == null) li = pick.lane;
      if (d == null) d = pick.d;
    }
    var run = runs[ri];
    if (!run || !run.lanes.length) return null;
    var lane = run.lanes[li];
    if (!lane) return null;
    var inc = {
      run: ri, lane: li, L: lane.L,
      d: d != null ? d : Math.random() * lane.L,
      /* the zone is a road distance, so it narrows with the road on small
         screens the same way gaps and stopping distances already do */
      half:  (opts.half != null ? opts.half : 130 + Math.random() * 90) * scaleNow,
      floor: opts.floor != null ? opts.floor : 0.07 + Math.random() * 0.10,
      dur:   opts.dur   != null ? opts.dur   : 16 + Math.random() * 9,
      inT: 1.2, outT: 3.0, age: 0
    };
    incidents.push(inc);
    return inc;
  }

  /* Eases on and off rather than snapping, so the queue forms and clears. */
  function envelope(inc) {
    if (inc.age < inc.inT) return inc.age / inc.inT;
    var left = inc.dur - inc.age;
    if (left < inc.outT) return Math.max(0, left / inc.outT);
    return 1;
  }

  /* Page-space y of a zone, for working out whether it is still worth having. */
  function incY(inc) {
    var lane = runs[inc.run] && runs[inc.run].lanes[inc.lane];
    if (!lane) return null;
    return lane.y[Math.min(lane.n, Math.max(0, Math.round(inc.d / STEP)))];
  }

  function tickIncidents(dt) {
    var pageTop = page.getBoundingClientRect().top + window.pageYOffset;
    var top = window.pageYOffset - pageTop, h = window.innerHeight;

    for (var i = incidents.length - 1; i >= 0; i--) {
      var inc = incidents[i];
      inc.age += dt;
      /* Scrolled well clear of it: let it go, so the next one can form where
         the reader has actually stopped instead of waiting out this one. */
      var y = incY(inc);
      if (y != null && (y < top - h || y > top + h * 2)) {
        if (inc.age < inc.dur - inc.outT) inc.age = inc.dur - inc.outT;
      }
      if (inc.age >= inc.dur) incidents.splice(i, 1);
    }
    if (cool > 0) cool -= dt;

    /* Reading, not scrolling. A little movement is a hand on a trackpad, not
       someone leaving, so only a real jump resets the clock. */
    var y = window.pageYOffset;
    if (lastScrollY < 0 || Math.abs(y - lastScrollY) > 40) { lastScrollY = y; dwell = 0; }
    else dwell += dt;

    if (!incidents.length && cool <= 0 && dwell >= DWELL && spawnIncident()) {
      dwell = 0;
      cool = COOL + Math.random() * 12;
    }
  }

  /* Fraction of the free-flow limit this vehicle is allowed right now:
     1 clear of every zone, falling to the zone's floor at its centre. */
  function capFor(c, ri, li) {
    var cap = 1;
    for (var i = 0; i < incidents.length; i++) {
      var inc = incidents[i];
      if (inc.run !== ri || inc.lane !== li) continue;
      var L = inc.L;
      var dist = Math.abs(((c.d - inc.d + 1.5 * L) % L) - 0.5 * L);
      if (dist > inc.half) continue;
      var f = 1 - (1 - inc.floor) * envelope(inc) * (1 - dist / inc.half);
      if (f < cap) cap = f;
    }
    return cap;
  }

  /* ==========================================================================
     8. Physics. Unchanged from the original: measure the gap to the car ahead,
     check the tightest curve in the lookahead window, take whichever speed is
     lower. Queues behind the semi are emergent, never scripted.
     ====================================================================== */

  function step(dt, real) {
    var moving = false;
    tickIncidents(real == null ? dt : real);
    var slowed = incidents.length > 0;
    for (var ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      for (var li = 0; li < 2; li++) {
        var lane = run.lanes[li], L = lane.L, list = run.byLane[li];
        if (!list.length) continue;
        list.sort(function (p, q) { return p.d - q.d; });
        for (var i = 0; i < list.length; i++) {
          var c = list[i], lead = list[(i + 1) % list.length];
          var gap = (lead.d - c.d + L) % L - lead.len; if (gap < 0) gap = 0;
          var idx = Math.min(lane.n, Math.max(0, Math.round(c.d / STEP)));
          var t = Math.min(c.top, lane.lim[idx] * scaleNow);
          if (slowed) t *= capFor(c, ri, li);
          var safe = c.gapMin + c.v * c.headTime;
          if (gap < safe) {
            var f = gap / safe;
            t = Math.min(t, Math.max(0, lead.v * 0.94) * (0.3 + 0.7 * f) + f * f * 45 * scaleNow);
          }
          if (paused) t = 0;
          var acc = t > c.v ? c.acc : -c.dec, nv = c.v + acc * dt;
          if (acc > 0 && nv > t) nv = t;
          if (acc < 0 && nv < t) nv = t;
          if (nv < 0) nv = 0;
          c.v = nv;
          c.d = (c.d + c.v * dt) % L;
          if (nv > 0.4) moving = true;
        }
      }
    }
    settled = paused && !moving;
  }

  /* Hand DOM nodes to whoever is on screen, and only transform those. */
  function render() {
    var free = [], ri, i, c, top = 0, bot = 0;
    if (!BAND_MODE) {
      var pageTop = page.getBoundingClientRect().top + window.pageYOffset;
      top = window.pageYOffset - pageTop - CULL_MARGIN;
      bot = top + window.innerHeight + CULL_MARGIN * 2;
    }

    for (ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      /* In band mode a whole band is on screen or off it: a band is never
         taller than a screen, so one rect read per band beats page arithmetic
         per vehicle — and the band's own rect is the only thing that knows
         where it ended up after the copy moved. */
      var bandOn = true;
      if (BAND_MODE) {
        var r = run.host.getBoundingClientRect();
        bandOn = r.bottom > -CULL_MARGIN && r.top < window.innerHeight + CULL_MARGIN;
        run.onScreen = bandOn;
      }
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        var ln = run.lanes[c.lane];
        var idx = Math.min(ln.n, Math.max(0, Math.round(c.d / STEP)));
        c.x = ln.x[idx]; c.y = ln.y[idx]; c.a = ln.a[idx];
        c.on = BAND_MODE ? bandOn : (c.y > top && c.y < bot);
        if (!c.on && c.node) unbind(c.node);
      }
    }
    for (i = 0; i < pool.length; i++) if (!pool[i].car) free.push(pool[i]);

    for (ri = 0; ri < runs.length; ri++) {
      var cars = runs[ri].cars;
      for (i = 0; i < cars.length; i++) {
        c = cars[i];
        if (!c.on) continue;
        if (!c.node) {
          if (!free.length) continue;               /* pool exhausted: skip */
          bind(free.pop(), c);
          (runs[ri].fleet || fleetG).appendChild(c.node.g);
        }
        c.node.g.setAttribute('transform',
          'translate(' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ') rotate(' +
          (c.a * 57.2958).toFixed(1) + ')');
        /* Headlights on and the paint knocked back once a car is on his night
           stretch. Only written when it changes, so it costs nothing a frame. */
        var isNight = inNight(c.y + (runs[ri].pageTop || 0));
        if (isNight !== c.night) {
          c.night = isNight;
          if (isNight) c.node.g.setAttribute('class', 'is-night');
          else c.node.g.removeAttribute('class');
        }
      }
    }
  }

  /* ==========================================================================
     9. Layout / rebuild
     ====================================================================== */

  var lastW = 0, lastH = 0;

  function fit(force) {
    var W = page.clientWidth || window.innerWidth;
    var H = page.offsetHeight;

    /* Band mode ignores height entirely. The page grows every time an answer
       opens and none of it moves a band's own geometry, so re-fitting on
       height would rebuild every route for nothing. A route that DID change
       height is rebuilt on its own, by the observer below. */
    if (BAND_MODE) {
      if (!force && Math.abs(W - lastW) < 2) return;
      lastW = W; lastH = H;
      fitRoutes(W);
      return;
    }

    if (!force && Math.abs(W - lastW) < 2 && Math.abs(H - lastH) < 24) return;
    lastW = W; lastH = H;

    scaleNow = W <= MOBILE_W ? 0.62 : (W <= NARROW_W ? 0.82 : 1);
    carScale = (CAR_H * scaleNow) / MEDH;

    SECS = activeSections();
    if (!SECS.length) return;

    var g = measure(W, scaleNow);
    /* Prefer the owner's own road. scene-build.js lays his tiles and hands
       back a centreline per run, in this page's pixels, measured AFTER the
       straights have stretched — so the cars drive the road that is actually
       drawn rather than a second one generated to match it. Falls back to the
       generated geometry if his data is not present. */
    var supplied = window.H19_ROAD_PATHS ? window.H19_ROAD_PATHS() : [];
    var built = supplied.length
      ? supplied.map(function (r) {
          return function (off) { return offsetPath(r.d, off); };
        })
      : [buildRunA(g, scaleNow), buildRunB(g, scaleNow)]
          .filter(function (p) { return !!p; });
    if (!built.length) return;

    makeTiles(W, H, built.map(function (p) { return p(0); }));

    /* Lane paths come out of the same geometry as the asphalt. Lane A follows
       the centreline direction at -31 (the driver's right); lane B is the
       reversed sample at +31 — correct right-hand traffic. */
    var gi = 0;
    var keep = runs.map(function (r) { return r ? r.cars : null; });
    runs = built.map(function (path, i) {
      var dA = path(-LANE * scaleNow), dB = path(LANE * scaleNow);
      tiles.forEach(function (t) {
        t.guides.childNodes[i * 2].setAttribute('d', dA);
        t.guides.childNodes[i * 2 + 1].setAttribute('d', dB);
      });
      var lanes = [sample(tiles[0].guides.childNodes[i * 2], false),
                   sample(tiles[0].guides.childNodes[i * 2 + 1], true)];
      return { lanes: lanes, cars: [], byLane: [[], []], capacity: 40 };
    });
    gi = gi;

    /* Vehicles are rebuilt against the new geometry; nodes go back to the pool. */
    keep.forEach(function (cs) {
      if (cs) cs.forEach(function (c) { if (c.node) unbind(c.node); });
    });
    pool.forEach(function (p) { p.id = null; });
    incidents.length = 0;          /* placed against geometry that just changed */
    sizePool();

    runs.forEach(function (r) {
      r.capacity = Math.max(4, Math.min(110,
        Math.round(TRAFFIC * (r.lanes[0].L * 2) / (SPACING * scaleNow))));
    });

    if (auto) applyAuto(); else applyManual();
  }

  /* ==========================================================================
     10. Time-of-day traffic — built, optional, off the visitor's own clock.
     Weekdays get two commuter peaks, weekends one long afternoon hump.
     Kept available so the owner can decide later; there is no visitor-facing
     control for it. Add ?road=debug to the URL to preview any hour.
     ====================================================================== */

  var WEEKDAY = [0.10, 0.06, 0.04, 0.04, 0.07, 0.16, 0.38, 0.72, 0.85, 0.62, 0.48, 0.50,
                 0.56, 0.52, 0.55, 0.66, 0.82, 0.95, 0.88, 0.66, 0.48, 0.36, 0.26, 0.16];
  var WEEKEND = [0.22, 0.16, 0.11, 0.06, 0.05, 0.07, 0.11, 0.16, 0.24, 0.34, 0.46, 0.55,
                 0.62, 0.66, 0.66, 0.64, 0.60, 0.58, 0.54, 0.48, 0.42, 0.36, 0.32, 0.27];

  /* Time of day is built and works, but it is parked while we are testing.
     Left on, the page is a near-empty road at 4am and a jam at 6pm, so no two
     people — and no two test runs — ever see the same thing. Everything runs
     at FIXED_LOAD instead, a normal midday level. Set TOD back to true to
     hand the road back to the clock; the debug hour slider overrides both. */
  var TOD = false, FIXED_LOAD = 0.5;

  var auto = true, weekend = false, previewHour = -1, manualCount = 0;
  function applyManual() { spread(manualCount || totalCapacity()); }

  function loadAt(h, wk) {
    var T = wk ? WEEKEND : WEEKDAY, i = Math.floor(h) % 24, f = h - Math.floor(h);
    return T[i] * (1 - f) + T[(i + 1) % 24] * f;
  }
  function labelFor(L) {
    return L >= 0.80 ? 'rush hour' : L >= 0.55 ? 'busy' :
           L >= 0.30 ? 'steady' : L >= 0.12 ? 'quiet' : 'empty road';
  }
  function clockText(h) {
    var hh = Math.floor(h) % 24, m = Math.floor((h - Math.floor(h)) * 60);
    var ap = hh < 12 ? 'AM' : 'PM', h12 = hh % 12 || 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }
  function applyAuto() {
    if (!auto || !runs.length || paused) return;
    var now = new Date(), h = -1, wk = false, L;
    if (previewHour >= 0) { h = previewHour; wk = weekend; L = loadAt(h, wk); }
    else if (!TOD) { L = FIXED_LOAD; }
    else {
      h = now.getHours() + now.getMinutes() / 60;
      wk = (now.getDay() === 0 || now.getDay() === 6);
      L = loadAt(h, wk);
    }
    var cap = totalCapacity();
    var n = Math.max(4, Math.round(4 + L * (cap - 4)));
    gmul = 1.15 - 0.45 * L;                     /* empty roads run faster */
    spread(n);
    n = totalCars();
    if (dev.tod) dev.tod.textContent =
      (h < 0 ? 'fixed' : clockText(h) + (wk ? ' Sat/Sun' : '')) +
      ' · ' + labelFor(L) + ' · ' + n + ' vehicles';
    if (dev.dens) { dev.dens.value = Math.min(dev.dens.max, n); dev.densV.textContent = n; }
    if (dev.spd) { dev.spd.value = Math.round(gmul * 100); dev.spdV.textContent = Math.round(gmul * 100) + '%'; }
  }
  setInterval(function () { if (previewHour < 0) applyAuto(); }, 60000);

  /* ==========================================================================
     11. Loop. Pauses when the tab is hidden and when the road is off-screen.
     ====================================================================== */

  var last = performance.now(), running = true;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (running && runs.length) {
      if (!reduced && !settled) step(dt * gmul, dt);
      render();
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden; last = performance.now();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      running = e[0].isIntersecting && !document.hidden; last = performance.now();
    }, { threshold: 0 }).observe(layer);
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(function () { fit(false); }, 140);
  });
  if ('ResizeObserver' in window) {
    if (BAND_MODE) {
      /* One observer, one route per entry: an answer opening changes the
         height of exactly one route, and that is the only one rebuilt. The
         rest have not changed shape, only position, and their geometry is
         their own — so there is nothing to do for them. */
      var dirty = [], rrt;
      var rro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) {
          if (dirty.indexOf(e.target) < 0) dirty.push(e.target);
        });
        clearTimeout(rrt);
        rrt = setTimeout(function () {
          var W = page.clientWidth || window.innerWidth;
          if (Math.abs(W - lastW) >= 2) { dirty.length = 0; fit(false); return; }
          dirty.forEach(function (elm) {
            for (var i = 0; i < runs.length; i++) {
              if (runs[i].el === elm) { fitRoute(runs[i]); break; }
            }
          });
          dirty.length = 0;
          if (auto) applyAuto(); else applyManual();
        }, 120);
      });
      ROUTES.forEach(function (r) { rro.observe(r); });
    } else {
      var ro = new ResizeObserver(function () {
        clearTimeout(rt); rt = setTimeout(function () { fit(false); }, 140);
      });
      ro.observe(page);
    }
  }
  window.addEventListener('load', function () { fit(true); });
  /* The scenery is laid from the owner's canvas and re-laid whenever the copy
     re-wraps — fonts arriving, mainly. When it moves, the centrelines it hands
     us move with it, and traffic still driving the old line ends up in the
     ocean. Debounced with the same timer as a resize so a burst settles once. */
  window.addEventListener('h19:road-moved', function () {
    clearTimeout(rt); rt = setTimeout(function () { fit(false); }, 60);
  });

  /* ==========================================================================
     12. Dev panel — ?road=debug. Not shipped to visitors.
     ====================================================================== */

  function setPaused(next) {
    if (next === paused) return;
    paused = next;
    if (!paused) settled = false;
    last = performance.now();
    var t = document.getElementById('road-toast');
    if (t) {
      t.textContent = paused ? 'Traffic paused' : 'Traffic running';
      t.classList.add('is-on');
      clearTimeout(t._t);
      t._t = setTimeout(function () { t.classList.remove('is-on'); }, 1900);
    }
    var btn = document.getElementById('road-pause');
    if (btn) {
      btn.textContent = paused ? 'Resume traffic animation' : 'Pause traffic animation';
      btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    }
  }
  function togglePaused() { setPaused(!paused); }
  (BAND_MODE ? page : layer).addEventListener('click', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('road-hit')) togglePaused();
  });
  (function () {
    var btn = document.getElementById('road-pause');
    if (btn) btn.addEventListener('click', togglePaused);
  })();

  /* Test hook, so the incident behaviour can be driven from the console
     instead of waiting for one to land. Harmless to leave in. */
  window.__sim = {
    incidents: incidents,
    spawn: spawnIncident,
    setCount: function (n) {
      auto = false;
      manualCount = Math.max(4, n | 0);
      if (dev.tod) dev.tod.textContent = 'manual';
      spread(manualCount);
      return totalCars();
    }
  };
  /* getters, because fit() replaces the run list wholesale on a resize */
  Object.defineProperty(window.__sim, 'cars', {
    get: function () {
      return runs.reduce(function (a, r) { return a.concat(r.cars); }, []);
    }
  });
  Object.defineProperty(window.__sim, 'runs', { get: function () { return runs; } });

  var dev = {};
  (function () {
    if (!/[?&]road=debug/.test(location.search)) return;
    document.body.classList.add('road-debug');
    var p = document.getElementById('road-dev');
    if (!p) return;
    p.innerHTML =
      '<div class="tod" id="rd-tod">&nbsp;</div>' +
      '<label>Hour <input id="rd-hr" type="range" min="-1" max="23" value="-1"><b id="rd-hrV">now</b></label>' +
      '<label>Traffic <input id="rd-dens" type="range" min="4" max="150" value="30"><b id="rd-densV">30</b></label>' +
      '<label>Speed <input id="rd-spd" type="range" min="20" max="260" value="100"><b id="rd-spdV">100%</b></label>' +
      '<label>Car size <input id="rd-sz" type="range" min="26" max="80" value="46"><b id="rd-szV">46</b></label>' +
      '<button id="rd-auto" class="on">Time of day</button> ' +
      '<button id="rd-wk">Weekend</button> ' +
      '<button id="rd-lanes">Lanes</button>';
    dev.tod = p.querySelector('#rd-tod');
    dev.dens = p.querySelector('#rd-dens'); dev.densV = p.querySelector('#rd-densV');
    dev.spd = p.querySelector('#rd-spd'); dev.spdV = p.querySelector('#rd-spdV');
    function offAuto() { auto = false; p.querySelector('#rd-auto').classList.remove('on'); dev.tod.textContent = 'manual'; }
    p.querySelector('#rd-hr').addEventListener('input', function () {
      previewHour = +this.value;
      p.querySelector('#rd-hrV').textContent = previewHour < 0 ? 'now' : clockText(previewHour);
      auto = true; p.querySelector('#rd-auto').classList.add('on'); applyAuto();
    });
    dev.dens.addEventListener('input', function () {
      offAuto(); manualCount = +this.value; dev.densV.textContent = this.value; spread(manualCount);
    });
    dev.spd.addEventListener('input', function () {
      offAuto(); gmul = +this.value / 100; dev.spdV.textContent = this.value + '%';
    });
    p.querySelector('#rd-sz').addEventListener('input', function () {
      CAR_H = +this.value; p.querySelector('#rd-szV').textContent = this.value;
      carScale = (CAR_H * scaleNow) / MEDH;
      pool.forEach(function (n) { n.id = null; });
      runs.forEach(function (r) { r.cars.forEach(function (c) {
        metrics(c); if (c.node) { c.node.id = null; bind(c.node, c); } }); });
    });
    p.querySelector('#rd-auto').onclick = function () {
      auto = !auto; this.classList.toggle('on', auto);
      if (auto) applyAuto(); else dev.tod.textContent = 'manual';
    };
    p.querySelector('#rd-wk').onclick = function () {
      weekend = !weekend; this.classList.toggle('on', weekend); applyAuto();
    };
    p.querySelector('#rd-lanes').onclick = function () {
      document.body.classList.toggle('road-debug-lanes');
      this.classList.toggle('on');
      document.querySelectorAll('.lane-guide').forEach(function (g) {
        g.style.opacity = g.style.opacity === '0.9' ? '0' : '0.9';
      });
    };
  })();

  fit(true);
  requestAnimationFrame(frame);
})();

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

  /* Run A — in above the hero, out through the right edge at the promise. */
  function buildRunA(g, scale) {
    var list = runSections(g, 'a');
    if (!list.length) return null;
    var R = R_MAX * scale, half = g.half;
    var p = pen(list[0].x, -320, Math.PI / 2);

    for (var i = 1; i < list.length; i++) {
      p.jog(list[i].x, list[i - 1].bottom, R);
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

    for (var i = (g.narrow ? 1 : 1); i < list.length; i++) {
      var prev = list[i - 1];
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
                                      stroke: ASPHALT, 'stroke-width': W_ROAD * scaleNow }));
        road.appendChild(el('path', { d: d, fill: 'none', stroke: LINE, 'stroke-width': EDGE_OUT * 2 * scaleNow }));
        road.appendChild(el('path', { d: d, fill: 'none', stroke: ASPHALT, 'stroke-width': EDGE_IN * 2 * scaleNow }));
        road.appendChild(el('path', { d: d, fill: 'none', stroke: LINE, 'stroke-width': DASH_W * scaleNow,
                                      'stroke-dasharray': dash }));
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
     7. The fleet.
     Vehicles are logical objects belonging to a run. DOM nodes are a recycled
     pool handed only to the vehicles currently near the viewport, so a
     nine-section page with two roads costs the same per frame as the original
     single-stage hero.
     ====================================================================== */

  var VAN = { Red_Van: 1, Blue_Van: 1, Blue_Minivan: 1, 'Blue_Minivan-2': 1, Grey_Minivan: 1 };
  var BIG = { Green_Truck: 1, Semitrailer: 1, Gas_Truck: 1, Blue_bus: 1,
              Brown_Truck: 1, Yellow_truck: 1, Brown_Big_Truck: 1 };

  var runs = [], pool = [], scaleNow = 1, gmul = 1, carScale = 1;

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

  function makeNode() {
    var g = el('g', { style: 'isolation:isolate' });   /* keeps multiply/screen
                                                          layers off the road
                                                          and off neighbours */
    var inner = el('g', {});
    var u = useOf(NAMES[0]);
    inner.appendChild(u);
    g.appendChild(inner);
    return { g: g, inner: inner, use: u, id: null, car: null };
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
     One or two land in a typical visit, so the loop never settles into a
     pattern you can recognise.
     ====================================================================== */

  var incidents = [], nextInc = 22 + Math.random() * 20;

  /* The road is roughly twenty screens long, so a zone dropped anywhere along
     it would almost always be off in a section nobody is looking at. Pick from
     the stretch that is actually on screen instead, and only fall back to a
     free choice if the road has scrolled out of view entirely. */
  function onScreenSpots() {
    var pageTop = page.getBoundingClientRect().top + window.pageYOffset;
    var top = window.pageYOffset - pageTop + 80;
    var bot = top + window.innerHeight - 160;
    var spots = [];
    for (var ri = 0; ri < runs.length; ri++) {
      var lanes = runs[ri].lanes;
      for (var li = 0; li < lanes.length; li++) {
        var y = lanes[li].y, hit = [];
        for (var i = 0; i <= lanes[li].n; i++) if (y[i] > top && y[i] < bot) hit.push(i);
        if (hit.length) spots.push({ run: ri, lane: li, idx: hit });
      }
    }
    return spots;
  }

  function spawnIncident(opts) {
    if (!runs.length) return null;
    opts = opts || {};
    var ri = opts.run, li = opts.lane, d = opts.d;
    if (ri == null || li == null || d == null) {
      var spots = onScreenSpots();
      if (spots.length) {
        var pick = spots[(Math.random() * spots.length) | 0];
        if (ri == null) ri = pick.run;
        if (li == null) li = pick.lane;
        if (d == null && ri === pick.run && li === pick.lane) {
          d = pick.idx[(Math.random() * pick.idx.length) | 0] * STEP;
        }
      }
      if (ri == null) ri = (Math.random() * runs.length) | 0;
      if (li == null) li = (Math.random() * 2) | 0;
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

  function tickIncidents(dt) {
    for (var i = incidents.length - 1; i >= 0; i--) {
      incidents[i].age += dt;
      if (incidents[i].age >= incidents[i].dur) incidents.splice(i, 1);
    }
    nextInc -= dt;
    if (nextInc <= 0) { spawnIncident(); nextInc = 55 + Math.random() * 55; }
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
    var pageTop = page.getBoundingClientRect().top + window.pageYOffset;
    var top = window.pageYOffset - pageTop - CULL_MARGIN;
    var bot = top + window.innerHeight + CULL_MARGIN * 2;
    var free = [], ri, i, c;

    for (ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        var ln = run.lanes[c.lane];
        var idx = Math.min(ln.n, Math.max(0, Math.round(c.d / STEP)));
        c.x = ln.x[idx]; c.y = ln.y[idx]; c.a = ln.a[idx];
        c.on = c.y > top && c.y < bot;
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
          fleetG.appendChild(c.node.g);
        }
        c.node.g.setAttribute('transform',
          'translate(' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ') rotate(' +
          (c.a * 57.2958).toFixed(1) + ')');
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
    if (!force && Math.abs(W - lastW) < 2 && Math.abs(H - lastH) < 24) return;
    lastW = W; lastH = H;

    scaleNow = W <= MOBILE_W ? 0.62 : (W <= NARROW_W ? 0.82 : 1);
    carScale = (CAR_H * scaleNow) / MEDH;

    SECS = activeSections();
    if (!SECS.length) return;

    var g = measure(W, scaleNow);
    var built = [buildRunA(g, scaleNow), buildRunB(g, scaleNow)]
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
    var ro = new ResizeObserver(function () {
      clearTimeout(rt); rt = setTimeout(function () { fit(false); }, 140);
    });
    ro.observe(page);
  }
  window.addEventListener('load', function () { fit(true); });

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
  layer.addEventListener('click', function (e) {
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

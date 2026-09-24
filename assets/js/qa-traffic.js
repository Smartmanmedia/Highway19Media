/* ============================================================================
   Highway 19 Media — Q&A traffic.
   ----------------------------------------------------------------------------
   The engine already running on the site, pointed at this page's roads. His
   twenty vehicles, his car-following model: every car measures the gap to the
   one ahead and the tightest curve in front of it and takes whichever speed is
   lower, so queues behind a semi are emergent and nothing ever drives through
   anything else.

   What is new here: the lanes are polylines measured off his own artboards
   (tools/qa/routes.json -> assets/js/qa-lanes.js), the traffic is drawn INSIDE
   each section's SVG so it scales with his art, and the two night sections get
   headlights.
   ========================================================================= */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var XLINK = 'http://www.w3.org/1999/xlink';
  if (!window.H19_SPRITE || !window.H19_QA_LANES) return;

  var NAMES = [
    'Green_Car', 'Grey_Sadan', 'Red_Van', 'Brown_Jeep', 'Green_Truck',
    'Semitrailer', 'Blue_Minivan', 'Pink_Sadan', 'Gas_Truck', 'Blue_bus',
    'Brown_Truck', 'Grey_Jeep', 'Yellow_truck', 'Red_Sports_car', 'Yellow_Cab',
    'Blue_Van', 'Pink_Mini', 'Blue_Minivan-2', 'Brown_Big_Truck', 'Grey_Minivan'
  ];
  var VAN = { Red_Van: 1, Blue_Van: 1, Blue_Minivan: 1, 'Blue_Minivan-2': 1, Grey_Minivan: 1 };
  var BIG = { Green_Truck: 1, Semitrailer: 1, Gas_Truck: 1, Blue_bus: 1,
              Brown_Big_Truck: 1, Yellow_truck: 1, Brown_Truck: 1 };

  var STEP = 5,          /* lane sample spacing, artboard units */
      LOOK = 26,         /* curvature lookahead, in samples     */
      BASE = 150,        /* free-flow speed, units/s at scale 1 */
      LANE_REF = 47.5,   /* the lane width those numbers are for */
      SPACING = 330,     /* units of lane per vehicle           */
      CULL = 420;        /* px of viewport margin still rendered */

  var NIGHT = { '03': 1, '04': 1 };

  function el(n, a) { var e = document.createElementNS(SVGNS, n);
    for (var k in a) e.setAttribute(k, a[k]); return e; }

  /* -- 1. His vehicles, mounted once ------------------------------------- */
  var host = el('svg', { 'aria-hidden': 'true', focusable: 'false' });
  host.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
  var parsed = new DOMParser().parseFromString(
    '<svg xmlns="' + SVGNS + '" xmlns:xlink="' + XLINK + '">' + window.H19_SPRITE + '</svg>',
    'image/svg+xml');
  while (parsed.documentElement.firstChild) host.appendChild(parsed.documentElement.firstChild);
  document.body.appendChild(host);

  var probeSvg = el('svg', { 'aria-hidden': 'true' });
  probeSvg.setAttribute('style', 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;left:0;top:0');
  var probe = el('g', {});
  probeSvg.appendChild(probe);
  document.body.appendChild(probeSvg);

  var BOX = {};
  NAMES.forEach(function (id) {
    var u = el('use', {}); u.setAttributeNS(XLINK, 'xlink:href', '#' + id); u.setAttribute('href', '#' + id);
    probe.appendChild(u);
    var b;
    try { b = u.getBBox(); } catch (e) { b = null; }
    if (!b || !b.width) { var src = host.querySelector('[id="' + id + '"]');
      try { b = src.getBBox(); } catch (e2) { b = { x: 0, y: 0, width: 100, height: 40 }; } }
    BOX[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    probe.removeChild(u);
  });
  document.body.removeChild(probeSvg);

  /* -- 2. His lanes, resampled ------------------------------------------- */
  function buildLane(pts, laneW) {
    var xs = [], ys = [], d = 0, i;
    /* walk the polyline at a fixed step */
    var acc = 0, px = pts[0][0], py = pts[0][1];
    xs.push(px); ys.push(py);
    for (i = 1; i < pts.length; i++) {
      var ax = pts[i - 1][0], ay = pts[i - 1][1], bx = pts[i][0], by = pts[i][1];
      var seg = Math.hypot(bx - ax, by - ay);
      if (!seg) continue;
      var t = (STEP - acc) / seg;
      while (t <= 1) {
        xs.push(ax + (bx - ax) * t); ys.push(ay + (by - ay) * t);
        acc = 0; t += STEP / seg;
      }
      acc += seg * (1 - Math.max(0, t - STEP / seg));
      if (acc > STEP) acc = acc % STEP;
    }
    var n = xs.length - 1;
    var ang = new Array(n + 1), lim = new Array(n + 1);
    for (i = 0; i <= n; i++) {
      var a = Math.max(0, i - 1), b2 = Math.min(n, i + 1);
      ang[i] = Math.atan2(ys[b2] - ys[a], xs[b2] - xs[a]) * 180 / Math.PI;
    }
    var sc = laneW / LANE_REF;
    for (i = 0; i <= n; i++) {
      /* tightest turn in the lookahead window decides the limit */
      var worst = 0;
      for (var j = 1; j <= LOOK; j++) {
        var k0 = Math.min(n, i + j - 1), k1 = Math.min(n, i + j);
        var dA = Math.abs(((ang[k1] - ang[k0] + 540) % 360) - 180);
        if (dA > worst) worst = dA;
      }
      lim[i] = BASE * sc * Math.max(0.38, 1 - worst / 14);
    }
    return { x: xs, y: ys, a: ang, lim: lim, n: n, L: n * STEP, w: laneW, sc: sc };
  }

  var fleets = [];
  Object.keys(window.H19_QA_LANES).forEach(function (k) {
    var raw = window.H19_QA_LANES[k];
    if (!raw || !raw.length) return;
    var sec = document.getElementById('s' + k);
    if (!sec) return;
    var svg = sec.querySelector('.art > svg, .art-a > svg');
    if (!svg) return;
    var g = svg.querySelector('[data-fleetslot]');
    if (!g) { g = el('g', { 'data-fleet': '1' }); svg.appendChild(g); }
    var night = !!NIGHT[k];
    var lanes = raw.map(function (r) { return buildLane(r.pts, r.w); });
    fleets.push({ k: k, sec: sec, svg: svg, g: g, lanes: lanes, night: night, cars: [], nodes: [] });
  });
  if (!fleets.length) return;

  /* -- 3. Cars ------------------------------------------------------------ */
  function metrics(c, lane) {
    var b = BOX[c.id];
    c.scale = lane.w * 0.80 / b.h;
    var len = b.w * c.scale;
    c.len = len + 10 * lane.sc;
    var byLen = Math.min(1, Math.max(0, (len - 72 * lane.sc) / (92 * lane.sc)));
    var byType = BIG[c.id] ? 1 : (VAN[c.id] ? 0.5 : 0);
    var big = Math.max(byLen, byType);
    c.gapMin = (18 + big * 20) * lane.sc + len * 0.34;
    c.headTime = 0.42 + big * 0.62;
    c.acc = (108 - big * 58) * lane.sc;
    c.dec = (310 - big * 140) * lane.sc;
    c.top = c.topRaw * (1 - big * 0.24);
    c.big = big;
  }
  function makeCar(lane, li) {
    var c = { id: NAMES[(Math.random() * NAMES.length) | 0], lane: li, d: 0, v: 0,
              topRaw: BASE * lane.sc * (0.88 + Math.random() * 0.26) };
    metrics(c, lane);
    c.v = c.top * 0.8;
    return c;
  }

  fleets.forEach(function (f) {
    f.lanes.forEach(function (lane, li) {
      var n = Math.max(2, Math.round(lane.L / (SPACING * lane.sc)));
      var list = [];
      for (var i = 0; i < n; i++) {
        var c = makeCar(lane, li);
        c.d = lane.L * i / n;
        list.push(c);
      }
      f.cars = f.cars.concat(list);
    });
    f.byLane = f.lanes.map(function (_, li) {
      return f.cars.filter(function (c) { return c.lane === li; });
    });
  });

  /* -- 4. A node per on-screen car ---------------------------------------- */
  function makeNode(night) {
    var g = el('g', { style: 'isolation:isolate' });
    var beam = null;
    if (night) {
      beam = el('path', { d: 'M0,-3 L150,-38 L150,38 L0,3 Z',
                          fill: 'url(#h19beam)', opacity: '1' });
      g.appendChild(beam);
    }
    var inner = el('g', {});
    var u = el('use', {});
    inner.appendChild(u); g.appendChild(inner);
    return { g: g, inner: inner, use: u, id: null, car: null, beam: beam };
  }
  function bind(node, c) {
    if (node.beam) {
      var b0 = BOX[c.id];
      node.beam.setAttribute('transform',
        'translate(' + (b0.w * c.scale * 0.46).toFixed(1) + ',0) scale(' +
        (c.scale * b0.h / 42).toFixed(3) + ')');
    }
    if (node.id !== c.id) {
      node.use.setAttributeNS(XLINK, 'xlink:href', '#' + c.id);
      node.use.setAttribute('href', '#' + c.id);
      var b = BOX[c.id];
      node.inner.setAttribute('transform', 'scale(' + c.scale.toFixed(4) + ') translate(' +
        (-(b.x + b.w / 2)).toFixed(2) + ',' + (-(b.y + b.h / 2)).toFixed(2) + ')');
      node.id = c.id;
    }
    node.car = c; c.node = node;
  }

  /* the headlight gradient, once */
  (function () {
    var d = fleets[0].svg.querySelector('defs') || fleets[0].svg;
    var lg = el('linearGradient', { id: 'h19beam', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg.appendChild(el('stop', { offset: '0', 'stop-color': '#fff6cc', 'stop-opacity': '.72' }));
    lg.appendChild(el('stop', { offset: '.45', 'stop-color': '#fff2b8', 'stop-opacity': '.3' }));
    lg.appendChild(el('stop', { offset: '1', 'stop-color': '#fff6cc', 'stop-opacity': '0' }));
    fleets.forEach(function (f) {
      if (!f.night) return;
      var defs = f.svg.querySelector('defs');
      if (!defs) { defs = el('defs', {}); f.svg.insertBefore(defs, f.svg.firstChild); }
      defs.appendChild(lg.cloneNode(true));
    });
  })();

  /* -- 5. Physics --------------------------------------------------------- */
  function step(dt) {
    for (var fi = 0; fi < fleets.length; fi++) {
      var f = fleets[fi];
      for (var li = 0; li < f.lanes.length; li++) {
        var lane = f.lanes[li], L = lane.L, list = f.byLane[li];
        if (!list.length) continue;
        list.sort(function (p, q) { return p.d - q.d; });
        for (var i = 0; i < list.length; i++) {
          var c = list[i], lead = list[(i + 1) % list.length];
          /* bumper to bumper, not centre to centre: a long vehicle behind a
             short one used to close the difference and drive through it */
          var gap = (lead.d - c.d + L) % L - (lead.len + c.len) / 2;
          if (gap < 0) gap = 0;
          var idx = Math.min(lane.n, Math.max(0, Math.round(c.d / STEP)));
          var t = Math.min(c.top, lane.lim[idx]);
          var safe = c.gapMin + c.v * c.headTime;
          if (gap < safe) {
            var fr = gap / safe;
            t = Math.min(t, Math.max(0, lead.v * 0.94) * (0.3 + 0.7 * fr) + fr * fr * 45 * lane.sc);
          }
          var acc = t > c.v ? c.acc : -c.dec, nv = c.v + acc * dt;
          if (acc > 0 && nv > t) nv = t;
          if (acc < 0 && nv < t) nv = t;
          if (nv < 0) nv = 0;
          c.v = nv;
          c.d = (c.d + c.v * dt) % L;
        }
      }
    }
  }

  function render() {
    var vh = window.innerHeight, sy = window.pageYOffset;
    for (var fi = 0; fi < fleets.length; fi++) {
      var f = fleets[fi];
      var r = f.sec.getBoundingClientRect();
      var u = f.svg.getBoundingClientRect().width / 3088;   /* art unit -> px */
      var secTop = r.top + sy;
      if (r.bottom < -CULL || r.top > vh + CULL) {
        for (var q = 0; q < f.nodes.length; q++)
          if (f.nodes[q].g.parentNode) f.g.removeChild(f.nodes[q].g);
        f.mounted = false;
        continue;
      }
      var free = [], i, c;
      for (i = 0; i < f.cars.length; i++) {
        c = f.cars[i];
        var lane = f.lanes[c.lane];
        var idx = Math.min(lane.n, Math.max(0, Math.round(c.d / STEP)));
        c.x = lane.x[idx]; c.y = lane.y[idx]; c.ang = lane.a[idx];
        var py = secTop + c.y * u - sy;              /* art y -> viewport y */
        c.on = py > -CULL && py < vh + CULL;
        if (!c.on && c.node) { free.push(c.node); c.node.car = null; c.node = null; }
      }
      for (i = 0; i < f.cars.length; i++) {
        c = f.cars[i];
        if (!c.on || c.node) continue;
        var node = free.pop();
        if (!node) { node = makeNode(f.night); f.nodes.push(node); }
        bind(node, c);
        if (!node.g.parentNode) f.g.appendChild(node.g);
      }
      for (i = 0; i < free.length; i++) if (free[i].g.parentNode) f.g.removeChild(free[i].g);
      for (i = 0; i < f.cars.length; i++) {
        c = f.cars[i];
        if (!c.node) continue;
        c.node.g.setAttribute('transform',
          'translate(' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ') rotate(' + c.ang.toFixed(1) + ')');
      }
    }
  }

  var last = 0, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    if (!reduce) step(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(function (t) { last = t; render(); requestAnimationFrame(frame); });
})();

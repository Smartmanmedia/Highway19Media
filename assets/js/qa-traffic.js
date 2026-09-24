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
  if (!window.H19_SPRITE || !window.H19_QA_RUNS) return;

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
      LANE_REF = 41,     /* his standard lane pitch, measured          */
      SPACING = 250,     /* units of lane per vehicle           */
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

  /* -- 2. His lanes, resampled -------------------------------------------
     A run is one continuous lane. Where his road carries on into the next
     section, the run carries on with it: the same vehicle leaves the bottom
     of one and arrives at the top of the next. */
  function resample(pts) {
    var xs = [], ys = [], i;
    var acc = 0;
    xs.push(pts[0][0]); ys.push(pts[0][1]);
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
    return { xs: xs, ys: ys };
  }

  var runs = [];
  window.H19_QA_RUNS.forEach(function (raw) {
    var segs = [], total = 0, pitch = raw[0].pitch;
    for (var i = 0; i < raw.length; i++) {
      var sec = document.getElementById('s' + raw[i].k);
      if (!sec) continue;
      var svg = sec.querySelector('.art > svg, .art-a > svg');
      if (!svg) continue;
      var slot = svg.querySelector('[data-fleetslot]');
      if (!slot) { slot = el('g', {}); svg.appendChild(slot); }
      var rs = resample(raw[i].pts);
      var n = rs.xs.length - 1;
      var ang = new Array(n + 1);
      for (var j = 0; j <= n; j++) {
        var a = Math.max(0, j - 1), b2 = Math.min(n, j + 1);
        ang[j] = Math.atan2(rs.ys[b2] - rs.ys[a], rs.xs[b2] - rs.xs[a]) * 180 / Math.PI;
      }
      var sc = pitch / LANE_REF;
      var lim = new Array(n + 1);
      for (j = 0; j <= n; j++) {
        var worst = 0;
        for (var q = 1; q <= LOOK; q++) {
          var k0 = Math.min(n, j + q - 1), k1 = Math.min(n, j + q);
          var dA = Math.abs(((ang[k1] - ang[k0] + 540) % 360) - 180);
          if (dA > worst) worst = dA;
        }
        lim[j] = BASE * sc * Math.max(0.42, 1 - worst / 15);
      }
      segs.push({ k: raw[i].k, sec: sec, svg: svg, slot: slot, night: !!NIGHT[raw[i].k],
                  x: rs.xs, y: rs.ys, a: ang, lim: lim, n: n, L: n * STEP, d0: total });
      total += n * STEP;
    }
    if (segs.length) runs.push({ segs: segs, L: total, pitch: pitch, sc: pitch / LANE_REF, cars: [] });
  });
  if (!runs.length) return;
  var fleets = runs;

  /* -- 3. Cars ------------------------------------------------------------ */
  function metrics(c, run) {
    var b = BOX[c.id];
    c.scale = run.pitch * 0.78 / b.h;
    var len = b.w * c.scale;
    c.len = len + 9 * run.sc;
    var byLen = Math.min(1, Math.max(0, (len - 72 * run.sc) / (92 * run.sc)));
    var byType = BIG[c.id] ? 1 : (VAN[c.id] ? 0.5 : 0);
    var big = Math.max(byLen, byType);
    c.gapMin = (16 + big * 18) * run.sc + len * 0.30;
    c.headTime = 0.42 + big * 0.62;
    c.acc = (108 - big * 58) * run.sc;
    c.dec = (310 - big * 140) * run.sc;
    c.top = c.topRaw * (1 - big * 0.24);
  }
  runs.forEach(function (run) {
    /* density follows the car size, but not one for one: a road he drew at
       twice the scale should not carry half the traffic */
    var n = Math.max(3, Math.round(run.L / (SPACING * Math.pow(run.sc, 0.45))));
    for (var i = 0; i < n; i++) {
      var c = { id: NAMES[(Math.random() * NAMES.length) | 0], d: 0, v: 0,
                topRaw: BASE * run.sc * (0.88 + Math.random() * 0.26) };
      metrics(c, run);
      c.d = run.L * i / n;
      c.v = c.top * 0.8;
      run.cars.push(c);
    }
    run.nodes = [];
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
    var lg = el('linearGradient', { id: 'h19beam', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg.appendChild(el('stop', { offset: '0', 'stop-color': '#fff6cc', 'stop-opacity': '.72' }));
    lg.appendChild(el('stop', { offset: '.45', 'stop-color': '#fff2b8', 'stop-opacity': '.3' }));
    lg.appendChild(el('stop', { offset: '1', 'stop-color': '#fff6cc', 'stop-opacity': '0' }));
    var done = {};
    runs.forEach(function (run) { run.segs.forEach(function (s2) {
      if (!s2.night || done[s2.k]) return;
      done[s2.k] = 1;
      var defs = s2.svg.querySelector('defs');
      if (!defs) { defs = el('defs', {}); s2.svg.insertBefore(defs, s2.svg.firstChild); }
      defs.appendChild(lg.cloneNode(true));
    }); });
  })();

  /* -- 5. Physics --------------------------------------------------------- */
  function step(dt) {
    for (var ri = 0; ri < runs.length; ri++) {
      var run = runs[ri], L = run.L, list = run.cars;
      if (list.length < 2) continue;
      list.sort(function (p, q) { return p.d - q.d; });
      for (var i = 0; i < list.length; i++) {
        var c = list[i], lead = list[(i + 1) % list.length];
        var gap = (lead.d - c.d + L) % L - (lead.len + c.len) / 2;
        if (gap < 0) gap = 0;
        var seg = segAt(run, c.d);
        var idx = Math.min(seg.n, Math.max(0, Math.round((c.d - seg.d0) / STEP)));
        var t = Math.min(c.top, seg.lim[idx]);
        var safe = c.gapMin + c.v * c.headTime;
        if (gap < safe) {
          var fr = gap / safe;
          t = Math.min(t, Math.max(0, lead.v * 0.94) * (0.3 + 0.7 * fr) + fr * fr * 45 * run.sc);
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

  function segAt(run, d) {
    var segs = run.segs;
    for (var i = segs.length - 1; i >= 0; i--) if (d >= segs[i].d0) return segs[i];
    return segs[0];
  }

  function render() {
    var vh = window.innerHeight, sy = window.pageYOffset;
    for (var ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      var free = [], i, c;
      for (i = 0; i < run.segs.length; i++) {
        var s2 = run.segs[i];
        var r2 = s2.sec.getBoundingClientRect();
        s2.top = r2.top + sy;
        s2.u = s2.svg.getBoundingClientRect().width / 3088;
      }
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        var seg = segAt(run, c.d);
        var idx = Math.min(seg.n, Math.max(0, Math.round((c.d - seg.d0) / STEP)));
        c.seg = seg;
        c.x = seg.x[idx]; c.y = seg.y[idx]; c.ang = seg.a[idx];
        var py = seg.top + c.y * seg.u - sy;
        c.on = py > -CULL && py < vh + CULL;
        if (c.node && (!c.on || c.node.seg !== seg)) {
          free.push(c.node); c.node.car = null; c.node = null;
        }
      }
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        if (!c.on || c.node) continue;
        var node = null;
        for (var q = 0; q < free.length; q++)
          if (free[q].seg === c.seg) { node = free.splice(q, 1)[0]; break; }
        if (!node) { node = makeNode(c.seg.night); run.nodes.push(node); }
        if (node.g.parentNode !== c.seg.slot) c.seg.slot.appendChild(node.g);
        node.seg = c.seg;
        bind(node, c);
      }
      for (i = 0; i < free.length; i++) if (free[i].g.parentNode) free[i].g.parentNode.removeChild(free[i].g);
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
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

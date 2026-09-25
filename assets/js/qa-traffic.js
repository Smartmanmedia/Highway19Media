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

  /* HIS NIGHT IS NOT A WHOLE SECTION. Section four is drawn as a dawn: black
     at the top, his desert light by the foot of it, and the tarmac under it
     goes from 22 to 87 on the way down. So how lit a car is follows where it
     is on his road, not which artboard it happens to be in. */
  var NIGHT = { '03': 1, '04': 1 };
  var DAWN  = { '04': [480, 980] };
  var BANDS = [
    { f: 'brightness(.10) saturate(.20)', beam: 1 },
    { f: 'brightness(.30) saturate(.38)', beam: 0.78 },
    { f: 'brightness(.56) saturate(.62)', beam: 0.46 },
    { f: 'brightness(.82) saturate(.86)', beam: 0.18 }
  ];
  function bandOf(seg, y) {
    if (!seg.night) return -1;
    if (!seg.dawn) return 0;
    var t = (y - seg.dawn[0]) / (seg.dawn[1] - seg.dawn[0]);
    if (t <= 0) return 0;
    if (t >= 1) return -1;                       /* his daylight: paint as drawn */
    return 1 + Math.min(BANDS.length - 2, Math.floor(t * (BANDS.length - 1)));
  }

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
    /* HIS LANE, SMOOTHED WITHOUT ROUNDING HIS BENDS OFF. The route is
       measured off his art and a measurement carries a unit or so of noise;
       at the distance a heading is read over, a unit of noise is degrees of
       yaw, and a car crossing his bridge visibly weaves.

       A plain average would take the noise out and his corners with it. This
       fits a parabola through eighty units of lane either side and keeps the
       middle of it: a parabola follows a circular arc to second order, so a
       straight comes out straight, a bend comes out the bend he drew, and
       the noise between them goes. */
    var m = xs.length, sx = new Array(m), sy = new Array(m), i2, j2;
    for (i2 = 0; i2 < m; i2++) {
      var h = Math.min(8, i2, m - 1 - i2);
      if (h < 3) { sx[i2] = xs[i2]; sy[i2] = ys[i2]; continue; }
      var n2 = 0, S2 = 0, S4 = 0, Sx = 0, Sy = 0, Qx = 0, Qy = 0;
      for (j2 = -h; j2 <= h; j2++) {
        var jj = j2 * j2;
        n2++; S2 += jj; S4 += jj * jj;
        Sx += xs[i2 + j2]; Sy += ys[i2 + j2];
        Qx += jj * xs[i2 + j2]; Qy += jj * ys[i2 + j2];
      }
      var det = n2 * S4 - S2 * S2;
      if (!det) { sx[i2] = xs[i2]; sy[i2] = ys[i2]; continue; }
      sx[i2] = (S4 * Sx - S2 * Qx) / det;
      sy[i2] = (S4 * Sy - S2 * Qy) / det;
    }
    return { xs: sx, ys: sy };
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
      /* HEADING OVER FORTY UNITS, NOT TEN. A car's nose should follow his
         road, not the last two samples of it: read off a short baseline the
         yaw picks up every unit of scan noise and the car wiggles. */
      for (var j = 0; j <= n; j++) {
        var a = Math.max(0, j - 6), b2 = Math.min(n, j + 6);
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
      var vb = svg.viewBox && svg.viewBox.baseVal;
      segs.push({ k: raw[i].k, sec: sec, svg: svg, slot: slot, night: !!NIGHT[raw[i].k],
                  h: vb ? vb.height : 0, dawn: DAWN[raw[i].k] || null, layers: {},
                  x: rs.xs, y: rs.ys, a: ang, lim: lim, n: n, L: n * STEP, d0: total });
      total += n * STEP;
    }
    /* who is above and who is below, so a car crossing his seam can be drawn
       on both sides of it at once */
    for (var s3 = 0; s3 < segs.length; s3++) {
      segs[s3].prev = segs[s3 - 1] || null;
      segs[s3].next = segs[s3 + 1] || null;
    }
    if (segs.length) runs.push({ segs: segs, L: total, pitch: pitch,
                                 sc: pitch / LANE_REF, cars: [],
                                 ramp: Math.max(96, pitch * 1.5) });
  });
  if (!runs.length) return;
  var fleets = runs;

  /* -- 3. Cars ------------------------------------------------------------ */
  function metrics(c, run) {
    var b = BOX[c.id];
    c.scale = run.pitch * 0.70 / b.h;
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
    var n = Math.max(3, Math.round(run.L / (SPACING * Math.pow(run.sc, 0.3))));
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

  /* -- 4. His headlamps and tail lamps ------------------------------------
     The drive's own geometry, to the digit (build/v2/traffic.js): two beams
     forward off the nose and two short red glows off the tail, every number a
     proportion of that vehicle's own measured box, so a semi throws a longer
     beam than a hatchback with no special case. One set per vehicle type,
     referenced by <use> like the cars themselves. */
  var LAMP = { inset: 0.02, headSep: 0.55, tailSep: 0.60,
               headLen: 0.70, tailLen: 0.12,
               headBase: 0.06, headTip: 0.20, tailBase: 0.09, tailTip: 0.15 };
  (function buildLamps() {
    var defs = el('defs', {});
    var hg = el('linearGradient', { id: 'h19-beam', x1: '0', y1: '0', x2: '1', y2: '0' });
    hg.appendChild(el('stop', { offset: '0', 'stop-color': '#fff6d2', 'stop-opacity': '.95' }));
    hg.appendChild(el('stop', { offset: '.42', 'stop-color': '#ffeaa6', 'stop-opacity': '.45' }));
    hg.appendChild(el('stop', { offset: '1', 'stop-color': '#ffe294', 'stop-opacity': '0' }));
    var tg = el('linearGradient', { id: 'h19-tail', x1: '1', y1: '0', x2: '0', y2: '0' });
    tg.appendChild(el('stop', { offset: '0', 'stop-color': '#ff4436', 'stop-opacity': '.95' }));
    tg.appendChild(el('stop', { offset: '1', 'stop-color': '#ff2a1c', 'stop-opacity': '0' }));
    defs.appendChild(hg); defs.appendChild(tg);
    NAMES.forEach(function (n) {
      var b = BOX[n], L = b.w, A = b.h, mid = b.y + A / 2, ins = LAMP.inset * L;
      var g = el('g', { id: n + '_beams' });
      var hx = b.x + L - ins, hl = LAMP.headLen * L;
      [-1, 1].forEach(function (side) {
        var y = mid + side * LAMP.headSep / 2 * A;
        g.appendChild(el('polygon', { fill: 'url(#h19-beam)', points:
          [hx, y - LAMP.headBase * A, hx, y + LAMP.headBase * A,
           hx + hl, y + LAMP.headTip * A, hx + hl, y - LAMP.headTip * A]
          .map(function (v) { return v.toFixed(2); }).join(' ') }));
      });
      var tx = b.x + ins, tl = LAMP.tailLen * L;
      [-1, 1].forEach(function (side) {
        var y = mid + side * LAMP.tailSep / 2 * A;
        g.appendChild(el('polygon', { fill: 'url(#h19-tail)', points:
          [tx, y - LAMP.tailBase * A, tx, y + LAMP.tailBase * A,
           tx - tl, y + LAMP.tailTip * A, tx - tl, y - LAMP.tailTip * A]
          .map(function (v) { return v.toFixed(2); }).join(' ') }));
      });
      defs.appendChild(g);
    });
    host.appendChild(defs);
  })();

  /* -- 5. A node per on-screen car ----------------------------------------
     THE BEAMS ARE THEIR OWN LAYER, under every car: that is what stops a
     queueing car's beams washing over the car in front of it.

     THE NIGHT IS PAINTED ON EACH CAR, NOT ON THE LAYER. One filter over the
     whole layer is one surface the size of the section, and every car that
     moves makes the browser paint all of it again: measured, that is a
     dropped frame every other frame on his three-lane interstate, which is
     the jitter. A car is a thumbnail; filtered on its own it is cached and
     only moved. Same sum, same colour - 60fps instead of 30. */
  function lanes(seg, band) {
    var key = String(band);
    if (seg.layers[key]) return seg.layers[key];
    var B = band >= 0 ? BANDS[band] : null;
    var b = el('g', { 'data-beams': '1' });
    var c = el('g', { 'data-cars': '1' });
    if (B) b.setAttribute('style', 'opacity:' + B.beam);
    seg.slot.appendChild(b); seg.slot.appendChild(c);
    return (seg.layers[key] = { beams: b, cars: c, lit: !!B, f: B ? B.f : '' });
  }
  function makeNode(seg, band) {
    var L = lanes(seg, band);
    var bg = null, bu = null;
    if (L.lit) {
      bg = el('g', {});
      bu = el('use', {});
      bg.appendChild(bu);
    }
    var g = el('g', { style: 'isolation:isolate' });
    var inner = el('g', {});
    var u = el('use', {});
    if (L.f) u.setAttribute('style', 'filter:' + L.f);
    inner.appendChild(u); g.appendChild(inner);
    var node = { g: g, bg: bg, bu: bu, inner: inner, use: u, id: null, car: null,
                 band: band, layer: L, stamp: -1, fade: -1 };
    g.__n = node; if (bg) bg.__n = node;
    return node;
  }
  function bind(node, c) {
    if (node.id !== c.id) {
      var b = BOX[c.id];
      node.use.setAttributeNS(XLINK, 'xlink:href', '#' + c.id);
      node.use.setAttribute('href', '#' + c.id);
      var t = 'scale(' + c.scale.toFixed(4) + ') translate(' +
        (-(b.x + b.w / 2)).toFixed(2) + ',' + (-(b.y + b.h / 2)).toFixed(2) + ')';
      node.inner.setAttribute('transform', t);
      node.carT = t;
      if (node.bu) {
        node.bu.setAttributeNS(XLINK, 'xlink:href', '#' + c.id + '_beams');
        node.bu.setAttribute('href', '#' + c.id + '_beams');
      }
      node.id = c.id;
    }
    node.car = c; c.node = node;
  }

  function bindGhost(n, c) {
    if (n.id === c.id) return;
    var b = BOX[c.id];
    n.use.setAttributeNS(XLINK, 'xlink:href', '#' + c.id);
    n.use.setAttribute('href', '#' + c.id);
    n.carT = 'scale(' + c.scale.toFixed(4) + ') translate(' +
      (-(b.x + b.w / 2)).toFixed(2) + ',' + (-(b.y + b.h / 2)).toFixed(2) + ')';
    n.inner.setAttribute('transform', n.carT);
    if (n.bu) {
      n.bu.setAttributeNS(XLINK, 'xlink:href', '#' + c.id + '_beams');
      n.bu.setAttribute('href', '#' + c.id + '_beams');
    }
    n.id = c.id;
  }

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

  /* EVERY LANE OF HIS SIX-LANE HIGHWAY IS ITS OWN RUN, and they all live in
     the same section: measuring that section once a frame instead of once a
     run is the difference between one layout pass and eighteen. */
  var measured = {};
  function measure(sy) {
    measured = {};
    for (var ri = 0; ri < runs.length; ri++)
      for (var i = 0; i < runs[ri].segs.length; i++) {
        var s2 = runs[ri].segs[i];
        if (measured[s2.k]) { s2.top = measured[s2.k][0]; s2.u = measured[s2.k][1]; continue; }
        s2.top = s2.sec.getBoundingClientRect().top + sy;
        s2.u = s2.svg.getBoundingClientRect().width / 3088;
        measured[s2.k] = [s2.top, s2.u];
      }
  }
  var FRAME = 0;
  function render() {
    var vh = window.innerHeight, sy = window.pageYOffset;
    FRAME++;
    measure(sy);
    for (var ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      var free = [], i, c;
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        var seg = segAt(run, c.d);
        /* BETWEEN the samples, not snapped to them. His six-lane highway is
           drawn at a quarter of the hero's scale, so a car landing on the
           nearest 5-unit sample moved in visible steps. */
        var f = (c.d - seg.d0) / STEP;
        if (f < 0) f = 0; else if (f > seg.n) f = seg.n;
        var i0 = f | 0, i1 = Math.min(seg.n, i0 + 1), fr = f - i0;
        c.seg = seg;
        c.x = seg.x[i0] + (seg.x[i1] - seg.x[i0]) * fr;
        c.y = seg.y[i0] + (seg.y[i1] - seg.y[i0]) * fr;
        var a0 = seg.a[i0], a1 = seg.a[i1];
        var da = ((a1 - a0 + 540) % 360) - 180;
        c.ang = a0 + da * fr;
        var py = seg.top + c.y * seg.u - sy;
        c.on = py > -CULL && py < vh + CULL;
        c.band = bandOf(seg, c.y);
        if (c.node && (!c.on || c.node.seg !== seg || c.node.band !== c.band)) {
          free.push(c.node); c.node.car = null; c.node = null;
        }
      }
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        if (!c.on || c.node) continue;
        var node = null;
        for (var q = 0; q < free.length; q++)
          if (free[q].seg === c.seg && free[q].band === c.band) { node = free.splice(q, 1)[0]; break; }
        if (!node) { node = makeNode(c.seg, c.band); run.nodes.push(node); }
        if (node.g.parentNode !== node.layer.cars) node.layer.cars.appendChild(node.g);
        if (node.bg && node.bg.parentNode !== node.layer.beams) node.layer.beams.appendChild(node.bg);
        node.seg = c.seg;
        bind(node, c);
      }
      for (i = 0; i < free.length; i++) {
        if (free[i].g.parentNode) free[i].g.parentNode.removeChild(free[i].g);
        if (free[i].bg && free[i].bg.parentNode) free[i].bg.parentNode.removeChild(free[i].bg);
        if (free[i].gh) {
          if (free[i].gh.g.parentNode) free[i].gh.g.parentNode.removeChild(free[i].gh.g);
          if (free[i].gh.bg && free[i].gh.bg.parentNode)
            free[i].gh.bg.parentNode.removeChild(free[i].gh.bg);
          free[i].gh = null;
        }
      }
      for (i = 0; i < run.cars.length; i++) {
        c = run.cars[i];
        if (!c.node) continue;
        var tf = 'translate(' + c.x.toFixed(2) + ',' + c.y.toFixed(2) +
                 ') rotate(' + c.ang.toFixed(2) + ')';
        c.node.g.setAttribute('transform', tf);
        c.node.stamp = FRAME;
        /* WHERE HIS ROAD JUST STOPS AT THE EDGE OF AN ARTBOARD. Each
           section clips its own art. Where his road carries on into the
           next one the car is drawn on both sides of the join and nothing
           is lost. Where it does not - his forest road simply begins at the
           top of its own artboard, under his rocks - a car arriving there
           was cut in half by the join. It is faded over its own length as
           it crosses, so it comes up out of the edge instead of being
           sliced by it. */
        var sg0 = c.seg, rp = run.ramp, fd = 1;
        if (!sg0.prev && c.y < rp) fd = c.y / rp;
        if (!sg0.next && sg0.h && c.y > sg0.h - rp) {
          var f2 = (sg0.h - c.y) / rp;
          if (f2 < fd) fd = f2;
        }
        if (fd < 0) fd = 0; else if (fd > 1) fd = 1;
        if (fd !== c.node.fade) {
          c.node.fade = fd;
          if (fd >= 1) c.node.g.removeAttribute('opacity');
          else c.node.g.setAttribute('opacity', fd.toFixed(3));
          if (c.node.bg) {
            if (fd >= 1) c.node.bg.removeAttribute('opacity');
            else c.node.bg.setAttribute('opacity', fd.toFixed(3));
          }
        }
        /* EACH SECTION CLIPS ITS OWN ART, so a car halfway over the join was
           losing whichever half was on the other side of it. While it
           straddles, the same car is drawn in the next section too, a whole
           artboard further up - it is one road. */
        var sg = c.seg, gh = null, gy = 0;
        if (sg.next && c.y > sg.h - 150) { gh = sg.next; gy = c.y - sg.h; }
        else if (sg.prev && c.y < 150 && sg.prev.h) { gh = sg.prev; gy = c.y + sg.prev.h; }
        if (gh) {
          var gb = bandOf(gh, gy);
          if (c.node.gh && c.node.gh.band !== gb) {
            if (c.node.gh.g.parentNode) c.node.gh.g.parentNode.removeChild(c.node.gh.g);
            if (c.node.gh.bg && c.node.gh.bg.parentNode)
              c.node.gh.bg.parentNode.removeChild(c.node.gh.bg);
            c.node.gh = null;
          }
          if (!c.node.gh) c.node.gh = makeNode(gh, gb);
          var gn = c.node.gh;
          if (gn.g.parentNode !== gn.layer.cars) gn.layer.cars.appendChild(gn.g);
          if (gn.bg && gn.bg.parentNode !== gn.layer.beams) gn.layer.beams.appendChild(gn.bg);
          bindGhost(gn, c);
          var gt = 'translate(' + c.x.toFixed(2) + ',' + gy.toFixed(2) +
                   ') rotate(' + c.ang.toFixed(2) + ')';
          gn.g.setAttribute('transform', gt);
          gn.stamp = FRAME;
          if (fd !== gn.fade) {
            gn.fade = fd;
            if (fd >= 1) gn.g.removeAttribute('opacity');
            else gn.g.setAttribute('opacity', fd.toFixed(3));
            if (gn.bg) {
              if (fd >= 1) gn.bg.removeAttribute('opacity');
              else gn.bg.setAttribute('opacity', fd.toFixed(3));
            }
          }
          if (gn.bg) gn.bg.setAttribute('transform', gt + ' ' + gn.carT);
        } else if (c.node.gh && c.node.gh.g.parentNode) {
          c.node.gh.g.parentNode.removeChild(c.node.gh.g);
          if (c.node.gh.bg && c.node.gh.bg.parentNode)
            c.node.gh.bg.parentNode.removeChild(c.node.gh.bg);
        }
        /* the beams ride in their own layer, so they carry the car's place
           AND the car's own scale */
        if (c.node.bg)
          c.node.bg.setAttribute('transform', tf + ' ' + c.node.carT);
      }
    }
  }

  /* NOTHING IS EVER LEFT STANDING ON HIS ROAD. A node is only his while a car
     is on it this frame; one that misses a frame is off the page, whatever
     path took it there. */
  var allSegs = [];
  runs.forEach(function (r) { r.segs.forEach(function (s2) {
    if (allSegs.indexOf(s2) < 0) allSegs.push(s2); }); });
  function sweep() {
    for (var si = 0; si < allSegs.length; si++) {
      var L = allSegs[si].layers;
      for (var key in L) {
        ['cars', 'beams'].forEach(function (which) {
          var g = L[key][which], i;
          for (i = g.children.length - 1; i >= 0; i--) {
            var n = g.children[i].__n;
            if (n && n.stamp !== FRAME) g.removeChild(g.children[i]);
          }
        });
      }
    }
  }

  var last = 0, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(t) {
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    if (!reduce) step(dt);
    render();
    /* an orphan cannot outlive half a second, and the check costs nothing
       spread over thirty frames */
    if ((FRAME % 30) === 0) sweep();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(function (t) { last = t; render(); requestAnimationFrame(frame); });
})();

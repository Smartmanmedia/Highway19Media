/* Highway 19 Media — traffic on HIS roads.

   The roads are not drawn here. They are his, in the artwork, and the routes
   this drives on were traced off the paint: every road group in his file
   carries its own dashed centre line, so tools/roads.js collects those dashes
   and chains them into runs. A turn comes out curved because his dashes are,
   not because anything here knows a radius.

   One overlay per band, laid exactly like that band's art and clipped by it,
   so a band that closes up when its answers are shut crops the traffic the
   same way it crops the scenery — and nothing has to be re-measured when the
   page grows.

   Lanes: his road is two lanes, one each way, at a quarter of its width
   either side of the centreline. A vehicle is sized to ITS lane, which is
   what keeps the highway's traffic small against the section roads.        */
(function () {
  'use strict';

  var ROUTES = window.H19_ROUTES || [];
  if (!ROUTES.length) return;

  var PAGE_W = 1441.5, ART_W = 2077.52, ORIGIN_X = 320.3;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var BAND_PAD = 40;          /* let a route reach a little past its band   */
  var CAR_OF_LANE = 0.62;     /* vehicle height as a share of its lane      */
  var SPEED = 105;            /* his px per second on a 95 road             */
  var SPACING = 250;          /* his px between vehicles in a lane          */

  function el(n, a) {
    var e = document.createElementNS(SVGNS, n);
    for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    return e;
  }

  /* ---- his vehicles ----------------------------------------------------
     cars-sprite.js is one SVG of twenty vehicles, all drawn facing right and
     referenced by <use>. It goes in the document once, hidden, and every
     vehicle on the page points at it. */
  var host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(host);
  /* PARSED AS SVG, not assigned as innerHTML. innerHTML on an HTML element
     builds HTML nodes from SVG markup — they look right in the inspector,
     report tagName in capitals, have no getBBox, and no <use href> will
     resolve against them. */
  try {
    /* the sprite is a bare <defs> fragment with no namespace of its own, so
       it is wrapped before parsing — otherwise nothing in it is an SVG
       element and no <use href> resolves against it */
    var src = (window.H19_SPRITE || '').trim();
    if (src.slice(0, 4) !== '<svg')
      src = '<svg xmlns="http://www.w3.org/2000/svg" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink">' + src + '</svg>';
    var doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    if (doc.documentElement && doc.documentElement.nodeName !== 'parsererror')
      host.appendChild(document.importNode(doc.documentElement, true));
  } catch (e) { return; }

  var NAMES = [];
  Array.prototype.forEach.call(host.querySelectorAll('g[id]'), function (n) {
    if (/^(grads|linear-gradient)/.test(n.id)) return;
    if (n.querySelector('path,rect,polygon,circle,ellipse')) NAMES.push(n.id);
  });
  NAMES = NAMES.filter(function (n, i) { return NAMES.indexOf(n) === i; });
  if (!NAMES.length) return;

  /* measure each one once, in its own coordinates */
  var probe = el('svg', { width: 0, height: 0 });
  probe.style.cssText = 'position:absolute;width:0;height:0';
  document.body.appendChild(probe);
  var BOX = {};
  NAMES.forEach(function (id) {
    var u = el('use', { href: '#' + id });
    u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + id);
    probe.appendChild(u);
    var b;
    try { b = u.getBBox(); } catch (e) { b = null; }
    if (!b || !b.width) { try { b = host.querySelector('#' + CSS.escape(id)).getBBox(); }
                          catch (e2) { b = { x: 0, y: 0, width: 100, height: 40 }; } }
    BOX[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    probe.removeChild(u);
  });
  probe.remove();
  NAMES = NAMES.filter(function (n) { return BOX[n].w > 8 && BOX[n].h > 4; });
  if (!NAMES.length) return;

  /* ---- geometry --------------------------------------------------------- */
  function offset(pts, d) {
    /* the same run, moved d to one side of itself */
    var out = [], i, n = pts.length;
    for (i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var vx = b[0] - a[0], vy = b[1] - a[1];
      var L = Math.hypot(vx, vy) || 1;
      out.push([pts[i][0] - (vy / L) * d, pts[i][1] + (vx / L) * d]);
    }
    return out;
  }

  function toPath(pts) {
    /* a soft polyline: his turns are sampled every dash, so a quadratic
       through the midpoints rounds them off without inventing a radius */
    if (pts.length < 3) return 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join('L');
    var d = 'M' + pts[0][0] + ' ' + pts[0][1], i;
    for (i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += 'Q' + pts[i][0] + ' ' + pts[i][1] + ' ' + mx + ' ' + my;
    }
    return d + 'L' + pts[pts.length - 1][0] + ' ' + pts[pts.length - 1][1];
  }

  /* the part of a route that belongs to one band */
  function clipRoute(pts, y0, y1) {
    var runs = [], cur = [];
    pts.forEach(function (p) {
      if (p[1] >= y0 - BAND_PAD && p[1] <= y1 + BAND_PAD) cur.push(p);
      else { if (cur.length > 2) runs.push(cur); cur = []; }
    });
    if (cur.length > 2) runs.push(cur);
    return runs;
  }

  /* ---- build one overlay per band --------------------------------------- */
  var lanes = [], seed = 1;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

  Array.prototype.forEach.call(
    document.querySelectorAll('[data-y0]'), function (bandEl) {
      var y0 = parseFloat(bandEl.getAttribute('data-y0'));
      var y1 = parseFloat(bandEl.getAttribute('data-y1'));
      var h  = y1 - y0;

      var mine = [];
      ROUTES.forEach(function (r) {
        clipRoute(r.p, y0, y1).forEach(function (run) { mine.push({ w: r.w, p: run }); });
      });
      if (!mine.length) return;

      var svg = el('svg', {
        'class': 'qa-traffic', 'aria-hidden': 'true', focusable: 'false',
        width: ART_W, height: h.toFixed(2),
        viewBox: (-ORIGIN_X) + ' ' + y0 + ' ' + ART_W + ' ' + h
      });
      bandEl.insertBefore(svg, bandEl.firstChild);

      mine.forEach(function (r) {
        var laneW = r.w / 2, off = r.w / 4;
        var fleet = el('g', { style: 'isolation:isolate' });
        svg.appendChild(fleet);
        [1, -1].forEach(function (side) {
          var pts = offset(r.p, off * side);
          if (side < 0) pts = pts.slice().reverse();     /* the other way round */
          var path = el('path', { d: toPath(pts), fill: 'none', stroke: 'none' });
          svg.appendChild(path);
          var L = 0;
          try { L = path.getTotalLength(); } catch (e) { L = 0; }
          if (L < 60) { path.remove(); return; }
          var lane = { path: path, L: L, cars: [], scale: 0 };
          var n = Math.max(1, Math.round(L / SPACING));
          for (var i = 0; i < n; i++) {
            var name = NAMES[(Math.floor(rnd() * NAMES.length)) % NAMES.length];
            var b = BOX[name];
            var k = (laneW * CAR_OF_LANE) / b.h;
            var g = el('g', {});
            var u = el('use', { href: '#' + name, transform:
              'scale(' + k.toFixed(4) + ') translate(' + (-b.x - b.w / 2) + ' ' + (-b.y - b.h / 2) + ')' });
            u.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + name);
            g.appendChild(u);
            fleet.appendChild(g);
            lane.cars.push({ g: g, s: (i + rnd() * 0.5) * (L / n),
                             v: SPEED * (0.82 + rnd() * 0.36) });
          }
          lanes.push(lane);
        });
      });
    });

  if (!lanes.length) return;

  /* ---- drive ------------------------------------------------------------ */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var running = !reduce, last = 0;

  function place(lane, car) {
    var p = lane.path.getPointAtLength(car.s);
    var q = lane.path.getPointAtLength(Math.min(lane.L, car.s + 2));
    var a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
    car.g.setAttribute('transform',
      'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ') rotate(' + a.toFixed(1) + ')');
  }
  lanes.forEach(function (l) { l.cars.forEach(function (c) { place(l, c); }); });

  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    for (var i = 0; i < lanes.length; i++) {
      var l = lanes[i];
      for (var j = 0; j < l.cars.length; j++) {
        var c = l.cars[j];
        c.s += c.v * dt;
        if (c.s > l.L) c.s -= l.L;
        place(l, c);
      }
    }
    requestAnimationFrame(frame);
  }
  if (running) requestAnimationFrame(frame);

  /* his pause control, and stop when the tab is not looking */
  var btn = document.getElementById('road-pause');
  if (btn) {
    btn.hidden = false;
    btn.addEventListener('click', function () {
      running = !running;
      btn.setAttribute('aria-pressed', String(!running));
      btn.textContent = running ? 'Pause traffic animation' : 'Resume traffic animation';
      if (running) { last = 0; requestAnimationFrame(frame); }
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!reduce && (!btn || btn.getAttribute('aria-pressed') !== 'true')) {
      running = true; last = 0; requestAnimationFrame(frame);
    }
  });
})();

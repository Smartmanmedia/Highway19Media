/* HIS TRAFFIC. Two-way, random, and it queues.
 *
 * The stop-and-go is the whole point, and it is the one thing keyframes cannot
 * do: a car has to react to the car in front of it, which means a simulation.
 * But a simulation is not the same as v1's 1,800 lines. This is the smallest
 * thing that produces the behaviour - a position along the road, a speed, and
 * a rule about the gap ahead - and the jams come out of that on their own,
 * because the cars are given different top speeds and a limited rate of
 * acceleration. Nothing is scripted; the waves are emergent.
 *
 * WHERE THE ROAD IS comes from his own art: tools/extract_path.js reads the
 * centreline off the white dashes he drew down the middle of every tile, so a
 * car sits where a car would sit and turns where his road turns.
 *
 * ROADS ARE PER SECTION, except one and two, which his art joins into a single
 * run - so they are one road here too. A car crossing that seam is drawn TWICE,
 * once in each section, because both sections clip their own overflow: the two
 * halves meet exactly on the boundary and read as one car passing through.
 *
 * Parked when its road is off screen, so a long page is not simulating traffic
 * nobody is looking at.
 */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var P = window.H19_PATHS, SPRITE = window.H19_SPRITE, NAMES = window.H19_CARS;
  var SHADES = window.H19_SHADES;          /* optional - no file, no shadows */
  if (!P || !SPRITE || !NAMES) return;

  var SVGNS = 'http://www.w3.org/2000/svg', XLINK = 'http://www.w3.org/1999/xlink';
  /* His roads. One and two are a single run in his art, so they are one road
     here. `thin` is a density multiplier - the desert straight is meant to be
     the quiet one. */
  var ROADS = [{ secs: ['01', '02'], thin: 1 },
               { secs: ['03'],       thin: 0.45 },
               { secs: ['04'],       thin: 1 }];
  var SPACING   = 0.110,  /* road length per car, as a share of section width -
                             the count follows from how long his road is, so a
                             short road does not end up nose to tail */
      CRUISE    = 0.060,  /* share of a section's width per second */
      SPREAD    = 0.55,   /* how much top speeds differ - this is what jams */
      LORRY     = 0.34,   /* how much slower the longest vehicle is than the
                             shortest. His semitrailer and his bus hold people
                             up, which is where most of the queueing comes
                             from - it is the same reason real traffic jams. */
      ACCEL     = 0.10, DECEL = 0.34,   /* same units, per second squared */
      HEADWAY   = 0.85,   /* seconds of gap a driver wants */
      REACT     = 0.85,   /* SECONDS OF REACTION DELAY, and the whole reason the
                             traffic queues rather than settling into a convoy.
                             A driver who responds instantly to the gap ahead
                             finds a stable equilibrium and stays there; a
                             driver who responds LATE overshoots, brakes harder
                             than needed, and the car behind does the same but
                             worse. That is what a stop-and-go wave is, in real
                             traffic and here - nothing about it is scripted. */
      CAR_ACROSS= 0.72;   /* car height as a share of its lane */

  /* -- his vehicles, once, hidden, referenced by <use> ---------------------- */
  var defs = document.createElementNS(SVGNS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('width', 0); defs.setAttribute('height', 0);
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.innerHTML = SPRITE + (SHADES || '');
  document.body.appendChild(defs);

  /* measure each one, so a lorry is a lorry and a mini is a mini */
  var box = {};
  NAMES.forEach(function (n) {
    var g = defs.querySelector('#' + CSS.escape(n));
    box[n] = g ? g.getBBox() : { x: 0, y: 0, width: 100, height: 40 };
  });
  /* long vehicle, slow vehicle */
  var lens = NAMES.map(function (n) { return box[n].width / box[n].height; });
  var lo = Math.min.apply(null, lens), hi = Math.max.apply(null, lens);
  var pace = {};
  NAMES.forEach(function (n, i) {
    pace[n] = 1 - LORRY * (hi > lo ? (lens[i] - lo) / (hi - lo) : 0);
  });

  /* -- the roads ------------------------------------------------------------ */
  var roads = ROADS.map(function (cfg) {
    var parts = cfg.secs.map(function (n) {
      var el = document.querySelector('.sec' + (+n));
      if (!el || !P[n]) return null;
      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'traffic z-road');
      svg.setAttribute('aria-hidden', 'true');
      el.appendChild(svg);
      /* TWO LAYERS, NOT ONE ORDER OF CHILDREN. Cars are appended a vehicle at a
         time, so a single list would read shadow, car, shadow, car - and the
         first car would paint UNDER the second car's shadow the moment the two
         came close on a bend. A group for all the shadows and a group for all
         the cars settles it once. */
      var shadeG = document.createElementNS(SVGNS, 'g');
      shadeG.setAttribute('class', 'shades');
      var carG = document.createElementNS(SVGNS, 'g');
      svg.appendChild(shadeG); svg.appendChild(carG);
      return { n: n, el: el, svg: svg, shadeG: shadeG, carG: carG, path: P[n] };
    }).filter(Boolean);
    if (!parts.length) return null;
    return { parts: parts, thin: cfg.thin, cars: [], live: true, pts: [], len: 0, laneW: 0 };
  }).filter(Boolean);
  if (!roads.length) return;

  function use(id) {
    var u = document.createElementNS(SVGNS, 'use');
    u.setAttributeNS(XLINK, 'xlink:href', '#' + id);
    u.setAttribute('href', '#' + id);
    return u;
  }

  /* -- measure: turn his percentages into page pixels ----------------------- */
  function layout() {
    roads.forEach(function (road) {
      var pts = [];
      road.parts.forEach(function (part) {
        var r = part.el.getBoundingClientRect();
        part.ox = r.left + scrollX; part.oy = r.top + scrollY;
        part.w = r.width; part.h = r.height;
        part.svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
        /* HIS SUN, THROUGH THE SAME THREE NUMBERS AS EVERY OTHER SHADOW.
           sun.css sets --sun-lean -0.35 and --sun-y 0.30, both per unit of
           lift, both in cqw. A car sits on the road, so its lift is small: 1.2
           against the speedboat's 2.0 and the hero sign's 8.8. cqw is a share
           of the SECTION, which is what r.width is here, so the offset scales
           with the art like everything else. */
        part.sunX = -0.35 * 1.2 / 100 * r.width;
        part.sunY =  0.30 * 1.2 / 100 * r.width;
        road.laneW = part.path.w / 100 * r.width / 2;
        part.path.p.forEach(function (q) {
          var pt = [part.ox + q[0] / 100 * r.width, part.oy + q[1] / 100 * r.height];
          /* NEVER LET THE JOINED ROAD DOUBLE BACK.
             Each section's centreline is extracted on its own, and section one's
             runs 3.4% of its height PAST its own bottom edge while section two's
             starts only 1.7% below that boundary - so simply concatenating them
             put a 180-degree reversal in the middle of the road, right where the
             two meet. A car reaching it turned round and drove back into the
             oncoming lane, or vanished. Same rule as the extractor uses inside a
             tile: a point has to lie forward of where the road is already going,
             or it is an overlap and gets dropped. */
          if (pts.length > 1) {
            var a = pts[pts.length - 2], b = pts[pts.length - 1];
            var hx = b[0] - a[0], hy = b[1] - a[1], hm = Math.hypot(hx, hy) || 1;
            var nx = pt[0] - b[0], ny = pt[1] - b[1], nm = Math.hypot(nx, ny) || 1;
            if ((hx / hm) * (nx / nm) + (hy / hm) * (ny / nm) < 0.2) return;
          }
          pts.push(pt);
        });
      });
      /* RUN THE ROAD OFF THE PAGE AT BOTH ENDS.
         His dashes stop short of his tarmac - the last tile in section three
         reaches 100.05% of the section while its last dash is at 96.8% - so a
         car that wrapped at the end of the path vanished and reappeared in
         plain view, three per cent inside the frame. The centreline is a
         faithful record of what he drew and should stay that way, so the road
         is extended HERE instead, straight on along its own end tangents until
         it is well outside the section. The wrap still happens; it just happens
         where nobody can see it. */
      var EXT = 0.22 * road.parts[0].w;
      var away = function (a, b) {
        var dx = a[0] - b[0], dy = a[1] - b[1], m = Math.hypot(dx, dy) || 1;
        return [a[0] + dx / m * EXT, a[1] + dy / m * EXT];
      };
      if (pts.length > 1) {
        pts.unshift(away(pts[0], pts[1]));
        pts.push(away(pts[pts.length - 1], pts[pts.length - 2]));
      }

      /* cumulative length, so a car can be placed by distance travelled */
      var cum = [0], L = 0;
      for (var i = 1; i < pts.length; i++) {
        L += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
        cum.push(L);
      }
      road.pts = pts; road.cum = cum; road.len = L;
      road.scale = road.parts[0].w;                       /* speeds scale with it */

      /* HOW LONG A VEHICLE THIS ROAD CAN ACTUALLY HOLD.
         A rigid body on a curve bulges away from the arc by about L*L/(8R) at
         its middle, so on a tight enough bend a long trailer hangs off the
         tarmac however carefully it is pointed - which is what his semitrailer
         was doing. Measure the tightest radius he drew, work out the spare
         room in a lane, and let the road decide which vehicles belong on it. */
      var R = Infinity;
      for (var t = 1; t < pts.length - 1; t++) {
        var a = pts[t-1], b = pts[t], c2 = pts[t+1];
        var A = Math.hypot(b[0]-a[0], b[1]-a[1]),
            B = Math.hypot(c2[0]-b[0], c2[1]-b[1]),
            C = Math.hypot(c2[0]-a[0], c2[1]-a[1]);
        var area = Math.abs((b[0]-a[0])*(c2[1]-a[1]) - (c2[0]-a[0])*(b[1]-a[1])) / 2;
        if (area > 1e-6) R = Math.min(R, A*B*C / (4*area));
      }
      var spare = road.laneW * (1 - CAR_ACROSS) / 2;
      road.maxLong = R === Infinity ? Infinity : Math.sqrt(8 * R * spare);
      road.cars.forEach(function (c) { size(road, c); });
    });
  }

  function size(road, c) {
    var b = box[c.id];
    c.k = road.laneW * CAR_ACROSS / b.height;
    c.long = b.width * c.k;                               /* its length on the road */
  }

  /* point and heading at a distance along the road */
  function at(road, s) {
    var cum = road.cum, pts = road.pts, lo = 0, hi = cum.length - 1;
    if (s <= 0) s = 0; else if (s >= road.len) s = road.len - 0.001;
    while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
    var a = pts[lo], b = pts[lo + 1] || pts[lo];
    var seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    var dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
    return { x: a[0] + dx * t, y: a[1] + dy * t, ux: dx / m, uy: dy / m };
  }

  /* -- populate ------------------------------------------------------------- */
  layout();
  roads.forEach(function (road) {
    var n = Math.max(2, Math.min(12, Math.round(road.len * road.thin / (road.scale * SPACING))));
    /* the vehicles that fit this road's tightest bend - always at least the
       shortest one, so a hairpin still gets traffic */
    var fits = NAMES.filter(function (nm) {
      return box[nm].width * (road.laneW * CAR_ACROSS / box[nm].height) <= road.maxLong;
    });
    if (!fits.length) fits = [NAMES.slice().sort(function (a, b) {
      return box[a].width / box[a].height - box[b].width / box[b].height; })[0]];
    for (var lane = 0; lane < 2; lane++) {
      for (var i = 0; i < n; i++) {
        var id = fits[(Math.random() * fits.length) | 0];
        var c = { id: id, lane: lane, nodes: [],
                  u: road.len * (i + Math.random() * 0.7) / n,
                  v: 0, vmax: 0, want: 0 };
        size(road, c);
        c.vmax = road.scale * CRUISE * pace[id] * (1 - SPREAD / 2 + Math.random() * SPREAD);
        c.v = c.want = c.vmax;
        road.parts.forEach(function (part) {
          var u = use(id); part.carG.appendChild(u);
          var sh = null;
          if (SHADES && defs.querySelector('#' + CSS.escape(id + '_shade'))) {
            sh = use(id + '_shade'); part.shadeG.appendChild(sh);
          }
          c.nodes.push({ u: u, sh: sh, part: part });
        });
        road.cars.push(c);
      }
    }
  });

  /* -- the loop ------------------------------------------------------------- */
  var last = 0;
  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    roads.forEach(function (road) {
      if (!road.live) return;
      for (var lane = 0; lane < 2; lane++) {
        var q = road.cars.filter(function (c) { return c.lane === lane; })
                         .sort(function (a, b) { return a.u - b.u; });

        /* 1. decide, and move */
        for (var i = 0; i < q.length; i++) {
          var c = q[i], ahead = q[(i + 1) % q.length];
          var gap = ahead.u - c.u; if (gap <= 0) gap += road.len;
          gap -= (c.long + ahead.long) / 2;
          /* what this driver would like to be doing - but seen late */
          var raw = Math.max(0, Math.min(c.vmax, gap / HEADWAY));
          c.want += (raw - c.want) * Math.min(1, dt / REACT);
          var d = c.want - c.v, lim = (d > 0 ? ACCEL : DECEL) * road.scale * dt;
          c.v += Math.max(-lim, Math.min(lim, d));
          if (c.v < 0) c.v = 0;
          c.u += c.v * dt;
          if (c.u >= road.len) c.u -= road.len;
        }

        /* 2. NOBODY DRIVES THROUGH ANYBODY - as a SEPARATE PASS, on a FRESH
           SORT. Doing this inside the loop above read an order that step 1 had
           already invalidated: the moment one car wrapped from the end of the
           road back to the start, the cars still to be processed saw it as
           their leader at u near zero, decided they were hopelessly overlapping
           it, and were shoved the length of the road - which is a car
           vanishing from one place and appearing in another, in plain view.
           The gap is measured round the ring so it is never negative, and the
           queue is walked from its head BACKWARDS so a car is only ever pushed
           back behind a leader that has already settled. */
        if (q.length > 1) {
          q.sort(function (a, b) { return a.u - b.u; });
          for (var k = q.length - 1; k >= 0; k--) {
            var c2 = q[k], lead = q[(k + 1) % q.length];
            var ring = lead.u - c2.u; if (ring <= 0) ring += road.len;
            var least = (c2.long + lead.long) / 2 * 1.06;
            if (ring < least) {
              c2.u = lead.u - least;
              if (c2.u < 0) c2.u += road.len;
              c2.v = Math.min(c2.v, lead.v);
            }
          }
        }
      }
      /* draw */
      road.cars.forEach(function (c) {
        /* lane one runs the other way down the same centreline */
        var s = c.lane ? road.len - c.u : c.u;
        var dir = c.lane ? -1 : 1;
        /* POINT IT ALONG ITS OWN AXLES, NOT ALONG THE TANGENT AT ITS MIDDLE.
           A rigid sprite turned to the tangent at its centre throws both ends
           off the road, and the longer it is the worse it gets - his
           semitrailer was lying clean across both lanes on every bend. Sampling
           where the front and the back actually sit and pointing along THAT
           chord is what a long vehicle really does through a curve: it cuts in.
           The centre goes at the midpoint of the two, so neither end hangs off. */
        var half = c.long / 2 * dir;
        var pf = at(road, s + half), pb = at(road, s - half);
        var p = { x: (pf.x + pb.x) / 2, y: (pf.y + pb.y) / 2,
                  ux: at(road, s).ux, uy: at(road, s).uy };
        var cdx = pf.x - pb.x, cdy = pf.y - pb.y;
        var ang = Math.atan2(cdy, cdx) * 180 / Math.PI;
        /* sit in your own lane: perpendicular to the road, half a lane over */
        var off = road.laneW / 2 * dir;
        var x = p.x - p.uy * off, y = p.y + p.ux * off;
        var b = box[c.id], cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        c.nodes.forEach(function (n) {
          var t = 'rotate(' + ang.toFixed(1) + ') scale(' + c.k.toFixed(4) + ') ' +
                  'translate(' + (-cx).toFixed(1) + ' ' + (-cy).toFixed(1) + ')';
          n.u.setAttribute('transform',
            'translate(' + (x - n.part.ox).toFixed(1) + ' ' +
                           (y - n.part.oy).toFixed(1) + ') ' + t);
          /* THE SUN DOES NOT TURN WITH THE CAR. His shadow art is registered to
             the car exactly - measured, 0.00 units out on all twenty - so the
             shadow takes the car's own rotation and scale, and the sun's
             displacement is added OUTSIDE them, in screen space. Every shadow
             on the road then points the same way whichever way its car is
             pointing, which is the whole difference between a sun and a smudge.
             (The boat's shadow spins with the hull; that is a boat's own wake
             sitting under it, not the same thing.) */
          if (n.sh) n.sh.setAttribute('transform',
            'translate(' + (x - n.part.ox + n.part.sunX).toFixed(1) + ' ' +
                           (y - n.part.oy + n.part.sunY).toFixed(1) + ') ' + t);
        });
      });
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* -- park a road nobody is looking at ------------------------------------- */
  if (window.IntersectionObserver) {
    roads.forEach(function (road) {
      var seen = new Set();
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); });
        road.live = seen.size > 0;
        if (road.live) last = 0;                 /* do not integrate the gap away */
      }, { rootMargin: '15%' });
      road.parts.forEach(function (p) { io.observe(p.el); });
    });
  }

  addEventListener('resize', layout);
  addEventListener('load', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.documentElement);
})();

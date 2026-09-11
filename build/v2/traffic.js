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

  /* A PHONE HAS ITS OWN ROADS, AND THEY ARE NOT THESE.
   *
   * The sections stop being drawings below the breakpoint and become columns,
   * so the top-down roads underneath are gone - and with them the centrelines
   * in paths.js, which are percentages of a section that no longer has that
   * shape. What his phone drawing has instead is a BAND of tarmac used as a
   * rule between one panel of copy and the next, three times, and the curve
   * that runs down the right of his green. Traffic belongs on all four: they
   * are roads, drawn from directly overhead, exactly like the ones above the
   * breakpoint.
   *
   * The engine below never cared which element it was given. It measures a box
   * and reads a centreline in percentages OF THAT BOX, so a road is a box plus
   * a line - which is all these are. Nothing under here changes for them.
   *
   * The same query mobile.css and drive.js ask, in the same words: a narrow
   * viewport AND a coarse pointer. A mouse is never a phone.
   */
  var MOBILE = matchMedia('(max-width:900px) and (pointer:coarse)').matches;

  /* HIS BAND, measured off the art itself. viewBox -1.76 1582.76 1087.21
     186.75: the tarmac runs y 1583.76 to 1768.51 and his broken centre line
     sits at 1671.63 with a height of 6.87, so its middle is 1675.07 - which is
     49.427% down the box. The road is 184.75 units across, and `w` is a share
     of the box's WIDTH, so that is 184.75/186.75 x 186.75/1087.21. */
  var MOB_BAND = { w: 16.993, p: [[0, 49.427], [100, 49.427]] };

  /* AND HIS CURVE. viewBox 864.47 7629.93 512.52 1997.5. The straight leg's
     tarmac runs x 865.47 to 1058.85, so its middle is 962.16 - 19.06% across -
     and the bend is a true quarter circle about (1375.99, 8142.33) with the
     outer edge at 510.4 and the inner at 317.0, so the centreline's radius is
     414.0. In the box's own percentages that centre is (99.805, 25.653) and
     the radius is 80.773 of the width by 20.725 of the height - the same
     circle, written in a box that is not square. Sampled every four and a half
     degrees; the engine resamples it to a smooth curve anyway. */
  var MOB_VERT = (function () {
    var cx = 99.805, cy = 25.653, Rw = 80.773, Rh = 20.725, p = [];
    for (var a = 90; a <= 180.01; a += 4.5) {
      var t = a * Math.PI / 180;
      p.push([+(cx + Rw * Math.cos(t)).toFixed(3),
              +(cy - Rh * Math.sin(t)).toFixed(3)]);
    }
    /* then straight down and off the bottom of the box, which is where the
       rock band at the top of section six takes over and swallows it */
    p.push([19.06, 60], [19.06, 100]);
    return { w: 37.73, p: p };
  })();

  /* His roads. One and two are a single run in his art, so they are one road
     here. `thin` is a density multiplier - the desert straight is meant to be
     the quiet one. */
  var ROADS = [{ secs: ['01', '02'], thin: 0.7, dens: 0.55, quick: 1.4 },
               /* HIS DESERT STRAIGHT IS THE EMPTY ONE. `thin` alone could not
                  hold it there: it is the longest road on the page, so a share
                  of a long road is still a lot of cars. A ceiling of its own
                  is the only thing that says "quiet" and keeps saying it
                  whatever the road's length works out to. */
               { secs: ['03'],       thin: 0.85, cap: 16, dens: 0.60, quick: 1.9 },
               /* HIS FOREST RUN IS THE OPEN ONE. Thirty per cent fewer cars
                  and a fifth more speed - a road that is moving, against the
                  desert's quiet and the coast's queue. `quick` is a multiplier
                  on every car's top speed, so the spread of speeds that makes
                  the queueing survives it: they all go faster, they do not all
                  go the SAME faster. */
               { secs: ['04'],       thin: 0.7, dens: 0.50, quick: 1.7 }];

  /* ON A PHONE, EVERY DRAWN ROAD IS ITS OWN ROAD. There is no art joining one
     band to the next - they are separate rules on a page - so each is its own
     loop with its own traffic, found in the markup rather than listed here, so
     a band he adds later gets cars without anyone remembering to.

     Thinner and a little quicker than the desktop's: a band is 390 across
     where his coast road is 1990, so the same count would be nose to tail, and
     a car that takes twenty seconds to cross a phone reads as parked. `cap` is
     a road's WHOLE traffic - the loop below runs n twice, once per lane.

     AND THE CURVE'S `quick` IS TWICE THE BANDS'. Speed is a share of the
     road's own scale, which is its element's width - and the curve's element
     is 185 across where a band is the whole 390, so the same multiplier put
     its cars at half the pace on a road twice as long. 3.6 lands them within
     a few pixels a second of each other, which is what reads as one road
     network rather than four unrelated ones. */
  if (MOBILE) {
    ROADS = [];
    [].forEach.call(document.querySelectorAll('.mob-road'), function (el) {
      ROADS.push({ els: [el], path: MOB_BAND, thin: 1, cap: 10, dens: 1, quick: 1.9 });
    });
    [].forEach.call(document.querySelectorAll('.mob-roadv'), function (el) {
      ROADS.push({ els: [el], path: MOB_VERT, thin: 1, cap: 12, dens: 1, quick: 3.6 });
    });
  }
  /* `dens` IS HIS, off the panel, and it is a separate number from `thin` on
     purpose. `thin` is what his art asks for - a desert that reads empty next
     to a coast that reads busy - and it belongs to the drawing. `dens` is the
     hour he spent with the sliders deciding how full the whole page should
     feel. Kept apart, the tuner still opens at 100% (this IS 100% now) and the
     art's own relative weighting survives anything he does to the page. */
  /* HOW MUCH TRAFFIC, AND WHY IT IS NOT 0.70. Thirty per cent fewer cars took
     the queueing with them: measured over 900 frames, a car's own speed swung
     63% of its cruise at full density and 24% at 0.70 - a road that never has
     to brake. Tuning could not bring it back. Even at an eight-second desired
     gap and a three-to-one spread of top speeds, 40 cars only reached 47%: a
     jam is a density effect, and there is a number of cars below which one
     cannot form however the drivers behave. 0.85 with the coupling below is
     60% - his stop-start, at fifty cars instead of fifty-eight. */
  var DENSITY   = 1.36,
      SPACING   = 0.083,  /* road length per car, as a share of section width -
                             the count follows from how long his road is, so a
                             short road does not end up nose to tail */
      CRUISE    = 0.060,  /* share of a section's width per second */
      /* AND THE COUPLING RAISED WITH IT. Fewer cars means more road each, so a
         driver has to want a bigger gap and the slow ones have to be slower
         before anyone catches anyone: 1.70 seconds to 4, a 0.55 spread to
         0.80, and his lorries from 0.45 slower than a car to 0.62. */
      SPREAD    = 0.80,   /* how much top speeds differ - this is what jams */
      LORRY     = 0.62,   /* how much slower the longest vehicle is than the
                             shortest. His semitrailer and his bus hold people
                             up, which is where most of the queueing comes
                             from - it is the same reason real traffic jams. */
      ACCEL     = 0.055, DECEL = 0.14,  /* same units, per second squared */
      HEADWAY   = 1.30,   /* seconds of gap a driver wants. His. Four seconds
                             was chosen against a road half again as full: with
                             the counts above the median gap roughly doubled,
                             and a four-second rule turned that into a road
                             where nobody reached a third of their own limit. */
      /* AND A CAR STOPS BEHIND A CAR, NOT ON IT. The gap below is measured
         bumper to bumper, so a rule of `gap / headway` asks a driver to come to
         rest with nothing left between them - which is exactly what he saw when
         the queues settled. A driver aims at this much clear road instead, as a
         share of the following car's OWN length, so his semitrailer leaves more
         room than a mini without a second number. */
      STANDOFF  = 0.34,
      REACT     = 1.45,   /* SECONDS OF REACTION DELAY, and the whole reason the
                             traffic queues rather than settling into a convoy.
                             A driver who responds instantly to the gap ahead
                             finds a stable equilibrium and stays there; a
                             driver who responds LATE overshoots, brakes harder
                             than needed, and the car behind does the same but
                             worse. That is what a stop-and-go wave is, in real
                             traffic and here - nothing about it is scripted. */
      CAR_ACROSS= 0.80;   /* how much of a lane THE WIDEST vehicle fills. Every
                             other vehicle is drawn at the same scale, so this
                             one number sets the size of the whole fleet and
                             his own proportions hold between them. */

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
  /* -- HIS HEADLIGHTS AND TAIL LAMPS -------------------------------------- */
  /* Drawn in code, never baked into a car. One set per VEHICLE TYPE, referenced
     by <use> like the cars themselves, so 106 vehicles cost ten definitions.
     Every number is a proportion of that vehicle's own measured box, which is
     why a semitrailer throws a longer beam than a hatchback with no special
     case and a new vehicle needs no new numbers.
     His art faces +x, so a beam points along +x in the car's own coordinates
     and the car's transform turns it through the bends for free - nothing here
     computes an angle. */
  var LAMP = {
    inset: 0.02,      /* back from the nose, so the cone leaves the bodywork */
    headSep: 0.55, tailSep: 0.60,      /* lamp separation, across the vehicle */
    headLen: 0.70, tailLen: 0.12,      /* beam length, along the vehicle */
    headBase: 0.06, headTip: 0.20,     /* half widths: narrow at the car, wide out */
    tailBase: 0.09, tailTip: 0.15
  };
  function beamDefs() {
    var d = ['<linearGradient id="h19-beam" x1="0" y1="0" x2="1" y2="0">' +
             '<stop offset="0" stop-color="#fff6d2" stop-opacity=".95"/>' +
             '<stop offset=".42" stop-color="#ffeaa6" stop-opacity=".45"/>' +
             '<stop offset="1" stop-color="#ffe294" stop-opacity="0"/></linearGradient>' +
             '<linearGradient id="h19-tail" x1="1" y1="0" x2="0" y2="0">' +
             '<stop offset="0" stop-color="#ff4436" stop-opacity=".95"/>' +
             '<stop offset="1" stop-color="#ff2a1c" stop-opacity="0"/></linearGradient>'];
    NAMES.forEach(function (n) {
      var b = box[n], L = b.width, A = b.height, mid = b.y + A / 2;
      var ins = LAMP.inset * L;
      var pts = [];
      /* headlights: forward from the nose */
      var hx = b.x + L - ins, hl = LAMP.headLen * L;
      [-1, 1].forEach(function (side) {
        var y = mid + side * LAMP.headSep / 2 * A;
        pts.push('<polygon fill="url(#h19-beam)" points="' +
          [hx, y - LAMP.headBase * A, hx, y + LAMP.headBase * A,
           hx + hl, y + LAMP.headTip * A, hx + hl, y - LAMP.headTip * A]
          .map(function (v) { return v.toFixed(2) }).join(' ') + '"/>');
      });
      /* tail lamps: a short glow backwards, wider than it is long */
      var tx = b.x + ins, tl = LAMP.tailLen * L;
      [-1, 1].forEach(function (side) {
        var y = mid + side * LAMP.tailSep / 2 * A;
        pts.push('<polygon fill="url(#h19-tail)" points="' +
          [tx, y - LAMP.tailBase * A, tx, y + LAMP.tailBase * A,
           tx - tl, y + LAMP.tailTip * A, tx - tl, y - LAMP.tailTip * A]
          .map(function (v) { return v.toFixed(2) }).join(' ') + '"/>');
      });
      d.push('<g id="' + n + '_beams">' + pts.join('') + '</g>');
    });
    return d.join('');
  }

  /* long vehicle, slow vehicle */
  var lens = NAMES.map(function (n) { return box[n].width / box[n].height; });
  var lo = Math.min.apply(null, lens), hi = Math.max.apply(null, lens);
  var pace = {};
  NAMES.forEach(function (n, i) {
    pace[n] = 1 - LORRY * (hi > lo ? (lens[i] - lo) / (hi - lo) : 0);
  });

  defs.insertAdjacentHTML('beforeend', '<svg>' + beamDefs() + '</svg>');

  /* THE MUTE IS GONE FROM HERE. It used to be a second sprite per vehicle -
     his shadow silhouette in a near-black, laid exactly over the car - and it
     is now one filter on the group instead; see traffic.css. Measured, that is
     three and a half milliseconds a frame back on his coast road at night.

     A BITMAP DID NOT HELP, and it is worth writing down so nobody tries it
     again: both night layers were baked through a canvas into PNGs at exactly
     the size they are painted, and the frame did not move - 48.7ms against
     48.9. Neither did an <image> of the same art as SVG. The cost was never
     rasterising the drawing; it was the blend mode over the top of it. */

  /* -- the roads ------------------------------------------------------------ */
  var roads = ROADS.map(function (cfg) {
    var parts = (cfg.els || cfg.secs).map(function (src) {
      /* a desktop road names a section and looks its centreline up in
         paths.js; a phone road hands over the element and the line itself */
      var el = cfg.els ? src : document.querySelector('.sec' + (+src));
      var n = cfg.els ? 'm' : src;
      var path = cfg.path || P[src];
      if (!el || !path) return null;
      var svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'traffic z-road');
      svg.setAttribute('aria-hidden', 'true');
      el.appendChild(svg);
      /* TWO LAYERS, NOT ONE ORDER OF CHILDREN. Cars are appended a vehicle at a
         time, so a single list would read shadow, car, shadow, car - and the
         first car would paint UNDER the second car's shadow the moment the two
         came close on a bend. A group for all the shadows and a group for all
         the cars settles it once. */
      /* NO STREET-LAMP POOLS ON HIS TOP-DOWN ROADS. They were pools of warm
         light every seven lane widths, and from directly overhead - which is
         where these sections look from - a pool has no lamp above it and no
         cone falling into it. It read as blooms lying on the tarmac. The
         first-person drive keeps its own, because down there the mast and the
         cone are in the picture with it. */
      var shadeG = document.createElementNS(SVGNS, 'g');
      shadeG.setAttribute('class', 'shades');
      /* THE BEAMS ARE ONE GROUP, ABOVE THE ROAD AND UNDER EVERY CAR. Under the
         cars is what stops a queueing car's beams washing over the car in front
         of it; one group is what lets the whole fleet's lighting be turned down
         from a single place, and what stops each beam blending with its
         neighbour's. Screen is set as inline CSS on purpose - a browser ignores
         mix-blend-mode written as an XML attribute. */
      var beamG = document.createElementNS(SVGNS, 'g');
      beamG.setAttribute('class', 'beams');
      /* NO BLEND MODE, AND THIS WAS THE FLICKER. `screen` on this group, with
         the `isolate` that a blend mode needs to stay off the rest of the
         page, is the single most expensive thing in the night scene: measured
         over a scripted scroll through his coast road, 48ms a frame with it
         and 26 without - as much as deleting the beams altogether, and against
         17 for the same page carrying no traffic at all. A blend mode makes
         the browser hold the group in a buffer of its own and composite it
         over the backdrop every frame, and a backdrop that is scrolling is a
         backdrop that is new every frame.

         AND IT LOOKS THE SAME. Screen over black IS the source - a + b - ab
         with b at nought is a - and his tarmac after dark is very nearly
         black, which is the only place these beams are ever seen. Compared
         side by side at 700 by 500 there is nothing in it. The blend was
         buying a difference that only exists over a light ground, and there
         is no light ground here. */
      var carG = document.createElementNS(SVGNS, 'g');
      carG.setAttribute('class', 'cars');
      /* THERE IS NO MUTE LAYER ANY MORE. It was a fourth group above the cars
         carrying his shadow silhouette again, in a night colour, sitting
         exactly ON each vehicle - the paint taken down without a filter,
         because a filter PER CAR on the group that moves every frame is the
         one thing to avoid. That reasoning was right and the conclusion was
         wrong: the filter goes on the GROUP, once, and thirty-five moving
         sprites go away. See traffic.css. */
      svg.appendChild(shadeG); svg.appendChild(beamG); svg.appendChild(carG);
      return { n: n, el: el, svg: svg, shadeG: shadeG,
               beamG: beamG, carG: carG, path: path };
    }).filter(Boolean);
    if (!parts.length) return null;
    return { parts: parts, thin: cfg.thin, cap: cfg.cap, dens: cfg.dens || 1,
             quick: cfg.quick || 1,
             cars: [], parked: [], n0: 0, share: 1,
             live: true, pts: [], len: 0, laneW: 0 };
  }).filter(Boolean);
  if (!roads.length) return;

  /* -- HIS SHOULDER LINES ------------------------------------------------------
   * A solid gold line down each side, outboard of the white ones he already
   * drew, with a strip of his tarmac showing between them - which is what a
   * road actually looks like and what the drive already does.
   *
   * DRAWN FROM THE CENTRELINE, NOT ADDED TO HIS ART. The alternative was to
   * find every edge marking in the tiles and put a copy beside it, and that
   * falls apart on the bends: an edge there is a filled arc ribbon, and moving
   * one "outward" means knowing the centre it was struck from. The line the
   * cars drive on already knows where the road is at every point, so the
   * shoulders are the same line pushed sideways - which also means they follow
   * his tarmac exactly, through every tile and every curve, and cost nothing
   * per frame because they are two paths written once.
   *
   * HOW MUCH GREY THERE IS BETWEEN THEM IS DECIDED BY HIS ART, not by me. The
   * road is 95.06 units across; his white lines sit 40.2 out from the middle
   * and are 3.3 wide, so there are 5.65 units of tarmac outboard of them and
   * that is the whole budget. A gold line as thick as his would eat 3.3 of it
   * and leave a hairline; at 2.4, flush to the edge, it leaves 3.25 - which is
   * a strip of road you can see rather than a gap you have to be told about.
   *
   * THE ENDS ARE TRIMMED BACK BY THE EXTENSION. The centreline is deliberately
   * run off the page at both ends so cars wrap out of sight; paint it and the
   * gold runs off into his grass.
   */
  var EDGE_OUT = 0.9748, EDGE_W = 2.4 / 95.06;
  function shoulderPath(road, off, ox, oy) {
    var p = road.pts, c = road.cum, hi = road.len - road.ext, d = '';
    for (var i = 0; i < p.length; i++) {
      if (c[i] < road.ext || c[i] > hi) continue;
      var a = p[i > 0 ? i - 1 : 0], b = p[i < p.length - 1 ? i + 1 : i];
      var dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1;
      d += (d ? 'L' : 'M') + (p[i][0] - dy / m * off - ox).toFixed(1) + ' ' +
                             (p[i][1] + dx / m * off - oy).toFixed(1);
    }
    return d;
  }
  function shoulders(road) {
    var off = road.laneW * EDGE_OUT, w = road.laneW * 2 * EDGE_W;
    road.parts.forEach(function (part) {
      if (!part.edges) {
        var g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', 'shoulders');
        part.svg.insertBefore(g, part.svg.firstChild);
        part.edges = [0, 1].map(function () {
          var e = document.createElementNS(SVGNS, 'path');
          e.setAttribute('fill', 'none');
          e.setAttribute('stroke', 'var(--edge)');
          g.appendChild(e);
          return e;
        });
      }
      part.edges.forEach(function (e, i) {
        e.setAttribute('stroke-width', w.toFixed(2));
        e.setAttribute('d', shoulderPath(road, i ? off : -off, part.ox, part.oy));
      });
    });
  }

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

      /* SMOOTH THE CENTRELINE BEFORE ANYTHING DRIVES ON IT.
         What comes out of his art is a POLYLINE - 90 points over 3,500px, so a
         segment every 36px with up to 13 degrees of turn between one and the
         next. A car reading its heading off the segment it happens to be on
         therefore snaps 13 degrees at a stroke, and because it sits half a lane
         OFF the centreline - along the normal, which snaps with it - that
         heading change throws it four pixels sideways in one frame. Every time.
         That is the stutter on the inside of his bends: not the speed, not the
         frame rate, a car being teleported across its own lane at every vertex.

         So the polyline is resampled to a curve through his own points at
         roughly seven pixels a step, and the tangent is continuous because the
         curve is. CENTRIPETAL Catmull-Rom, not uniform: his points are anything
         from 5px to 300px apart, and the uniform version loops out into the
         verge wherever the spacing changes that hard. */
      var lerp = function (a, b, t) {
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      };
      var knot = function (a, b) { return Math.pow(Math.hypot(b[0]-a[0], b[1]-a[1]), 0.5) || 1e-4; };
      function curve(src, step) {
        if (src.length < 3) return src;
        var out = [], N = src.length;
        for (var i = 0; i < N - 1; i++) {
          var p0 = src[i > 0 ? i - 1 : 0], p1 = src[i], p2 = src[i + 1],
              p3 = src[i < N - 2 ? i + 2 : N - 1];
          var t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
          var m = Math.max(1, Math.round(Math.hypot(p2[0]-p1[0], p2[1]-p1[1]) / step));
          for (var j = 0; j < m; j++) {
            var tt = t1 + (t2 - t1) * (j / m);
            var A1 = lerp(p0, p1, (tt - t0) / (t1 - t0)),
                A2 = lerp(p1, p2, (tt - t1) / (t2 - t1)),
                A3 = lerp(p2, p3, (tt - t2) / (t3 - t2));
            var B1 = lerp(A1, A2, (tt - t0) / (t2 - t0)),
                B2 = lerp(A2, A3, (tt - t1) / (t3 - t1));
            out.push(lerp(B1, B2, (tt - t1) / (t2 - t1)));
          }
        }
        out.push(src[N - 1]);
        return out;
      }
      pts = curve(pts, road.parts[0].w * 0.005);

      /* cumulative length, so a car can be placed by distance travelled */
      var cum = [0], L = 0;
      for (var i = 1; i < pts.length; i++) {
        L += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
        cum.push(L);
      }
      road.pts = pts; road.cum = cum; road.len = L;
      road.scale = road.parts[0].w;                       /* speeds scale with it */
      road.ext = EXT;
      shoulders(road);

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
      road.R = R;
      road.k = road.laneW * CAR_ACROSS / maxAcross;
      /* SPARE ROOM IS PER VEHICLE now that they are not all the same width. A
         narrow car has most of its lane free and can be longer through a bend
         than a wide one; using the widest vehicle's spare room for all of them
         barred cars that would have gone round perfectly well. */
      road.maxLong = function (nm) {
        if (road.R === Infinity) return Infinity;
        var spare = road.laneW / 2 - box[nm].height * road.k / 2;
        return spare <= 0 ? 0 : Math.sqrt(8 * road.R * spare);
      };
      road.cars.forEach(function (c) { size(road, c); });

    });
  }

  /* ONE SCALE FOR THE WHOLE FLEET, NOT ONE PER VEHICLE.
     Scaling each vehicle to the same width across the road is what threw his
     size relations away: every car came out exactly as wide as every lorry, and
     only their own aspect made one longer than the other, so his semitrailer
     read as barely twice a saloon where he drew it more than three times. His
     instruction was to measure the biggest and bring the rest down from it, so
     the road's scale is set by the WIDEST vehicle in the fleet filling its lane
     and every other vehicle takes that same number. A saloon is then narrower
     than a lane, which is what a saloon is. */
  var maxAcross = Math.max.apply(null, NAMES.map(function (n) { return box[n].height }));

  /* HOW MUCH ROAD A LANE ACTUALLY HAS, HERE.
   *
   * The simulation measures everything along the CENTRELINE, but the cars
   * drive half a lane either side of it, and on a bend the inside lane is
   * shorter than the middle - a metre of centreline is less than a metre of
   * inside lane. Two cars a car's length apart in centreline u were therefore
   * closer than that on the inside of every curve, and once the fleet was
   * given his real sizes they drove into each other there. It never happened
   * on a straight, and never on the outside, which is exactly what he saw.
   *
   * Rather than reason about signs and curvature, this measures it: step a
   * little way along the centreline, offset both ends into the lane, and see
   * how far the lane actually went. Under 1 on the inside of a bend, over 1
   * on the outside, exactly 1 on a straight.
   */
  function laneScale(road, s, dir) {
    var d = 3, off = road.laneW / 2 * dir;
    var a = at(road, s), b = at(road, s + d);
    var ax = a.x - a.uy * off, ay = a.y + a.ux * off;
    var bx = b.x - b.uy * off, by = b.y + b.ux * off;
    var m = Math.hypot(bx - ax, by - ay) / d;
    return m < 0.35 ? 0.35 : m;            /* never divide by nearly nothing */
  }

  function size(road, c) {
    c.k = road.k;
    c.long = box[c.id].width * c.k;                       /* its length on the road */
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
    /* DENSITY LAST, AFTER THE CAP. Two of his three roads sit on the 30-car
       ceiling, so widening SPACING would not have thinned them at all - the
       count would have come down to the cap and stopped. Taking the share off
       the number that actually gets used is the only place a 30% cut is a 30%
       cut.

       AND `cap` IS A ROAD'S WHOLE TRAFFIC, not its n. n is cars PER LANE and
       the loop below runs it twice, which is how a ceiling of 10 first came
       out as twenty cars on his desert. */
    var n = Math.max(2, Math.min(road.cap ? road.cap / 2 : 30, Math.round(DENSITY *
      Math.min(30, Math.round(road.len * road.thin / (road.scale * SPACING))))));
    /* HIS SHARE LAST, AFTER THE CAP, for the same reason DENSITY is: two of
       the three roads sit on a ceiling, and a share taken before one is not a
       share at all. This is the identical arithmetic the tuner's Cars slider
       does to n0 through the census - so the road opens at the count he set
       and the panel opens at 100%. */
    n = Math.max(1, Math.round(n * (road.dens || 1)));
    /* the vehicles that fit this road's tightest bend - always at least the
       shortest one, so a hairpin still gets traffic */
    var fits = NAMES.filter(function (nm) {
      return box[nm].width * road.k <= road.maxLong(nm);
    });
    if (!fits.length) fits = [NAMES.slice().sort(function (a, b) {
      return box[a].width / box[a].height - box[b].width / box[b].height; })[0]];
    /* A BENCH, NOT JUST A ROAD. Forty per cent more cars are built than the
       road shows, parked out of sight from the first frame - so the tuner can
       ask for MORE traffic than the design count as well as less, and night
       and day are both a share of the same fixed pool. A parked car is out of
       road.cars, so it costs one hidden <use> and not a single transform. */
    var nPool = Math.round(n * 1.4);
    for (var lane = 0; lane < 2; lane++) {
      for (var i = 0; i < nPool; i++) {
        var id = fits[(Math.random() * fits.length) | 0];
        var c = { id: id, lane: lane, nodes: [],
                  u: road.len * (i + Math.random() * 0.7) / nPool,
                  v: 0, vmax: 0, want: 0 };
        size(road, c);
        /* the car's OWN top speed, before the road's pace multiplier - kept
           apart so `quick` can be turned live without re-drawing the spread */
        c.vbase = road.scale * CRUISE * pace[id] *
                  (1 - SPREAD / 2 + Math.random() * SPREAD);
        c.v = c.want = c.vbase * road.quick;
        road.parts.forEach(function (part) {
          var u = use(id); part.carG.appendChild(u);
          var sh = null;
          if (SHADES && defs.querySelector('#' + CSS.escape(id + '_shade'))) {
            sh = use(id + '_shade'); part.shadeG.appendChild(sh);
          }
          var bm = use(id + '_beams'); part.beamG.appendChild(bm);
          c.nodes.push({ u: u, sh: sh, bm: bm, part: part });
        });
        road.cars.push(c);
      }
    }
    road.n0 = n * 2;                 /* the daylight complement he designed */
  });

  /* the simulation, for tools/check_traffic.js to read. Tuning a jam by
     watching pixels is guesswork; the gap a driver HAS against the gap a driver
     WANTS is the number that decides whether a road queues at all. */
  window.H19_TRAFFIC = roads;
  /* the bench goes to the bench before anything is drawn, so the road opens at
     the count he designed rather than filling up and thinning out in view -
     through the same census the hour uses, so it comes off both lanes */
  roads.forEach(function (road) { road.seen = false; census(road, 1); });

  /* -- NIGHT THINS THE ROAD BY ATTRITION -------------------------------------
   * Sixty per cent of the traffic goes home after dark, and none of it
   * vanishes. A car is only ever taken off at the moment it WRAPS - the end of
   * its lap, off the end of his art, where it was going to reappear at the
   * start anyway - so what the reader sees is cars leaving and not being
   * replaced. That is the same thing "stop spawning" means on a road that is a
   * loop rather than a queue of arrivals.
   *
   * Coming back is the same rule read the other way. One car per road per
   * frame at most, and only into the biggest gap in its lane and only if that
   * gap is more than three times its own length - so it appears on empty road
   * rather than materialising in front of somebody, and the road fills the way
   * it emptied. It also takes the speed of the car it is following in, which
   * is what stops a returning car standing still while the traffic goes past.
   *
   * WHAT NIGHT IS is read off --night, the same variable the palette and the
   * headlamps use, so a system setting, an explicit theme, the storyline and
   * his button all say the same thing here. Polled twice a second, not per
   * frame: getComputedStyle is the one expensive call in this file.
   */
  /* the two numbers the tuner can move that are not a road's own */
  var TUNE = window.H19_TUNE = { nightKeep: 0.6, headway: HEADWAY,
                                 stareAt: 15, stareTo: 0.5, tuning: false };
  /* WHAT THE ROAD IS ACTUALLY DOING, as a share of what its drivers WANT to be
     doing. This is the number that makes the panel honest: at his density the
     median gap is 64px and a four-second headway lets a car have 16px/s of it
     against a 93px/s top speed, so every car on the road is held at a sixth of
     its own limit and the speed slider multiplies a number nobody reaches. */
  var paceBase = 0;
  window.H19_FLOW = function (now) {
    var v = 0, top = 0, n = 0, stopped = 0, pace = 0;
    roads.forEach(function (road) {
      road.cars.forEach(function (c) {
        v += c.v; top += c.vbase * road.quick; n++;
        pace += c.v / road.scale;
        if (c.v < c.vbase * road.quick * 0.15) stopped++;
      });
    });
    pace = n ? pace / n : 0;
    /* THE BASELINE IS THE SHIPPED ROAD, taken once it has settled and never
       again. Two numbers are needed and neither says it alone: the share of
       what drivers WANT tells you whether the road is free or queueing, and it
       FALLS when you raise the top speed because the gap has not changed. What
       it does not tell you is whether the traffic actually got faster. This
       does. */
    return { cars: n, flow: n ? v / top : 1, stopped: stopped,
             pace: paceBase ? pace / paceBase : 1, raw: pace };
  };
  var NIGHT = 0, nightRead = -1e9;
  function nightShare(now, roads) {
    if (now - nightRead > 500) {
      nightRead = now;
      NIGHT = (parseFloat(getComputedStyle(document.documentElement)
                 .getPropertyValue('--night')) || 0) > 0.5 ? 1 : 0;
      /* AND WHETHER ANYONE IS LOOKING. A road nobody can see does not have to
         be polite about it: it can take cars off and put them back where they
         belong immediately, because "natural" only means anything inside the
         frame. On screen it is one car at a time, at the end of a lap, into a
         gap. Off screen it is done by the time he scrolls to it - which is
         what makes toggling the hour feel instant everywhere except the piece
         of road he happens to be watching, where it is a road emptying. */
      /* THE BASELINE IS TAKEN ON THE CLOCK, not the first time the panel asks.
         Read it lazily and it lands on whatever the road was doing the moment
         he first opened the tuner - which, if he had already moved a slider,
         is the very thing it is supposed to be measured against. Eight seconds
         in, once, and never again. */
      if (!paceBase && now > 8000) paceBase = window.H19_FLOW().raw || 1e-6;
      for (var i = 0; i < roads.length; i++) {
        var el = roads[i].parts[0] && roads[i].parts[0].el, r;
        roads[i].seen = roads[i].live &&
          (!el || ((r = el.getBoundingClientRect()),
                   r.bottom > -200 && r.top < innerHeight + 200));
      }
    }
    return NIGHT ? TUNE.nightKeep : 1;
  }
  function vis(c, on) {
    if (!on && c.held) { c.held = false; flag(c); }   /* it left; it is not holding anyone up */
    c.nodes.forEach(function (n) {
      var d = on ? '' : 'none';
      n.u.style.display = d;
      if (n.sh) n.sh.style.display = d;
      if (n.bm) n.bm.style.display = d;
    });
  }
  /* into the biggest gap its lane has, or not at all this frame */
  function admit(road, c) {
    var lane = road.cars.filter(function (x) { return x.lane === c.lane; })
                        .sort(function (a, b) { return a.u - b.u; });
    if (!lane.length) { c.u = 0; c.v = c.want = c.vbase * road.quick; return true; }
    var best = 0, bestGap = -1;
    for (var i = 0; i < lane.length; i++) {
      var g = lane[(i + 1) % lane.length].u - lane[i].u;
      if (g <= 0) g += road.len;
      if (g > bestGap) { bestGap = g; best = i; }
    }
    if (road.seen && !road.force && bestGap < c.long * 3.2) return false;
    var u = lane[best].u + bestGap / 2;
    c.u = u >= road.len ? u - road.len : u;
    c.v = c.want = Math.min(c.vbase * road.quick, lane[best].v);
    return true;
  }
  /* LANE BY LANE, NOT ROAD BY ROAD, and that is not a detail. The pool is
     built as every car of lane nought and then every car of lane one, so a
     census that simply took cars off the end of the list emptied the oncoming
     lane first and left both carriageways' worth of traffic going one way.
     Each lane gets half the road's target and is filled and emptied against
     its own count. */
  function laneCount(road, lane) {
    var k = 0;
    for (var i = 0; i < road.cars.length; i++) if (road.cars[i].lane === lane) k++;
    return k;
  }
  function census(road, share) {
    var total = Math.max(2, Math.min(road.cars.length + road.parked.length,
                         Math.round(road.n0 * share * road.share)));
    for (var lane = 0; lane < 2; lane++) {
      var want = lane ? Math.floor(total / 2) : Math.ceil(total / 2);
      var have = laneCount(road, lane);
      if (have > want) {
        for (var i = road.cars.length - 1; i >= 0 && have > want; i--) {
          var c = road.cars[i];
          /* `force` is the tuner saying "now, not next lap". Attrition is the
             right behaviour for nightfall, which is a mood; it is the wrong
             behaviour for a slider, which is a question. */
          if (c.lane !== lane || !(c.wrapped || !road.seen || road.force)) continue;
          vis(c, false); road.parked.push(road.cars.splice(i, 1)[0]); have--;
        }
      } else while (have < want) {
        var k = -1;
        for (var j = road.parked.length - 1; j >= 0; j--) {
          if (road.parked[j].lane === lane) { k = j; break; }
        }
        if (k < 0) break;
        var b = road.parked[k];
        if (!admit(road, b)) break;
        road.parked.splice(k, 1); vis(b, true); road.cars.push(b); have++;
        if (road.seen && !road.force) break;   /* one at a time, in plain view */
      }
    }
    for (var m = 0; m < road.cars.length; m++) road.cars[m].wrapped = false;
    road.force = false;
  }

  /* -- TAP A CAR AND IT STOPS ------------------------------------------------
   * Tap it again and it drives on. Everything behind it queues up on its own -
   * there is no code for the queue, because the following model already knows
   * what to do about a car that is not moving - and when it goes the queue
   * unwinds at the same acceleration every other car uses. The whole feature is
   * one flag on one car.
   *
   * A TAP, NOT A PRESS, and that is not a style choice. Press-and-hold on a
   * touch screen is the operating system's gesture: it opens the context menu
   * over the top of whatever you were holding. So the interaction is a tap -
   * down and up in the same place, inside half a second - which is a gesture
   * nothing else wants. Anything longer, or that moves, is a scroll or a
   * long-press and is left alone.
   *
   * Nothing is prevented and nothing is captured: the listeners are passive, so
   * a swipe that starts on a car is still a swipe.
   */
  var TAP_MS = 500, TAP_PX = 10;
  var tapAt = 0, tapX = 0, tapY = 0, tapOk = false;
  function carAt(cx, cy) {
    for (var r = 0; r < roads.length; r++) {
      var road = roads[r];
      if (!road.live) continue;
      for (var q = 0; q < road.parts.length; q++) {
        var part = road.parts[q], svg = part.svg;
        var box2 = svg.getBoundingClientRect();
        if (cx < box2.left || cx > box2.right || cy < box2.top || cy > box2.bottom) continue;
        var m = svg.getScreenCTM(); if (!m) continue;
        var pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
        pt = pt.matrixTransform(m.inverse());
        var best = null, bd = road.laneW * 1.4;
        for (var i = 0; i < road.cars.length; i++) {
          var c = road.cars[i];
          if (c.wx === undefined) continue;
          var d = Math.hypot(c.wx - part.ox - pt.x, c.wy - part.oy - pt.y);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) return best;
      }
    }
    return null;
  }
  function flag(c) {
    /* the one bit of feedback: a stopped car glows, so it is obvious which one
       you tapped and which one to tap again. Only ever on the handful that are
       actually held, so the filter this file warns about everywhere else costs
       nothing here. */
    c.nodes.forEach(function (n) {
      n.u.style.filter = c.held ? 'drop-shadow(0 0 5px rgba(255,60,40,.95))' : '';
    });
  }
  addEventListener('pointerdown', function (e) {
    tapAt = performance.now(); tapX = e.clientX; tapY = e.clientY;
    tapOk = !(e.target.closest && e.target.closest('.mode-switch,.tune-btn,.tune,a,button,input,textarea,select'));
  }, { passive: true });
  addEventListener('pointermove', function (e) {
    if (tapOk && Math.hypot(e.clientX - tapX, e.clientY - tapY) > TAP_PX) tapOk = false;
  }, { passive: true });
  addEventListener('pointercancel', function () { tapOk = false; }, { passive: true });
  addEventListener('pointerup', function (e) {
    if (!tapOk) return;
    tapOk = false;
    if (performance.now() - tapAt > TAP_MS) return;
    if (Math.hypot(e.clientX - tapX, e.clientY - tapY) > TAP_PX) return;
    var c = carAt(e.clientX, e.clientY);
    if (!c) return;
    c.held = !c.held;
    flag(c);
  }, { passive: true });

  /* -- THE RUBBERNECK ---------------------------------------------------------
   * Stand still on a section for five seconds and the traffic starts taking an
   * interest in you: everyone eases off to two fifths of what they wanted, over
   * a couple of seconds, and the road bunches up behind the ones who slowed
   * first. Move again and it lets go over about a second and the queue eats
   * itself. It is one multiplier on the speed every driver DESIRES, not on the
   * speed they have - so it goes through the same following model as everything
   * else and comes out as a jam rather than as everything crawling in step.
   */
  var stareY = -1, stareSince = 0, gawk = 1;
  function rubberneck(now, dt) {
    if (scrollY !== stareY) { stareY = scrollY; stareSince = now; }
    /* AND NOT WHILE HE IS TUNING. Sitting still with the panel open is exactly
       the condition this looks for, so every slider was being read against a
       road already crawling at two fifths - which is most of why none of them
       appeared to do anything. */
    var want = (!TUNE.tuning && now - stareSince > TUNE.stareAt * 1000)
             ? TUNE.stareTo : 1;
    var rate = want < gawk ? dt / 2.2 : dt / 1.0;   /* slow to notice, quick to forgive */
    gawk += Math.max(-rate, Math.min(rate, want - gawk));
    return gawk;
  }

  /* -- the loop ------------------------------------------------------------- */
  /* IS IT NIGHT? ASK THE SAME QUESTION THE STYLESHEET ASKS.
     night.css lights the beams from `--night: 1`, and THREE selectors set it:
     data-mode="night", data-theme="dark", and a dark system setting with no
     explicit choice. This asked only the first, so on a machine in dark mode
     the beams were painted at full brightness while the engine, believing it
     was daytime, never wrote their transforms - and a beam that is never
     written stays wherever it last was, which is out over the water beside
     the road. That is what "stray cars" were. mode.js publishes the ladder it
     already used for the switch; one truth, read here. */
  var darkMQ = matchMedia('(prefers-color-scheme: dark)');
  function nightNow() {
    if (window.H19_NIGHT) return window.H19_NIGHT();
    var d = document.documentElement.dataset;              /* mode.js absent */
    if (d.mode === 'night') return true;
    if (d.mode === 'day') return false;
    if (d.theme === 'dark') return true;
    if (d.theme === 'light') return false;
    return darkMQ.matches;
  }
  var last = 0, wasNight = nightNow(), litUntil = 0;
  function frame(now) {
    var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
    last = now;

    var share = nightShare(now, roads);
    var stare = rubberneck(now, dt);
    /* ARE THE NIGHT LAYERS WORTH MOVING THIS FRAME? One read of one attribute,
       once, against a hundred-odd vehicles times two nodes times two sections
       that would otherwise be transformed to be invisible. */
    var isNight = nightNow();
    if (isNight !== wasNight) { wasNight = isNight; litUntil = now + 1300; }
    /* `lit` is "the beams are worth moving": all night, and either side of the
       switch while they fade. `shaded` is the same question for the sun's
       shadows, which is the opposite one - all DAY, and either side while THEY
       fade. Both have to cover the crossing or a layer is taken out of the tree
       while it still has opacity, which is a pop rather than a fade. */
    var lit = isNight || now < litUntil;
    var shaded = !isNight || now < litUntil;
    roads.forEach(function (road) {
      /* THE CENSUS RUNS EVEN ON A ROAD THAT IS ASLEEP, and it has to. A road
         whose section is off screen is paused - none of its cars move, so none
         of them ever reaches the end of a lap, so a road that is asleep when
         the hour changes would still be at its daylight count when he scrolls
         to it. Paused is also exactly when it is free to change all at once,
         because there is nobody to see it happen. */
      census(road, share);
      if (!road.live) return;
      for (var lane = 0; lane < 2; lane++) {
        var q = road.cars.filter(function (c) { return c.lane === lane; })
                         .sort(function (a, b) { return a.u - b.u; });

        /* what a car's own length costs it in CENTRELINE units where it is
           standing: on the inside of a bend its lane is short, so the same
           car eats more of the centreline than its length suggests */
        for (var z = 0; z < q.length; z++) {
          var cz = q[z];
          cz.uLong = cz.long / laneScale(road, cz.u, cz.lane ? -1 : 1);
        }

        /* 1. decide, and move */
        for (var i = 0; i < q.length; i++) {
          var c = q[i], ahead = q[(i + 1) % q.length];
          var gap = ahead.u - c.u; if (gap <= 0) gap += road.len;
          gap -= (c.uLong + ahead.uLong) / 2;
          /* what this driver would like to be doing - but seen late */
          var raw = Math.max(0, Math.min(c.vbase * road.quick * stare,
                                         (gap - c.uLong * STANDOFF * 1.4) / TUNE.headway));
          /* A DRIVER WHO HAS BEEN TAPPED DOES NOT HAVE TO THINK ABOUT IT. Every
             other desire is seen late, through REACT, which is what makes the
             waves; this one is immediate, so the car brakes at DECEL like a car
             and is stopped in half a second rather than easing asymptotically
             towards nought for the next ten. */
          c.want = c.held ? 0 : c.want + (raw - c.want) * Math.min(1, dt / REACT);
          var d = c.want - c.v, lim = (d > 0 ? ACCEL : DECEL) * road.scale * dt;
          c.v += Math.max(-lim, Math.min(lim, d));
          if (c.v < 0) c.v = 0;
          c.u += c.v * dt;
          /* the end of a lap - the one moment a car can leave without anyone
             seeing it go */
          if (c.u >= road.len) { c.u -= road.len; c.wrapped = true; }
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
            /* A FLOOR NOBODY SHOULD REACH. Six per cent of a car length used
               to be the whole of it, so the clamp WAS the queue: every driver
               aimed at nought gap and this caught them all at touching. Now the
               rule above aims at a third of a car length and this sits under it
               it at the same third - so a driver who overshot through REACT
               still ends up with the room the rule asked for rather than on
               the bumper in front. The rule aims a little FURTHER back than
               this (1.4x), so the two agree about where a queue stands and the
               clamp is only ever worth a pixel or two. */
            var least = (c2.uLong + lead.uLong) / 2 + c2.uLong * STANDOFF;
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
        var p = { x: (pf.x + pb.x) / 2, y: (pf.y + pb.y) / 2 };
        var cdx = pf.x - pb.x, cdy = pf.y - pb.y;
        var cm = Math.hypot(cdx, cdy) || 1;
        var ang = Math.atan2(cdy, cdx) * 180 / Math.PI;
        /* SIT IN YOUR OWN LANE, OFF YOUR OWN AXLES. Half a lane along the
           normal - and the normal is taken from the car's own chord, the same
           one it is pointed along, not from whichever segment its centre
           happens to be sitting on. A car cannot then be facing one way and
           offset another, which is what used to jerk it sideways at a vertex.

           TIMES dir, AND THAT IS THE WHOLE POINT OF THIS LINE. The chord runs
           from the car's back axle to its front, so on the oncoming lane it
           already points the opposite way down the road. Using it raw as the
           tangent cancelled the dir in the offset - dir squared is one - and
           put both lanes on the same side of the centreline, driving through
           each other. Turning it back into the road's own forward direction
           first is what keeps the two lanes apart. */
        var tx = (cdx / cm) * dir, ty = (cdy / cm) * dir;
        var off = road.laneW / 2 * dir;
        var x = p.x - ty * off, y = p.y + tx * off;
        c.wx = x; c.wy = y;                 /* where a finger would find it */
        var b = box[c.id], cx = b.x + b.width / 2, cy = b.y + b.height / 2;
        var spin = 'rotate(' + ang.toFixed(1) + ') scale(' + c.k.toFixed(4) + ') ' +
                   'translate(' + (-cx).toFixed(1) + ' ' + (-cy).toFixed(1) + ')';
        for (var ni = 0; ni < c.nodes.length; ni++) {
          var n = c.nodes[ni], part = n.part;
          var lx = x - part.ox, ly = y - part.oy;
          /* IS THIS CAR EVEN IN THIS SECTION? His coast road runs through two,
             so every car on it carries a whole set of nodes in EACH - which is
             what makes a car cross the seam without a join. A car in section
             one is therefore also being drawn, transformed and composited in
             section two, off the end of its own box, where it is clipped away
             and nobody ever sees it. That is half the work on the longest road
             on the page, thrown away every frame.

             display:none is what takes it out - a hidden <use> is not laid out,
             not painted and not composited - and it is written ONCE, on the
             frame it crosses out, not every frame it is away. `pad` is a whole
             car's length of slack so the swap always happens off screen. */
          var pad = c.long + 40;
          var on = lx > -pad && ly > -pad && lx < part.w + pad && ly < part.h + pad;
          if (on !== n.on) {
            n.on = on;
            var d = on ? '' : 'none';
            n.u.style.display = d;
            if (n.sh) n.sh.style.display = d;
            n.shOn = on;
          }
          /* A BEAM IS HIDDEN WHENEVER IT IS NOT WORTH MOVING, which is the
             same bargain the shadows already had and the reason they never
             had this fault. Through the day the beams are at zero opacity and
             their transforms are not written, so they go stale - and a beam
             that is stale but DISPLAYED only needs something to light it to
             become a headlight lying on the water beside the road. Tying the
             two together means a displayed beam is always a beam that was
             written this frame, whatever the theme, the mode or the timing. */
          if (n.bm && n.bmOn !== (on && lit)) {
            n.bmOn = on && lit;
            n.bm.style.display = n.bmOn ? '' : 'none';
          }
          /* the sun's shadows leave the tree at dusk rather than fading to an
             opacity nobody can see: at zero opacity they still cost a full
             raster of his art on every vehicle in every frame */
          if (n.sh && n.shOn !== (on && shaded)) {
            n.shOn = on && shaded;
            n.sh.style.display = n.shOn ? '' : 'none';
          }
          if (!on) continue;
          var move = 'translate(' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ') ' + spin;
          n.u.setAttribute('transform', move);
          /* AND THE NIGHT LAYERS ARE NOT WRITTEN IN THE DAY. The beams and the
             mute are at zero opacity until dark, so through the whole of the
             day scene these two lines were building a string and parsing it
             into a matrix for a hundred vehicles, sixty times a second, to move
             something nobody can see. `lit` stays true for a second and a bit
             after the switch is thrown, because that is how long they take to
             fade and they have to be in the right place while they do. */
          /* AND A BEAM IS NEVER SHOWN WHERE IT LAST WAS. Through the day the
             beams are at zero opacity and not worth moving, so their transform
             goes stale - which is harmless until something lights them. The
             frame a node crosses INTO a section is the one frame that has to
             be written anyway, lit or not: after it, a beam that is displayed
             is a beam in the right place, whatever turns the light on next. */
          if (lit) {
            if (n.bm) n.bm.setAttribute('transform', move);
          }
          /* THE SUN DOES NOT TURN WITH THE CAR. His shadow art is registered to
             the car exactly - measured, 0.00 units out on all twenty - so the
             shadow takes the car's own rotation and scale, and the sun's
             displacement is added OUTSIDE them, in screen space. Every shadow
             on the road then points the same way whichever way its car is
             pointing, which is the whole difference between a sun and a smudge.
             (The boat's shadow spins with the hull; that is a boat's own wake
             sitting under it, not the same thing.) */
          if (n.sh && shaded) n.sh.setAttribute('transform',
            'translate(' + (lx + part.sunX).toFixed(1) + ' ' +
                           (ly + part.sunY).toFixed(1) + ') ' + spin);
        }
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

#!/usr/bin/env node
/* The road's centreline for a section, taken from HIS OWN DASHES.
 *
 * Every road tile he draws is a #575757 body with white edge lines down the
 * sides and white DASHES down the middle. The dashes are the centreline by
 * definition - that is what a road's centre line is - so there is nothing to
 * guess: read their centres out of his art, map them into section
 * percentages, and chain them in the order the road runs.
 *
 * Distinguishing dashes from edge lines: the edge lines sit at the extremes of
 * the road body, the dashes sit on its centre axis. So take the union of the
 * #575757 shapes as the road, and keep the white shapes whose centre lands
 * near the middle of it.
 *
 * Output is a polyline in SECTION PERCENTAGES - x of the width, y of the
 * height - which is the same coordinate system everything else in the build
 * uses. tools/make_traffic.js turns that into keyframes.
 *
 *   node tools/extract_path.js 01
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');

const N = process.argv[2] || '01';
const html = fs.readFileSync(`build/v2/section-${N}.html`, 'utf8');

/* section geometry, so a tile's top% can be turned into a y% of the section */
const css = fs.readFileSync(`build/v2/section-${N}.css`, 'utf8');
const ar = /aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(css);
const SEC_H_OVER_W = +ar[2] / +ar[1];

/* Does this section wrap its art in a .page? Section one does: everything is a
   share of the PAGE, which starts partway down. */
const pageTop = /\.sec\d\s+\.page\{[^}]*top:\s*([\d.]+)%/.exec(css);
const PAGE_TOP = pageTop ? +pageTop[1] : 0;                      // % of section h
const PAGE_H   = 100 - PAGE_TOP;                                 // % of section h

/* the road tiles, in the order they appear - which is the order the road runs */
const tiles = [];
const re = /<img[^>]*class="[^"]*\bz-road\b[^"]*"[^>]*>/g;
let m;
while ((m = re.exec(html))) {
  const tag = m[0];
  if (/cruise/.test(tag)) continue;                              // the boat
  const src = /src="([^"]+)"/.exec(tag)[1];
  const st  = /style="([^"]+)"/.exec(tag)[1];
  const g = k => { const r = new RegExp(k + ':\\s*(-?[\\d.]+)%').exec(st); return r ? +r[1] : null; };
  tiles.push({ file: path.resolve('build/v2', src), name: path.basename(src),
               left: g('left'), top: g('top'), width: g('width') });
}
if (!tiles.length) { console.error('no road tiles in section ' + N); process.exit(1); }

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage();
  await p.setContent('<body style="margin:0">');

  const groups = [];
  let roadW = 1e9;
  for (const t of tiles) {
    const svg = fs.readFileSync(t.file, 'utf8');
    const got = await p.evaluate(s => {
      document.body.innerHTML = s;
      const el = document.querySelector('svg');
      const vb = el.viewBox.baseVal;
      const road = [], white = [];
      el.querySelectorAll('path,rect,polygon,line').forEach(n => {
        const f = (n.getAttribute('fill') || '').toLowerCase();
        let b; try { b = n.getBBox(); } catch (e) { return; }
        if (!b.width && !b.height) return;
        if (f === '#575757') road.push(b);
        else if (f === '#fff' || f === '#ffffff') white.push(b);
      });
      if (!road.length) return null;
      const R = road.reduce((a, b) => ({
        x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        r: Math.max(a.r, b.x + b.width), b: Math.max(a.b, b.y + b.height) }),
        { x: 1e9, y: 1e9, r: -1e9, b: -1e9 });

      /* A DASH SITS IN THE MIDDLE OF THE ROAD; AN EDGE LINE HUGS ITS RIM.
         That is the only difference that holds for straights and curves alike -
         size does not (his curve tiles carry a short straight whose edge lines
         are shorter than the arc's dashes) and neither does distance from the
         tile centre (a curve's dashes follow an arc, nowhere near it).
         So measure it: march out from each white shape's centre until the
         point leaves his road body, and keep the ones with room around them.
         The threshold is a share of the largest clearance found, so it
         calibrates itself to whatever width he drew the road. */
      const bodies = [...el.querySelectorAll('path,rect,polygon')]
        .filter(n => (n.getAttribute('fill')||'').toLowerCase() === '#575757');
      const inRoad = (x, y) => {
        const pt = el.createSVGPoint(); pt.x = x; pt.y = y;
        for (const n of bodies) {
          try { if (n.isPointInFill(pt)) return true; } catch (e) {
            const b = n.getBBox();
            if (x >= b.x && x <= b.x+b.width && y >= b.y && y <= b.y+b.height) return true;
          }
        }
        return false;
      };
      const span = Math.max(R.r - R.x, R.b - R.y);
      const step = span / 400;
      const clearance = c => {
        let min = Infinity;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          let d = 0;
          while (d < span && inRoad(c.x + dx*d, c.y + dy*d)) d += step;
          if (d < min) min = d;
        }
        return min;
      };
      const cand = white.map(b => ({ x: b.x + b.width/2, y: b.y + b.height/2 }));
      cand.forEach(c => { c.clear = clearance(c); });
      const maxClear = Math.max(...cand.map(c => c.clear));
      const dashes = cand.filter(c => c.clear > maxClear * 0.45);
      /* the narrow dimension of a straight run IS the road's width */
      const rw = Math.min(R.r - R.x, R.b - R.y);
      return { vb: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
               road: R, roadW: rw, dashes };
    }, svg);
    if (!got) { console.error('  no road body in ' + t.name); continue; }

    /* tile user units -> section percentages. The tile is placed by its own
       width, and its height follows from the viewBox aspect. */
    const tileWpc = t.width;                                   // % of section w
    const tileHpc = tileWpc * (got.vb.h / got.vb.w) / SEC_H_OVER_W;  // % of section h
    const topPc = PAGE_TOP + t.top * PAGE_H / 100;             // % of section h
    const group = [];
    for (const d of got.dashes) {
      group.push({
        x: t.left  + (d.x - got.vb.x) / got.vb.w * tileWpc,
        y: topPc   + (d.y - got.vb.y) / got.vb.h * tileHpc * (PAGE_H / 100 ? 1 : 1),
        tile: t.name });
    }
    groups.push(group);
    /* his straights are all one width; take the narrowest reading as the road */
    const wpc = got.roadW / got.vb.w * t.width;
    if (/stright/.test(t.name)) roadW = Math.min(roadW, wpc);
    console.error('  ' + t.name.padEnd(14) + got.dashes.length + ' dashes');
  }
  await br.close();

  /* CHAIN WITHIN EACH TILE, in tile order, PREFERRING A POINT THAT CONTINUES
     THE DIRECTION OF TRAVEL rather than simply the nearest one.
     Nearest-alone is wrong inside his curve tiles: each of those carries the
     arc's dashes AND a short straight's dashes, and where the two meet the
     nearest unused point is sometimes back on the other run. That produced
     three reversed segments in the middle of every curve - heading jumps of
     116 and 140 degrees - which is what threw the cars sideways on the bends.
     Scoring distance against the turn it would take fixes it, because a road
     does not double back on itself inside one tile. */
  var order = [];
  var exit = null, head = null, dropped = 0;
  var FORWARD = 0.2;   /* cos 78 degrees */
  for (var gi = 0; gi < groups.length; gi++) {
    var g = groups[gi];
    if (!g.length) continue;
    var rest = g.slice(), cur;
    var seed = exit || null;
    if (!seed) {
      /* WHERE THE ROAD STARTS. "The topmost dash" is meaningless on a
         horizontal run - every dash shares a y, so section three began in the
         MIDDLE of its own road and had to double back to collect the rest.
         Start at an end instead: the end that faces the tile the road runs on
         to, or, if this is the only tile, the far end of its own long axis. */
      var next = groups.slice(gi + 1).find(function (h) { return h.length; });
      if (next) {
        var cxn = next.reduce(function (t, q) { return t + q.x; }, 0) / next.length;
        var cyn = next.reduce(function (t, q) { return t + q.y; }, 0) / next.length;
        cur = rest.reduce(function (a, b) {
          return dist(b, { x: cxn, y: cyn }) > dist(a, { x: cxn, y: cyn }) ? b : a; });
      } else {
        var cx = rest.reduce(function (t, q) { return t + q.x; }, 0) / rest.length;
        var cy = rest.reduce(function (t, q) { return t + q.y; }, 0) / rest.length;
        var far = rest.reduce(function (a, b) {
          return dist(b, { x: cx, y: cy }) > dist(a, { x: cx, y: cy }) ? b : a; });
        cur = far;
      }
    }
    else {
      /* CARRY THE HEADING ACROSS THE TILE BOUNDARY. Picking the point NEAREST
         the previous tile's exit is not enough: his tiles overlap slightly, so
         the nearest point can be one that sits BEHIND the exit. That first step
         then points backwards, and because every later step is scored against
         it, the whole tile gets collected in reverse before jumping forward -
         which is the 180-degree flip that put cars through each other.
         The road keeps going the way it was going, so score the entry the same
         way every other step is scored. */
      var bi = -1, bd = Infinity;
      for (var i = 0; i < rest.length; i++) {
        var e = unit(seed, rest[i]);
        if (head && head[0] * e[0] + head[1] * e[1] < FORWARD) continue;   /* behind us */
        var d = dist(seed, rest[i]);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) { dropped += rest.length; continue; }
      cur = rest[bi];
      head = unit(seed, cur);
    }
    rest.splice(rest.indexOf(cur), 1);
    order.push(cur);
    /* ONLY EVER GO FORWARD. HIS TILES OVERLAP, so a tile's first dashes can be
       duplicates of ones the road has already driven past - in section three
       the last tile begins 3.6 units BEHIND the previous tile's exit. Ordering
       cannot fix that; those points have to be dropped, or the chain collects
       them at the end and doubles back 180 degrees, which is what put cars
       through each other on the straight and threw them sideways on the bends.
       A candidate must lie within about 78 degrees of the way we are already
       travelling - loose enough for his arcs, which step 15 degrees at a time. */
    while (rest.length) {
      var best = -1, bestScore = Infinity;
      for (var j = 0; j < rest.length; j++) {
        var u = unit(cur, rest[j]);
        var cos = head ? head[0] * u[0] + head[1] * u[1] : 1;
        if (cos < FORWARD) continue;
        var score = dist(cur, rest[j]) * (1 + 4 * (1 - cos));
        if (score < bestScore) { bestScore = score; best = j; }
      }
      if (best < 0) { dropped += rest.length; break; }
      head = unit(cur, rest[best]);
      cur = rest[best]; order.push(cur); rest.splice(best, 1);
    }
    exit = cur;
  }

  function dist(a, b) {
    var dx = b.x - a.x, dy = (b.y - a.y) * SEC_H_OVER_W;
    return Math.hypot(dx, dy);
  }
  function unit(a, b) {
    var dx = b.x - a.x, dy = (b.y - a.y) * SEC_H_OVER_W, m = Math.hypot(dx, dy) || 1;
    return [dx / m, dy / m];
  }

  /* PROVE IT. A centreline that turns more than 40 degrees between two
     consecutive dashes is not a road he drew, it is a chaining mistake. */
  var worst = 0, at = -1, prev = null;
  for (var k = 0; k < order.length - 1; k++) {
    var u2 = unit(order[k], order[k + 1]);
    if (prev) {
      var turn = Math.abs(Math.acos(Math.max(-1, Math.min(1,
        prev[0] * u2[0] + prev[1] * u2[1]))) * 180 / Math.PI);
      if (turn > worst) { worst = turn; at = k; }
    }
    prev = u2;
  }
  console.error('  ' + dropped + ' overlapping dashes dropped');
  console.error('  sharpest turn between dashes: ' + worst.toFixed(1) + ' degrees'
    + (worst > 40 ? '  <-- STILL WRONG near point ' + at : ''));

  console.error('  ' + order.length + ' centreline points');
  process.stdout.write(JSON.stringify({
    section: N, secHoverW: SEC_H_OVER_W, roadW: +roadW.toFixed(3),
    points: order.map(p => [ +p.x.toFixed(3), +p.y.toFixed(3) ])
  }, null, 1) + '\n');
})();

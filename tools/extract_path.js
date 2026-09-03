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

  /* CHAIN WITHIN EACH TILE, in tile order. The tiles are already in the order
     the road runs, so the only question is which way round each tile's own
     dashes go - and a single tile's dashes are a simple chain, so a local
     nearest-neighbour seeded from the previous tile's exit is safe. A GLOBAL
     nearest-neighbour is not: it doubled back up section one's road where the
     horizontal run passes the vertical one. */
  const order = [];
  let exit = null;
  for (const g of groups) {
    if (!g.length) continue;
    const rest = g.slice();
    let cur;
    if (exit === null) cur = rest.reduce((a, b) => (b.y < a.y ? b : a));   // enters at the top
    else {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < rest.length; i++) {
        const dx = rest[i].x - exit.x, dy = (rest[i].y - exit.y) * SEC_H_OVER_W;
        if (dx*dx + dy*dy < bd) { bd = dx*dx + dy*dy; bi = i; }
      }
      cur = rest[bi];
    }
    rest.splice(rest.indexOf(cur), 1);
    order.push(cur);
    while (rest.length) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < rest.length; i++) {
        const dx = rest[i].x - cur.x, dy = (rest[i].y - cur.y) * SEC_H_OVER_W;
        if (dx*dx + dy*dy < bd) { bd = dx*dx + dy*dy; bi = i; }
      }
      cur = rest[bi]; order.push(cur); rest.splice(bi, 1);
    }
    exit = cur;
  }
  console.error('  ' + order.length + ' centreline points');
  process.stdout.write(JSON.stringify({
    section: N, secHoverW: SEC_H_OVER_W, roadW: +roadW.toFixed(3),
    points: order.map(p => [ +p.x.toFixed(3), +p.y.toFixed(3) ])
  }, null, 1) + '\n');
})();

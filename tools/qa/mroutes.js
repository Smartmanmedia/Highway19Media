/* HIS MOBILE ROADS, FOLLOWED.
 * ---------------------------------------------------------------------------
 * The desktop routes were walked off his artboards a pixel at a time
 * (trace-roads.js) because his scenes there are full of things drawn over the
 * tarmac. The mobile roads are not: each one is his own named group - #Curve
 * and #Curve-2 - and nothing is on top of them. So they are lifted out on
 * their own, painted solid black on white, and the ribbon that leaves is
 * unbroken: no kerb, no dashes, no centre line to confuse a cross-section.
 *
 * The walk is the same idea as his desktop one. From a seed on the straight
 * run, step along the heading, cut across it, and put the point back in the
 * middle of the tarmac it lands in. The heading follows the centres, so the
 * line turns with his curve without anything knowing what a curve is.
 *
 *   node tools/qa/mroutes.js          ->  tools/qa/mroutes.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/home/user/highway19media';

/* which file, which box the page shows it in, and where his road starts */
const JOBS = [
  { key: 'road', file: 'm-road.svg',  vb: [1093.2, 1000],
    seed: [-110, 139.97], dir: 0 },
  /* his first section runs its road over a bridge, and the bridge deck is
     not inside either Curve group - it is loose, in his tarmac grey. So the
     keep list is the Curves plus everything painted that grey, and the walk
     is given enough gap tolerance to cross the white rails and dashes he
     draws on top of the deck. */
  { key: 'm1',   file: 'm-sec-1.svg', vb: [1516.19, 2045.63], seed: [96, 1990],
    dir: -Math.PI / 2, tarmac: '#575757', gap: 18 },
  { key: 'm4',   file: 'm-sec-4.svg', vb: [1122.01, 3362.8],  seed: [-110, 139.97], dir: 0 },
];

(async () => {
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('http://localhost:8777/assets/scene/');
const out = {};
for (const J of JOBS) {
  const src = fs.readFileSync(`${ROOT}/assets/scene/${J.file}`, 'utf8');
  const r = await p.evaluate(async ([src, J]) => {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    const svg = doc.documentElement;
    const keep = [...svg.querySelectorAll('[id^="Curve"]')];
    if (J.tarmac) {
      const t = J.tarmac.toLowerCase();
      svg.querySelectorAll('[fill]').forEach(e => {
        if ((e.getAttribute('fill') || '').toLowerCase() === t &&
            !keep.some(g => g.contains(e))) keep.push(e);
      });
    }
    if (!keep.length) return { err: 'no Curve group' };
    /* his road, alone, solid: every fill and stroke forced to black so the
       ribbon has no dashes, no kerb line and no centre line inside it */
    const NS = 'http://www.w3.org/2000/svg';
    const holder = doc.createElementNS(NS, 'svg');
    holder.setAttribute('xmlns', NS);
    /* HIS ROAD RUNS OFF THE ARTBOARD ON BOTH SIDES, deliberately - that is
       what stops a car appearing out of nothing at the edge of the screen -
       so the canvas is drawn with a margin all round and the walk can follow
       him out there and back. */
    const PAD = 160;
    holder.setAttribute('viewBox',
      (-PAD) + ' ' + (-PAD) + ' ' + (J.vb[0] + 2 * PAD) + ' ' + (J.vb[1] + 2 * PAD));
    keep.forEach(g => holder.appendChild(g.cloneNode(true)));
    holder.querySelectorAll('*').forEach(e => {
      if (e.hasAttribute('fill') && e.getAttribute('fill') !== 'none') e.setAttribute('fill', '#000');
      if (e.hasAttribute('stroke') && e.getAttribute('stroke') !== 'none') e.setAttribute('stroke', '#000');
      if (e.style) { e.style.fill = ''; e.style.stroke = ''; }
    });
    const txt = new XMLSerializer().serializeToString(holder);

    /* one canvas pixel per artboard unit */
    const W = Math.round(J.vb[0]) + 2 * PAD, H = Math.round(J.vb[1]) + 2 * PAD;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
    const im = new Image();
    im.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(txt)));
    await im.decode();
    cx.drawImage(im, 0, 0, W, H);
    const D = cx.getImageData(0, 0, W, H).data;
    const road = (x, y) => { x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      return D[(y * W + x) * 4] < 110; };

    /* where his road starts, if it was not given: the leftmost dark pixel */
    let seed = J.seed, dir = J.dir;
    if (!seed) {
      let best = null;
      for (let x = 0; x < W && !best; x++)
        for (let y = 0; y < H; y++) if (road(x, y)) { best = [x, y]; break; }
      if (!best) return { err: 'no road pixels' };
      let y0 = best[1], y1 = best[1];
      while (road(best[0] + 2, y0 - 1)) y0--;
      while (road(best[0] + 2, y1 + 1)) y1++;
      seed = [best[0] + 3 - PAD, (y0 + y1) / 2 - PAD];
    }

    /* cut across the heading and come back with the middle of the tarmac */
    const MAXW = 400, GAP = J.gap || 0;
    /* out to the edge of his tarmac, stepping over anything he has drawn on
       top of it - a dash, a lane line, a bridge rail - up to GAP units of it */
    const edge = (x, y, nx, ny, s) => {
      let at = 0, miss = 0;
      for (let t = 1; t <= MAXW; t++) {
        if (road(x + nx * t * s, y + ny * t * s)) { at = t; miss = 0; }
        else if (++miss > GAP) break;
      }
      return at * s;
    };
    const centre = (x, y, a) => {
      const nx = -Math.sin(a), ny = Math.cos(a);
      const lo = edge(x, y, nx, ny, -1), hi = edge(x, y, nx, ny, 1);
      if (hi - lo < 4) return null;
      const m = (lo + hi) / 2;
      return { x: x + nx * m, y: y + ny * m, w: hi - lo };
    };

    const STEP = 4, TURN = 0.10;
    /* the walk runs in canvas space and reports in his own */
    let a = dir, x = seed[0] + PAD, y = seed[1] + PAD;
    if (!road(x, y)) return { err: 'seed is not on his road' };
    const pts = [[seed[0], seed[1]]], wid = [];
    for (let n = 0; n < 6000; n++) {
      /* try the heading and a fan either side of it; take the one whose
         cross-section is narrowest, which is the one square to his road */
      let best = null, ba = a;
      for (let k = -3; k <= 3; k++) {
        const t = a + k * TURN;
        const nx2 = x + Math.cos(t) * STEP, ny2 = y + Math.sin(t) * STEP;
        if (!road(nx2, ny2)) continue;
        const c = centre(nx2, ny2, t);
        if (!c) continue;
        if (!best || c.w < best.w) { best = c; ba = t; }
      }
      if (!best) break;
      a = ba; x = best.x; y = best.y;
      pts.push([+(x - PAD).toFixed(2), +(y - PAD).toFixed(2)]); wid.push(best.w);
      /* off the artboard on either side, with a little run-out */
      if (x < 12 || y < 12 || x > W - 12 || y > H - 12) break;
    }
    wid.sort((u, v) => u - v);
    if (!wid.length) return { err: 'the walk did not move' };
    return { pts, width: +wid[wid.length >> 1].toFixed(2), W, H, n: pts.length };
  }, [src, J]);
  if (r.err) { console.log(J.key, '-', r.err); continue; }
  /* the first and last few points are the walk settling on and off his road
     - a little hook at each end - and a car would follow it */
  const pts = r.pts.slice(3, -2);
  out[J.key] = { vb: J.vb, width: r.width, pts };
  console.log(J.key, r.n, 'points | his tarmac', r.width, 'units wide |',
    'from', r.pts[0].join(','), 'to', r.pts[r.pts.length - 1].join(','));
}
fs.writeFileSync(`${ROOT}/tools/qa/mroutes.json`, JSON.stringify(out));
await b.close();
})();

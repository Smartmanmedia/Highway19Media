/* ============================================================================
 * HIS ROAD PIECES, SNAPPED TO EACH OTHER - the measuring half.
 * ----------------------------------------------------------------------------
 * His Q&A roads are laid from separate pieces - _Stright-n and _Curve-n groups
 * - and they were placed by hand, so where two meet their white edges are
 * often a fraction to a few units apart. At the home page's size that was
 * invisible; at a 4K window it is a visible step in both edge lines and the
 * dashes. The home page's road was fixed the same way: nothing is redrawn,
 * each piece is moved - straight across, never scaled - onto the one it joins.
 *
 *   node tools/qa/roadsnap-measure.js http://localhost:8719/q-a/
 *
 * Needs puppeteer-core and a Chrome (CHROME_PATH). It reads the built page in
 * a real browser, so every piece is measured where it is actually drawn, and
 * writes tools/qa/roadsnap.json: { "<group id>": [dx, dy] } in each group's
 * PARENT's units - which is what build_site.js puts in front of the group's
 * own transform. Re-run it whenever tools/qa/make.sh has rebuilt faq.html.
 *
 * THE RULE. Per axis, separately: horizontal edges set a piece's dy, vertical
 * edges its dx - a curve can take both, and moving it along one axis never
 * disturbs its alignment on the other. A piece that runs off the side of its
 * section (for dy) or its top or bottom (for dx) is an ANCHOR and does not
 * move: that is where the road carries on into the next section or into the
 * bleed strips, and those are fixed. So is everything in his base layer. The
 * rest take a breadth-first walk out from the anchors, each piece moved onto
 * whichever neighbour reached it first.
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const URL = process.argv[2] || 'http://localhost:8719/q-a/';
const OUT = path.join(__dirname, 'roadsnap.json');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const result = {}, report = [];
  for (const [W, mobile] of [[2000, false], [400, true]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: 1000, isMobile: mobile });
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
    const r = await page.evaluate(() => {
      const ROAD = /_(Stright|Curve)(-\d+)?$/;
      const out = {}, rep = [];
      document.querySelectorAll('section svg').forEach(svg => {
        const sec = svg.closest('section');
        if (!sec || !sec.getBoundingClientRect().width) return;
        /* NOT HIS SIX-LANE HIGHWAY. It is laid from interlocking lane tiles
           whose edges are shared between rows, so pairing edges piece by
           piece sends a tile onto the wrong row - it looked right as drawn
           and was left that way. */
        if (sec.id === 's07') return;
        const vb = svg.viewBox.baseVal;
        const root = svg.getCTM().inverse();
        const pieces = new Map();                       /* id -> piece */
        const get = id => {
          if (!pieces.has(id)) pieces.set(id, { id, H: [], V: [], fix: { x: false, y: false } });
          return pieces.get(id);
        };
        svg.querySelectorAll('rect').forEach(e => {
          const f = (e.getAttribute('fill') || '').toLowerCase();
          if (f !== '#fff' && f !== '#ffffff' && f !== 'white') return;
          let bb; try { bb = e.getBBox(); } catch (x) { return; }
          const m = root.multiply(e.getCTM());
          const P = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; return q.matrixTransform(m); };
          const a = P(bb.x, bb.y), c = P(bb.x + bb.width, bb.y + bb.height);
          const x0 = Math.min(a.x, c.x), x1 = Math.max(a.x, c.x);
          const y0 = Math.min(a.y, c.y), y1 = Math.max(a.y, c.y);
          const g = e.closest('g[id]');
          const gid = g && ROAD.test(g.id) ? g.id : '__base';
          const p = get(gid);
          if (y1 - y0 < 6 && x1 - x0 > 60) {
            p.H.push({ c: (y0 + y1) / 2, a: x0, b: x1 });
            if (x0 < vb.x + 5 || x0 < 5 || x1 > vb.x + vb.width - 5) p.fix.y = true;
          } else if (x1 - x0 < 6 && y1 - y0 > 60) {
            p.V.push({ c: (x0 + x1) / 2, a: y0, b: y1 });
            if (y0 < 5 || y1 > vb.y + vb.height - 5) p.fix.x = true;
          }
        });
        if (pieces.has('__base')) pieces.get('__base').fix = { x: true, y: true };

        /* the offset that puts Q's edges on P's, along one axis, if they meet */
        const meet = (P, Q, ax) => {
          const L1 = ax === 'y' ? P.H : P.V, L2 = ax === 'y' ? Q.H : Q.V;
          const ds = [];
          for (const s of L1) for (const t of L2) {
            const d = s.c - t.c;
            const touch = Math.max(s.a, t.a) - Math.min(s.b, t.b) < 3;
            if (touch && Math.abs(d) < 4) ds.push(d);
          }
          if (!ds.length) return null;
          ds.sort((u, v) => u - v);
          return ds[ds.length >> 1];
        };
        const list = [...pieces.values()];
        const shift = new Map(list.map(p => [p.id, { x: 0, y: 0 }]));
        for (const ax of ['x', 'y']) {
          const done = new Set(list.filter(p => p.fix[ax]).map(p => p.id));
          const walk = queue => {
            while (queue.length) {
              const P = queue.shift();
              for (const Q of list) {
                if (done.has(Q.id)) continue;
                const d = meet(P, Q, ax);
                if (d === null) continue;
                shift.get(Q.id)[ax] = shift.get(P.id)[ax] + d;
                done.add(Q.id); queue.push(Q);
              }
            }
          };
          walk(list.filter(p => done.has(p.id)));
          /* A RUN WITH NO ANCHOR - pieces that only meet each other - still
             has to meet itself. Its longest piece holds still and the rest
             come to it. */
          const len = p => (ax === 'y' ? p.H : p.V).reduce((n, s) => n + s.b - s.a, 0);
          for (;;) {
            const free = list.filter(p => !done.has(p.id) && len(p) > 0 &&
              list.some(q => q !== p && meet(p, q, ax) !== null))
              .sort((a, b) => len(b) - len(a));
            if (!free.length) break;
            done.add(free[0].id);
            walk([free[0]]);
          }
        }
        for (const p of list) {
          if (p.id === '__base') continue;
          const s = shift.get(p.id);
          if (Math.abs(s.x) < 0.05 && Math.abs(s.y) < 0.05) continue;
          /* into the group's parent's units */
          const g = svg.querySelector('#' + CSS.escape(p.id));
          const pm = root.multiply(g.parentNode.getCTM()).inverse();
          const o = svg.createSVGPoint(); o.x = 0; o.y = 0;
          const v = svg.createSVGPoint(); v.x = s.x; v.y = s.y;
          const o2 = o.matrixTransform(pm), v2 = v.matrixTransform(pm);
          out[p.id] = [+(v2.x - o2.x).toFixed(3), +(v2.y - o2.y).toFixed(3)];
          rep.push(sec.id + ' ' + p.id + ' ' + s.x.toFixed(2) + ',' + s.y.toFixed(2));
        }
      });
      return { out, rep };
    });
    Object.assign(result, r.out);
    report.push(...r.rep);
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
  console.log(report.join('\n'));
  console.log(Object.keys(result).length + ' pieces -> ' + path.relative(process.cwd(), OUT));
})();

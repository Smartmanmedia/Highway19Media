#!/usr/bin/env node
/* DROP THE SHAPES THAT CANNOT BE SEEN.
 *
 * His shadow art is the car redrawn - body, windows, wheels, mirrors, every
 * panel - and all of it black. Painted black on black, only the shapes that
 * reach the OUTSIDE of the silhouette make any difference; the rest is 40KB of
 * detail nobody can ever see.
 *
 * Which ones those are is not something to guess at: a wheel juts out where a
 * window does not, and the body is not always drawn first. So this measures.
 * Every shape is rendered on its own, the whole vehicle is rendered once as the
 * target, and shapes are added biggest-first, keeping only the ones that light
 * up a pixel nothing before them had. Then the result is compared against the
 * original silhouette and must match to the pixel.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const SRC = 'build/v2/shades.js', RES = 300;

(async () => {
  const js = fs.readFileSync(SRC, 'utf8');
  const body = /window\.H19_SHADES=`([\s\S]*)`;/.exec(js)[1];
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 900, height: 600 } });
  await p.setContent('<body style="margin:0"></body>');

  const out = await p.evaluate(async ([body, RES]) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
    document.body.appendChild(host);
    const SVGNS = 'http://www.w3.org/2000/svg';

    /* render an arbitrary set of shape elements over one vehicle's own box */
    async function ink(nodes, bb) {
      const s = document.createElementNS(SVGNS, 'svg');
      s.setAttribute('viewBox', bb.x + ' ' + bb.y + ' ' + bb.width + ' ' + bb.height);
      s.setAttribute('width', RES); s.setAttribute('height',
        Math.max(1, Math.round(RES * bb.height / bb.width)));
      nodes.forEach(n => s.appendChild(n.cloneNode(true)));
      const url = 'data:image/svg+xml;base64,' +
        btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(s))));
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas');
      c.width = +s.getAttribute('width'); c.height = +s.getAttribute('height');
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const m = new Uint8Array(c.width * c.height);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 40 ? 1 : 0;
      return m;
    }

    const report = [];
    for (const g of [...host.querySelectorAll('g[id$="_shade"]')]) {
      const bb = g.getBBox();
      const shapes = [...g.querySelectorAll('path,polygon,rect,circle,ellipse,polyline')];
      const whole = await ink(shapes, bb);
      const each = [];
      for (const s of shapes) {
        const m = await ink([s], bb);
        let n = 0; for (let i = 0; i < m.length; i++) n += m[i];
        each.push({ el: s, m, n });
      }
      each.sort((a, b) => b.n - a.n);
      const cov = new Uint8Array(whole.length);
      const keep = [];
      for (const e of each) {
        let adds = 0;
        for (let i = 0; i < e.m.length; i++) if (e.m[i] && !cov[i]) adds++;
        if (adds > 0) { keep.push(e.el); for (let i = 0; i < e.m.length; i++) cov[i] |= e.m[i]; }
      }
      /* it has to come out the same picture */
      let diff = 0;
      for (let i = 0; i < whole.length; i++) if (whole[i] !== cov[i]) diff++;
      const dead = new Set(keep);
      shapes.forEach(s => { if (!dead.has(s)) s.remove(); });
      report.push({ id: g.id, was: shapes.length, now: keep.length,
                    diff, px: whole.length });
    }
    const svg = host.querySelector('svg');
    return { body: svg.innerHTML, report };
  }, [body, RES]);

  let worst = 0, was = 0, now = 0;
  for (const r of out.report) {
    worst = Math.max(worst, r.diff / r.px);
    was += r.was; now += r.now;
    console.log(r.id.padEnd(22) + r.was + ' shapes -> ' + r.now +
      (r.diff ? '   ' + r.diff + ' pixels different' : ''));
  }
  console.log(was + ' shapes -> ' + now + ', worst silhouette change ' +
    (worst * 100).toFixed(4) + '% of the vehicle');
  if (worst > 0.0005) { console.log('FAIL - the silhouette changed'); process.exit(1); }

  const head = js.slice(0, js.indexOf('window.H19_SHADES='));
  fs.writeFileSync(SRC, head + 'window.H19_SHADES=`' +
    out.body.replace(/\s*\n\s*/g, '') + '`;\n');
  console.log('build/v2/shades.js  ' + (fs.statSync(SRC).size / 1024).toFixed(1) + ' KB');
  await br.close();
})();

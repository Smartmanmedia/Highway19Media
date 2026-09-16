#!/usr/bin/env node
/* Where does one of his layers sit relative to another?
 *
 * Illustrator crops every export to its own content unless told not to, so a
 * set of layers meant to stack arrives with three different artboards and no
 * record of how they line up. This finds the offset by CORRELATING THE INK:
 * render both, take the per-column and per-row coverage, and slide one against
 * the other until they agree best.
 *
 * It is an estimate, not a measurement - a shadow is deliberately offset from
 * the thing casting it, so the peak lands near his intended placement rather
 * than exactly on it. Good enough to look right, and the two numbers it prints
 * are the ones to nudge.
 *
 *   node tools/align_layers.js <base.svg> <overlay.svg>
 */
const fs = require('fs');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const [baseF, overF] = process.argv.slice(2);
const W = 900;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: W, height: 700 } });
  await p.setContent('<body style="margin:0">');

  async function profile(file) {
    const b64 = Buffer.from(fs.readFileSync(file)).toString('base64');
    return p.evaluate(async ([d, W]) => {
      const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i);
        i.src = 'data:image/svg+xml;base64,' + d; });
      const s = W / img.width, h = Math.round(img.height * s);
      const c = document.createElement('canvas');
      c.width = W; c.height = h;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, W, h);
      const a = x.getImageData(0, 0, W, h).data;
      const col = new Float64Array(W), row = new Float64Array(h);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < W; xx++) {
        const v = a[(yy * W + xx) * 4 + 3] / 255;
        col[xx] += v; row[yy] += v;
      }
      return { col: [...col], row: [...row], w: img.width, h: img.height, scale: s, ph: h };
    }, [b64, W]);
  }
  const A = await profile(baseF), B = await profile(overF);
  await br.close();

  const norm = v => { const m = Math.max(...v) || 1; return v.map(q => q / m); };
  function best(a, b, span) {
    a = norm(a); b = norm(b);
    let bo = 0, bs = -Infinity;
    for (let o = -span; o <= span; o++) {
      let s = 0, n = 0;
      for (let i = 0; i < b.length; i++) {
        const j = i + o;
        if (j < 0 || j >= a.length) continue;
        s += a[j] * b[i]; n++;
      }
      if (n > 20 && s / Math.sqrt(n) > bs) { bs = s / Math.sqrt(n); bo = o; }
    }
    return bo;
  }
  const dxPx = best(A.col, B.col, Math.round(W * 0.45));
  const dyPx = best(A.row, B.row, Math.round(A.ph * 0.45));
  /* back into the BASE's own user units */
  const dx = dxPx / A.scale, dy = dyPx / A.scale;
  console.log(overF + '  relative to  ' + baseF);
  console.log('  base    ' + A.w.toFixed(2) + ' x ' + A.h.toFixed(2));
  console.log('  overlay ' + B.w.toFixed(2) + ' x ' + B.h.toFixed(2));
  console.log('  offset  x ' + dx.toFixed(1) + '   y ' + dy.toFixed(1) + '   (base user units)');
  console.log('  so as a share of the base: left ' + (100*dx/A.w).toFixed(3) + '%  top '
    + (100*dy/A.h).toFixed(3) + '%  width ' + (100*B.w/A.w).toFixed(3) + '%');
})();

#!/usr/bin/env node
/* Read a section export into a manifest: every named layer, in ART COLUMN
 * coordinates, which is what the CSS uses.
 *
 * The art column is the part of the artboard that maps to the page width.
 * Anything outside it is bleed. In section one the ocean runs x 87 -> 2011.33
 * of a 2011.33-wide artboard, so the column is 1924.34 wide and all 87 units
 * of bleed are on the LEFT — the side the road and the low cloud leave by.
 * Measuring against the artboard instead of the column would put every layer
 * 4.5% right of where he drew it. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const SRC = process.argv[2];
const COL = process.argv[3] ? process.argv[3].split(',').map(Number) : null;   // x0,width

(async () => {
  const svg = fs.readFileSync(SRC, 'utf8');
  const [, , VW, VH] = /viewBox="([\d.\s-]+)"/.exec(svg)[1].trim().split(/\s+/).map(Number);

  /* the column, from the ocean/ground polygon if it is there, else the artboard */
  let x0 = 0, cw = VW;
  const oc = /<polygon id="ocean" points="([^"]+)"/.exec(svg);
  if (COL) { x0 = COL[0]; cw = COL[1]; }
  else if (oc) {
    const p = oc[1].replace(/,/g, ' ').split(/\s+/).map(Number);
    const xs = p.filter((_, i) => i % 2 === 0);
    x0 = Math.min(...xs); cw = Math.max(...xs) - x0;
  }

  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const p = await b.newPage({ viewport:{ width:1200, height:900 } });
  await p.setContent('<style>html,body{margin:0}svg{display:block;width:' + VW + 'px}</style>' + svg);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(4000);
  const rows = await p.evaluate(() => {
    const s = document.querySelector('svg'), sr = s.getBoundingClientRect();
    const SHAPES = 'path,polygon,polyline,rect,circle,ellipse,line';
    const out = [];
    s.querySelectorAll('g[id]').forEach(g => {
      if (/^(Layer_?\d|_?[xX]\d)/.test(g.id)) return;
      const r = g.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      let own = 0;
      g.querySelectorAll(SHAPES).forEach(sh => { if (sh.closest('g') === g) own++; });
      out.push({ id:g.id, x:r.left-sr.left, y:r.top-sr.top, w:r.width, h:r.height,
                 shapes:g.querySelectorAll(SHAPES).length, own });
    });
    return out.sort((a, b) => a.y - b.y);
  });
  await b.close();

  const pc = v => +( (v - x0) / cw * 100 ).toFixed(2);
  const pw = v => +( v / cw * 100 ).toFixed(2);
  const py = v => +( v / VH * 100 ).toFixed(2);

  const manifest = {
    file: path.basename(SRC),
    artboard: { w: VW, h: VH },
    column: { x: +x0.toFixed(2), w: +cw.toFixed(2) },
    bleed: { left: +x0.toFixed(2), right: +(VW - x0 - cw).toFixed(2) },
    aspect: +(VH / cw).toFixed(4),
    layers: rows.map(r => ({
      name: r.id, shapes: r.shapes,
      left: pc(r.x), top: py(r.y), width: pw(r.w), height: py(r.h),
      bleeds: r.x < x0 - 1 || r.x + r.w > x0 + cw + 1
    }))
  };

  console.log(manifest.file + '   artboard ' + VW + ' x ' + VH);
  console.log('  art column  x ' + manifest.column.x + '  width ' + manifest.column.w +
              '   bleed ' + manifest.bleed.left + ' left, ' + manifest.bleed.right + ' right');
  console.log('  ASPECT ' + manifest.aspect + '   (section height = ' +
              (manifest.aspect * 100).toFixed(2) + '% of the page width)\n');
  console.log('  layer              left     top   width  height  shapes  bleeds');
  manifest.layers.forEach(l => console.log('  ' + l.name.padEnd(16) +
    String(l.left).padStart(8) + '%' + String(l.top).padStart(7) + '%' +
    String(l.width).padStart(7) + '%' + String(l.height).padStart(7) + '%' +
    String(l.shapes).padStart(8) + (l.bleeds ? '   yes' : '')));

  const out = path.join(path.dirname(SRC), path.basename(SRC).replace(/\.svg$/, '') + '.manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  console.log('\n  -> ' + out);
})();

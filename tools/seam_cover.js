#!/usr/bin/env node
/* WHERE CAN THE GREEN/WHITE SEAM HIDE?
 *
 * The band is a jagged mass, so there is only a narrow strip where its ink
 * covers every column edge to edge. A seam anywhere else shows through the
 * gaps as a straight line - which is what he is seeing. Coverage is measured
 * on the REAL composite, not on a doctored one: shoot the page as it stands,
 * shoot it again with every rock layer hidden, and call a pixel covered where
 * the two differ. That way clipping and z-order count for what they are.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
const W = 1600;
const ROCKS = '.sec4 svg[viewBox="0 0 1918.34 497.43"], .sec6 .rock-cross, .sec6 .rock-layer';
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: W, height: 1000 } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'build/v2/page.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));

  const geo = await p.evaluate(sel => {
    const d = e => { const r = e.getBoundingClientRect();
      return { t: r.top + scrollY, b: r.bottom + scrollY }; };
    const band = document.querySelector(sel.split(',')[0].trim());
    const s4 = document.querySelector('.sec4'), s6 = document.querySelector('.sec6');
    return { band: d(band), s4: d(s4), s6: d(s6), page: d(s6.querySelector('.page')) };
  }, ROCKS);

  const top = Math.floor(geo.band.t) - 10, h = Math.ceil(geo.band.b - geo.band.t) + 30;
  const shoot = async hide => {
    await p.evaluate(([sel, hd]) => document.querySelectorAll(sel)
      .forEach(e => e.style.visibility = hd ? 'hidden' : ''), [ROCKS, hide]);
    await p.waitForTimeout(120);
    const png = await p.screenshot({ clip: { x: 0, y: top, width: W, height: h }, fullPage: true });
    return p.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return [...c.getContext('2d').getImageData(0, 0, img.width, img.height).data];
    }, png.toString('base64'));
  };
  const A = await shoot(false), B = await shoot(true);

  console.log('band ' + geo.band.t.toFixed(1) + ' -> ' + geo.band.b.toFixed(1) +
              ' | sec4 bottom ' + geo.s4.b.toFixed(1) +
              ' | sec6 top ' + geo.s6.t.toFixed(1) +
              ' | white page top ' + geo.page.t.toFixed(1));

  const rows = [];
  for (let y = 0; y < h; y++) {
    let cov = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(A[i]-B[i]) + Math.abs(A[i+1]-B[i+1]) + Math.abs(A[i+2]-B[i+2]) > 12) cov++;
    }
    rows.push(cov);
  }
  const full = rows.map((c, i) => [i + top, c]).filter(([, c]) => c === W).map(([y]) => y);
  console.log(full.length
    ? 'FULL COVER ' + full[0] + ' .. ' + full[full.length-1] + '  (' + full.length + ' rows)'
    : 'FULL COVER: none - no seam can hide anywhere in this band');
  for (let y = 0; y < h; y += 3) {
    const pc = rows[y] / W * 100;
    if (pc > 55) console.log((y + top) + '  ' + pc.toFixed(1) + '%' + (rows[y] === W ? '  FULL' : ''));
  }
  await br.close();
})();

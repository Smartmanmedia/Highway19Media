#!/usr/bin/env node
/* IS THERE A STRAIGHT LINE ACROSS THE 4/6 TRANSITION?
 *
 * Not "is the seam where I meant it" - a computed style would say yes either
 * way. This looks for the artefact itself: a row where green sits directly on
 * top of white. Every such column is a pixel of the straight edge he can see.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
const W = 1600;
const isGreen = (r,g,b) => g > r + 25 && g > b + 25;
const isWhite = (r,g,b) => r > 235 && g > 235 && b > 235;
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: W, height: 1000 } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'build/v2/page.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1200);
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  const g = await p.evaluate(() => {
    const r = document.querySelector('.sec4 svg[viewBox="0 0 1918.34 497.43"]').getBoundingClientRect();
    return { t: r.top + scrollY, b: r.bottom + scrollY };
  });
  const top = Math.floor(g.t), h = Math.ceil(g.b - g.t) + 40;
  const png = await p.screenshot({ clip: { x: 0, y: top, width: W, height: h }, fullPage: true });
  const d = await p.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return [...c.getContext('2d').getImageData(0, 0, img.width, img.height).data];
  }, png.toString('base64'));

  let worst = { y: -1, n: 0 };
  for (let y = 0; y < h - 3; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) {
      const a = (y * W + x) * 4, c = ((y + 3) * W + x) * 4;
      if (isGreen(d[a],d[a+1],d[a+2]) && isWhite(d[c],d[c+1],d[c+2])) n++;
    }
    if (n > worst.n) worst = { y: y + top, n };
  }
  const pc = worst.n / W * 100;
  console.log('worst green-directly-over-white row: y=' + worst.y +
              '  ' + worst.n + ' of ' + W + ' columns (' + pc.toFixed(1) + '%)');
  console.log(pc > 2 ? 'FAIL - a straight edge is visible' : 'OK - the rocks carry the transition');
  await br.close();
  process.exit(pc > 2 ? 1 : 0);
})();

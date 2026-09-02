#!/usr/bin/env node
/* His truss cell as an image, from HIS OWN TILE FILE (EXT_Polls), which is
 * what he exported it for.
 *
 * The first attempt cut a cell out of the section render instead. That loses
 * him: the section is drawn at section scale, so a 124-unit cell rasterises
 * from a fraction of the artwork and the tubular shading on his bars flattens
 * into a grey gradient. His tile file is drawn at its own scale, so it
 * rasterises at full detail.
 *
 * Rasterised rather than tiled as vector because the cell is 514 shapes; about
 * fifteen fit across a screen, which is ~7,700 shapes for one piece of trim.
 * As an image the browser decodes it once and every repeat is free. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const SRC = '/home/user/highway19media/incoming/v2/section-01/tiles/ext-polls.svg';
const OUT = '/home/user/highway19media/assets/v2/section-01/truss-cell';
const SCALE = 6;

(async () => {
  const svg = fs.readFileSync(SRC, 'utf8');
  const [, , VW, VH] = /viewBox="([\d.\s-]+)"/.exec(svg)[1].trim().split(/\s+/).map(Number);
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const W = Math.round(VW * SCALE), H = Math.round(VH * SCALE);
  const p = await b.newPage({ viewport:{ width:W, height:H } });
  await p.setContent('<style>html,body{margin:0;background:transparent}' +
                     'svg{display:block;width:' + W + 'px;height:' + H + 'px}</style>' + svg);
  await p.waitForTimeout(2500);
  const png = await p.screenshot({ omitBackground: true });

  const enc = await b.newPage();
  const url = await enc.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.95);
  }, png.toString('base64'));
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(OUT + '.webp', buf);
  fs.writeFileSync(OUT + '.png', png);
  console.log('his tile ' + VW + ' x ' + VH + '  ->  ' + W + ' x ' + H + ' at ' + SCALE + 'x');
  console.log('  webp ' + (buf.length/1024).toFixed(1) + ' KB');
  console.log('  one cell = ' + VW + ' of a 1924.34 column = ' + (VW/1924.34*100).toFixed(3) + '%');
  await b.close();
})();

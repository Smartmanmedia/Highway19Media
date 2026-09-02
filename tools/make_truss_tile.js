#!/usr/bin/env node
/* One truss cell as an image, exactly one STEP wide so it repeats with his own
 * spacing.
 *
 * Two things that were not obvious. His X is TWO overlapping groups, one per
 * diagonal — cutting "the group" gives a single slash, which tiles into
 * something that looks like rain. And the cell has to be taken from the
 * section itself so it stays registered, which means hiding the ocean first or
 * the blue paints into the tile and the truss disappears against the sea.
 *
 * Rasterised because 514 shapes per cell as vector is ~7,700 across a screen —
 * heavier than the 32 copies baked into his export. As an image the browser
 * decodes it once and every repeat after that is free. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const SRC = '/home/user/highway19media/incoming/v2/section-01/section-01.svg';
const OUT = '/home/user/highway19media/assets/v2/section-01/truss-cell';
/* a couple of units of margin top and bottom: the cell bbox clips his rails */
const X = 84.19, Y = 309.5, STEP = 129.67, H = 128.0, SCALE = 3;

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const W = Math.round(STEP * SCALE), HH = Math.round(H * SCALE);
  const p = await b.newPage({ viewport:{ width:W, height:HH } });
  const framed = fs.readFileSync(SRC, 'utf8').replace(/<svg([^>]*)>/, (m, a) =>
    '<svg' + a.replace(/width="[\d.]+"/, 'width="' + W + '"')
              .replace(/height="[\d.]+"/, 'height="' + HH + '"')
              .replace(/viewBox="[^"]+"/, 'viewBox="' + X + ' ' + Y + ' ' + STEP + ' ' + H + '"') + '>');
  await p.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}' +
                     '#ocean{display:none}</style>' + framed);
  await p.waitForTimeout(3000);
  const png = await p.screenshot({ omitBackground: true });

  const enc = await b.newPage();
  const url = await enc.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.92);
  }, png.toString('base64'));
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(OUT + '.webp', buf);
  fs.writeFileSync(OUT + '.png', png);
  console.log('truss cell ' + W + ' x ' + HH + ' at ' + SCALE + 'x   webp ' +
              (buf.length/1024).toFixed(1) + ' KB');
  console.log('  one step = ' + STEP + ' of a 1924.34 column = ' +
              (STEP / 1924.34 * 100).toFixed(3) + '%');
  await b.close();
})();

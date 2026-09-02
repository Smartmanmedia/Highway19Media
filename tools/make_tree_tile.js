#!/usr/bin/env node
/* His idea, made to work: one set of trees repeated horizontally with an
 * overlap, instead of one enormous forest that cannot stretch.
 *
 * Tiling it as VECTOR would be worse than what it replaces — the set is 4,185
 * shapes, so three of them is 12,555 against the forest's 10,112. Rasterised
 * once and repeated as an image, the browser decodes it a single time and the
 * repeats are free, however wide the screen.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const W = 964.57, H = 766.26;

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:Math.ceil(W), height:Math.ceil(H) },
                                       deviceScaleFactor:2 });
  await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>' +
    fs.readFileSync(ROOT + '/incoming/TreesTile.svg','utf8'));
  await page.waitForTimeout(4000);
  const png = await page.screenshot({ omitBackground:true,
    clip:{ x:0, y:0, width:Math.round(W), height:Math.round(H) } });

  const enc = await browser.newPage();
  const results = [];
  for (const q of [0.9, 0.82, 0.74]) {
    const url = await enc.evaluate(async ({ b64, q }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', q);
    }, { b64: png.toString('base64'), q });
    results.push({ q, bytes: Buffer.from(url.split(',')[1], 'base64') });
  }
  await browser.close();

  const pick = results.find(r => r.q === 0.82);
  fs.writeFileSync(ROOT + '/assets/scene/tree-tile.webp', pick.bytes);
  console.log('one tree set, ' + Math.round(W) + ' x ' + Math.round(H) + ' at 2x\n');
  results.forEach(r => console.log('  quality ' + r.q.toFixed(2) + '   ' +
    (r.bytes.length/1024).toFixed(0) + ' KB' + (r.q === 0.82 ? '   <- shipping' : '')));
  console.log('\n  replaces Forest: 10,112 shapes / 2,457 KB of SVG');
  console.log('  as vector his tile would be 4,185 shapes EACH — three across is worse');
})();

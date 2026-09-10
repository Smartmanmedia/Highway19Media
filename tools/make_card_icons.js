#!/usr/bin/env node
/* HIS FOUR CARD ICONS, FROM THE FILES HE ACTUALLY DREW.
 *
 * These were traced by hand for a few rounds because the icons inside his
 * Cards SVG were external xlink:hrefs pointing at a folder on his machine -
 * links that do not travel with a file. He has put the four PNGs in the
 * repository under assets/brand, so nothing is traced any more.
 *
 * AND THEY ARE NOT CROPPED. His own Cards New.svg carries these four as
 * embedded PNGs - not dead links after all, which is worth knowing - and the
 * transform on each one places it against its card to a hundredth of a per
 * cent. Those placements are what the cards now use, and they assume his
 * margins: crop the ink out and every number in them is wrong. The uploads
 * are the same four drawings at higher resolution (390 x 435 against his
 * embedded 316 x 352, same aspect to a thousandth), so they go in whole.
 *
 * AND THEY GO OUT AS WEBP. They arrive as 100K PNGs at 435 tall for something
 * that paints 74 pixels across on a 1920 page - 150 on a retina one. 300 wide
 * at quality 0.82 is three per cent of the weight and more resolution than the
 * card can show.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'v2', 'section-06');
const NAMES = ['webdesign', 'video', 'print', 'social'];
const LONG = 300;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 700, height: 700 } });
  await p.goto('about:blank');
  for (const n of NAMES) {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'brand', n + '.png'));
    const got = await p.evaluate(async ({ d, LONG }) => {
      const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
      const c0 = document.createElement('canvas');
      c0.width = i.width; c0.height = i.height;
      const x0 = c0.getContext('2d'); x0.drawImage(i, 0, 0);
      const l = 0, t = 0, w = i.width, h = i.height;
      const s = LONG / Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(i, l, t, w, h, 0, 0, c.width, c.height);
      return { webp: c.toDataURL('image/webp', 0.82).split(',')[1],
               w: c.width, h: c.height, ar: +(w / h).toFixed(4) };
    }, { d: src.toString('base64'), LONG });
    const f = path.join(OUT, 'icon-' + n + '.webp');
    fs.writeFileSync(f, Buffer.from(got.webp, 'base64'));
    console.log(`icon-${n}.webp`.padEnd(22) + got.w + 'x' + got.h +
      '  ar ' + got.ar + '   ' + (src.length / 1024).toFixed(0) + 'K -> ' +
      (fs.statSync(f).size / 1024).toFixed(1) + 'K');
  }
  await br.close();
})();

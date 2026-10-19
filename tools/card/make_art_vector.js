#!/usr/bin/env node
/* THE ICON SET, STRUCK FROM A CARD'S OWN VECTOR MARK.
 *
 *   CHROME_PATH=/path/to/chrome node tools/card/make_art_vector.js <slug>
 *
 * make_art.js cuts a card's art out of photographs and needs sharp. A card
 * whose logo is a drawing needs none of that: the mark is already resolution
 * free, so every size is the same file rendered larger or smaller, struck
 * through a browser rather than a raster library.
 *
 * It reads cards/<slug>/art-src/mark.svg and cards/<slug>/card.json, and
 * writes the set tools/card/build.js insists on:
 *
 *   icon-32.png icon-192.png icon-512.png   on the card's own background
 *   icon-maskable-512.png                   the same, inside Android's 80% safe zone
 *   apple-touch-icon.png                    180, opaque - iOS will not honour alpha
 *   logo-160.webp                           transparent, for the mark on the card
 *   intro-logo.png                          300, transparent
 *   vcard-photo.jpg                         the picture that rides inside the .vcf
 *
 * A dev tool like the rest: its output is committed to cards/<slug>/art/ and
 * the host's build only copies.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');

const slug = process.argv[2];
if (!slug) { console.error('usage: make_art_vector.js <card slug>'); process.exit(1); }
const dir = path.join(ROOT, 'cards', slug);
const markFile = path.join(dir, 'art-src', 'mark.svg');
if (!fs.existsSync(markFile)) {
  console.error('no ' + path.relative(ROOT, markFile) + ' - this tool is for cards whose logo is a drawing');
  process.exit(1);
}
const card = JSON.parse(fs.readFileSync(path.join(dir, 'card.json'), 'utf8'));
const mark = fs.readFileSync(markFile, 'utf8').replace(/width="\d+"\s+height="\d+"/, 'width="100%" height="100%"');
const bg = ((card.art || {}).icon || {}).bg || (card.theme || {}).bg || '#000';
const OUT = path.join(dir, 'art');

/* size, file, background (null = transparent), how much of the box the mark fills */
const SET = [
  [32,  'icon-32.png',            bg,   0.86],
  [192, 'icon-192.png',           bg,   0.86],
  [512, 'icon-512.png',           bg,   0.86],
  [512, 'icon-maskable-512.png',  bg,   0.62],  /* Android crops to a circle; 80% safe zone */
  [180, 'apple-touch-icon.png',   bg,   0.86],  /* opaque on purpose - iOS flattens alpha to black */
  [160, 'logo-160.webp',          null, 1.00],
  [300, 'intro-logo.png',         null, 1.00],
  [240, 'vcard-photo.jpg',        bg,   0.80],
];

const page = (size, fill, scale) => `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${size}px;height:${size}px}
body{background:${fill || 'transparent'};display:grid;place-items:center}
.m{width:${(size * scale).toFixed(2)}px;height:${(size * scale).toFixed(2)}px}
</style><div class="m">${mark}</div>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  for (const [size, file, fill, scale] of SET) {
    const p = await b.newPage({ viewport: { width: size, height: size },
                                deviceScaleFactor: 1 });
    await p.setContent(page(size, fill, scale), { waitUntil: 'load' });
    const out = path.join(OUT, file);
    if (file.endsWith('.webp')) {
      /* playwright writes png and jpeg; webp comes off a canvas, the way the
         rest of this repo makes webp without an image library */
      const shot = (await p.screenshot({ omitBackground: !fill })).toString('base64');
      const data = await p.evaluate(async b64 => {
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/webp', 0.92).split(',')[1];
      }, shot);
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
    } else if (file.endsWith('.jpg')) {
      await p.screenshot({ path: out, type: 'jpeg', quality: 88 });
    } else {
      await p.screenshot({ path: out, omitBackground: !fill });
    }
    console.log('  ' + path.relative(ROOT, out) + '  ' + size + 'x' + size + '  ' +
                Math.max(1, Math.round(fs.statSync(out).size / 1024)) + ' KB');
    await p.close();
  }
  await b.close();
})();

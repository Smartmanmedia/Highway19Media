/* The rasters unembed() pulls out of his artboards, as webp.
 * Illustrator embeds them as PNG; the same drawing as webp is a fifth of the
 * bytes and every browser this site supports reads it inside an <image>.
 * All image work in this repository is done in Chromium - there is no PIL, no
 * sharp and no ImageMagick here - so it is a canvas and toDataURL, the same
 * way the rest of the art was converted.
 *   node tools/qa/embwebp.js
 * unembed() prefers the .webp when it finds one, so a rebuild picks these up. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', '..', 'assets', 'img');
(async () => {
  const pngs = fs.readdirSync(DIR).filter(f => /^emb-.*\.png$/.test(f));
  if (!pngs.length) { console.log('nothing to convert'); return; }
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const p = await b.newPage();
  for (const f of pngs) {
    const b64 = fs.readFileSync(path.join(DIR, f)).toString('base64');
    const out = await p.evaluate(async b64 => {
      const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      return c.toDataURL('image/webp', 0.92).split(',')[1];
    }, b64);
    const to = f.replace(/\.png$/, '.webp');
    fs.writeFileSync(path.join(DIR, to), Buffer.from(out, 'base64'));
    console.log(f, (fs.statSync(path.join(DIR, f)).size / 1024 | 0) + ' KB  ->  ' +
                   to, (fs.statSync(path.join(DIR, to)).size / 1024 | 0) + ' KB');
  }
  await b.close();
})();

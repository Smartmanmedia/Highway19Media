#!/usr/bin/env node
/* Some of his art is genuinely a thousand shapes — the desert is 978 low-poly
 * rocks and bushes, and there is nothing to collapse: every path is real
 * geometry. A browser has to draw all of them every time it rasters that
 * region, and on a machine short of memory that is where art starts dropping
 * out. A bitmap decodes once.
 *
 * Only for art that is detailed, static and carries no text. Anything with
 * type in it, or anything that has to stay crisp at any zoom, stays vector.
 *
 *   node tools/rasterise_art.js <in.svg> <out.webp> <width> [quality]
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const [IN, OUT, W, Q] = [process.argv[2], process.argv[3],
                         parseInt(process.argv[4] || '3200', 10),
                         parseInt(process.argv[5] || '88', 10)];
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--no-sandbox'] });
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(IN)).toString('base64');
  const p = await b.newPage({ viewport:{ width: 400, height: 400 } });
  await p.setContent('<body style="margin:0"><img id=i style="width:'+W+'px;display:block" src="'+uri+'">');
  await p.waitForFunction(()=>document.getElementById('i').naturalWidth>0);
  const size = await p.evaluate(()=>{const i=document.getElementById('i');return {w:i.width,h:i.height};});
  await new Promise(r=>setTimeout(r,600));
  /* Through a canvas rather than a screenshot: playwright only writes PNG or
     JPEG, and JPEG has no alpha. The art has to sit over the section's own
     colour, so the alpha has to survive. */
  const url = await p.evaluate(({w,h,q})=>{
    const im = document.getElementById('i');
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    return c.toDataURL('image/webp', q/100);
  }, { w:size.w, h:size.h, q:Q });
  const buf = Buffer.from(url.split(',')[1], 'base64');
  fs.writeFileSync(OUT, buf);
  console.log(OUT + '  ' + size.w + 'x' + size.h + '  ' + Math.round(buf.length/1024) + ' KB' +
              '  (from ' + Math.round(fs.statSync(IN).size/1024) + ' KB of SVG)');
  await b.close();
})();

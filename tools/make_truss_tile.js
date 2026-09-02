#!/usr/bin/env node
/* His truss cell as an image, from his own EXT_Polls tile.
 *
 * WHY THE TWO RENDERS. His rails are built from about 130 stacked rects each
 * 0.14 units tall. Screenshot that against a transparent page and every one of
 * them is a sub-pixel sliver antialiasing against nothing: they never
 * accumulate to full opacity, so a rail his file draws as solid white came out
 * at alpha 200 of 255 and the truss looked see-through. The tile's own left and
 * right edges came out at half alpha for the same reason, which is a visible
 * seam at every repeat.
 *
 * There is no opacity anywhere in his file — checked. So the alpha is entirely
 * an artefact of how it was rasterised, and it can be solved for exactly.
 * Render the same frame twice, once on black and once on white; any pixel the
 * artwork covers fully reads the same on both, and one it covers partly reads
 * differently by exactly the amount of background showing through:
 *
 *     alpha  = 1 - (white - black)
 *     colour = black / alpha
 *
 * That returns his artwork at the opacity he drew it, with clean edges that
 * butt together invisibly.
 *
 * Rasterised at all because the cell is 514 shapes; about fifteen fit across a
 * screen, so ~7,700 shapes for one piece of trim. As an image the browser
 * decodes it once and every repeat after that is free. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const SRC = '/home/user/highway19media/incoming/v2/section-01/tiles/ext-polls.svg';
const OUT = '/home/user/highway19media/assets/v2/section-01/truss-cell';
/* 10x: his 0.14 slivers become 1.4px rather than sub-pixel, and 131.8 x 10 is
   a whole 1318 so the repeat boundary lands on a pixel edge. */
const SCALE = 10;

/* His gradient is about 130 rects each 0.14 units tall, drawn edge to edge.
 * Edge to edge is exactly the problem: two abutting slivers antialias against
 * each other and leave a hairline of background between them, at any scale, so
 * a rail his file draws as solid reads as 197 of 255 no matter how big it is
 * rendered. Growing each sliver by a hair makes them overlap instead. The
 * colours differ by one step of 255 between neighbours, so the overlap cannot
 * be seen — and it is done to a copy on the way to the rasteriser, never to
 * his file. */
function closeGaps(svg) {
  return svg.replace(/height="(0?\.\d+)"/g, (m, h) =>
    parseFloat(h) < 0.25 ? 'height="' + (parseFloat(h) + 0.03).toFixed(3) + '"' : m);
}

(async () => {
  const svg = closeGaps(fs.readFileSync(SRC, 'utf8'));
  const [, , VW, VH] = /viewBox="([\d.\s-]+)"/.exec(svg)[1].trim().split(/\s+/).map(Number);
  const W = Math.round(VW * SCALE), H = Math.round(VH * SCALE);

  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });

  const shot = async bg => {
    const p = await b.newPage({ viewport:{ width:W, height:H } });
    await p.setContent('<style>html,body{margin:0;background:' + bg + '}' +
                       'svg{display:block;width:' + W + 'px;height:' + H + 'px}</style>' + svg);
    await p.waitForTimeout(2000);
    const png = await p.screenshot();
    await p.close();
    return png.toString('base64');
  };
  const onBlack = await shot('#000'), onWhite = await shot('#fff');

  const solve = await b.newPage();
  const url = await solve.evaluate(async ({ blk, wht, W, H }) => {
    const load = async b64 => { const i = new Image(); i.src = 'data:image/png;base64,' + b64;
                                await i.decode(); return i; };
    const grab = async b64 => { const im = await load(b64);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      return x.getImageData(0, 0, W, H); };
    const B = await grab(blk), Wd = await grab(wht);
    const out = new ImageData(W, H);
    for (let i = 0; i < B.data.length; i += 4) {
      /* solve per channel and take the most opaque reading — a channel the
         artwork happens to match the backdrop on carries no information */
      let a = 0;
      for (let c = 0; c < 3; c++) {
        const av = 1 - (Wd.data[i + c] - B.data[i + c]) / 255;
        if (av > a) a = av;
      }
      if (a <= 0.002) { out.data[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) out.data[i + c] = Math.min(255, Math.round(B.data[i + c] / a));
      out.data[i + 3] = Math.round(Math.min(1, a) * 255);
    }
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
    c2.getContext('2d').putImageData(out, 0, 0);
    return { webp: c2.toDataURL('image/webp', 0.95), png: c2.toDataURL('image/png') };
  }, { blk: onBlack, wht: onWhite, W, H });
  await b.close();

  const wb = Buffer.from(url.webp.split(',')[1], 'base64');
  fs.writeFileSync(OUT + '.webp', wb);
  fs.writeFileSync(OUT + '.png', Buffer.from(url.png.split(',')[1], 'base64'));
  console.log('his tile ' + VW + ' x ' + VH + '  ->  ' + W + ' x ' + H + ' at ' + SCALE + 'x');
  console.log('  webp ' + (wb.length / 1024).toFixed(1) + ' KB, alpha solved from two renders');
  console.log('  one cell = ' + VW + ' of a 1924.34 column = ' + (VW / 1924.34 * 100).toFixed(3) + '%');
})();

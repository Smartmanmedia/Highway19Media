#!/usr/bin/env node
/* HIS FOUR PALMS AGAIN, FROM THE FILE HE HAS JUST REDRAWN THEM IN.
 *
 * assets/scene/Palm trees.svg carries Tree1..tree4 - the same four trees the
 * scene already plants, repainted: a lighter, yellower green with fuller
 * fronds. Same species, same poses, new paint.
 *
 * THE SHADOWS ARE NOT IN THAT FILE and they are not being regenerated. He drew
 * them once, properly projected, in highway-ppv-src; a flipped-and-skewed
 * cut-out is a smear rather than a palm, and the trees have not moved or
 * changed shape enough for his own shadows to stop fitting them. So the four
 * -shadow sprites and the w/h/dx/dy ratios in SH stay exactly as they are.
 *
 * WHAT DOES HAVE TO BE MEASURED AGAIN is where each tree STANDS across its own
 * sprite. fx is the trunk, not the middle of the picture: his trees lean, so
 * the box's centre can sit a sixth of the width away from the foot, and
 * centring the sprite on the world x hangs the trunk out over the water. It is
 * read off the ink - the horizontal centre of the bottom two per cent of the
 * opaque pixels - rather than taken on trust.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'scene', 'Palm trees.svg');
const OUT = path.join(ROOT, 'assets', 'v2', 'section-05');
const H = 1024;
const TREES = { a: 'Tree1', b: 'tree2', c: 'tree3', d: 'tree4' };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await br.newPage({ viewport: { width: 1400, height: 700 } });
  await page.setContent('<body style="margin:0">' + fs.readFileSync(SRC, 'utf8') + '</body>');
  await page.waitForTimeout(300);

  const boxes = await page.evaluate(ids => {
    const out = {};
    for (const [k, id] of Object.entries(ids)) {
      const g = document.getElementById(id);
      const b = g.getBBox();
      out[k] = { x: b.x, y: b.y, w: b.width, h: b.height };
    }
    return out;
  }, TREES);
  const src = fs.readFileSync(SRC, 'utf8');
  await page.close();

  const report = {};
  for (const [k, id] of Object.entries(TREES)) {
    const b = boxes[k];
    const W = Math.round(H * b.w / b.h);
    const one = src
      .replace(/<svg([^>]*)>/, (m, a) => '<svg' + a
        .replace(/width="[\d.]+"/, `width="${W}"`)
        .replace(/height="[\d.]+"/, `height="${H}"`)
        .replace(/viewBox="[^"]*"/, `viewBox="${b.x} ${b.y} ${b.w} ${b.h}"`) + '>')
      /* everything but this tree hidden, so one <g> is cut without moving it */
      .replace(/<g id="(Tree1|tree2|tree3|tree4)"/g,
        (m, g) => g === id ? m : `<g style="display:none" id="${g}"`);
    const p = await br.newPage({ viewport: { width: W, height: H } });
    await p.setContent('<body style="margin:0">' + one + '</body>');
    await p.waitForTimeout(250);
    const png = await p.screenshot({ omitBackground: true });
    const got = await p.evaluate(async ({ d, w, h }) => {
      const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      /* THE TRUNK, off the ink: the centre of the opaque pixels in the bottom
         two per cent of the sprite, which on a palm is the base of the trunk
         and nothing else. */
      const px = x.getImageData(0, Math.floor(h * 0.98), w, Math.ceil(h * 0.02)).data;
      let lo = w, hi = 0;
      for (let n = 0; n < px.length; n += 4) if (px[n + 3] > 40) {
        const cx = (n / 4) % w; if (cx < lo) lo = cx; if (cx > hi) hi = cx;
      }
      return { webp: c.toDataURL('image/webp', 0.88).split(',')[1],
               fx: lo <= hi ? +(((lo + hi) / 2) / w).toFixed(4) : 0.5 };
    }, { d: png.toString('base64'), w: W, h: H });
    fs.writeFileSync(path.join(OUT, `palm-${k}.webp`), Buffer.from(got.webp, 'base64'));
    report[k] = { ar: +(b.w / b.h).toFixed(4), fx: got.fx, px: W + 'x' + H,
      kb: +(fs.statSync(path.join(OUT, `palm-${k}.webp`)).size / 1024).toFixed(1) };
    await p.close();
  }
  await br.close();
  for (const [k, r] of Object.entries(report))
    console.log(`palm-${k}.webp  ${r.px}  ${r.kb}K   ar ${r.ar}   fx ${r.fx}`);
})();

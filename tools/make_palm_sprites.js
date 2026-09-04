#!/usr/bin/env node
/* HIS FOUR PALMS AS SPRITES, AND WHY NOT AS VECTOR.
 *
 * The four trees carry 247 shapes between them and 246 of his gradients - one
 * per frond - and as vector that is 214KB before a single tree is planted.
 * The weight is survivable; the frame cost is not. A palm in this scene is
 * never still: it grows the whole way past the camera, and a <use> of a
 * gradient-filled group has to be re-rasterised at every new scale. Fourteen
 * of them on screen is eight hundred gradient fills a frame.
 *
 * A sprite is rasterised once and scaled by the compositor, which is the same
 * work whatever size it is drawn at. So each tree is rendered here at 1024
 * tall - more than it is ever drawn on a 4K screen - and written as WebP.
 *
 * The shadows are NOT sprites and not his either: a cast shadow that is a
 * separate drawing comes apart from what casts it the moment anything moves.
 * The scene derives each one from the tree itself.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'assets', 'v2', 'section-05');
const H = 1024;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const sheet = fs.readFileSync(path.join(DIR, 'palms.svg'), 'utf8');
  const names = [...sheet.matchAll(/<symbol id="(palm-[a-z])" viewBox="([^"]+)"/g)];
  const rows = [];
  for (const [, id, vb] of names) {
    const [, , w, h] = vb.split(/\s+/).map(Number);
    const W = Math.round(H * w / h);
    const p = await br.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    /* A <use> OF A <symbol> BRINGS ITS OWN viewBox WITH IT. Repeating his
       viewBox on the outer <svg> as well maps the symbol into the wrong
       corner of user space and it lands outside the view - which is exactly
       what happened first time round and rendered four blank sprites. The
       outer box starts at the origin and the <use> is given the size; the
       symbol's own viewBox does the rest. */
    await p.setContent('<body style="margin:0">' + sheet +
      '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<use href="#' + id + '" width="' + w + '" height="' + h + '"/></svg></body>');
    await p.waitForTimeout(250);
    const png = await p.screenshot({ omitBackground: true });
    const webp = await p.evaluate(async d => {
      const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      return c.toDataURL('image/webp', 0.9).split(',')[1];
    }, png.toString('base64'));
    const f = path.join(DIR, id + '.webp');
    fs.writeFileSync(f, Buffer.from(webp, 'base64'));
    rows.push(id + ' ' + W + 'x' + H + ' ' + (fs.statSync(f).size / 1024).toFixed(1) + 'K');
    await p.close();
  }
  await br.close();
  console.log(rows.join(', '));
})();

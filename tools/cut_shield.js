#!/usr/bin/env node
/* HIS HIGHWAY 19 BADGE, off the mobile artboard.
 * In that file it is a 206KB embedded PNG at a third scale - too big to inline
 * and the wrong shape to cut as vector, because it IS a raster in his source.
 * So it is re-rendered at the size the phone actually paints it, twice over for
 * a retina screen, on a transparent ground. */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SP = '/tmp/claude-0/-home-user-storyboard-app/1a554a96-134b-52ef-894a-d9448b97add1/scratchpad/';
(async () => {
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 1080, height: 900 }, deviceScaleFactor: 1 });   /* 228px is three times the 60 a phone paints it at */
  await pg.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>' +
    fs.readFileSync(SP + 'mobile.svg', 'utf8'), { waitUntil: 'load' });
  await pg.waitForTimeout(3000);
  /* AND EVERYTHING ELSE GOES FIRST. His badge is drawn ON the yellow banner
     with the green board behind it, so a clip of its box comes back with a
     stripe of each - the transparent ground is only transparent where nothing
     is painted. */
  const box = await pg.evaluate(() => {
    const im = [...document.querySelectorAll('svg > g > image')]
      .filter(e => { const r = e.getBoundingClientRect();
                     return r.width > 80 && r.top < 1200; })[0];
    if (!im) return null;
    document.querySelectorAll('svg > g').forEach(g => {
      [...g.children].forEach(c => { if (c !== im) c.style.display = 'none'; });
    });
    const r = im.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  await pg.waitForTimeout(400);
  if (!box) { console.log('shield not found'); await br.close(); return; }
  const out = path.join(__dirname, '..', 'assets', 'v2', 'mobile', 'shield-badge.png');
  await pg.screenshot({ path: out, clip: box, omitBackground: true });
  console.log('shield', Math.round(box.width) + 'x' + Math.round(box.height),
    (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
  await br.close();
})();

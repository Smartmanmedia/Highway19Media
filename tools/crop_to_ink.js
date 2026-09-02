#!/usr/bin/env node
/* Tighten an Illustrator SVG's viewBox to the artwork actually drawn in it.
 *
 * Several of the exports carry a huge mostly-empty canvas — Boat.svg is
 * 1220x385 for a boat about 60px across, sitting in one corner. Placing that
 * by its declared width puts the art nowhere near where you asked for it, and
 * every position becomes trial and error. Cropping to the ink makes each asset
 * mean what it looks like: its box IS its artwork.
 *
 * The bounding box is measured by the browser (getBBox), not guessed from the
 * path data, so strokes, transforms and nested groups are all accounted for.
 * Illustrator's invisible fill="none" registration rects are ignored — they
 * are the whole reason the canvas is oversized.
 *
 *   node tools/crop_to_ink.js assets/brand/scene/Boat.svg [more.svg ...]
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) { console.log('usage: node tools/crop_to_ink.js <file.svg> ...'); process.exit(1); }

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-proxy-server', '--ignore-certificate-errors', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 2600, height: 2000 } });

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    await page.setContent('<style>html,body{margin:0}svg{display:block}</style>' + src);
    await page.waitForTimeout(700);

    const box = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      /* fill="none" rects are Illustrator's artboard markers, not artwork */
      svg.querySelectorAll('rect[fill="none"]').forEach(r => r.remove());
      const b = svg.getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });

    const before = (src.match(/viewBox="([^"]*)"/) || [])[1];
    const pad = 1;                                   /* keeps antialiased edges */
    const vb = [box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2]
      .map(n => +n.toFixed(2));

    let out = src
      .replace(/(<svg\b[^>]*?)\sviewBox="[^"]*"/, '$1 viewBox="' + vb.join(' ') + '"')
      .replace(/(<svg\b[^>]*?)\swidth="[^"]*"/,  '$1 width="'  + vb[2] + '"')
      .replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, '$1 height="' + vb[3] + '"');
    /* drop the markers from the shipped file too, so nothing invisible
       stretches the box again later */
    out = out.replace(/<rect\b[^>]*\bfill="none"[^>]*\/>\s*/g, '');

    fs.writeFileSync(f, out);
    const wasted = before
      ? (1 - (box.w * box.h) / (parseFloat(before.split(/[\s,]+/)[2]) * parseFloat(before.split(/[\s,]+/)[3]))) * 100
      : 0;
    console.log('  ' + f.split('/').pop().padEnd(18) +
      before + '  ->  ' + vb.join(' ') +
      '   (' + wasted.toFixed(0) + '% of the canvas was empty)');
  }
  await browser.close();
})();

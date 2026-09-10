#!/usr/bin/env node
/* HIS LINE IN THE MIDDLE OF THE ROAD, REPLACED.
 *
 * The floating line halfway along the drive said "Highway 19 Media", which
 * names the company to somebody who has been reading its name since the first
 * screen. He has sent what it should say instead - MORE MILES / FOR YOUR /
 * BUDGET, with a line under it - drawn as MORE_MILES.svg.
 *
 * It is baked here rather than set in HTML for the same reason the boards are:
 * his file asks for three weights of his own typeface by their Illustrator
 * names, and only two of them are on the page. The fonts go in as base64 and
 * the whole thing is rendered once, so what the road carries is exactly the
 * file he drew.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'assets', 'v2', 'section-07');
const W = 433.66, H = 237.11, OUT_W = 1400;

const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString('base64');
const face = (name, weight, file) =>
  `@font-face{font-family:'${name}';font-weight:${weight};font-display:block;` +
  `src:url(data:font/woff2;base64,${b64('assets/fonts/' + file)}) format('woff2')}`;
/* the names Illustrator writes, not the ones a stylesheet would choose. He
 * asks for a SemiBold this project does not carry. Bold is the nearest of the
 * five it does by weight and the WRONG one by width: his strapline is set to
 * within twelve units of the right edge of his own artboard, and in Bold it
 * runs past it and loses "er." off the end. Medium fits, which on a line this
 * small is the difference that matters. */
const FONTS =
  face('BeVietnamPro-Black', 400, 'BeVietnamPro-Black.woff2') +
  face('BeVietnamPro-Medium', 400, 'BeVietnamPro-Medium.woff2') +
  face('BeVietnamPro-SemiBold', 400, 'BeVietnamPro-Medium.woff2') +
  face('Be Vietnam Pro', 500, 'BeVietnamPro-Medium.woff2') +
  face('Be Vietnam Pro', 600, 'BeVietnamPro-Medium.woff2') +
  face('Be Vietnam Pro', 800, 'BeVietnamPro-Black.woff2');

const body = fs.readFileSync(path.join(DIR, 'more-miles-src.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const ART =
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${FONTS}</style>${body}</svg>`;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p0 = await br.newPage({ viewport: { width: 900, height: 600 } });
  /* HIS BOX IS NOT HIS INK. The artboard is 433.66 across and his strapline
     is set to within twelve units of the right edge of it - in HIS SemiBold.
     In the nearest weight this project carries the same line runs past that
     edge and loses "er." off the end, and the empty third of the artboard to
     the right of MORE MILES pushes the whole block off centre besides. So the
     box is measured off the ink rather than taken on trust: whatever the type
     actually occupies, plus a two-unit margin, is what the road carries. */
  await p0.setContent('<body style="margin:0">' + ART + '</body>');
  await p0.evaluate(() => document.fonts.ready);
  await p0.waitForTimeout(400);
  const bb = await p0.evaluate(() => {
    const g = document.querySelector('svg > g') || document.querySelector('svg');
    const b = g.getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  await p0.close();
  const M = 2;
  const VX = +(bb.x - M).toFixed(2), VY = +(bb.y - M).toFixed(2);
  const VW = +(bb.w + M * 2).toFixed(2), VH = +(bb.h + M * 2).toFixed(2);
  console.log('ink ' + VW + ' x ' + VH + '  (his artboard was ' + W + ' x ' + H + ')');
  const OUT_H = Math.round(OUT_W * VH / VW);
  const p = await br.newPage({ viewport: { width: OUT_W, height: OUT_H } });
  await p.setContent('<body style="margin:0">' + ART
    .replace(`width="${W}" height="${H}"`, `width="${OUT_W}" height="${OUT_H}"`)
    .replace(`viewBox="0 0 ${W} ${H}"`, `viewBox="${VX} ${VY} ${VW} ${VH}"`) + '</body>');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  const png = await p.screenshot({ omitBackground: true });
  const webp = await p.evaluate(async ({ d }) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    c.getContext('2d').drawImage(i, 0, 0);
    return c.toDataURL('image/webp', 0.86).split(',')[1];
  }, { d: png.toString('base64') });
  fs.writeFileSync(path.join(DIR, 'more-miles.webp'), Buffer.from(webp, 'base64'));
  await p.close(); await br.close();
  console.log('more-miles.webp   ' + OUT_W + 'x' + OUT_H + '  ' +
    (fs.statSync(path.join(DIR, 'more-miles.webp')).size / 1024).toFixed(1) + 'K   aspect ' +
    (VW / VH).toFixed(4));
})();

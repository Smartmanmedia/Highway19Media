#!/usr/bin/env node
/* HIS BILLBOARD, BAKED - AND THE FACE IS NOW HIS OWN FILE.
 *
 * The SVG he sent carries the structure - the mast, the truss arm, the six
 * floodlights and the dark backing panel - but the face of it was a LINKED
 * raster,
 *
 *     <image ... xlink:href="C:\Users\Adam\Downloads\53fcf21f-....png"/>
 *
 * and a link to a folder on his machine does not travel with an SVG, so what
 * arrived was a board with nothing written on it. The face was set by hand
 * here for a few rounds while that file was found.
 *
 * It has been found: he put it in the repository as `Billboard ad@2x.png`,
 * 1728 x 723. His <image> was 1942 x 809 - the same shape to a tenth of a
 * per cent - so it drops into exactly the box and transform he drew it at,
 * and nothing is set by hand any more. The file is read from where he put it,
 * under the name he gave it, so there is one copy of it and not two.
 *
 * WEB WEIGHT. The two twins are written at quality 0.80 rather than 0.93 at
 * exactly the same 1500 x 1252: same pixels on screen, 53K a side instead of
 * 88K. Every asset on this page travels as a data URI and base64 adds a third
 * on top, so 70K off the pair is 94K off the page.
 *
 * Day and night twins both, because nothing inside an <img> can be recoloured
 * by CSS and the scene crossfades the two.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'assets', 'v2', 'section-07');
const OUT_W = 1500;
const Q = +(process.env.Q || 0.80);
const W = 1101.49, H = 919.66;              /* his board, whole, mast and all */
const FW = 1942, FH = 809;                  /* the box his face was drawn into */

const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString('base64');

/* HIS FACE. One element, at the size and place his own <image> had. */
const SRC = 'Billboard ad@2x.png';        /* his file, at the root, his name */
const FACE =
  `<image x="0" y="0" width="${FW}" height="${FH}" preserveAspectRatio="none"` +
  ` xlink:href="data:image/png;base64,${b64(SRC)}"/>`;

/* HIS FRAME.
 *
 * HIS SIX FLOODLIGHT CONES COME OFF. He drew one under each fitting as a
 * soft-light ellipse, which is right over the pale ground it was drawn
 * against and is a white blot over a navy face - six of them, straight across
 * the copy. And this board is an LED panel, which is not floodlit at all. */
const frame = fs.readFileSync(path.join(DIR, 'billboard-fixed.svg'), 'utf8')
  .replace('<g isolation="isolate">', '<g style="isolation:isolate">');
const CONES = /<ellipse[^>]*mix-blend-mode:soft-light[^>]*\/>/g;
const face  = `<g transform="translate(.08 34.32) scale(.44)">${FACE}</g>`;
const DAY   = frame.replace('<!-- his map raster, dead link, replaced below -->', face)
                   .replace(CONES, '');

/* AND THE SAME BOARD AFTER DARK - AN LED PANEL, which is a different thing
 * from a poster with lamps on it. A poster is lit FROM OUTSIDE, so at night
 * you dim the whole board and paint the lamplight back on; that is what put a
 * warm rectangle over his artwork and a halo round the outside of it.
 *
 * An LED board makes its own light. So the frame goes dark - it is metal at
 * night like every other mast in the scene - and the face is redrawn over the
 * top at full strength, untouched. Nothing is added around it: the light in
 * the picture is the light. */
const NIGHT = DAY.replace('</svg>',
  `<rect width="${W}" height="${H}" fill="#06122b" opacity=".58"/>${face}</svg>`);

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const OUT_H = Math.round(OUT_W * H / W);
  for (const [file, art] of [['billboard.webp', DAY], ['billboard-night.webp', NIGHT]]) {
    const p = await br.newPage({ viewport: { width: OUT_W, height: OUT_H } });
    await p.setContent('<body style="margin:0">' +
      art.replace(`width="${W}" height="${H}"`, `width="${OUT_W}" height="${OUT_H}"`) + '</body>');
    await p.waitForTimeout(700);
    const png = await p.screenshot({ omitBackground: true });
    const webp = await p.evaluate(async ({d, q}) => {
      const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      return c.toDataURL('image/webp', q).split(',')[1];
    }, {d: png.toString('base64'), q: Q});
    fs.writeFileSync(path.join(DIR, file), Buffer.from(webp, 'base64'));
    await p.close();
    console.log(file.padEnd(22) + OUT_W + 'x' + OUT_H + '  ' +
      (fs.statSync(path.join(DIR, file)).size / 1024).toFixed(1) + 'K');
  }
  await br.close();
  console.log('aspect ' + (W / H).toFixed(4));
})();

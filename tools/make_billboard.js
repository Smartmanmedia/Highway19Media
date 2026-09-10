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
const CONES = /<ellipse[^>]*mix-blend-mode:soft-light[^>]*\/>/g;
const frame = fs.readFileSync(path.join(DIR, 'billboard-fixed.svg'), 'utf8')
  .replace('<g isolation="isolate">', '<g style="isolation:isolate">')
  /* HIS THICKNESS LAYER, PUT BACK ON THE BOARD'S CORNERS.
   *
   * Behind the face he drew the board's edge - the dark shape that makes it
   * read as a panel with depth rather than a decal. Illustrator wrote it as a
   * self-crossing outline,
   *
   *   871.98 401.4  9.22 401.4  1.24 395.06  863.81 34.33  871.98 40.57
   *
   * and the long leg from the bottom-left corner to the top-right one is a
   * DIAGONAL. Filled non-zero, which is what a browser does with it, that is
   * not an edge at all: it is a triangle across the lower half of the board.
   * So the thickness sat under one corner and nowhere near the other three,
   * which is exactly what he is looking at.
   *
   * It is the rectangle it was always meant to be: top-left on the face's own
   * top-left, and 17.4 wide of it to the right and 11.1 below - his own two
   * offsets, kept. */
  .replace(/<polygon points="871\.98 401\.4[^"]*"\s*\/>/,
    '<rect x="0.08" y="34.32" width="871.90" height="367.08" fill="#0a1526"/>');
const face  = `<g transform="translate(.08 34.32) scale(.44)">${FACE}</g>`;
const DAY   = frame.replace('<!-- his map raster, dead link, replaced below -->', face)
                   .replace(CONES, '');

/* AND THE SAME BOARD AFTER DARK.
 *
 * TWO THINGS WERE WRONG WITH THE LAST ONE.
 *
 * The square. The frame was darkened by laying a flat rect over the WHOLE
 * 1101 x 920 box - and most of that box is empty. A rect does not care: it
 * filled every transparent pixel with dark blue, so the board arrived at night
 * inside a solid rectangle of sky that was not the sky. It is a FILTER now,
 * which multiplies the colour and leaves the alpha alone, so nothing that was
 * transparent stops being transparent.
 *
 * And his spotlights. He drew a cone under each of the six fittings and asked
 * where they had gone: they came off in both twins when the halo did, which
 * was one cut too many. They belong at night - that is the whole point of
 * them - so the night twin has them and the day twin does not, which is also
 * how a real board behaves.
 *
 * The face is still redrawn at full strength over the darkened frame: an LED
 * panel makes its own light, so the metalwork goes dark and the picture does
 * not. */
const cones = (frame.match(CONES) || []).join('');
const NIGHT = frame
  .replace('<!-- his map raster, dead link, replaced below -->', '')
  .replace(CONES, '')
  .replace(/(<svg[^>]*>)/, `$1<defs><filter id="dusk" color-interpolation-filters="sRGB">` +
    `<feColorMatrix type="matrix" values="` +
    `.34 0 0 0 .012   0 .34 0 0 .022   0 0 .38 0 .055   0 0 0 1 0"/></filter></defs>` +
    `<g filter="url(#dusk)">`)
  /* THE FACE, THEN HIS SIX CONES ON TOP OF IT. The order matters and it is
     not the order they are drawn in: his cones sit over the face, and the
     face is being redrawn after the frame to keep it out of the darkening -
     so drawn in place they would end up underneath it and invisible, which is
     what "where are my spot lights" was. Out of the filtered group, over the
     face, on the blend he gave them. */
  .replace('</svg>', `</g>${face}<g opacity=".42">${cones}</g></svg>`);

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

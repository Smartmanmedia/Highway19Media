#!/usr/bin/env node
/* HIS BILLBOARD, BAKED.
 *
 * The file he sent is the STRUCTURE - the mast, the truss arm, the six lamps
 * and their light, and the dark backing panel. The FACE of it is not in the
 * file: it is a linked raster,
 *
 *     <image ... xlink:href="C:\Users\Adam\Downloads\53fcf21f-....png"/>
 *
 * and a link to a folder on his machine does not travel with an SVG. So what
 * arrives is a board with nothing written on it.
 *
 * The face is therefore set here, the same way board three's three lines are:
 * his own typeface as base64, his own shield, his own colours, laid out to the
 * proportions of the render he sent. It drops out the moment the PNG lands -
 * one <image> back in place of one <g>.
 *
 * Day and night twins both, because nothing inside an <img> can be recoloured
 * by CSS and the scene crossfades the two.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'assets', 'v2', 'section-07');
const OUT_W = 1500;

const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString('base64');
const face = (name, weight, file) =>
  `@font-face{font-family:'${name}';font-weight:${weight};font-display:block;` +
  `src:url(data:font/woff2;base64,${b64('assets/fonts/' + file)}) format('woff2')}`;
const FONTS =
  face('BVP', 500, 'BeVietnamPro-Medium.woff2') +
  face('BVP', 800, 'BeVietnamPro-ExtraBold.woff2') +
  face('BVP', 900, 'BeVietnamPro-Black.woff2');

/* THE FACE, at the size of the raster it replaces: his <image> is 1942 x 809
 * placed at translate(.08 34.32) scale(.44), so anything drawn in that box
 * lands exactly where his artwork was meant to. */
const FW = 1942, FH = 809, L = 86;
const RED = '#d2232a', GOLD = '#ffc220';

/* one line of his kicker, tracked out to a width rather than to a letter
 * spacing - the width is what is readable off his render */
const T = (s, x, y, size, w, weight, fill, cls) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
  (cls ? ` class="${cls}"` : '') +
  ` textLength="${w}" lengthAdjust="spacing">${s}</text>`;
/* and one set in a width, glyphs and all - his two headline lines are
 * condensed, which is a width, not a tracking */
const TT = (s, x, y, size, w, weight, fill, cls) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}"` +
  (cls ? ` class="${cls}"` : '') +
  ` textLength="${w}" lengthAdjust="spacingAndGlyphs">${s}</text>`;

const FACE = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0d2b52"/><stop offset=".55" stop-color="#0a2246"/>
    <stop offset="1" stop-color="#061a38"/></linearGradient>
  <radialGradient id="glow" cx=".22" cy=".3" r=".8">
    <stop offset="0" stop-color="#1b4c86" stop-opacity=".55"/>
    <stop offset="1" stop-color="#1b4c86" stop-opacity="0"/></radialGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f4f6f8"/><stop offset=".48" stop-color="#ffffff"/>
    <stop offset=".52" stop-color="#cfd4d9"/><stop offset="1" stop-color="#eef1f4"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffd košík"/></linearGradient>
  <linearGradient id="road" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#3a3f45"/><stop offset="1" stop-color="#20252b"/></linearGradient>
</defs>
<style>${FONTS}
text{font-family:BVP,sans-serif;dominant-baseline:auto}
.sh{filter:drop-shadow(0 6px 0 rgba(0,0,0,.35))}
</style>
<rect width="${FW}" height="${FH}" fill="url(#bg)"/>
<rect width="${FW}" height="${FH}" fill="url(#glow)"/>

<!-- HIS ROAD, sweeping in from the bottom and away behind the shield -->
<path d="M1210 ${FH} C1400 ${FH - 40} 1570 ${FH - 178} 1652 ${FH - 350}
         L${FW} ${FH - 396} L${FW} ${FH} Z" fill="url(#road)"/>
<path d="M1300 ${FH} C1462 ${FH - 46} 1596 ${FH - 192} 1668 ${FH - 361}"
      fill="none" stroke="#4a5057" stroke-width="6" opacity=".75"/>
<path d="M1352 ${FH} C1500 ${FH - 47} 1622 ${FH - 189} 1688 ${FH - 347}"
      fill="none" stroke="${GOLD}" stroke-width="12"
      stroke-dasharray="42 38" stroke-linecap="butt"/>

<!-- HIS KICKER, a rule either side -->
<rect x="${L}" y="79" width="158" height="9" fill="${RED}"/>
${T('TAMPA BAY', 305, 111, 52, 495, 500, '#fff')}
<rect x="849" y="79" width="161" height="9" fill="${RED}"/>

<!-- AND HIS TWO LINES, at his widths: both are condensed, and a condensed
     face is a WIDTH, so each is set into the span it occupies on his render
     rather than to a letter spacing that would only be right at one size -->
${TT('ROAD MAP BUILT FOR', L, 268, 100, 963, 900, 'url(#silver)', 'sh')}
${TT('YOUR BUSINESS.', L, 462, 173, 1292, 900, GOLD, 'sh')}
${TT('25+ years of experience, put to work for your business.', L, 566, 44, 1292, 500, '#fff')}

<!-- HIS THREE WORDS, the rules between them his red -->
${T('STRATEGY', L, 723, 31, 224, 500, '#fff')}
<rect x="${L + 268}" y="694" width="5" height="38" fill="${RED}"/>
${T('CREATIVE', L + 317, 723, 31, 208, 500, '#fff')}
<rect x="${L + 569}" y="694" width="5" height="38" fill="${RED}"/>
${T('RESULTS', L + 618, 723, 31, 183, 500, '#fff')}

<!-- HIS SHIELD -->
<image x="1462" y="90" width="511" height="511"
       xlink:href="data:image/webp;base64,${b64('assets/v2/ui-shield.webp')}"/>
</svg>`.replace('<stop offset="0" stop-color="#ffd košík"/>', '<stop offset="0" stop-color="#ffd34d"/>');

/* HIS FRAME, with the face put back where the dead link was.
 *
 * AND HIS SIX FLOODLIGHTS ONLY BURN AFTER DARK. He drew a cone under each
 * fitting as a soft-light ellipse, which is right over the pale ground it was
 * drawn against and is a white blot over a navy face - six of them, one per
 * lamp, straight across the copy. A board's floodlights are not on at noon,
 * so the day twin has none and the night twin has them at a third. */
const frame = fs.readFileSync(path.join(DIR, 'billboard-fixed.svg'), 'utf8')
  .replace('<g isolation="isolate">', '<g style="isolation:isolate">');
const CONES = /<ellipse[^>]*mix-blend-mode:soft-light[^>]*\/>/g;
const inner = FACE.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const withFace = frame.replace('<!-- his map raster, dead link, replaced below -->',
  `<g transform="translate(.08 34.32) scale(.44)">${inner}</g>`);
const DAY = withFace.replace(CONES, '');

/* AND THE SAME BOARD AFTER DARK - AN LED PANEL, which is a different thing
 * from a poster with lamps on it. A poster is lit FROM OUTSIDE, so at night
 * you dim the whole board and paint the lamplight back on; that is what put a
 * warm rectangle over his artwork and a halo round the outside of it, which
 * is what he saw and did not want.
 *
 * An LED board makes its own light. So the frame goes dark - it is metal at
 * night like every other mast in the scene - and the FACE is redrawn over the
 * top at full strength, untouched. Nothing is added around it: the light in
 * the picture is the light. And the six floodlight cones come off entirely,
 * day and night, because a screen is not floodlit. */
const NIGHT = withFace.replace(CONES, '').replace('</svg>',
  `<rect width="1101.49" height="919.66" fill="#06122b" opacity=".58"/>` +
  `<g transform="translate(.08 34.32) scale(.44)">${inner}</g></svg>`);

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const W = 1101.49, H = 919.66, OUT_H = Math.round(OUT_W * H / W);
  fs.writeFileSync(path.join(DIR, 'billboard.svg'), DAY);
  for (const [file, art] of [['billboard.webp', DAY], ['billboard-night.webp', NIGHT]]) {
    const p = await br.newPage({ viewport: { width: OUT_W, height: OUT_H } });
    await p.setContent('<body style="margin:0">' +
      art.replace(`width="${W}" height="${H}"`, `width="${OUT_W}" height="${OUT_H}"`) + '</body>');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    const png = await p.screenshot({ omitBackground: true });
    const webp = await p.evaluate(async d => {
      const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      return c.toDataURL('image/webp', 0.92).split(',')[1];
    }, png.toString('base64'));
    fs.writeFileSync(path.join(DIR, file), Buffer.from(webp, 'base64'));
    await p.close();
    console.log(file.padEnd(22) + OUT_W + 'x' + OUT_H + '  ' +
      (fs.statSync(path.join(DIR, file)).size / 1024).toFixed(1) + 'K');
  }
  await br.close();
  console.log('aspect ' + (W / H).toFixed(4));
})();

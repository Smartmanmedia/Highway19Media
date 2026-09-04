#!/usr/bin/env node
/* HIS TWO GANTRY BOARDS, BAKED. Both are 940.5 x 295.5 with the same four
 * brackets, and both carry live <text> in his own typeface - which an <img>
 * cannot reach, because an image is its own document and the page's fonts are
 * not in it. So the fonts go in as base64 @font-face and the whole thing is
 * rendered to a bitmap here.
 *
 * Board 1 arrives finished: he set the wording, the shield and the lane
 * diagram himself. Board 3 he sent as the panel alone, so its three lines are
 * put back on in his sizes, read off his mock-up as fractions of the board so
 * they hold at any width the road draws it.
 *
 * Each board also gets a NIGHT twin: nothing inside an <img> can be recoloured
 * by CSS, so the dark green and the lit beams are a second bitmap that the
 * scene crossfades up after dark.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'assets', 'v2', 'section-05');
const W = 940.5, H = 295.5, OUT_W = 1800;
/* HIS NIGHT GREEN AND HIS NIGHT GOLD, the same two the site's night palette
 * uses. A board is one bitmap, so the night board is a second bitmap: nothing
 * inside an <img> can be recoloured by CSS. */
const NIGHT = { '#1c9022': '#0a3d1f', '#ffda00': '#e7aa28' };

const b64 = f => fs.readFileSync(path.join(ROOT, f)).toString('base64');
const face = (name, weight, file) =>
  `@font-face{font-family:'${name}';font-weight:${weight};font-display:block;` +
  `src:url(data:font/woff2;base64,${b64('assets/fonts/' + file)}) format('woff2')}`;

const bodyOf = f => fs.readFileSync(path.join(DIR, f), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/* HIS FAMILY NAMES, NOT MINE. Illustrator writes the face name first -
 * "BeVietnamPro-Black, 'Be Vietnam Pro'" - so the file is registered under
 * that exact name as well, or the first name in his list resolves to nothing
 * and the browser falls back to whatever serif it has to hand. */
const FONTS =
  face('BVP', 300, 'BeVietnamPro-Light.woff2') +
  face('BVP', 500, 'BeVietnamPro-Medium.woff2') +
  face('BVP', 900, 'BeVietnamPro-Black.woff2') +
  face('BeVietnamPro-Black', 400, 'BeVietnamPro-Black.woff2') +
  face('BeVietnamPro-Medium', 400, 'BeVietnamPro-Medium.woff2') +
  face('Be Vietnam Pro', 500, 'BeVietnamPro-Medium.woff2') +
  face('Be Vietnam Pro', 800, 'BeVietnamPro-Black.woff2');

/* HIS BOARD ONE, WHOLE. Nothing is added to it - the copy, the shield and the
 * lane diagram are all in the file he drew. */
const sign1 =
`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${FONTS}</style>
${bodyOf('sign-1-src.svg')}
</svg>`;

const body = bodyOf('sign-3-src.svg');
const sign3 =
`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>${FONTS}
text{font-family:BVP;fill:#fff}
.hd{font-size:64px;font-weight:900;letter-spacing:-.01em}
.lt{font-weight:300}
.sub{font-size:23px;font-weight:500}
</style>
${body}
<text class="hd" x="52" y="122">Your Success <tspan class="lt">Is</tspan></text>
<text class="hd" x="52" y="196"><tspan class="lt">Our </tspan>Destination.</text>
<rect x="243" y="215" width="182" height="3" fill="#fff"/>
<text class="sub" x="334" y="256" text-anchor="middle">We&#8217;re not here to sell you services you don&#8217;t need.</text>
<image x="590" y="72" width="152" height="152" xlink:href="data:image/webp;base64,${b64('assets/v2/ui-shield.webp')}"/>
</svg>`;

const BRACKETS = [116.8, 354.0, 605.4, 830.5];   /* his four, centred */
/* HIS SIGN LAMPS, DRAWN ON EACH BOARD'S OWN BRACKETS. The page hangs his
 * ui-sign-lights.svg over the home page's hero board and it lands right,
 * because that file was cut to the hero's 2.685 to one. These two boards are
 * 3.183, so stretched onto them the beams land between the brackets instead
 * of under them, and their fittings double up with the eight each board
 * already has drawn on it. So the light is drawn here instead, at the x of
 * each of HIS brackets. */
const BEAMS =
  `<defs><linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#fff" stop-opacity=".16"/>` +
  `<stop offset=".5" stop-color="#fff" stop-opacity=".09"/>` +
  `<stop offset="1" stop-color="#fff" stop-opacity=".04"/>` +
  `</linearGradient></defs>` +
  BRACKETS.map(cx =>
    `<path d="M${cx - 17} 7 H${cx + 17} L${cx + 93} ${H / 2} L${cx + 17} ${H - 7} ` +
    `H${cx - 17} L${cx - 93} ${H / 2} Z" fill="url(#beam)"/>`).join('');

const nightOf = svg => {
  let n = svg;
  for (const [d, x] of Object.entries(NIGHT)) n = n.split(d).join(x);
  return n.replace('</svg>', BEAMS + '</svg>');
};

const BOARDS = [['sign-1', sign1], ['sign-3', sign3]];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const OUT_H = Math.round(OUT_W * H / W);
  for (const [name, day] of BOARDS) {
    const night = nightOf(day);
    fs.writeFileSync(path.join(DIR, name + '.svg'), day);
    fs.writeFileSync(path.join(DIR, name + '-night.svg'), night);
    for (const [file, art] of [[name + '.webp', day], [name + '-night.webp', night]]) {
      const p = await br.newPage({ viewport: { width: OUT_W, height: OUT_H } });
      await p.setContent('<body style="margin:0">' + art.replace(`width="${W}" height="${H}"`,
        `width="${OUT_W}" height="${OUT_H}"`) + '</body>');
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      const png = await p.screenshot({ omitBackground: true });
      const webp = await p.evaluate(async d => {
        const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        c.getContext('2d').drawImage(i, 0, 0);
        return c.toDataURL('image/webp', 0.92).split(',')[1];
      }, png.toString('base64'));
      fs.writeFileSync(path.join(DIR, file), Buffer.from(webp, 'base64'));
      await p.close();
      console.log(file.padEnd(20) + OUT_W + 'x' + OUT_H + '  ' +
        (fs.statSync(path.join(DIR, file)).size / 1024).toFixed(1) + 'K');
    }
  }
  await br.close();
  console.log('aspect ' + (W / H).toFixed(3));
})();

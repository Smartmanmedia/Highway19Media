#!/usr/bin/env node
/* HIS THIRD BOARD. He sent the sign itself - the panel, its eight brackets,
 * the divider and the straight-ahead arrow - and set the wording, the shield
 * and the rule on top of it in the mock-up. This puts those three back on his
 * artwork in his own typeface and bakes the result, because an <img> cannot
 * reach the page's fonts and the board would otherwise come out in whatever
 * serif the browser had to hand. Sizes are read off his mock-up as fractions
 * of the board, so they hold at any width the road draws it.
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

const src = fs.readFileSync(path.join(DIR, 'sign-3-src.svg'), 'utf8');
const body = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const svg =
`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
${face('BVP', 300, 'BeVietnamPro-Light.woff2')}
${face('BVP', 500, 'BeVietnamPro-Medium.woff2')}
${face('BVP', 900, 'BeVietnamPro-Black.woff2')}
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

fs.writeFileSync(path.join(DIR, 'sign-3.svg'), svg);
let night = svg;
for (const [d, n] of Object.entries(NIGHT)) night = night.split(d).join(n);
fs.writeFileSync(path.join(DIR, 'sign-3-night.svg'), night);

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const OUT_H = Math.round(OUT_W * H / W);
  for (const [file, art] of [['sign-3.webp', svg], ['sign-3-night.webp', night]]) {
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
    console.log(file.padEnd(18) + OUT_W + 'x' + OUT_H + '  ' +
      (fs.statSync(path.join(DIR, file)).size / 1024).toFixed(1) + 'K');
  }
  await br.close();
  console.log('aspect ' + (W / H).toFixed(3));
})();

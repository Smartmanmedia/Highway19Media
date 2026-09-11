#!/usr/bin/env node
/* THE PICTURES A LINK SHOWS. Not part of the page - these are what Facebook,
 * iMessage and a browser tab render when the site is shared or bookmarked, and
 * a site without them shows a blank rectangle and a grey globe.
 *
 * Both are drawn here from his own parts - the shield, his lockup, his blue -
 * rather than cropped out of the page, because the page opens at night and a
 * screenshot of it is a black frame.
 *
 *   node tools/make_meta_art.js
 *     assets/v2/meta/og.jpg          1200x630, the share card
 *     assets/v2/meta/icon-180.png    home screen
 *     assets/v2/meta/icon-32.png     browser tab
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const ROOT = path.join(__dirname, '..');
const OUT  = path.join(ROOT, 'assets', 'v2', 'meta');
fs.mkdirSync(OUT, { recursive: true });

const b64 = p => fs.readFileSync(path.join(ROOT, p)).toString('base64');
const SHIELD = 'data:image/webp;base64,' + b64('assets/v2/ui-shield.webp');
const FONT   = 'data:font/woff2;base64,' + b64('assets/fonts/BeVietnamPro-Black.woff2');
const FONT6  = 'data:font/woff2;base64,' + b64('assets/fonts/BeVietnamPro-Bold.woff2');

const FACE = `@font-face{font-family:BV;font-weight:900;src:url(${FONT}) format('woff2')}
@font-face{font-family:BV;font-weight:700;src:url(${FONT6}) format('woff2')}`;

/* his header gradient, and his blue at the ends */
const BLUE = 'linear-gradient(115deg,#00287d 0%,#0459bd 46%,#02459e 68%,#002d76 100%)';

const card = `<style>${FACE}
html,body{margin:0}
body{width:1200px;height:630px;background:${BLUE};font-family:BV,sans-serif;
  display:flex;align-items:center;gap:66px;padding:0 92px;box-sizing:border-box;color:#fff;
  position:relative;overflow:hidden}
/* the sweep of light his sky has, so the card is not a flat rectangle */
body:before{content:"";position:absolute;inset:-40%;
  background:radial-gradient(46% 60% at 18% 8%,rgba(120,205,255,.30),rgba(120,205,255,0) 70%)}
/* and his yellow edge along the bottom, the way a sign is bound */
body:after{content:"";position:absolute;left:0;right:0;bottom:0;height:12px;background:#ffde17}
img{width:228px;position:relative;filter:drop-shadow(0 14px 30px rgba(0,10,40,.45))}
.txt{position:relative}
h1{margin:0;font-size:67px;line-height:.96;letter-spacing:-.01em;font-weight:900}
h1 i{font-style:normal;color:#29abe2;font-size:79px;margin:0 .06em}
.rule{width:356px;height:5px;background:#29abe2;margin:22px 0 19px}
p{margin:0;font-size:22px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
  color:rgba(255,255,255,.94)}
</style>
<img src="${SHIELD}" alt="">
<div class="txt">
  <h1>HIGHWAY<i>19</i>MEDIA</h1>
  <div class="rule"></div>
  <p>Creative Marketing for Tampa&nbsp;Bay Businesses</p>
</div>`;

/* THE TAB ICON IS NOT THE CARD SHRUNK. At 32 pixels the lockup is four grey
   rows; only the shield survives, so the icon is the shield and nothing else,
   on his blue, with the corners a touch rounded the way iOS masks it anyway. */
const icon = `<style>html,body{margin:0}
body{width:100vw;height:100vh;background:${BLUE};display:flex;align-items:center;
  justify-content:center;box-sizing:border-box}
img{height:76%;filter:drop-shadow(0 3% 5% rgba(0,8,30,.45))}</style>
<img src="${SHIELD}" alt="">`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async (html, w, h, file) => {
    const page = await browser.newPage({ viewport: { width: w, height: h },
                                         deviceScaleFactor: 1 });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, file),
      ...(/\.jpg$/.test(file) ? { type: 'jpeg', quality: 88 } : {}) });
    await page.close();
    console.log(file + '  ' + Math.round(fs.statSync(path.join(OUT, file)).size / 1024) + ' KB');
  };
  /* jpeg for the card: it is a photograph of a gradient, and a scraper pulls
     it over a phone connection. 410 KB of PNG buys nothing over 60 of jpeg. */
  await shot(card, 1200, 630, 'og.jpg');
  /* the icons stay PNG - flat colour, and 32px of jpeg would ring */
  await shot(icon, 180, 180, 'icon-180.png');
  await shot(icon,  32,  32, 'icon-32.png');
  await browser.close();
})();

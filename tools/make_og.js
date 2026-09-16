#!/usr/bin/env node
/* THE SHARE CARD, DRAWN SO A SQUARE CROP STILL READS.
 *
 * Facebook and LinkedIn show an og:image at its full 1200x630. WhatsApp,
 * iMessage and Slack crop it to a SQUARE - and a square cut from 1200x630 is
 * the full height and the middle 630 wide. The old card ran the shield and
 * the wordmark across the full width, so that crop sliced the wordmark in
 * half and the preview read "HIGHWAY19 ME".
 *
 * Nothing about the vertical needs protecting; only the horizontal does. So
 * the lockup is centred and kept inside a 560px column - comfortably inside
 * the 630 a square crop keeps - and the card reads whole either way.
 *
 *   node tools/make_og.js      ->  assets/v2/meta/og.jpg  (1200x630)
 *                                  assets/v2/meta/og-square.jpg (630x630, proof)
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const b64 = p => fs.readFileSync(path.join(ROOT, p)).toString('base64');

const FONT = f => `@font-face{font-family:"Be Vietnam Pro";font-weight:${f.w};
  src:url(data:font/woff2;base64,${b64('assets/fonts/BeVietnamPro-' + f.n + '.woff2')}) format("woff2")}`;

const html = `<!doctype html><meta charset="utf-8"><style>
${[{n:'Medium',w:500},{n:'Bold',w:700},{n:'ExtraBold',w:800}].map(FONT).join('\n')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;
  font-family:"Be Vietnam Pro",sans-serif;
  background:
    radial-gradient(120% 90% at 50% 8%, #1f6dc4 0%, #135aa8 45%, #0b3f7d 100%);
  display:flex;align-items:center;justify-content:center}
/* THE SAFE COLUMN. 560 < 630, so everything here survives the square crop. */
.lock{width:560px;display:flex;flex-direction:column;align-items:center;
  text-align:center;padding-bottom:26px}
.shield{width:196px;height:auto;display:block;
  filter:drop-shadow(0 10px 22px rgba(0,0,0,.34))}
.word{margin-top:26px;font-weight:800;font-size:56px;line-height:1;
  letter-spacing:-.005em;color:#fff;white-space:nowrap;
  text-shadow:0 2px 10px rgba(0,0,0,.22)}
.word i{font-style:normal;color:#4cc3f5}
.rule{width:100%;height:3px;margin:20px 0 18px;border-radius:2px;
  background:linear-gradient(90deg,rgba(255,255,255,0) 0,#7fd0f7 18%,#7fd0f7 82%,rgba(255,255,255,0) 100%)}
.tag{font-weight:500;font-size:20px;line-height:1.45;letter-spacing:.085em;
  color:#dbeaff;text-transform:uppercase}
.bar{position:absolute;left:0;right:0;bottom:0;height:12px;background:#ffc20e}
</style>
<div class="lock">
  <img class="shield" src="data:image/png;base64,${b64('assets/brand/shield.png')}" alt="">
  <div class="word">HIGHWAY <i>19</i> MEDIA</div>
  <div class="rule"></div>
  <div class="tag">Creative marketing<br>for Tampa Bay businesses</div>
</div>
<div class="bar"></div>`;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);

  const out = path.join(ROOT, 'assets/v2/meta');
  await p.screenshot({ path: path.join(out, 'og.jpg'), type: 'jpeg', quality: 92 });
  /* the same card as a messaging app cuts it - written out so the crop is
     something that can be looked at rather than assumed */
  await p.screenshot({ path: path.join(out, 'og-square.jpg'), type: 'jpeg',
                       quality: 92, clip: { x: 285, y: 0, width: 630, height: 630 } });

  /* AND THE WORDMARK MUST NOT TOUCH THE CROP EDGE. A nowrap headline that
     outgrows its column does not wrap, it overflows - and the overflow is
     exactly what the square crop would cut. So it is measured, not trusted. */
  const w = await p.evaluate(() => document.querySelector('.word').scrollWidth);
  if (w > 560) { console.error('wordmark ' + w + 'px overflows the 560px safe column'); process.exit(1); }
  console.log('og.jpg 1200x630 + og-square.jpg 630x630   wordmark ' + w + 'px of 560 safe');
  await br.close();
})();

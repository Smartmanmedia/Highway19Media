#!/usr/bin/env node
/* THE PICTURE A CARD SHOWS WHEN SOMEBODY SHARES IT.
 *
 *   CHROME_PATH=/path/to/chrome node tools/card/make_share.js <slug>
 *   CHROME_PATH=... node tools/card/make_share.js --all
 *
 * WhatsApp, Messenger, iMessage, Facebook and the rest do not open the card -
 * they read its <head> and draw og:image. Every card was handing them the
 * site's own share picture, so a plumber's card forwarded to a customer
 * arrived wearing the Highway 19 shield. A card is somebody else's business;
 * what it sends ahead of itself has to be theirs.
 *
 * This writes cards/<slug>/art/share-1200.jpg - 1200x630, the size every one
 * of those apps crops from - out of what the card already has: the logo at
 * art.icon.src, the colours in theme, the tagline in identity. Nothing new to
 * draw and nothing to keep in step by hand.
 *
 * A dev tool, like make_art.js: the output is committed to cards/<slug>/art/
 * and tools/card/build.js only copies it. It needs Chromium rather than
 * sharp, because it is setting type rather than cutting a picture.
 *
 * A card that wants something else - a photograph, a poster - puts its own
 * absolute URL in card.json as "og" and that wins; see build.js.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');

const W = 1200, H = 630;
const FONT = 'bvp-600.woff2';            /* the site's own semibold */

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dataUri = (p, mime) =>
  'data:' + mime + ';base64,' + fs.readFileSync(p).toString('base64');
const mimeOf = p => ({ '.webp': 'image/webp', '.png': 'image/png',
                       '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                       '.svg': 'image/svg+xml' })[path.extname(p).toLowerCase()];

function page(card) {
  const id = card.identity || {}, theme = card.theme || {};
  const icon = (card.art || {}).icon || {};
  /* HIS OWN COLOUR, NOT THE ICON'S. make_art.js bakes the home-screen icon
     onto art.icon.bg, which is not always the card's background - Highway
     19's icon sits on #111214 and its card on navy. The logo goes on here
     with its transparency intact, over the card's colour, so the picture is
     the card's and not a square of something else. */
  const bg = theme.bg || icon.bg || '#000';
  const accent = theme.accent || '#fff';

  /* A CARD WITH ITS OWN LOCKUP (art.share: the logo with its name, as the
     business's designer set it) sends that and nothing else - no tagline,
     no city, nothing in our typeface standing next to theirs. */
  const lock = (card.art || {}).share && path.join(ROOT, card.art.share);
  if (lock && fs.existsSync(lock)) return `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0}
html,body{width:${W}px;height:${H}px}
body{background:${bg};display:grid;place-items:center}
img{height:${Math.round(H * 0.8)}px;width:auto;display:block}
</style><img src="${dataUri(lock, mimeOf(lock))}" alt="">`;

  const src = icon.src && path.join(ROOT, icon.src);
  const logo = src && fs.existsSync(src) ? dataUri(src, mimeOf(src)) : null;

  const fontFile = path.join(ROOT, 'assets', 'fonts', FONT);
  const font = fs.existsSync(fontFile) ? dataUri(fontFile, 'font/woff2') : null;

  /* the name is only drawn where the logo is not carrying it */
  const name = logo ? '' : esc(id.business || '');

  return `<!doctype html><meta charset="utf-8"><style>
${font ? `@font-face{font-family:'BVP';src:url(${font}) format('woff2');font-weight:600;font-display:block}` : ''}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{background:${bg};display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:34px;padding:56px 80px;
  font-family:'BVP',system-ui,sans-serif;font-weight:600;text-align:center;
  -webkit-font-smoothing:antialiased}
img{height:300px;width:auto;max-width:720px;object-fit:contain;display:block}
h1{font-size:72px;line-height:1.1;color:#fff;letter-spacing:-.01em}
p.tag{font-size:40px;line-height:1.25;color:${accent}}
p.area{font-size:26px;line-height:1.3;color:rgba(255,255,255,.62)}
</style>
${logo ? `<img src="${logo}" alt="">` : ''}
${name ? `<h1>${name}</h1>` : ''}
${id.tagline ? `<p class="tag">${esc(id.tagline)}</p>` : ''}
${id.area ? `<p class="area">${esc(id.area)}</p>` : ''}`;
}

(async () => {
  const args = process.argv.slice(2);
  const slugs = args[0] === '--all'
    ? fs.readdirSync(path.join(ROOT, 'cards'))
        .filter(d => fs.existsSync(path.join(ROOT, 'cards', d, 'card.json')))
    : args;
  if (!slugs.length) {
    console.error('usage: make_share.js <slug> [slug...]   |   --all');
    process.exit(1);
  }

  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  for (const slug of slugs) {
    const dir = path.join(ROOT, 'cards', slug);
    const card = JSON.parse(fs.readFileSync(path.join(dir, 'card.json'), 'utf8'));
    await p.setContent(page(card), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    const out = path.join(dir, 'art', 'share-1200.jpg');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log('  ' + path.relative(ROOT, out) + '  ' + W + 'x' + H + '  ' +
                Math.round(fs.statSync(out).size / 1024) + ' KB');
  }
  await b.close();
})();

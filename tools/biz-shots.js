#!/usr/bin/env node
/* THE EXAMPLES ON /highway-biz/, PHOTOGRAPHED FROM THE REAL CARDS.
 *
 *   CHROME_PATH=/path/to/chrome node tools/biz-shots.js
 *
 * The page sells a card by describing it, which is the weakest way to sell
 * anything. These are the actual cards, shot on a phone-sized window, so the
 * thing being sold is on the page being sold from.
 *
 * A dev tool like tools/card/make_art.js: the output is committed to
 * assets/v2/biz/ and the build only copies it. Each file carries a version in
 * its name - /assets is served immutable for a year, so a regenerated shot
 * under the same name would never reach anyone who had seen the old one.
 * Bump the -vN when a card is redesigned.
 *
 * It wants the built site on http://127.0.0.1:8783 (serve dist/site). A card
 * that lives on somebody else's site carries its own absolute url instead -
 * serve that site too and point BIZ_AAM at it.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.BIZ_BASE || 'http://127.0.0.1:8783';
const OUT = path.join(ROOT, 'assets', 'v2', 'biz');

/* phone-shaped, and tall enough to carry the name, the buttons and the start
   of what is under them - which is what a reader is trying to see */
const W = 390, H = 720;

const SHOTS = [
  { file: 'card-carpenterrick-v1.jpg',    path: '/community/carpenterrick/bc/' },
  { file: 'card-hwy19-v1.jpg',            path: '/hwy19/adambc/' },
  /* HIS MUSIC CARD IS NOT ON THIS SITE. It is adamayashmusic.com's own
     /nfc, built in Webflow and living in the -adamayashmusic-site repo -
     the same offer, a different host. Serve that repo and set BIZ_AAM to
     it to re-shoot. Its headline face ships with it; Exo, its body face,
     comes from Google, so a shot taken without that reachable falls back. */
  { file: 'card-adamayashmusic-v1.jpg', url: (process.env.BIZ_AAM || '') + '/nfc.html' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  for (const s of SHOTS) {
    const p = await b.newPage({
      viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
                 '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const at = s.url || (BASE + s.path);
    if (s.url && !process.env.BIZ_AAM) {
      console.log('  (skipped ' + s.file + ' - set BIZ_AAM to the site serving it)');
      await p.close(); continue;
    }
    await p.goto(at, { waitUntil: 'load' });
    /* HIS INTRO PLAYS FIRST. It is the right thing on a phone and the wrong
       thing in a photograph - a reader wants the card, not its curtain. */
    await p.waitForTimeout(5200);
    await p.evaluate(() => {
      document.querySelectorAll('.intro, #intro, .consent, #h19-consent').forEach(e => e.remove());
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(900);
    const out = path.join(OUT, s.file);
    await p.screenshot({ path: out, type: 'jpeg', quality: 84 });
    console.log('  ' + path.relative(ROOT, out) + '  ' + W + 'x' + H + '@2  ' +
                Math.round(fs.statSync(out).size / 1024) + ' KB');
    await p.close();
  }
  await b.close();
})();

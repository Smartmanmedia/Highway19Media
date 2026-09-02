#!/usr/bin/env node
/* Pull pieces straight out of the owner's composed Highway_19_Website.svg.
 *
 * The composed file is code, so anything in it can be lifted without asking
 * for another export. Two things come out here:
 *
 *   Road.svg   every road tile, found by geometry rather than by name — the
 *              straights and curves are a fixed set of sizes, and a couple of
 *              them were never named in Illustrator.
 *   OurSign.svg  the green plate with its <text> removed. The words are set in
 *              HighwayGothicExpanded, which nobody outside the owner's machine
 *              has, so they render as a serif everywhere else. Real HTML text
 *              goes over the plate instead — readable, selectable, and findable
 *              by search engines, which a picture of a headline never is.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const ROOT = __dirname + '/..';

/* w x h of a straight, a straight turned sideways, and the two curve turns */
const TILE = [[106,361],[361,106],[445,471],[471,445]];
const near = (a,b,t=3) => Math.abs(a-b) <= t;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.setContent('<style>html,body{margin:0}svg{display:block;width:2472px}</style>' +
    fs.readFileSync(ROOT + '/incoming/Website.svg', 'utf8'));
  await page.waitForTimeout(5000);

  const out = await page.evaluate((TILE) => {
    const near = (a,b,t=3) => Math.abs(a-b) <= t;
    const root = document.getElementById('Layer_1');
    const NS = 'http://www.w3.org/2000/svg';

    /* --- road: every child whose box is one of the tile sizes --- */
    const tiles = [], boxes = [];
    [...root.children].forEach(el => {
      let b; try { b = el.getBBox(); } catch (e) { return; }
      if (!b || !b.width) return;
      if (!TILE.some(([w,h]) => near(b.width,w) && near(b.height,h))) return;
      tiles.push(el.outerHTML);
      boxes.push({ id: el.getAttribute('id') || '(unnamed)',
                   x:+b.x.toFixed(1), y:+b.y.toFixed(1),
                   w:+b.width.toFixed(1), h:+b.height.toFixed(1) });
    });
    const bx = Math.min(...boxes.map(b=>b.x)), by = Math.min(...boxes.map(b=>b.y));
    const bw = Math.max(...boxes.map(b=>b.x+b.w)) - bx;
    const bh = Math.max(...boxes.map(b=>b.y+b.h)) - by;

    /* --- the sign, minus its text --- */
    const sign = [...root.children].find(el => {
      let b; try { b = el.getBBox(); } catch(e){ return false; }
      return b && near(b.width, 1248, 6) && near(b.height, 332, 6);
    });
    let signHTML = null, signBox = null, dropped = 0;
    if (sign) {
      const c = sign.cloneNode(true);
      c.querySelectorAll('text').forEach(t => { t.remove(); dropped++; });
      signHTML = c.outerHTML;
      const b = sign.getBBox();
      signBox = { x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) };
    }

    /* gradients and clips the lifted markup still points at */
    const defs = document.querySelector('svg defs');
    return { tiles, boxes, road: { x:+bx.toFixed(1), y:+by.toFixed(1), w:+bw.toFixed(1), h:+bh.toFixed(1) },
             signHTML, signBox, dropped, defs: defs ? defs.outerHTML : '' };
  }, TILE);

  const wrap = (body, box, defs) =>
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
    'width="' + box.w + '" height="' + box.h + '" ' +
    'viewBox="' + box.x + ' ' + box.y + ' ' + box.w + ' ' + box.h + '">\n' +
    defs + '\n' + body + '\n</svg>\n';

  fs.writeFileSync(ROOT + '/assets/brand/scene/Road.svg',
    wrap(out.tiles.join('\n'), out.road, out.defs));
  console.log('Road.svg — ' + out.tiles.length + ' tiles, ' +
    out.road.w + ' x ' + out.road.h + ' at ' + out.road.x + ',' + out.road.y);
  out.boxes.forEach(b => console.log('   ' + b.id.padEnd(13) +
    'x' + String(b.x).padStart(7) + '  y' + String(b.y).padStart(7) + '   ' + b.w + ' x ' + b.h));

  if (out.signHTML) {
    fs.writeFileSync(ROOT + '/assets/brand/scene/OurSign.svg',
      wrap(out.signHTML, out.signBox, out.defs));
    console.log('\nOurSign.svg — ' + out.dropped + ' text blocks removed, ' +
      out.signBox.w + ' x ' + out.signBox.h);
  } else console.log('\nsign not found by geometry');

  await browser.close();
})();

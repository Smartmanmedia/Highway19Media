#!/usr/bin/env node
/* HIS MOBILE ARTBOARD, CUT INTO THE PIECES THE PAGE NEEDS.
 *
 * Highway_19_Website_MobileArtboard_8 is one 1080 x 11292.8 drawing with every
 * mobile section in it. Illustrator's layer names do not survive as a usable
 * tree - almost everything is a flat list of children under one group called
 * "Clouds" - so the pieces are cut by WHERE THEY ARE rather than by what they
 * are called: a band of the artboard, and every child whose box falls inside
 * it. That is exactly how a person would cut them, and it does not depend on
 * a naming convention he never promised.
 *
 * Each piece comes out as a standalone SVG with its own viewBox and its own
 * defs, ready to be inlined - inlined and not <img>, so his Be Vietnam Pro
 * reaches the type inside it.
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] ||
  '/tmp/claude-0/-home-user-storyboard-app/1a554a96-134b-52ef-894a-d9448b97add1/scratchpad/mobile.svg';
const OUT = path.join(__dirname, '..', 'assets', 'v2', 'mobile');

/* name: [top, bottom] in artboard units, and optionally [left, right] */
/* ONLY ONE PIECE IS ACTUALLY NEW. Everything else in his mobile drawing - the
   motorway shield, the Your Road Map button, both warning triangles, the green
   Our Sign, the Explore button, the beach, the desert, the forest, the rocks -
   is already on the page from the desktop build, drawn once and themed for
   night. Cutting a second copy out of the artboard would be two of everything
   to keep in step. The stacked hero board is the exception: it is a shape he
   has not drawn before, four rows deep instead of one across.

   NO TEXT COMES WITH IT. His labels are set as SVG <text>, which cannot wrap,
   cannot be selected and does not answer to the page's own type scale - and
   readable type on a phone was the whole brief. The board comes out as
   artwork and the four labels go over it as HTML. */
const CUTS = {
  /* NO RASTER SHIELD AND NO GANTRY EITHER. His badge is a 206KB embedded PNG
     in this file and the truss beside it is 54KB of clipped paths - and the
     page already carries both, drawn as vector and themed for night. Anything
     reaching past x 1000 is the gantry; the board, its banner, its three
     dividers, its four arrows and its brackets all end before it. What comes
     out is 10KB instead of 271. */
  'hero-board': { y: [400, 1570], drop: ['text', 'image'], maxRight: 1000 }
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const br = await chromium.launch();
  const pg = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await pg.setContent('<style>body{margin:0}</style>' + fs.readFileSync(SRC, 'utf8'),
                      { waitUntil: 'load' });
  await pg.waitForTimeout(3000);
  for (const [name, cut] of Object.entries(CUTS)) {
    const out = await pg.evaluate(([cut]) => {
      const NS = 'http://www.w3.org/2000/svg';
      const root = document.querySelector('svg');
      const defs = root.querySelector('defs');
      const keep = [];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      /* THE BOX HAS TO BE THE ONE ON THE PAGE, not the one in the element's own
         coordinates. getBBox() ignores the element's transform, and every
         <text> in his artboard is placed by one - so a label sitting at y 900
         reports y -58 and falls outside every band it belongs to. That is why
         the first cut of the hero sign came out with no words on it. Reading
         the screen rectangle and taking it back through the root's own matrix
         gives the position in ARTBOARD units, which is what the bands are in. */
      const inv = root.getScreenCTM().inverse();
      const toArt = r => {
        const p = root.createSVGPoint();
        p.x = r.left; p.y = r.top; const a = p.matrixTransform(inv);
        p.x = r.right; p.y = r.bottom; const b = p.matrixTransform(inv);
        return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
      };
      root.querySelectorAll('svg > g').forEach(top => {
        [...top.children].forEach(c => {
          let b; try { b = toArt(c.getBoundingClientRect()); } catch (e) { return; }
          if (!(b.width > 0 && b.height > 0)) return;
          const mid = b.y + b.height / 2;
          if (mid < cut.y[0] || mid > cut.y[1]) return;
          if (cut.drop && cut.drop.includes(c.tagName.toLowerCase())) return;
          if (cut.maxRight && b.x + b.width > cut.maxRight) return;
          if (cut.x && (b.x + b.width / 2 < cut.x[0] || b.x + b.width / 2 > cut.x[1])) return;
          keep.push(c.outerHTML);
          x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width);
          y0 = Math.min(y0, b.y); y1 = Math.max(y1, b.y + b.height);
        });
      });
      if (!keep.length) return null;
      const pad = 1;
      const vb = [x0 - pad, y0 - pad, (x1 - x0) + pad * 2, (y1 - y0) + pad * 2]
        .map(v => +v.toFixed(2));
      return { defs: defs ? defs.outerHTML : '', body: keep.join('\n'), vb };
    }, [cut]);
    if (!out) { console.log(name.padEnd(14), 'NOTHING FOUND'); continue; }
    /* AND THE DEFS ONLY IF ANYTHING ASKS FOR THEM. His artboard's <defs> is
       every gradient and clip path in the whole 11,000-unit drawing, half the
       weight of a piece that uses none of them - and it would carry ids like
       "linear-gradient" and "clippath-8" into a page that has its own. */
    const uses = /url\(#/.test(out.body);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" ' +
      'xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + out.vb.join(' ') + '" ' +
      'width="' + out.vb[2] + '" height="' + out.vb[3] + '">\n' +
      (uses ? out.defs + '\n' : '') + out.body + '\n</svg>\n';
    fs.writeFileSync(path.join(OUT, name + '.svg'), svg);
    console.log(name.padEnd(14), out.vb[2].toFixed(0) + ' x ' + out.vb[3].toFixed(0),
      ' ', (svg.length / 1024).toFixed(0) + 'KB');
  }
  await br.close();
})();

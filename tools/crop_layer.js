#!/usr/bin/env node
/* CROP ONE OF HIS LAYERS TO THE PAGE COLUMN, AND DROP WHAT FALLS OUTSIDE.
 *
 * His full-width layers carry a second copy of themselves off to the side for
 * tiling. Setting the viewBox hides it, but every shape is still in the
 * document and still parsed and still shipped - a third of the file drawing
 * something nobody can see. This sets the viewBox AND removes the shapes that
 * lie wholly outside it, measured by their real bounding boxes rather than by
 * reading coordinates out of the path data.
 *
 *   node tools/crop_layer.js in.svg out.svg "x y w h"
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const [inF, outF, vb] = process.argv.slice(2);
const [X, Y, WI, HI] = vb.split(/\s+/).map(Number);
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage();
  await p.setContent('<body></body>');
  const src = fs.readFileSync(inF, 'utf8').replace(/<\?xml[^>]*\?>/, '');
  const r = await p.evaluate(([s, X, Y, WI, HI]) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = s; document.body.appendChild(d);
    const svg = d.querySelector('svg');
    const all = [...svg.querySelectorAll('path,polygon,rect,circle,ellipse,polyline')];
    let cut = 0;
    for (const e of all) {
      let b; try { b = e.getBBox() } catch (_) { continue }
      if (b.x > X + WI || b.x + b.width < X || b.y > Y + HI || b.y + b.height < Y) {
        e.remove(); cut++;
      }
    }
    /* a group left with nothing in it is just noise */
    let g; do { g = [...svg.querySelectorAll('g')].filter(n => !n.childElementCount);
      g.forEach(n => n.remove()) } while (g.length);
    svg.setAttribute('viewBox', X + ' ' + Y + ' ' + WI + ' ' + HI);
    svg.setAttribute('width', WI); svg.setAttribute('height', HI);
    /* his C2PA metadata block is 30KB of provenance nobody renders */
    svg.querySelectorAll('metadata').forEach(n => n.remove());
    const out = svg.outerHTML;
    d.remove();
    return { out, cut, kept: all.length - cut };
  }, [src, X, Y, WI, HI]);
  fs.writeFileSync(outF, r.out.replace(/\s*\n\s*/g, '') + '\n');
  console.log(outF.split('/').pop() + ': kept ' + r.kept + ' shapes, dropped ' +
    r.cut + ' outside the crop   ' +
    (fs.statSync(inF).size / 1024).toFixed(0) + 'KB -> ' +
    (fs.statSync(outF).size / 1024).toFixed(0) + 'KB');
  await br.close();
})();

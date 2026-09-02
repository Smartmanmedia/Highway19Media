#!/usr/bin/env node
/* Cut his road out tile by tile, and record how each one may be resized.
 *
 * His road is drawn as a tile set — straights and quarter-turn curves — which
 * is exactly what makes it survivable on a page twice the height of his
 * canvas. A straight can be stretched along its own axis and nobody can tell.
 * A curve cannot: stretch it and the radius goes oval. So each tile is
 * extracted with a rule for how it is allowed to grow, and the road is re-laid
 * rather than scaled.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = ROOT + '/assets/scene/road/';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:2472, height:900 } });
  await page.setContent('<style>html,body{margin:0}svg{display:block}</style>' +
    fs.readFileSync(ROOT + '/incoming/Website2.svg','utf8'));
  await page.waitForTimeout(6000);

  const res = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    /* Illustrator puts the layer name on data-name OR id depending on export;
       "Roads" comes through as an id here while its tiles use data-name. */
    const roads = [...svg.querySelectorAll('g')].find(g =>
      (g.getAttribute('data-name') || g.getAttribute('id')) === 'Roads');
    if (!roads) return { err: 'no Roads group; groups seen: ' +
      [...svg.querySelectorAll('g')].slice(0,12)
        .map(g => g.getAttribute('data-name') || g.getAttribute('id') || '?').join(', ') };
    const defs = svg.querySelector('defs');
    const out = [];
    let i = 0;
    const sel = 'g[data-name="Stright"],g[data-name="Curve"],g[id^="Stright"],g[id^="Curve"]';
    roads.querySelectorAll(sel).forEach(t => {
      const b = t.getBBox();
      if (!b.width) return;
      const nm = t.getAttribute('data-name') || t.getAttribute('id') || '';
      const kind = /^Curve/.test(nm) ? 'curve'
                 : (b.width > b.height ? 'straight-h' : 'straight-v');
      out.push({
        id: 'tile' + (i++), kind,
        x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2),
        svg: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
             'width="' + b.width.toFixed(2) + '" height="' + b.height.toFixed(2) + '" ' +
             'viewBox="' + [b.x,b.y,b.width,b.height].map(n=>n.toFixed(2)).join(' ') + '" ' +
             'preserveAspectRatio="none">' + (defs?defs.outerHTML:'') + t.outerHTML + '</svg>'
      });
    });
    return { tiles: out };
  });
  await browser.close();
  if (res.err) { console.log(res.err); process.exit(1); }
  const tiles = res.tiles;

  tiles.forEach(t => {
    /* ids are shared across every tile — they all carry the same <defs> */
    let s = t.svg;
    const ids = new Set([...s.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    [...ids].sort((a,b) => b.length - a.length).forEach(id => {
      const q = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp('\\bid="' + q + '"','g'), 'id="' + t.id + '-' + id + '"')
           .replace(new RegExp('url\\(#' + q + '\\)','g'), 'url(#' + t.id + '-' + id + ')')
           .replace(new RegExp('(\\b(?:xlink:)?href=")#' + q + '"','g'), '$1#' + t.id + '-' + id + '"');
    });
    s = s.replace(/\smix-blend-mode="([a-z-]+)"/g, ' style="mix-blend-mode:$1"');
    t.svg = s;
    fs.writeFileSync(OUT + t.id + '.svg', s);
  });

  const manifest = tiles.map(({ id, kind, x, y, w, h }) => ({ id, kind, x, y, w, h }));
  fs.writeFileSync(ROOT + '/tools/road-tiles.json', JSON.stringify(manifest, null, 2));

  const by = k => manifest.filter(t => t.kind === k).length;
  console.log(manifest.length + ' tiles: ' + by('straight-v') + ' vertical, ' +
    by('straight-h') + ' horizontal, ' + by('curve') + ' curves\n');
  manifest.slice().sort((a,b)=>a.y-b.y).forEach(t => console.log(
    '  ' + t.id.padEnd(8) + t.kind.padEnd(12) +
    ('x' + t.x).padStart(9) + ('y' + t.y).padStart(10) +
    '   ' + t.w + ' x ' + t.h));
})();

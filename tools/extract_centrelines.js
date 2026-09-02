#!/usr/bin/env node
/* Read each road tile's centreline out of his own artwork.
 *
 * Inferring it from tile bounding boxes does not work: his straights overlap
 * each other and a curve's box overlaps both its neighbours, so "which edge
 * connects to what" is ambiguous and the guesses put the traffic in the sea.
 *
 * But the centreline is already drawn — it is the dashed white stripe down the
 * middle of every tile. Taking the centre of each dash, in order, gives the
 * line exactly, curves included, with nothing deduced. Points are stored
 * normalised to the tile box, so a straight that gets stretched later carries
 * its centreline with it.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

(async () => {
  const tiles = JSON.parse(fs.readFileSync(ROOT + '/tools/road-tiles.json', 'utf8'));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:1200, height:900 } });

  const out = {};
  for (const t of tiles) {
    const svg = fs.readFileSync(ROOT + '/assets/scene/road/' + t.id + '.svg', 'utf8');
    await page.setContent('<style>html,body{margin:0}svg{display:block}</style>' + svg);
    await page.waitForTimeout(120);

    const pts = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      const vb = svg.viewBox.baseVal;
      /* The dashes: small white shapes. The edge lines are white too but run
         the whole length of the tile, so size separates them cleanly. */
      const all = [...svg.querySelectorAll('rect,path')].filter(el => {
        const f = (el.getAttribute('fill') || '').toLowerCase();
        if (f !== '#fff' && f !== '#ffffff' && f !== 'white') return false;
        let b; try { b = el.getBBox(); } catch (e) { return false; }
        if (!b.width || !b.height) return false;
        const long = Math.max(b.width, b.height), short = Math.min(b.width, b.height);
        return long < Math.max(vb.width, vb.height) * 0.45 && short < 40;
      });
      return all.map(el => { const b = el.getBBox();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    });

    if (pts.length < 2) { out[t.id] = null; continue; }

    /* Order them: start at the point furthest from the centroid, then walk
       nearest-neighbour. A dash chain has no branches, so this is exact. */
    const cx = pts.reduce((a,p)=>a+p.x,0)/pts.length;
    const cy = pts.reduce((a,p)=>a+p.y,0)/pts.length;
    let start = 0, far = -1;
    pts.forEach((p,i) => { const d=(p.x-cx)**2+(p.y-cy)**2; if(d>far){far=d;start=i;} });
    const left = pts.slice(), chain = [left.splice(start,1)[0]];
    while (left.length) {
      let bi = 0, bd = Infinity, cur = chain[chain.length-1];
      left.forEach((p,i)=>{ const d=(p.x-cur.x)**2+(p.y-cur.y)**2; if(d<bd){bd=d;bi=i;} });
      chain.push(left.splice(bi,1)[0]);
    }
    /* normalised to the tile box, so stretching carries the line with it */
    out[t.id] = chain.map(p => ({
      u: +((p.x - t.x) / t.w).toFixed(4),
      v: +((p.y - t.y) / t.h).toFixed(4)
    }));
  }
  await browser.close();

  fs.writeFileSync(ROOT + '/tools/road-centrelines.json', JSON.stringify(out, null, 1));
  Object.entries(out).forEach(([id, c]) => {
    const t = tiles.find(x => x.id === id);
    console.log('  ' + id.padEnd(8) + t.kind.padEnd(12) +
      (c ? c.length + ' dashes   ' +
        'u ' + Math.min(...c.map(p=>p.u)).toFixed(2) + '–' + Math.max(...c.map(p=>p.u)).toFixed(2) +
        '   v ' + Math.min(...c.map(p=>p.v)).toFixed(2) + '–' + Math.max(...c.map(p=>p.v)).toFixed(2)
        : 'NO DASHES FOUND'));
  });
})();

#!/usr/bin/env node
/* Walk a vertical line down the page and report any hard horizontal edge.
 * A seam is a row where the colour jumps further than the rows around it are
 * drifting — which is exactly what a background meeting another background
 * looks like, and exactly what artwork flowing into artwork does not. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const decode = require('/tmp/claude-0/-home-user-storyboard-app/1a554a96-134b-52ef-894a-d9448b97add1/scratchpad/png.js');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dist = (a,b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);

(async () => {
  const srv = http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
    const t={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    s.writeHead(200,{'Content-Type':t}); s.end(fs.readFileSync(f));});
  await new Promise(r => srv.listen(8997, r));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const W = 1400, H = 900;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('http://127.0.0.1:8997/index.html', { waitUntil: 'load' });
  await sleep(2500);
  await page.evaluate(() => {                       /* traffic off, it moves */
    const h = document.querySelector('.road-hit');
    h && h.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await sleep(5000);

  const bounds = await page.evaluate(() => {
    const o = {};
    ['problem','objection','promise','services'].forEach(id => {
      const e = document.getElementById(id);
      if (e) o[id] = Math.round(e.getBoundingClientRect().top + window.scrollY);
    });
    o.total = document.body.scrollHeight;
    return o;
  });

  /* sample a 6px-wide column at x=40 — clear of the copy and the road */
  const X = 40, jumps = [];
  let prev = null;
  for (let y = 300; y < Math.min(bounds.services + 200, bounds.total - H); y += 4) {
    await page.evaluate(v => window.scrollTo({top:v,behavior:'instant'}), y - 400);
    await sleep(12);
    const img = decode(await page.screenshot({ clip: { x: X, y: 400, width: 6, height: 4 } }));
    const c = img.at(3, 2);
    if (prev) { const d = dist(c, prev); if (d > 24) jumps.push({ y, d, from: prev, to: c }); }
    prev = c;
  }

  const hex = c => '#' + c.map(v => v.toString(16).padStart(2,'0')).join('');
  const where = y => {
    let best = 'page top';
    for (const [k,v] of Object.entries(bounds)) if (k !== 'total' && y >= v) best = k;
    return best;
  };
  console.log('vertical colour walk down the scenery, ' + W + 'px wide\n');
  if (!jumps.length) console.log('  no hard edges found — every transition drifts\n');
  else jumps.forEach(j => console.log('  y=' + String(j.y).padStart(5) + '  in ' + where(j.y).padEnd(10) +
    '  jump ' + String(j.d).padStart(4) + '   ' + hex(j.from) + ' -> ' + hex(j.to)));
  console.log('\nsection tops: ' + JSON.stringify(bounds));
  await browser.close(); srv.close();
})();

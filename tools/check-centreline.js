#!/usr/bin/env node
/* Is the line the traffic drives actually ON the road that is drawn?
 *
 * check-cars-on-road.js samples the pixel under each vehicle, which makes it
 * a measurement of wherever the traffic happens to be at that instant —
 * different cars, different places, every run, so a 10-point swing between
 * runs says nothing. This walks the centreline itself at fixed intervals with
 * the traffic hidden, so the same page always gives the same answer, and a
 * change in it is a change in the geometry rather than in the dice. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = parseInt(process.argv[2], 10) || 1400;

(async () => {
  const srv = http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
    const t={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    s.writeHead(200,{'Content-Type':t}); s.end(fs.readFileSync(f));});
  await new Promise(r => srv.listen(8978, r));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:W, height:900 } });
  await page.goto('http://127.0.0.1:8978/index.html', { waitUntil:'load' });
  await page.evaluate(() => document.fonts.ready);
  await sleep(3500);

  const pts = await page.evaluate(() => {
    /* hide the traffic so we sample the road, not a car roof */
    document.querySelectorAll('.car,[data-car],#road-layer .veh').forEach(n => n.style.visibility = 'hidden');
    const runs = window.H19_ROAD_PATHS ? window.H19_ROAD_PATHS() : [];
    const layer = document.getElementById('road-layer').getBoundingClientRect();
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
    document.body.appendChild(svg);
    const out = [];
    runs.forEach((r, i) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', r.d); svg.appendChild(p);
      const L = p.getTotalLength();
      for (let t = 0.02; t < 0.99; t += 0.04) {
        const q = p.getPointAtLength(L * t);
        /* the centreline is in the layer's own coordinates */
        out.push({ run: r.name || i, x: q.x + layer.left,
                   y: q.y + layer.top + window.pageYOffset });
      }
    });
    svg.remove();
    return out;
  });

  const ASPHALT = [[87,87,87],[95,95,95],[77,77,77],[120,120,120],[255,255,255]];
  const near = (c, t) => Math.abs(c[0]-t[0])+Math.abs(c[1]-t[1])+Math.abs(c[2]-t[2]) < 60;
  let on = 0; const off = [];
  for (const q of pts) {
    const hex = await page.evaluate(async ({x, y}) => {
      window.scrollTo({ top: Math.max(0, y - 300), behavior:'instant' });
      await new Promise(r => requestAnimationFrame(r));
      return { vy: y - window.pageYOffset, sx: x };
    }, q);
    if (hex.vy < 0 || hex.vy > 899) continue;
    const shot = await page.screenshot({ clip:{ x:Math.max(0,hex.sx-1), y:Math.max(0,hex.vy-1), width:3, height:3 } });
    const c = await page.evaluate(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
      const d = cv.getContext('2d').getImageData(1, 1, 1, 1).data;
      return [d[0], d[1], d[2]];
    }, shot.toString('base64'));
    if (ASPHALT.some(a => near(c, a))) on++;
    else off.push('rgb(' + c.join(',') + ') at ' + Math.round(q.x) + ',' + Math.round(q.y));
  }
  const total = on + off.length;
  console.log(W + 'px   centreline points sampled: ' + total);
  console.log('  on the road: ' + on + '   off it: ' + off.length +
              '   ' + (total ? Math.round(off.length / total * 100) : 0) + '% off');
  if (off.length) console.log('  e.g. ' + off.slice(0, 6).join(', '));
  await browser.close(); srv.close();
})();

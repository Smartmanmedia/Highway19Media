#!/usr/bin/env node
/* Are the cars actually ON the road?
 * Sample the pixel under each vehicle's centre. Asphalt is a narrow band of
 * greys; anything else means the traffic is driving over the scenery, which is
 * what happens when the lane paths and the drawn road come from two different
 * geometries. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const decode = require('/tmp/claude-0/-home-user-storyboard-app/1a554a96-134b-52ef-894a-d9448b97add1/scratchpad/png.js');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex = c => '#' + c.map(v => v.toString(16).padStart(2,'0')).join('');

(async () => {
  const srv = http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
    const t={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    s.writeHead(200,{'Content-Type':t}); s.end(fs.readFileSync(f));});
  await new Promise(r => srv.listen(9015, r));
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:1400, height:900 } });
  await page.goto('http://127.0.0.1:9015/index.html', { waitUntil:'load' });
  await sleep(3000);
  await page.evaluate(() => { const h=document.querySelector('.road-hit');
    h && h.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
  await sleep(5000);                       /* let the traffic come to rest */

  /* hide the vehicles so we sample the ground they stand on, not their paint */
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'hidecars';
    /* Hide the vehicles so we sample the ground they stand on — and the copy
       and the signs too, or a car correctly on the road under his gantry
       reads as "off road" because the sign is what the pixel actually shows. */
    s.textContent = '.road-fleet{visibility:hidden}' +
                    '.sec__inner,.site-header,.site-footer{visibility:hidden}' +
                    '';
    document.head.appendChild(s);
  });

  const cars = await page.evaluate(() => {
    if (!window.__sim) return [];
    return window.__sim.cars.map(c => ({ x: Math.round(c.x), y: Math.round(c.y) }))
      .filter(c => c.x || c.y);
  });

  const pg = await page.evaluate(() => {
    const m = document.getElementById('main');
    return m.getBoundingClientRect().top + window.pageYOffset;
  });

  let on = 0, off = 0; const misses = [];
  for (const c of cars.slice(0, 120)) {
    const vy = c.y + pg;
    await page.evaluate(y => window.scrollTo({top:Math.max(0,y-450),behavior:'instant'}), vy);
    await sleep(40);
    const sy = await page.evaluate(y => y - window.pageYOffset, vy);
    if (sy < 3 || sy > 895 || c.x < 3 || c.x > 1395) continue;
    const img = decode(await page.screenshot({ clip:{ x:Math.round(c.x)-2, y:Math.round(sy)-2, width:5, height:5 }}));
    const p = img.at(2,2);
    /* asphalt, its edge lines and the dashes */
    const grey = Math.abs(p[0]-p[1]) < 18 && Math.abs(p[1]-p[2]) < 18;
    const road = grey && p[0] > 60 && p[0] < 245;
    road ? on++ : (off++, misses.length < 6 && misses.push(hex(p) + ' at ' + c.x + ',' + Math.round(c.y)));
  }
  console.log('vehicles sampled: ' + (on + off));
  console.log('  on asphalt: ' + on);
  console.log('  off road:   ' + off + (misses.length ? '   e.g. ' + misses.join(', ') : ''));
  console.log(off === 0 ? '\n  every vehicle is on his road' :
    '\n  ' + Math.round(off/(on+off)*100) + '% are driving over the scenery');
  await browser.close(); srv.close();
})();

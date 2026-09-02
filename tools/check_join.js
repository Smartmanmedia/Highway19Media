#!/usr/bin/env node
/* The road has to cross the seam between two sections without a break. Every
 * position is a percentage, so it either works at all sizes or none - but
 * rounding can still open a one-pixel seam, so this walks the road's own
 * column down through the join and reports any pixel that is not road.
 *
 *   node tools/check_join.js [width ...]
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const WIDTHS = process.argv.slice(2).map(Number);
const SIZES = WIDTHS.length ? WIDTHS : [1024, 1280, 1440, 1920, 2560, 3840];

(async () => {
  const srv = http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
    const t={'.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'}[path.extname(f)]||'application/octet-stream';
    s.writeHead(200,{'Content-Type':t}); s.end(fs.readFileSync(f));});
  await new Promise(r => srv.listen(8987, r));
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--no-sandbox'] });
  let bad = 0;
  for (const W of SIZES) {
    const p = await b.newPage({ viewport:{ width:W, height:800 } });
    await p.goto('http://127.0.0.1:8987/build/v2/page.html', { waitUntil:'load' });
    await new Promise(r=>setTimeout(r,1200));
    const g = await p.evaluate(()=>[...document.querySelectorAll('section')].map(s=>{
      const r=s.getBoundingClientRect(); return { top:r.top+scrollY, h:r.height, w:r.width };}));
    /* the road's own centre line, and a band either side of the seam */
    const x = Math.round(g[0].w * 0.177);
    const from = Math.round(g[0].top + g[0].h - g[0].w*0.04);
    const to   = Math.round(g[1].top + g[1].w*0.04);
    const shot = await p.screenshot({ fullPage:true, clip:{ x, y:from, width:2, height:to-from } });
    const p2 = await b.newPage();
    await p2.setContent('<img id=i src="data:image/png;base64,'+shot.toString('base64')+'">');
    await p2.waitForFunction(()=>document.getElementById('i').naturalWidth>0);
    const r = await p2.evaluate(()=>{ const im=document.getElementById('i');
      const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
      const x=c.getContext('2d'); x.drawImage(im,0,0);
      const d=x.getImageData(0,0,1,c.height).data; const gaps=[];
      for(let y=0;y<c.height;y++){ const R=d[y*4],G=d[y*4+1],B=d[y*4+2];
        /* road is grey or white; anything with a strong blue cast is a hole */
        if (B - R > 40) gaps.push(y); }
      return { h:c.height, gaps }; });
    await p2.close(); await p.close();
    const ok = r.gaps.length === 0;
    if (!ok) bad++;
    console.log(String(W).padStart(5) + 'px  ' + (ok ? 'road continuous through the join'
      : 'BREAK: ' + r.gaps.length + ' px of background in the road column at y+' + r.gaps[0]));
  }
  await b.close(); srv.close();
  process.exit(bad ? 1 : 0);
})();

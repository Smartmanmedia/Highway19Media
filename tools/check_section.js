#!/usr/bin/env node
/* The page's copy against HIS copy, both as a share of the art column. His
 * side is read from the export's own <text>; the page's side is the rendered
 * ink through a Range, so the two are the same measurement. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HIS = JSON.parse(fs.readFileSync(ROOT + '/incoming/v2/section-01/section-01.text.json','utf8'));
const PAIRS = [
  ['A Clear Road',      '.sec1 h1'],
  ["You've done",       '.sec1 .copy.sub'],
  ['Running a local',   '.sec1 .copy.body'],
  ['Great Work',        '.sec1 h2.copy'],
  ['The best shop',     '.sec1 .copy.sub ~ * .x', 1],   /* second sub */
  ['You finish a job',  null, 2],
];
(async () => {
  const srv = http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
    const t={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    s.writeHead(200,{'Content-Type':t}); s.end(fs.readFileSync(f));});
  await new Promise(r => srv.listen(8966, r));
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const W = parseInt(process.argv[2] || '1400', 10);
  const p = await b.newPage({ viewport:{ width:W, height:Math.round(W*0.95) } });
  await p.goto('http://127.0.0.1:8966/build/v2/section-01.html', { waitUntil:'load' });
  await p.evaluate(() => document.fonts.ready);
  await sleep(2500);
  const mine = await p.evaluate(() => {
    const sec = document.querySelector('.sec1').getBoundingClientRect();
    const ink = el => { const r = document.createRange(); r.selectNodeContents(el);
      const bs = [...r.getClientRects()].filter(x => x.width > 1 && x.height > 4);
      if (!bs.length) return null;
      const l = Math.min(...bs.map(x=>x.left)), rt = Math.max(...bs.map(x=>x.right));
      return { left:(l-sec.left)/sec.width*100, width:(rt-l)/sec.width*100,
               top:(Math.min(...bs.map(x=>x.top))-sec.top)/sec.height*100, lines:bs.length }; };
    const out = {};
    document.querySelectorAll('.sec1 .copy').forEach(el => {
      const k = (el.textContent || '').trim().replace(/\s+/g,' ').slice(0, 18);
      out[k] = ink(el);
    });
    return out;
  });
  await b.close(); srv.close();

  console.log('section one at ' + W + 'px — his copy vs the page\n');
  console.log('  block                        his                page              drift');
  let bad = 0;
  HIS.filter(h => h.text.length > 3).forEach(h => {
    const key = Object.keys(mine).find(k => k.startsWith(h.text.slice(0, 14)));
    if (!key || !mine[key]) return;
    const m = mine[key];
    const dl = m.left - h.left, dw = m.width - h.width, dt = m.top - h.top;
    const off = Math.abs(dl) > 1.5 || Math.abs(dt) > 1.5 || Math.abs(dw) > 3;
    if (off) bad++;
    console.log('  ' + h.text.slice(0,26).padEnd(28) +
      (h.left.toFixed(1) + ',' + h.top.toFixed(1) + ' w' + h.width.toFixed(1)).padEnd(19) +
      (m.left.toFixed(1) + ',' + m.top.toFixed(1) + ' w' + m.width.toFixed(1)).padEnd(18) +
      (dl>0?'+':'') + dl.toFixed(1) + ' / ' + (dt>0?'+':'') + dt.toFixed(1) +
      ' / ' + (dw>0?'+':'') + dw.toFixed(1) + (off ? '  <<' : ''));
  });
  console.log('\n  ' + bad + ' block(s) out by more than a whisker  (left / top / width, all % of the section)');
})();

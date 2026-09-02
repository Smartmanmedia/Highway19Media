#!/usr/bin/env node
/* Measure the page against his composition, element by element.
 *
 * Everything is expressed as a share of the 1924-wide art column, so his
 * 2472-wide canvas and a 1400-wide browser can be compared directly. For each
 * piece of copy he drew, this reports where he put it and where the page puts
 * it, and the gap between. That is the list of things still to close.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ART_X = 288.9, ART_W = 1924.33;

/* his text run -> the element on the page that carries it */
const PAIRS = [
  ['A Clear Road',            '#hero h1'],
  ["You've done the hard",    '#hero .sub'],
  ['Running a local business','#hero .body-copy'],
  ['Great Work',              '#problem h2'],
  ['The best shop',           '#problem .sub'],
  ['You finish a job',        '#problem .body-copy'],
  ["You've Been Down",        '#objection h2'],
  ['And somebody sold',       '#objection .sub'],
  ['A template website',      '#objection .body-copy'],
  ['We Handle the Marketing', '#promise h2'],
  ['One team, one vision',    '#promise .sub'],
  ['From video production',   '#promise .body-copy']
];

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });

  /* --- his composition --- */
  const design = await (async () => {
    const p = await browser.newPage({ viewport:{ width:1200, height:900 } });
    await p.setContent('<style>html,body{margin:0}svg{display:block;width:2472px}</style>' +
      fs.readFileSync(ROOT + '/incoming/Website2.svg','utf8'));
    await p.waitForTimeout(5000);
    const out = await p.evaluate(() => {
      const svg = document.querySelector('svg'), sr = svg.getBoundingClientRect();
      const k = 2472.32 / sr.width;
      return [...svg.querySelectorAll('text')].map(t => {
        const r = t.getBoundingClientRect();
        return { txt: t.textContent.trim().replace(/\s+/g,' '),
                 x: (r.left - sr.left) * k, w: r.width * k, y: (r.top - sr.top) * k };
      });
    });
    await p.close();
    return out;
  })();

  /* --- the page --- */
  const srv = http.createServer((q,s)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.writeHead(404);return s.end();}
    const t={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'}[path.extname(f)]||'application/octet-stream';
    s.writeHead(200,{'Content-Type':t}); s.end(fs.readFileSync(f));});
  await new Promise(r => srv.listen(9023, r));
  const page = await browser.newPage({ viewport:{ width:1400, height:900 } });
  await page.goto('http://127.0.0.1:9023/index.html', { waitUntil:'load' });
  await sleep(3000);

  const live = await page.evaluate(sels => {
    const W = document.getElementById('main').getBoundingClientRect().width;
    const o = {};
    sels.forEach(s => {
      const el = document.querySelector(s);
      if (!el) return;
      const r = el.getBoundingClientRect();
      o[s] = { l: r.left / W * 100, rt: r.right / W * 100 };
    });
    return o;
  }, PAIRS.map(p => p[1]));

  console.log('position across the page, as a share of the art column\n');
  console.log('  copy                        his          page         drift');
  let worst = [];
  PAIRS.forEach(([needle, sel]) => {
    const d = design.find(t => t.txt.startsWith(needle));
    const l = live[sel];
    if (!d || !l) { console.log('  ' + needle.slice(0,26).padEnd(28) + (d?'':'not in his file ') + (l?'':'no element')); return; }
    const hl = (d.x - ART_X) / ART_W * 100, hr = (d.x + d.w - ART_X) / ART_W * 100;
    const dl = l.l - hl, dr = l.rt - hr;
    const flag = (Math.abs(dl) > 6 || Math.abs(dr) > 8) ? '  <<' : '';
    if (flag) worst.push(needle);
    console.log('  ' + needle.slice(0,26).padEnd(28) +
      (hl.toFixed(0) + '–' + hr.toFixed(0) + '%').padEnd(13) +
      (l.l.toFixed(0) + '–' + l.rt.toFixed(0) + '%').padEnd(13) +
      ((dl>0?'+':'') + dl.toFixed(0) + ' / ' + (dr>0?'+':'') + dr.toFixed(0)) + flag);
  });
  console.log('\n  ' + worst.length + ' out by more than a few percent' +
    (worst.length ? ': ' + worst.join(', ') : ''));
  await browser.close(); srv.close();
})();

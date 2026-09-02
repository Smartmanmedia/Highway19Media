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
    await p.setContent('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;700;800&display=block"><style>html,body{margin:0}svg{display:block;width:2472px}</style>' +
      fs.readFileSync(ROOT + '/incoming/Website2.svg','utf8'));
    /* His export names each style as its own family — BeVietnamPro-Black,
       BeVietnamPro-Light, and so on — and only some runs carry the real
       "Be Vietnam Pro" as a fallback. The ones that do not silently render in
       whatever the browser has, which is narrower, and then every width
       measured off them is wrong. Map his style names onto the real family at
       the right weight, and leave the road-sign face alone: Highway Gothic
       Expanded is not a webfont we have, and pretending otherwise would make
       these numbers look right while being wrong. */
    await p.evaluate(() => {
      const W = { Thin:100, ExtraLight:200, Light:300, Regular:400, Medium:500,
                  SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
      let mapped = 0, sign = 0;
      document.querySelectorAll('svg text, svg tspan').forEach(n => {
        const fam = (n.getAttribute('font-family') ||
                     getComputedStyle(n).fontFamily || '').replace(/["']/g, '');
        const m = /BeVietnamPro-(\w+)/.exec(fam);
        if (m) { n.style.fontFamily = '"Be Vietnam Pro", sans-serif';
                 if (W[m[1]]) n.style.fontWeight = W[m[1]];
                 mapped++; }
        else if (/HighwayGothic/i.test(fam)) sign++;
      });
      window.__fontFix = { mapped, sign };
    });
    await p.waitForTimeout(5000);
    const fix = await p.evaluate(() => window.__fontFix);
    console.log('  his type: ' + fix.mapped + ' runs mapped onto Be Vietnam Pro, ' +
                fix.sign + ' left in Highway Gothic Expanded (no webfont — ' +
                'those widths are approximate)\n');
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

  /* Measure the INK, not the box. His side is the glyph bounds of an SVG
     <text>; an element rect is the whole column whether the words fill it or
     not, so comparing the two can never converge -- a heading that fits in
     half its column reads as a column half the width. A Range over the
     element's own text gives the union of its line boxes, which is the same
     thing his <text> gives. The column itself is reported separately. */
  const live = await page.evaluate(sels => {
    const W = document.getElementById('main').getBoundingClientRect().width;
    const o = {};
    sels.forEach(s => {
      const el = document.querySelector(s);
      if (!el) return;
      const rng = document.createRange();
      rng.selectNodeContents(el);
      const boxes = [...rng.getClientRects()].filter(r => r.width > 1 && r.height > 1);
      const r = boxes.length
        ? { left: Math.min(...boxes.map(b => b.left)),
            right: Math.max(...boxes.map(b => b.right)) }
        : el.getBoundingClientRect();
      const col = el.getBoundingClientRect();
      o[s] = { l: r.left / W * 100, rt: r.right / W * 100,
               cl: col.left / W * 100, cr: col.right / W * 100 };
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

  /* --- the columns themselves -----------------------------------------
     His column is the union of every text run he set in that section, not
     just the three I match by name -- a wrapped paragraph is a separate
     <text> per line in his file, and the widest line is what sets the
     column. The page's column is the .sec__body box. This is the number
     the CSS actually controls. */
  const SECTIONS = [['#hero','A Clear Road'], ['#problem','Great Work'],
                    ['#objection',"You've Been Down"], ['#promise','We Handle the Marketing']];
  const byY = design.slice().sort((a,b) => a.y - b.y);
  const starts = SECTIONS.map(([, needle]) => {
    const d = byY.find(t => t.txt.startsWith(needle));
    return d ? d.y : null;
  });

  const cols = await page.evaluate(sels => {
    const W = document.getElementById('main').getBoundingClientRect().width;
    return sels.map(s => {
      const el = document.querySelector(s + ' .sec__body');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left / W * 100, rt: r.right / W * 100 };
    });
  }, SECTIONS.map(s => s[0]));

  console.log('\n\ncolumn the copy sits in, as a share of the art column\n');
  console.log('  section       his          page         drift');
  SECTIONS.forEach(([sel], i) => {
    const from = starts[i], to = starts[i + 1] != null ? starts[i + 1] : 1e9;
    if (from == null) return;
    const runs = byY.filter(t => t.y >= from - 40 && t.y < to - 40 && t.txt);
    if (!runs.length || !cols[i]) return;
    const hl = (Math.min(...runs.map(r => r.x)) - ART_X) / ART_W * 100;
    const hr = (Math.max(...runs.map(r => r.x + r.w)) - ART_X) / ART_W * 100;
    const dl = cols[i].l - hl, dr = cols[i].rt - hr;
    console.log('  ' + sel.padEnd(14) +
      (hl.toFixed(0) + '–' + hr.toFixed(0) + '%').padEnd(13) +
      (cols[i].l.toFixed(0) + '–' + cols[i].rt.toFixed(0) + '%').padEnd(13) +
      ((dl>0?'+':'') + dl.toFixed(0) + ' / ' + (dr>0?'+':'') + dr.toFixed(0)) +
      ((Math.abs(dl) > 4 || Math.abs(dr) > 4) ? '  <<' : ''));
  });
  await browser.close(); srv.close();
})();

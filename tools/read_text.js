#!/usr/bin/env node
/* His copy is in the section export as positioned <text>. Read it — the block
 * bounds, the alignment and the per-line sizes — instead of guessing from the
 * render. Everything comes out as a share of the art column. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const SRC = process.argv[2];
(async () => {
  const svg = fs.readFileSync(SRC, 'utf8');
  const [, , VW, VH] = /viewBox="([\d.\s-]+)"/.exec(svg)[1].trim().split(/\s+/).map(Number);
  let x0 = 0, cw = VW;
  const oc = /<polygon id="ocean" points="([^"]+)"/.exec(svg);
  if (oc) { const p = oc[1].replace(/,/g,' ').split(/\s+/).map(Number);
            const xs = p.filter((_, i) => i % 2 === 0);
            x0 = Math.min(...xs); cw = Math.max(...xs) - x0; }

  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const p = await b.newPage({ viewport:{ width:1200, height:900 } });
  await p.setContent(
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;700;800&display=block">' +
    '<style>html,body{margin:0}svg{display:block;width:' + VW + 'px}</style>' + svg);
  /* his export names each style as its own family; map them onto the real one */
  await p.evaluate(() => {
    const W = { Thin:100, ExtraLight:200, Light:300, Regular:400, Medium:500,
                SemiBold:600, Bold:700, ExtraBold:800, Black:900 };
    document.querySelectorAll('svg text, svg tspan').forEach(n => {
      const fam = (n.getAttribute('font-family') || getComputedStyle(n).fontFamily || '').replace(/["']/g,'');
      const m = /BeVietnamPro-(\w+)/.exec(fam);
      if (m) { n.style.fontFamily = '"Be Vietnam Pro", sans-serif';
               if (W[m[1]]) n.style.fontWeight = W[m[1]]; }
    });
  });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(3500);

  const rows = await p.evaluate(() => {
    const s = document.querySelector('svg'), sr = s.getBoundingClientRect();
    return [...s.querySelectorAll('text')].map(t => {
      const kids = [...t.querySelectorAll('tspan')];
      const lines = (kids.length ? kids : [t]).map(n => {
        const r = n.getBoundingClientRect();
        return { txt:(n.textContent||'').trim().replace(/\s+/g,' '),
                 x:r.left-sr.left, y:r.top-sr.top, w:r.width, h:r.height,
                 size:parseFloat(getComputedStyle(n).fontSize),
                 weight:getComputedStyle(n).fontWeight,
                 fam:(n.getAttribute('font-family')||getComputedStyle(n).fontFamily||'').split(',')[0].replace(/"/g,'') };
      }).filter(l => l.w > 1);
      const r = t.getBoundingClientRect();
      return { lines, x:r.left-sr.left, y:r.top-sr.top, w:r.width, h:r.height };
    }).filter(t => t.lines.length).sort((a,b) => a.y - b.y);
  });
  await b.close();

  const pc = v => +(((v - x0) / cw) * 100).toFixed(2);
  const pw = v => +((v / cw) * 100).toFixed(2);
  const py = v => +((v / VH) * 100).toFixed(2);

  console.log(SRC.split('/').pop() + '   column x ' + x0.toFixed(2) + ' w ' + cw.toFixed(2) + '\n');
  const out = [];
  rows.forEach(t => {
    const first = t.lines[0].txt.slice(0, 34);
    /* is the block centred, left or right? compare each line's centre */
    const ls = t.lines.map(l => l.x), rs = t.lines.map(l => l.x + l.w);
    const cs = t.lines.map((l, i) => ls[i] + l.w / 2);
    const spread = a => Math.max(...a) - Math.min(...a);
    const align = spread(cs) <= spread(ls) && spread(cs) <= spread(rs) ? 'centre'
                : spread(ls) <= spread(rs) ? 'left' : 'right';
    console.log('  "' + first + '"');
    console.log('     block   left ' + pc(t.x) + '%   top ' + py(t.y) + '%   width ' + pw(t.w) +
                '%   ' + align + '-aligned   ' + t.lines.length + ' line(s)');
    console.log('     type    ' + [...new Set(t.lines.map(l => l.size.toFixed(2) + '/' + l.weight))].join(', ') +
                '   ' + [...new Set(t.lines.map(l => l.fam))].join(', '));
    out.push({ text: first, left: pc(t.x), top: py(t.y), width: pw(t.w), align,
               lines: t.lines.map(l => ({ txt:l.txt, left:pc(l.x), top:py(l.y),
                                          size:+l.size.toFixed(2), weight:l.weight })) });
  });
  const f = SRC.replace(/\.svg$/, '') + '.text.json';
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
  console.log('\n  -> ' + f);
})();

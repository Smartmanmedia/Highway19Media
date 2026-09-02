#!/usr/bin/env node
/* Read the owner's composed file and report every top-level layer: what it is
 * called, where it sits, how big it is, and how heavy. This is the shared map
 * — everything else is placed from it rather than guessed. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const FILE = process.argv[2] || path.join(__dirname, '../incoming/Website2.svg');

(async () => {
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:1200, height:900 } });
  await page.setContent('<style>html,body{margin:0}svg{display:block;width:2472px}</style>' +
    fs.readFileSync(FILE,'utf8'));
  await page.waitForTimeout(6000);

  const out = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    const root = document.getElementById('Layer_1') ||
                 [...svg.querySelectorAll('g')].find(g => g.getAttribute('data-name') === 'Layer 1') ||
                 svg.querySelector('g');
    const rows = [];
    [...root.children].forEach((el, i) => {
      let b; try { b = el.getBBox(); } catch (e) { return; }
      if (!b || (!b.width && !b.height)) return;
      const shapes = el.querySelectorAll ?
        el.querySelectorAll('path,rect,circle,polygon,ellipse,image,text,line,polyline').length : 1;
      rows.push({ i, name: el.getAttribute('data-name') || el.getAttribute('id') || el.tagName,
        x:+b.x.toFixed(0), y:+b.y.toFixed(0), w:+b.width.toFixed(0), h:+b.height.toFixed(0), shapes });
    });
    return { w: vb.width, h: vb.height, rows, kids: root.children.length };
  });

  console.log('canvas ' + out.w + ' x ' + out.h + '   ' + out.kids + ' top-level layers\n');
  console.log('  #  layer                       x      y      w      h  shapes');
  out.rows.forEach(r => console.log('  ' + String(r.i).padStart(2) + '  ' + r.name.slice(0,25).padEnd(25) +
    String(r.x).padStart(6) + String(r.y).padStart(7) + String(r.w).padStart(7) +
    String(r.h).padStart(7) + String(r.shapes).padStart(7)));
  fs.writeFileSync(path.join(__dirname,'master-layers.json'), JSON.stringify(out, null, 2));
  await browser.close();
})();

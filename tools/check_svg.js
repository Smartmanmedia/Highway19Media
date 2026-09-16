#!/usr/bin/env node
/* Does every asset still PARSE? An SVG edited by string surgery can lose a tag
 * and go quietly blank - which is how his second sign's green board vanished,
 * from an opening <rect> removed while its </rect> stayed behind. Cheap to run,
 * and it catches the whole class.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) {
  const q = path.join(d, f);
  fs.statSync(q).isDirectory() ? walk(q) : /\.svg$/i.test(q) && files.push(q);
} })('assets/v2');
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage();
  await p.setContent('<body>');
  let bad = 0;
  for (const f of files) {
    const r = await p.evaluate(s => {
      const d = new DOMParser().parseFromString(s, 'image/svg+xml');
      const err = d.querySelector('parsererror');
      if (err) return { ok: false, why: err.textContent.slice(0, 90) };
      document.body.innerHTML = '';
      document.body.appendChild(d.documentElement);
      const svg = document.querySelector('svg');
      let n = 0; svg.querySelectorAll('path,rect,circle,polygon,ellipse,image').forEach(() => n++);
      let b; try { b = svg.getBBox(); } catch (e) { b = { width: 0, height: 0 }; }
      return { ok: n > 0 && b.width > 0, shapes: n, w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
    }, fs.readFileSync(f, 'utf8'));
    if (!r.ok) { bad++; console.log('  BROKEN ' + f + '  ' + (r.why || JSON.stringify(r))); }
  }
  console.log(files.length + ' svg assets checked, ' + bad + ' broken');
  await br.close();
})();

#!/usr/bin/env node
/* Cut named layers out of a section export into their own files, cropped to
 * their own ink, keeping only the defs each one actually uses. Ids are
 * prefixed per layer so two files on one page cannot fight over a gradient. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const SRC = process.argv[2], OUT = process.argv[3], ONLY = process.argv.slice(4);

(async () => {
  const svg = fs.readFileSync(SRC, 'utf8');
  const [, , VW, VH] = /viewBox="([\d.\s-]+)"/.exec(svg)[1].trim().split(/\s+/).map(Number);
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const p = await b.newPage({ viewport:{ width:1200, height:900 } });
  await p.setContent('<style>html,body{margin:0}svg{display:block;width:' + VW + 'px}</style>' + svg);
  await p.waitForTimeout(3500);

  const cut = await p.evaluate(names => {
    const s = document.querySelector('svg'), sr = s.getBoundingClientRect();
    const defs = s.querySelector('defs');
    const out = [];
    names.forEach(n => {
      const g = document.getElementById(n);
      if (!g) return;
      const r = g.getBoundingClientRect();
      const box = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
      const markup = g.outerHTML;
      /* keep only the gradients/clips this layer references */
      const used = new Set([...markup.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]));
      let keep = '';
      if (defs) [...defs.children].forEach(d => { if (used.has(d.id)) keep += d.outerHTML; });
      out.push({ name: n, box, markup, defs: keep });
    });
    return out;
  }, ONLY);
  await b.close();

  fs.mkdirSync(OUT, { recursive: true });
  cut.forEach(c => {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let body = (c.defs ? '<defs>' + c.defs + '</defs>' : '') + c.markup;
    /* namespace ids so separate files never collide */
    const ids = [...new Set([...body.matchAll(/id="([^"]+)"/g)].map(m => m[1]))];
    ids.sort((a, z) => z.length - a.length).forEach(id => {
      const q = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      body = body.replace(new RegExp('id="' + q + '"', 'g'), 'id="' + slug + '-' + id + '"')
                 .replace(new RegExp('url\\(#' + q + '\\)', 'g'), 'url(#' + slug + '-' + id + ')');
    });
    const w = c.box.w.toFixed(2), h = c.box.h.toFixed(2);
    /* xlink:href MUST have its namespace declared on the new root. His signs
       carry an embedded PNG referenced that way, and without the declaration
       the file is not well-formed XML — the browser drops the whole image and
       shows the alt text, with no error anywhere. */
    const file = '<svg xmlns="http://www.w3.org/2000/svg"' +
      ' xmlns:xlink="http://www.w3.org/1999/xlink" width="' + w + '" height="' + h +
      '" viewBox="' + c.box.x.toFixed(2) + ' ' + c.box.y.toFixed(2) + ' ' + w + ' ' + h + '">' +
      body + '</svg>\n';
    fs.writeFileSync(path.join(OUT, slug + '.svg'), file);
    console.log('  ' + (slug + '.svg').padEnd(22) + w + ' x ' + h +
                '   at ' + c.box.x.toFixed(1) + ',' + c.box.y.toFixed(1) +
                '   ' + Math.round(file.length / 1024) + ' KB');
  });
})();

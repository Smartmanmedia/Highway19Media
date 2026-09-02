#!/usr/bin/env node
/* Cut every named layer out of the owner's composed file into its own asset,
 * and write a manifest of where each one sits on his canvas.
 *
 * This replaces asking for twenty separate exports. His composed file is the
 * only source of truth: positions, colours and gradient axes all come from it,
 * so nothing has to be guessed or re-registered. Named layers are what make it
 * possible — before he named them, every group came through as "Layer_1".
 *
 * Heavy layers become WebP. That is never about quality: a layer of 10,000
 * shapes costs the browser hundreds of milliseconds before it paints anything,
 * at any size. Everything else stays vector and is untouched.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC  = ROOT + '/incoming/Website2.svg';
const OUT  = ROOT + '/assets/scene/';
const SHAPE_LIMIT = 2000;          /* over this, raster beats vector */

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--ignore-certificate-errors','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{ width:2472, height:900 }, deviceScaleFactor:1.5 });
  await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>' +
    fs.readFileSync(SRC,'utf8'));
  await page.waitForTimeout(6000);

  const layers = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const out = [];
    const seen = new Set();
    const walk = (el, depth) => {
      [...el.children].forEach(c => {
        if (c.tagName !== 'g') return;
        const n = c.getAttribute('data-name') || c.getAttribute('id') || '';
        let b; try { b = c.getBBox(); } catch (e) { b = null; }
        const isGroup = ['Layer 1','Roads','Clouds','Signs','Text'].includes(n);
        if (n && b && b.width && !isGroup && !seen.has(n)) {
          seen.add(n);
          out.push({ name: n, x:+b.x.toFixed(2), y:+b.y.toFixed(2),
                     w:+b.width.toFixed(2), h:+b.height.toFixed(2),
                     shapes: c.querySelectorAll('path,rect,circle,polygon,ellipse,image,text').length });
        }
        if (depth < 2) walk(c, depth + 1);
      });
    };
    walk(svg, 0);
    return { canvas: { w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height }, out };
  });

  const enc = await browser.newPage();
  const manifest = [];
  for (const L of layers.out) {
    if (L.name === 'Text') continue;
    const heavy = L.shapes > SHAPE_LIMIT;
    const file = L.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase().replace(/^-|-$/g,'');

    /* show only this layer, so nothing behind it bleeds into the cut */
    await page.evaluate(name => {
      const svg = document.querySelector('svg');
      svg.querySelectorAll('g').forEach(g => { g.dataset.h = ''; g.style.display = ''; });
      const target = [...svg.querySelectorAll('g')].find(g =>
        (g.getAttribute('data-name') || g.getAttribute('id')) === name);
      const keep = new Set(); for (let n = target; n; n = n.parentElement) keep.add(n);
      svg.querySelectorAll('g').forEach(g => {
        if (!keep.has(g) && !target.contains(g)) g.style.display = 'none';
      });
    }, L.name);
    await page.waitForTimeout(120);

    let out;
    if (heavy) {
      await page.setViewportSize({ width: 2472, height: Math.min(2400, Math.ceil(L.h) + 20) });
      await page.evaluate(y => window.scrollTo({top:y,behavior:'instant'}), L.y);
      await page.waitForTimeout(200);
      const png = await page.screenshot({ omitBackground: true,
        clip: { x: L.x, y: 0, width: Math.round(L.w), height: Math.round(L.h) } });
      const url = await enc.evaluate(async b64 => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/webp', 0.86);
      }, png.toString('base64'));
      out = { ext: 'webp', bytes: Buffer.from(url.split(',')[1], 'base64') };
    } else {
      let svgText = await page.evaluate(name => {
        const src = document.querySelector('svg');
        const target = [...src.querySelectorAll('g')].find(g =>
          (g.getAttribute('data-name') || g.getAttribute('id')) === name);
        const b = target.getBBox();
        const defs = src.querySelector('defs');
        return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" ' +
          'xmlns:xlink="http://www.w3.org/1999/xlink" width="' + b.width.toFixed(2) + '" height="' +
          b.height.toFixed(2) + '" viewBox="' + [b.x,b.y,b.width,b.height].map(n=>n.toFixed(2)).join(' ') +
          '">\n' + (defs ? defs.outerHTML : '') + '\n' + target.outerHTML + '\n</svg>\n';
      }, L.name);
      /* Illustrator writes blend modes as an XML attribute, which every
         browser ignores — a "multiply" shadow then renders as flat grey and
         the piece looks like it has no shadow at all. Lifting the markup
         straight out of the DOM carries that bug through untouched, which is
         exactly what happened: 30 shadows across the scene, all dead. */
      var moved = 0;
      svgText = svgText.replace(/\smix-blend-mode="([a-z-]+)"/g, function (m, mode) {
        moved++; return ' style="mix-blend-mode:' + mode + '"';
      });
      if (moved) console.log('    ' + L.name + ': ' + moved + ' blend mode(s) -> inline CSS');

      /* Every piece carries a copy of his whole <defs>. Inlined side by side —
         which they must be, or their shadows cannot see the page — they would
         fight over every gradient id and repaint each other. Prefix per file. */
      var ids = new Set([...svgText.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
      [...ids].sort((a,b) => b.length - a.length).forEach(function (id) {
        var q = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        svgText = svgText
          .replace(new RegExp('\\bid="' + q + '"', 'g'), 'id="' + file + '-' + id + '"')
          .replace(new RegExp('url\\(#' + q + '\\)', 'g'), 'url(#' + file + '-' + id + ')')
          .replace(new RegExp('(\\b(?:xlink:)?href=")#' + q + '"', 'g'), '$1#' + file + '-' + id + '"');
      });
      out = { ext: 'svg', bytes: Buffer.from(svgText, 'utf8') };
    }
    fs.writeFileSync(OUT + file + '.' + out.ext, out.bytes);
    manifest.push({ name: L.name, file: file + '.' + out.ext,
                    x: L.x, y: L.y, w: L.w, h: L.h, shapes: L.shapes,
                    kb: +(out.bytes.length/1024).toFixed(0) });
  }
  await browser.close();

  fs.writeFileSync(ROOT + '/tools/scene-manifest.json',
    JSON.stringify({ canvas: layers.canvas, layers: manifest }, null, 2));
  console.log('canvas ' + layers.canvas.w.toFixed(2) + ' x ' + layers.canvas.h.toFixed(2) + '\n');
  console.log('  layer                  file                        x       y       w       h  shapes    size');
  manifest.forEach(m => console.log('  ' + m.name.slice(0,21).padEnd(23) + m.file.padEnd(26) +
    String(m.x).padStart(7) + String(m.y).padStart(8) + String(m.w).padStart(8) +
    String(m.h).padStart(8) + String(m.shapes).padStart(7) + (m.kb + 'K').padStart(8)));
})();

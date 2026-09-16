#!/usr/bin/env node
/* WHAT COLOUR DID HE PAINT THIS, IN HIS OWN NIGHT?
 *
 * He asked for his artboards to be followed item by item rather than a
 * brightness laid over the daylight, and the artboards are 200KB of Illustrator
 * output each - too much to read by eye. This puts one of them in a browser and
 * asks the DOM the only two questions that matter for each shape: where is it,
 * and what colour is it. Gradients are resolved to their stops, opacity and
 * blend mode are reported, and everything is in HIS artboard units so a number
 * here can be compared with a number in the day file directly.
 *
 *   node tools/his_colours.js 1                    every named group
 *   node tools/his_colours.js 1 Hero_Sign          one group, shape by shape
 *   node tools/his_colours.js 1 --box 0,294,1920,157   whatever is in a window
 *
 * Areas are the shape's own bounding box, so the list is ordered by what you
 * would actually see. Shapes smaller than 0.01% of the artboard are dropped.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');

const UP = '/root/.claude/uploads/1a554a96-134b-52ef-894a-d9448b97add1';
const board = process.argv[2] || '1';
const file = fs.readdirSync(UP).find(f => f.includes('nightArtboard_' + board));
if (!file) { console.error('no artboard ' + board); process.exit(1) }

const args = process.argv.slice(3);
const boxAt = args.indexOf('--box');
const win = boxAt >= 0 ? args[boxAt + 1].split(',').map(Number) : null;
const group = boxAt === 0 ? null : args[0] && !args[0].startsWith('--') ? args[0] : null;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 1200, height: 900 } });
  await p.setContent('<body style="margin:0">' + fs.readFileSync(path.join(UP, file), 'utf8') + '</body>');
  const out = await p.evaluate(({ group, win }) => {
    const svg = document.querySelector('svg');
    const vb = svg.viewBox.baseVal;
    const named = e => { for (let n = e; n; n = n.parentElement)
      if (n.id && !/^(Layer_|clippath|linear-|radial-|W5M0)/.test(n.id)) return n.id; return '-' };
    /* a gradient is reported as its stops, because that is what he set */
    const paint = v => {
      const m = /url\(["']?#(.+?)["']?\)/.exec(v);
      if (!m) return v;
      let g = document.getElementById(m[1]);
      /* Illustrator chains gradients through xlink:href */
      for (let i = 0; g && !g.querySelector('stop') && i < 4; i++)
        g = document.getElementById((g.getAttribute('xlink:href') || g.getAttribute('href') || '#').slice(1));
      if (!g) return v;
      return [...g.querySelectorAll('stop')].map(s => {
        const c = getComputedStyle(s);
        return c.stopColor + (c.stopOpacity !== '1' ? '@' + (+c.stopOpacity).toFixed(2) : '');
      }).join(' -> ');
    };
    const rows = [];
    for (const e of svg.querySelectorAll('path,rect,polygon,circle,ellipse,line,polyline')) {
      let b; try { b = e.getBBox() } catch { continue }
      if (b.width * b.height < vb.width * vb.height * 1e-4) continue;
      if (group && named(e) !== group) continue;
      if (win && (b.x > win[0] + win[2] || b.x + b.width < win[0] ||
                  b.y > win[1] + win[3] || b.y + b.height < win[1])) continue;
      const c = getComputedStyle(e);
      let op = 1; for (let n = e; n && n !== svg; n = n.parentElement) op *= +getComputedStyle(n).opacity;
      rows.push({ g: named(e), tag: e.tagName,
        box: [b.x, b.y, b.width, b.height].map(n => Math.round(n)).join(','),
        area: b.width * b.height,
        fill: paint(c.fill), stroke: c.stroke === 'none' ? '' : paint(c.stroke),
        op: +op.toFixed(2), blend: c.mixBlendMode === 'normal' ? '' : c.mixBlendMode });
    }
    return { vb: [vb.width, vb.height], rows };
  }, { group, win });

  console.log(file.replace(/^[0-9a-f]+-/, '') + '   ' + out.vb.join(' x '));
  const rows = out.rows.sort((a, b) => b.area - a.area);
  const seen = new Map();
  for (const r of rows) {
    if (!group && !win) {           /* summary: one line per group per colour */
      const k = r.g + '|' + r.fill;
      if (seen.has(k)) { seen.get(k).n++; continue }
      seen.set(k, r); r.n = 1;
    }
  }
  const show = (!group && !win) ? [...seen.values()] : rows;
  console.log('group'.padEnd(24) + 'fill'.padEnd(34) + 'op'.padEnd(6) + 'box (his units)');
  for (const r of show)
    console.log(r.g.padEnd(24) + r.fill.slice(0, 58).padEnd(59) +
      String(r.op).padEnd(6) + r.box + (r.n > 1 ? '   x' + r.n : '') +
      (r.blend ? '  ' + r.blend : '') + (r.stroke ? '  stroke ' + r.stroke.slice(0, 20) : ''));
  await br.close();
})();

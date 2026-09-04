#!/usr/bin/env node
/* HIS FOUR PALMS AND HIS FOUR SHADOWS, AS SPRITES.
 *
 * WHY SPRITES AND NOT VECTOR. The four trees carry 247 shapes and 246 of his
 * gradients - one per frond - and as vector that is 214KB before a single tree
 * is planted. The weight is survivable; the frame cost is not. A palm here is
 * never still: it grows the whole way past the camera, and a <use> of a
 * gradient-filled group has to be re-rasterised at every new scale. Rasterised
 * once, the compositor scales it for nothing.
 *
 * WHY HIS SHADOWS AND NOT A DERIVED ONE. A shadow can be faked by flipping the
 * tree onto the ground and skewing it, and it is always wrong: a front-view
 * cut-out laid flat gives a smear, not a palm. He DREW the shadows - groups
 * 4 to 13 of his file, one under each tree, at 54% - properly projected, and
 * they are the only correct answer.
 *
 * A DRAWN SHADOW CAN COME APART FROM WHAT CASTS IT, which is the one risk, so
 * it is never placed on its own: what is written out is the shadow's size and
 * its offset from the TREE'S FOOT, both as multiples of the tree's own height.
 * The scene multiplies those by whatever height the tree is drawn at, so the
 * two are one object at every distance.
 *
 * Each tree is paired with the shadow whose corner lies nearest its foot,
 * which is unambiguous in his file - the nearest is 18 to 34 units away and
 * the runner-up is never closer than 180.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'assets', 'v2', 'section-05');
const H = 1024;
const TREES = { a: 14, b: 15, c: 18, d: 19 };
const SHADOWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const src = fs.readFileSync(path.join(DIR, 'highway-ppv-src.svg'), 'utf8');
  const page = await br.newPage({ viewport: { width: 1200, height: 700 } });
  await page.setContent('<body style="margin:0">' + src + '</body>');

  const plan = await page.evaluate(({ TREES, SHADOWS }) => {
    const svg = document.querySelector('svg');
    let g = svg.querySelector('g');
    while (g && [...g.children].filter(c => c.tagName === 'g').length < 5) {
      const n = [...g.children].find(c => c.tagName === 'g'); if (!n) break; g = n;
    }
    const kids = [...g.children];
    const box = i => { const b = kids[i].getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height } };
    const out = {};
    for (const [name, ti] of Object.entries(TREES)) {
      const t = box(ti), foot = { x: t.x + t.w / 2, y: t.y + t.h };
      let best = null;
      for (const si of SHADOWS) {
        const s = box(si);
        const d = Math.hypot(s.x - foot.x, s.y - foot.y);
        if (!best || d < best.d) best = { si, s, d };
      }
      out[name] = { ti, tree: t, si: best.si, sh: best.s, d: Math.round(best.d),
        /* everything the scene needs, in multiples of the tree's own height */
        ratio: { w: best.s.w / t.h, h: best.s.h / t.h,
                 dx: (best.s.x - foot.x) / t.h, dy: (best.s.y - foot.y) / t.h } };
    }
    return out;
  }, { TREES, SHADOWS });
  await page.close();

  /* A tree is drawn up to ~930 px tall on a 4K screen, so it is rasterised at
   * H. Its shadow is never drawn taller than a quarter of that - his own
   * numbers put it at 0.25 of the tree's height - so rasterising it at the
   * same H is paying for pixels nobody ever sees. WebP keeps alpha lossless,
   * which is where a cut-out's weight actually lives, so resolution is the
   * only lever that moves it: half-size shadows cost half the section. */
  const shot = async (index, file, vb, scale) => {
    const [, , w, h] = vb;
    const Hh = Math.round(H * (scale || 1));
    const W = Math.max(2, Math.round(Hh * w / h));
    const p = await br.newPage({ viewport: { width: W, height: Hh } });
    await p.setContent('<body style="margin:0">' + src + '</body>');
    await p.evaluate(({ index, vb, W, Hh }) => {
      const svg = document.querySelector('svg');
      let g = svg.querySelector('g');
      while (g && [...g.children].filter(c => c.tagName === 'g').length < 5) {
        const n = [...g.children].find(c => c.tagName === 'g'); if (!n) break; g = n;
      }
      const el = [...g.children][index];
      const one = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      one.setAttribute('viewBox', vb.join(' '));
      one.setAttribute('width', W); one.setAttribute('height', Hh);
      one.style.cssText = 'display:block';
      const defs = document.querySelector('defs');
      if (defs) one.appendChild(defs.cloneNode(true));
      one.appendChild(el.cloneNode(true));
      document.body.innerHTML = ''; document.body.appendChild(one);
    }, { index, vb, W, Hh });
    await p.waitForTimeout(280);
    const png = await p.screenshot({ omitBackground: true });
    const webp = await p.evaluate(async d => {
      const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      return c.toDataURL('image/webp', 0.9).split(',')[1];
    }, png.toString('base64'));
    fs.writeFileSync(path.join(DIR, file), Buffer.from(webp, 'base64'));
    await p.close();
    return (fs.statSync(path.join(DIR, file)).size / 1024).toFixed(1) + 'K';
  };

  const rows = [], geo = {};
  for (const [name, p] of Object.entries(plan)) {
    const t = await shot(p.ti, 'palm-' + name + '.webp', [p.tree.x, p.tree.y, p.tree.w, p.tree.h]);
    const s = await shot(p.si, 'palm-' + name + '-shadow.webp', [p.sh.x, p.sh.y, p.sh.w, p.sh.h], 0.5);
    geo[name] = { w: +p.ratio.w.toFixed(4), h: +p.ratio.h.toFixed(4),
                  dx: +p.ratio.dx.toFixed(4), dy: +p.ratio.dy.toFixed(4) };
    rows.push(name + ': tree[' + p.ti + '] ' + t + ' + shadow[' + p.si + '] ' + s +
      ' (' + p.d + ' from its foot)');
  }
  fs.writeFileSync(path.join(DIR, 'palms.json'), JSON.stringify(geo, null, 2) + '\n');
  await br.close();
  console.log(rows.join('\n'));
  console.log('palms.json  ' + JSON.stringify(geo));
})();

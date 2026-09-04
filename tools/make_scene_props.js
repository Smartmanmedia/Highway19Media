#!/usr/bin/env node
/* HIS STREET LAMPS AND HIS WAVE LINES, cut out of the two files he drew.
 *
 * He drew each lamp eight times over, once per distance - but the scene has a
 * projection, so it only needs the shape twice: mast-on-the-right with the arm
 * reaching left (which stands on the seaward verge) and its mirror. Groups 4
 * and 8 are the two biggest, so they are the ones that rasterise cleanly.
 *
 * The waves are five lines in one strip. Each is cut on its own so the scene
 * can lay them at five different depths and let the projection space them.
 *
 * As with the palms, what comes out is not just a picture: fx is where the
 * MAST stands across its own sprite, read off the ink, because a lamp is
 * planted by its mast and not by the middle of its bounding box.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const DIR = path.join(__dirname, '..', 'assets', 'v2', 'section-05');

const JOBS = [
  { src: 'street-lights-src.svg', group: 'Layer_1-2',
    out: [['lamp-r', 3], ['lamp-l', 7]], H: 900, foot: true },
  { src: 'wave-lines-src.svg', group: 'Wave_lines',
    out: [['wave-1', 0], ['wave-2', 1], ['wave-3', 2], ['wave-4', 3], ['wave-5', 4]],
    W: 1536, foot: false },
];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const geo = {};
  for (const job of JOBS) {
    const src = fs.readFileSync(path.join(DIR, job.src), 'utf8');
    const page = await br.newPage({ viewport: { width: 1200, height: 700 } });
    await page.setContent('<body style="margin:0">' + src + '</body>');
    const boxes = await page.evaluate(id => {
      const g = document.querySelector('#' + id) || document.querySelector('g g');
      return [...g.children].map(c => { const b = c.getBBox();
        return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    }, job.group);
    await page.close();

    for (const [name, idx] of job.out) {
      const b = boxes[idx];
      const Hh = job.H ? job.H : Math.max(2, Math.round(job.W * b.h / b.w));
      const W = job.H ? Math.max(2, Math.round(job.H * b.w / b.h)) : job.W;
      const p = await br.newPage({ viewport: { width: job.foot ? W : 800,
                                              height: job.foot ? Hh : 600 } });
      await p.setContent('<body style="margin:0">' + src + '</body>');
      await p.evaluate(({ id, idx, b, W, Hh }) => {
        const g = document.querySelector('#' + id) || document.querySelector('g g');
        const el = [...g.children][idx];
        const one = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        one.setAttribute('viewBox', [b.x, b.y, b.w, b.h].join(' '));
        one.setAttribute('width', W); one.setAttribute('height', Hh);
        one.style.cssText = 'display:block';
        const defs = document.querySelector('defs');
        if (defs) one.appendChild(defs.cloneNode(true));
        one.appendChild(el.cloneNode(true));
        document.body.innerHTML = ''; document.body.appendChild(one);
      }, { id: job.group, idx, b, W, Hh });
      await p.waitForTimeout(job.foot ? 260 : 40);
      /* A WAVE IS 2200 LONG AND SIXTEEN TALL, and a page screenshot of a
       * viewport that shape never comes back - the renderer sits there. So the
       * strips are drawn through a canvas instead: hand the browser the one
       * path with its own defs as an SVG data URI and let it rasterise into a
       * bitmap of whatever shape is asked for. No viewport involved. */
      const png = job.foot ? (await p.screenshot({ omitBackground: true })).toString('base64') : null;
      const out = await p.evaluate(async ({ d, foot }) => {
        const i = new Image();
        i.src = d ? 'data:image/png;base64,' + d
                  : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                      new XMLSerializer().serializeToString(document.querySelector('svg')));
        await i.decode();
        const c = document.createElement('canvas');
        c.width = i.width || innerWidth; c.height = i.height || innerHeight;
        const cx = c.getContext('2d'); cx.drawImage(i, 0, 0);
        let fx = 0.5;
        if (foot) {   /* the base of the mast, the same way the palms find theirs */
          const rows = Math.max(2, Math.round(c.height * 0.03));
          const px = cx.getImageData(0, c.height - rows, c.width, rows).data;
          let s = 0, w = 0;
          for (let y = 0; y < rows; y++) for (let x = 0; x < c.width; x++) {
            const a = px[(y * c.width + x) * 4 + 3]; if (a < 40) continue;
            s += x * a; w += a;
          }
          if (w) fx = (s / w) / c.width;
        }
        return { webp: c.toDataURL('image/webp', 0.9).split(',')[1], fx };
      }, { d: png, foot: job.foot });
      fs.writeFileSync(path.join(DIR, name + '.webp'), Buffer.from(out.webp, 'base64'));
      await p.close();
      geo[name] = { ar: +(b.w / b.h).toFixed(4), fx: +out.fx.toFixed(4) };
      console.log(name.padEnd(8), W + 'x' + Hh,
        (fs.statSync(path.join(DIR, name + '.webp')).size / 1024).toFixed(1) + 'K',
        ' aspect ' + geo[name].ar + (job.foot ? '  mast at ' + (out.fx * 100).toFixed(1) + '%' : ''));
    }
  }
  fs.writeFileSync(path.join(DIR, 'props.json'), JSON.stringify(geo, null, 2) + '\n');
  await br.close();
  console.log('props.json  ' + JSON.stringify(geo));
})();

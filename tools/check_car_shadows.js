#!/usr/bin/env node
/* IS THERE A SHADOW UNDER EACH CAR, AND IS IT ON THE RIGHT SIDE?
 *
 * ONE screenshot, no toggling. Hiding the shadow layer and diffing two shots is
 * the obvious test and it does not work here: every section isolates its own
 * stacking context, so toggling anything inside one makes Chromium recomposite,
 * and a shot taken during that catches the hero sign's shadow half in. That
 * reads as tens of levels of darkening in the right place and passed cars whose
 * shadows were switched off - through six animation frames and 300ms of settle.
 *
 * So this measures the picture as it stands. The sun displaces a shadow by a
 * known vector, the same for every car, which leaves a crescent of shadow
 * sticking out past the car on one side and nothing at all on the other. Points
 * well inside the car are pushed BY that vector to land in the crescent, and by
 * its negative to land on bare road. If the shadow is painting, the crescent is
 * the darker of the two - and if the sun ever gets reversed, this fails too,
 * which a hide-and-diff test never would.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
const W = 1500, H = 1000;

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: W, height: H } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/highway19-v2.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1600);
  await p.evaluate(() => { document.getAnimations().forEach(a => a.pause());
                           window.requestAnimationFrame = function () { return 0 } });
  await p.waitForTimeout(300);
  const still = await p.screenshot(), again = await p.screenshot();
  if (!still.equals(again)) {
    console.log('FAIL - the page is still moving, nothing measured here means anything');
    await br.close(); process.exit(1);
  }

  const secs = await p.evaluate(() =>
    [...document.querySelectorAll('.traffic .shades')].map(g => g.closest('section').className));

  let checked = 0, bad = 0, thin = 0;
  for (let si = 0; si < secs.length; si++) {
    const plan = await p.evaluate(si => {
      const g = [...document.querySelectorAll('.traffic .shades')][si];
      const sec = g.closest('section');
      sec.scrollIntoView({ block: 'center' });
      /* his sun, the same three numbers traffic.js uses */
      const sw = sec.getBoundingClientRect().width;
      const sun = { x: -0.35 * 1.2 / 100 * sw, y: 0.30 * 1.2 / 100 * sw };
      const out = [];
      for (const u of sec.querySelectorAll('.traffic .cars > use')) {
        /* translate(a b) rotate(ang) scale(k) translate(-cx -cy) - written by
           traffic.js, so it is read back rather than guessed at */
        const t = /translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\(([\d.]+)\)/
                  .exec(u.getAttribute('transform') || '');
        const svg = u.closest('svg');
        if (!t || !svg) continue;
        const o = svg.getBoundingClientRect();
        const id = (u.getAttribute('href') || '').slice(1);
        const src = document.querySelector('svg[aria-hidden] #' + CSS.escape(id));
        if (!src) continue;
        const b = src.getBBox(), k = +t[4];
        const c = { x: o.left + +t[1], y: o.top + +t[2] };
        const a = +t[3] * Math.PI / 180;
        out.push({ id, c, a, hl: b.width * k / 2, hw: b.height * k / 2, sun });
      }
      return out;
    }, si);

    const shot = await p.screenshot();
    const res = await p.evaluate(async ([b64, plan, W]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, cv.width, cv.height).data;
      const lum = (px, py) => {
        px = Math.round(px); py = Math.round(py);
        if (px < 0 || py < 0 || px >= cv.width || py >= cv.height) return null;
        const i = (py * cv.width + px) * 4;
        return .299*d[i] + .587*d[i+1] + .114*d[i+2];
      };
      return plan.map(v => {
        const co = Math.cos(v.a), si = Math.sin(v.a);
        /* PAIRS, AND A MEDIAN. Averaging the two sides does not survive this
           road: one side of a car can be over a white lane dash and the other
           over plain tarmac, and 200 levels of dash swamps the 27 a 30% shadow
           is worth. Each sample is a PAIR - the same point pushed each way -
           and the answer is the median of the pairs, which a few dashes cannot
           move. */
        const pairs = [];
        /* a grid well inside the car, pushed both ways by the sun */
        for (let fl = -0.72; fl <= 0.72; fl += 0.09)
          for (let fw = -0.6; fw <= 0.6; fw += 0.12) {
            const lx = fl * v.hl, ly = fw * v.hw;
            const px = v.c.x + lx * co - ly * si, py = v.c.y + lx * si + ly * co;
            /* push it by the sun, and keep it only once it has left the car */
            const qx = px + v.sun.x, qy = py + v.sun.y;
            const dx = qx - v.c.x, dy = qy - v.c.y;
            const al =  dx * co + dy * si, ac = -dx * si + dy * co;
            if (Math.abs(al) <= v.hl && Math.abs(ac) <= v.hw) continue;
            /* its control is the same point through the car's centre: as far
               out on the far side, where his sun puts nothing */
            const A = lum(qx, qy), B = lum(2 * v.c.x - qx, 2 * v.c.y - qy);
            if (A !== null && B !== null) pairs.push(B - A);
          }
        pairs.sort((a, b) => a - b);
        return { id: v.id, n: pairs.length, on: v.c, pairs: pairs };
      });
    }, [shot.toString('base64'), plan, W]);

    /* PER SECTION, NOT PER CAR. One car gives a few dozen samples and a single
       lane dash or a strip of grass on the control side swings its median by
       more than a shadow is worth. Pooling a section's cars drowns that: the
       road under one car is another car's dash and the only thing every sample
       has in common is the sun. */
    const pool = [];
    let cars = 0;
    for (const r of res) {
      if (r.on.x < 40 || r.on.y < 40 || r.on.x > W - 40 || r.on.y > H - 40) continue;
      if (r.n < 8) { thin++; continue; }
      cars++; pool.push.apply(pool, r.pairs);
    }
    if (!cars) continue;
    pool.sort((a, b) => a - b);
    const med = pool[pool.length >> 1];
    checked += cars;
    const ok = med >= 6;
    if (!ok) bad++;
    console.log('  ' + secs[si].padEnd(6) + cars + ' cars, ' + pool.length +
      ' samples: the sun side is ' + med.toFixed(1) + ' darker' +
      (ok ? '' : '   <- NO SHADOW'));
  }
  console.log(checked + ' cars measured across ' + secs.length + ' sections, ' +
    bad + ' section(s) with no shadow on the sun side' +
    (thin ? '   (' + thin + ' cars too small to sample)' : ''));
  if (!checked) { console.log('FAIL - nothing was actually measured'); process.exit(1) }
  await br.close();
  process.exit(bad ? 1 : 0);
})();

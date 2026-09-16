#!/usr/bin/env node
/* DOES THE TRAFFIC ACTUALLY STOP AND GO?
 *
 * A jam is emergent, so the constants being set is not the answer - the same
 * numbers can settle into a convoy that never varies. This watches the running
 * simulation: traffic.js publishes its roads, so every car's speed and its own
 * top speed can be read straight off rather than inferred from how far a sprite
 * moved between two screenshots.
 *
 * That distinction matters. A first version measured pixels and called a car
 * slow when it fell under its own MEDIAN speed - which is exactly the number a
 * car in a stop-and-go wave has half the time, so a road full of waves scored
 * the same as a road with none.
 *
 * A road nobody is looking at is parked, so each is brought on screen in turn.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 1500, height: 1000 } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'build/v2/page.html'));
  await p.waitForTimeout(1800);
  if (!await p.evaluate(() => !!window.H19_TRAFFIC)) {
    console.log('FAIL - traffic.js is not running'); await br.close(); process.exit(1);
  }
  const nroads = await p.evaluate(() => window.H19_TRAFFIC.length);
  const T = +(process.argv[3] || 40);
  const per = Math.max(12, Math.round(T * 5 / nroads));

  let bad = 0;
  for (let r = 0; r < nroads; r++) {
    await p.evaluate(r => {
      const rd = window.H19_TRAFFIC[r];
      rd.parts[0].el.scrollIntoView({ block: 'center' });
    }, r);
    await p.waitForTimeout(1500);              /* let the road wake and settle */
    const acc = { stop: 0, slow: 0, n: 0, waves: 0, name: '', have: 0, want: 0 };
    let prevSlow = null;
    for (let t = 0; t < per; t++) {
      await p.waitForTimeout(200);
      const s = await p.evaluate(r => {
        const rd = window.H19_TRAFFIC[r];
        if (!rd.live) return null;
        const v = rd.cars.map(c => c.v / (c.vmax || 1));
        const lane0 = rd.cars.filter(c => c.lane === 0);
        const meanLong = rd.cars.reduce((s, c) => s + c.long, 0) / rd.cars.length;
        const meanVmax = rd.cars.reduce((s, c) => s + c.vmax, 0) / rd.cars.length;
        /* NOBODY MAY TELEPORT. The anti-overlap pass shoves a car clear when
           two end up inside each other, and denser traffic makes that more
           likely - in plain view it is a car vanishing from one place and
           appearing in another. Reading u straight off the simulation catches
           it exactly; a wrap round the end of the road is the one legitimate
           big step and is excluded by size. */
        /* DO ANY TWO CARS OVERLAP? Measured where they are DRAWN, not where
           the simulation thinks they are - which is the whole point, because
           the simulation counts along the centreline and the cars drive half a
           lane either side of it. On the inside of a bend that lane is shorter,
           so cars a car's length apart in centreline units were driving into
           each other, and only there. */
        const nodes = [...rd.parts[0].carG.children];
        const pos = t => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t || '');
                           return m ? [+m[1], +m[2]] : null };
        let worstBite = 0;
        for (const ln of [0, 1]) {
          const idx = rd.cars.map((c, i) => [c, i]).filter(([c]) => c.lane === ln)
                             .sort((a, b) => a[0].u - b[0].u);
          for (let i = 0; i < idx.length; i++) {
            const [a, ai] = idx[i], [b, bi] = idx[(i + 1) % idx.length];
            const pa = pos(nodes[ai] && nodes[ai].getAttribute('transform'));
            const pb = pos(nodes[bi] && nodes[bi].getAttribute('transform'));
            if (!pa || !pb) continue;
            const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
            const need = (a.long + b.long) / 2;
            if (d < need * 3) worstBite = Math.max(worstBite, need - d);
          }
        }
        const u = rd.cars.map(c => c.u), L = rd.len;
        return { v: v, u: u, len: L, bite: worstBite,
                 name: rd.parts.map(q => q.n).join('+'),
                 have: rd.len / lane0.length - meanLong, vmax: meanVmax };
      }, r);
      if (!s) continue;
      if (acc.u && acc.u.length === s.u.length) {
        for (let i = 0; i < s.u.length; i++) {
          let d = Math.abs(s.u[i] - acc.u[i]);
          if (d > s.len / 2) d = s.len - d;                 /* wrapped, not jumped */
          if (d > 60) acc.jumps = (acc.jumps || 0) + 1;     /* 0.2s at cruise is ~17px */
        }
      }
      acc.u = s.u;
      acc.bite = Math.max(acc.bite || 0, s.bite);
      acc.name = s.name; acc.have = s.have; acc.want = s.vmax;
      let slowNow = 0;
      for (const f of s.v) {
        acc.n++;
        if (f < 0.08) acc.stop++;
        else if (f < 0.55) acc.slow++;
        if (f < 0.55) slowNow++;
      }
      /* a WAVE, not just slowness: the number of cars queueing has to rise and
         fall, or the road is simply a uniform crawl */
      if (prevSlow !== null && Math.abs(slowNow - prevSlow) >= 1) acc.waves++;
      prevSlow = slowNow;
    }
    if (!acc.n) { console.log('road ' + r + ': never woke up'); bad++; continue }
    const stop = acc.stop / acc.n * 100, slow = acc.slow / acc.n * 100;
    const churn = acc.waves / per * 100;
    console.log('sec' + acc.name + ':  stopped ' + stop.toFixed(1) +
      '%   queueing ' + slow.toFixed(1) + '%   the queue changes size ' +
      churn.toFixed(0) + '% of ticks   (gap ' + acc.have.toFixed(0) +
      'px, wants ' + (acc.want * 1.7).toFixed(0) + 'px)   teleports ' +
      (acc.jumps || 0) + '   deepest overlap ' + (acc.bite || 0).toFixed(1) + 'px');
    if ((acc.bite || 0) > 4) { bad++;
      console.log('    ^ cars are driving into each other'); }
    if (acc.jumps) { bad++; console.log('    ^ ' + acc.jumps + ' cars teleported'); }
    if (stop + slow < 12) { bad++; console.log('    ^ nobody queues here'); }
    else if (churn < 25) { bad++; console.log('    ^ a uniform crawl, not stop and go'); }
  }
  console.log(bad ? bad + ' road(s) not stopping and going' : 'every road stops and goes');
  await br.close();
  process.exit(bad ? 1 : 0);
})();

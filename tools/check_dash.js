#!/usr/bin/env node
/* WHERE DOES THE SPEEDBOAT ACTUALLY GO?
 *
 * A turning boat's bounding box swells - broadside it is more than twice the
 * width it is bow-on - and the widest moment is not the furthest-left moment,
 * so this is walked rather than reasoned about. Steps the animation through a
 * whole lap and reports the swept box, plus the stretch where it is off the
 * top of the section altogether.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
const W = 1400, STEPS = 440;
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: W, height: 1000 } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'build/v2/page.html'));
  await p.waitForTimeout(1200);

  const r = await p.evaluate(async ([W, STEPS]) => {
    const sec = document.querySelector('.sec1');
    const box = sec.getBoundingClientRect();
    const art = document.querySelector('.cruise-fast .art');
    const an = document.getAnimations().filter(a =>
      a.effect && a.effect.target && a.effect.target.closest &&
      a.effect.target.closest('.cruise-fast'));
    an.forEach(a => a.pause());
    const dur = an[0].effect.getTiming().duration;
    /* the things it must not touch: his road tiles and the section's own left
       edge. Boxes, not ink - a road tile's box IS its tarmac here. */
    const road = [...document.querySelectorAll('.sec1 img.z-road[data-at]')]
      .map(e => e.getBoundingClientRect());
    let L = 1e9, R = -1e9, T = 1e9, B = -1e9, hidden = 0, near = 1e9;
    for (let i = 0; i < STEPS; i++) {
      an.forEach(a => a.currentTime = dur * i / STEPS);
      const b = art.getBoundingClientRect();
      const x0 = (b.left - box.left) / W * 100, x1 = (b.right - box.left) / W * 100;
      const y0 = (b.top - box.top) / W * 100,  y1 = (b.bottom - box.top) / W * 100;
      L = Math.min(L, x0); R = Math.max(R, x1); T = Math.min(T, y0); B = Math.max(B, y1);
      if (y1 <= 0) hidden++;
      for (const t of road) {
        const dx = Math.max(t.left - b.right, b.left - t.right, 0);
        const dy = Math.max(t.top - b.bottom, b.top - t.bottom, 0);
        near = Math.min(near, Math.hypot(dx, dy) / W * 100);
      }
    }
    return { L, R, T, B, near, hidden: hidden / STEPS, dur, secH: box.height / W * 100 };
  }, [W, STEPS]);

  const f = n => n.toFixed(2);
  console.log('swept box, as a share of the section width');
  console.log('  left  ' + f(r.L) + '%   right ' + f(r.R) + '%   -> ' + f(r.R - r.L) + '% wide');
  console.log('  top   ' + f(r.T) + '%   bottom ' + f(r.B) + '%   (section is ' + f(r.secH) + '% tall)');
  console.log('  fully off the top for ' + (r.hidden * 100).toFixed(1) + '% of the lap ('
    + (r.hidden * r.dur / 1000).toFixed(1) + 's of ' + (r.dur / 1000) + 's)');
  console.log('  closest it ever comes to his road: ' + f(r.near) + '% of the width');
  const bad = [];
  if (r.R - r.L > 20) bad.push('wider than the 20% he asked for');
  if (r.L < 0) bad.push('runs off the left edge');
  if (r.hidden < 0.08) bad.push('barely leaves the screen to turn');
  if (r.near < 2) bad.push('crowds the road');
  console.log(bad.length ? 'FAIL - ' + bad.join('; ') : 'OK');
  await br.close();
  process.exit(bad.length ? 1 : 0);
})();

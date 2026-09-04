#!/usr/bin/env node
/* THE FOUR THINGS HE ASKED TO SEE VERIFIED.
 *
 * 1. Day is ZERO, not faint. Measured as pixels, not as a computed opacity:
 *    the page is shot with the beams in the document and again with them cut
 *    out of it, and the two must be identical byte for byte.
 * 2. The beams point along the direction of travel through a bend. Taken from
 *    the geometry, not by eye: the beam group's own transform must match its
 *    car's, and the car's heading must match the road's tangent where it is.
 * 3. A queueing car's beams fall on the road, not across the car in front.
 *    That is depth, so it is checked as depth: every beam must be painted
 *    before every car in the same section.
 * 4. Changing mode fades. There has to be a transition on the thing that
 *    carries the change.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const file = 'file://' + path.resolve(process.argv[2] || 'build/v2/page.html');
  let bad = 0;

  /* ---- day ---- */
  const day = await br.newPage({ viewport: { width: 1400, height: 900 },
                                 colorScheme: 'light' });
  await day.goto(file); await day.waitForTimeout(1800);
  await day.evaluate(() => { document.getAnimations().forEach(a => a.pause());
                             window.requestAnimationFrame = function(){ return 0 } });
  await day.waitForTimeout(300);
  const n = await day.evaluate(() =>
    document.querySelectorAll('.traffic .beams > use').length);
  const before = await day.screenshot();
  await day.evaluate(() => document.querySelectorAll('.traffic .beams')
    .forEach(g => g.remove()));
  await day.waitForTimeout(200);
  const after = await day.screenshot();
  console.log('1. day: ' + n + ' beam sets in the document, and removing every one of them ' +
    (before.equals(after) ? 'changes NOTHING - the day state is zero'
                          : 'CHANGES THE PICTURE - they are showing in daylight'));
  if (!before.equals(after)) bad++;
  await day.close();

  /* ---- night ---- */
  /* NIGHT IS DRIVEN HERE, not left to whatever currently switches it. The page
     is pinned to daylight while he decides what night should be, and a check
     that read the trigger instead of the mechanism would report the lights
     broken every time that decision changes. --night is the mechanism; this
     sets it and tests what it does. */
  const p = await br.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(file); await p.waitForTimeout(1800);
  await p.evaluate(() => document.documentElement.style.setProperty('--night', '1'));
  /* the fade is a second long by design, so wait past it - reading at 1200ms
     caught it at 0.88 and reported the beams unlit */
  await p.waitForTimeout(2000);
  /* THE NIGHT PAGE IS NOT FROZEN. Blanking requestAnimationFrame ends the
     traffic loop for good - putting the function back does not restart it,
     because nothing is left to call it - and the check that reads which way
     the cars are pointing then ran over zero moving cars and passed on
     nothing. Nothing below needs a freeze: a beam and its car are read in one
     evaluate, which cannot be interrupted, and the rest wants movement. */
  const lit = await p.evaluate(() => {
    const g = document.querySelector('.traffic .beams');
    const cs = getComputedStyle(g);
    return { op: +cs.opacity, blend: cs.mixBlendMode,
             night: getComputedStyle(document.documentElement)
                      .getPropertyValue('--night').trim(),
             trans: cs.transitionProperty + ' ' + cs.transitionDuration };
  });
  console.log('   night (--night driven to 1 by this check): opacity ' +
    lit.op + ', blend ' + lit.blend);
  if (lit.op < 0.9) { bad++; console.log('   ^ the beams are not lit at night') }
  if (lit.blend !== 'screen') { bad++; console.log('   ^ blend is not screen') }

  /* ---- 2. heading ---- */
  const head = await p.evaluate(() => {
    const worst = { d: 0 }, seen = [];
    document.querySelectorAll('section').forEach(sec => {
      const beams = [...sec.querySelectorAll('.traffic .beams > use')];
      const cars  = [...sec.querySelectorAll('.traffic .cars > use')];
      if (beams.length !== cars.length) { worst.count = true; return }
      const rot = t => { const m = /rotate\(([-\d.]+)\)/.exec(t || ''); return m ? +m[1] : null };
      const pos = t => { const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(t || '');
                         return m ? [+m[1], +m[2]] : null };
      for (let i = 0; i < cars.length; i++) {
        const bt = beams[i].getAttribute('transform'), ct = cars[i].getAttribute('transform');
        const dr = Math.abs(rot(bt) - rot(ct));
        const bp = pos(bt), cp = pos(ct);
        const dp = Math.hypot(bp[0] - cp[0], bp[1] - cp[1]);
        const d = Math.max(dr, dp);
        if (d > worst.d) { worst.d = d }
        /* is the car itself pointing along the road? compare its heading with
           the direction it is actually travelling, one frame apart */
        seen.push(rot(ct));
      }
    });
    return worst;
  });
  console.log('2. steering: the worst a beam set differs from its own car is ' +
    head.d.toFixed(3) + ' (degrees or px)' +
    (head.d < 0.01 ? ' - they ride the same transform, so they turn with it'
                   : ' - THEY HAVE COME APART'));
  if (head.d > 0.01 || head.count) bad++;

  /* the cars themselves point along the road - measured by moving them */
  const travel = await p.evaluate(() => new Promise(res => {
    const rd = window.H19_TRAFFIC[0];
    const a = rd.cars.map(c => c.u);
    const g = [...document.querySelectorAll('.sec1 .traffic .cars > use')];
    const p0 = g.map(u => /translate\(([-\d.]+) ([-\d.]+)\)/.exec(u.getAttribute('transform')));
    setTimeout(() => {
      const p1 = g.map(u => /translate\(([-\d.]+) ([-\d.]+)\)/.exec(u.getAttribute('transform')));
      const r  = g.map(u => +/rotate\(([-\d.]+)\)/.exec(u.getAttribute('transform'))[1]);
      let worst = 0, n = 0;
      for (let i = 0; i < g.length; i++) {
        if (!p0[i] || !p1[i]) continue;
        const dx = +p1[i][1] - +p0[i][1], dy = +p1[i][2] - +p0[i][2];
        const step = Math.hypot(dx, dy);
        /* barely moved, or wrapped round the end of its road - a car starting
           again at the other end covers the whole page in one sample and reads
           as pointing anywhere. At cruise a car moves about 14px in this
           interval, so 40 is well clear of real motion and well under a wrap. */
        if (step < 3 || step > 40) continue;
        /* the smallest angle between where it points and where it went */
        const diff = Math.atan2(dy, dx) * 180 / Math.PI - r[i];
        const d = Math.abs(((diff % 360) + 540) % 360 - 180);
        worst = Math.max(worst, d); n++;
      }
      res({ worst, n });
    }, 160);
  }));
  console.log('   and the cars point where they are going: worst ' +
    travel.worst.toFixed(1) + ' degrees off its own direction of travel over ' +
    travel.n + ' moving cars');
  /* SOME DIFFERENCE IS CORRECT, NOT A FAULT. A car is drawn along the chord
     through its OWN LENGTH - which is what a long vehicle really does on a
     bend, it cuts in - while this measures the secant of the arc it covered
     between two samples. On a tight curve those are not the same line. Ten
     degrees is the width of that honest gap; anything past it would be a beam
     genuinely pointing off the road. */
  if (travel.worst > 10) { bad++; console.log('   ^ a beam would point off the road') }

  /* ---- 3. depth ---- */
  const depth = await p.evaluate(() => {
    let ok = true, checked = 0;
    document.querySelectorAll('.traffic').forEach(svg => {
      const kids = [...svg.children];
      const b = kids.findIndex(e => e.classList.contains('beams'));
      const c = kids.findIndex(e => e.classList.contains('cars'));
      if (b < 0 || c < 0) return;
      checked++;
      if (b > c) ok = false;
    });
    return { ok, checked };
  });
  console.log('3. depth: in all ' + depth.checked + ' traffic layers the beams are painted ' +
    (depth.ok ? 'BEFORE every car - a beam cannot cross the car in front'
              : 'AFTER the cars - beams will wash over the car in front'));
  if (!depth.ok) bad++;

  /* ---- 4. fade ---- */
  const fade = /opacity/.test(lit.trans) && !/^0s/.test(lit.trans.split(' ').pop());
  console.log('4. mode change: beam group transition is "' + lit.trans + '"' +
    (fade ? ' - it fades' : ' - IT SNAPS'));
  if (!fade) bad++;

  console.log(bad ? bad + ' check(s) failed' : 'all four verified');
  await br.close();
  process.exit(bad ? 1 : 0);
})();

/* Does any band ever bring an edge into the window? Walk the cycle and compare
 * every band's box against the wrapper. */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
(async () => {
  const W = 1990;
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: W, height: 1050 } });
  await p.goto('file://' + path.resolve('dist/highway19-v2.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.querySelector('.sec2').scrollIntoView());
  await p.waitForTimeout(500);

  const info = await p.evaluate(() => {
    const w = document.querySelector('.sec2 .waves');
    return { wrap: w.getBoundingClientRect().toJSON(),
             names: [...w.querySelectorAll('.wave')].map(e => e.getAttribute('class').split(' ')[1]),
             anims: document.getAnimations().filter(a => a.animationName === 'swell').length };
  });
  console.log('animations running:', info.anims, '(expect 4)');
  console.log('window:', Math.round(info.wrap.width) + 'x' + Math.round(info.wrap.height) + 'px\n');

  const worst = {};
  for (let t = 0; t <= 46000; t += 250) {           // two full cycles of the slowest
    await p.evaluate(ms => document.getAnimations()
      .filter(a => a.animationName === 'swell')
      .forEach(a => { a.pause(); a.currentTime = ms; }), t);
    const row = await p.evaluate(() => {
      const w = document.querySelector('.sec2 .waves').getBoundingClientRect();
      return [...document.querySelectorAll('.sec2 .waves .wave')].map(e => {
        const r = e.getBoundingClientRect();
        return { n: e.getAttribute('class').split(' ')[1],
                 left: r.left - w.left, right: w.right - r.right,
                 top: r.top - w.top,  bottom: w.bottom - r.bottom };
      });
    });
    for (const b of row) {
      const o = worst[b.n] || (worst[b.n] = { left: 1e9, right: 1e9, top: 1e9, bottom: 1e9 });
      for (const k of ['left','right','top','bottom']) o[k] = Math.min(o[k], b[k]);
    }
  }
  console.log('smallest margin of his art past the window, over two full cycles:');
  console.log('  band        left     right      top    bottom   (px; negative = an edge is showing)');
  for (const n of info.names) {
    const o = worst[n];
    console.log('  ' + n.replace('wave-','').padEnd(9),
      ...['left','right','top','bottom'].map(k => (o[k] <= 0 ? '' : '!!') + o[k].toFixed(1).padStart(8)));
  }
  await br.close();
})();

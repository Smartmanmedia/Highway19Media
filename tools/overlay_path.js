#!/usr/bin/env node
/* Draw an extracted centreline over the built page, so a path can be checked
 * against his art by eye rather than by trusting the numbers.
 *   node tools/overlay_path.js 01 /tmp/path-01.json  */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const N = process.argv[2], pts = JSON.parse(fs.readFileSync(process.argv[3],'utf8')).points;
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 1400, height: 1000 } });
  await p.goto('file://' + path.resolve('dist/highway19-v2.html'));
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700);
  await p.evaluate(([n, pts]) => {
    const sec = document.querySelector('.sec' + (+n));
    const o = document.createElement('div');
    o.style.cssText = 'position:absolute;inset:0;z-index:99;pointer-events:none';
    o.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">'
      + '<polyline fill="none" stroke="#ff0" stroke-width="0.35" vector-effect="non-scaling-stroke" points="'
      + pts.map(q => q.join(',')).join(' ') + '"/>'
      + pts.map((q,i) => '<circle cx="'+q[0]+'" cy="'+q[1]+'" r="0.45" fill="'+(i?'#f0f':'#0f0')+'"/>').join('')
      + '</svg>';
    sec.appendChild(o);
  }, [N, pts]);
  await p.waitForTimeout(300);
  const el = await p.$('.sec' + (+N));
  await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await el.screenshot({ path: '/tmp/overlay-' + N + '.png' });
  console.log('wrote /tmp/overlay-' + N + '.png');
  await br.close();
})();

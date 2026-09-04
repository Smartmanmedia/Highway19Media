#!/usr/bin/env node
/* HOW CLOSE IS THE NIGHT TO HIS OWN ARTBOARDS?
 *
 * He painted a night version in Illustrator. This puts the built page beside
 * it and reads the same elements off both, so "closer" is a number rather than
 * an opinion. Anything the page draws live - his cars, their lights, the
 * traffic - has no counterpart in a still artboard and is not compared.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path'), fs = require('fs');

/* WHOLE SECTIONS, NOT POINTS. Hand-picked sample points kept landing on
   different things in his artboard and in mine - his rock band where my page
   was, his sand where my surf was - and reported a colour difference that was
   really an aiming error. The median and the quartiles of a whole section
   cannot be aimed wrongly: they say how dark it is and what colour it is
   overall, which is the thing being matched. */
const PAIRS = [[1, '.sec1'], [2, '.sec2'], [3, '.sec3'], [4, '.sec4'], [5, '.sec6']];
const hex = c => '#' + c.map(n => n.toString(16).padStart(2, '0')).join('');
const lum = c => 0.299*c[0] + 0.587*c[1] + 0.114*c[2];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const helper = await br.newPage(); await helper.setContent('<body></body>');
  /* THE SAMPLING HAPPENS IN THE PAGE. A first version handed the whole pixel
     array back across the protocol - seventeen million numbers for one
     screenshot - and simply never returned. Only the handful of colours asked
     for come back. */
  const read = b64 => helper.evaluate(async d => {
    const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const px = x.getImageData(0, 0, i.width, i.height).data;
    const v = [[], [], []], L = [];
    /* every 4th pixel is plenty and keeps this quick */
    for (let k = 0; k < px.length; k += 16) {
      if (px[k+3] < 200) continue;                    /* his transparent margins */
      v[0].push(px[k]); v[1].push(px[k+1]); v[2].push(px[k+2]);
      L.push(0.299*px[k] + 0.587*px[k+1] + 0.114*px[k+2]);
    }
    const q = (a, f) => { a.sort((p, r) => p - r); return a[Math.floor(a.length * f)] };
    return { mid: [q(v[0], .5), q(v[1], .5), q(v[2], .5)],
             dark: q(L.slice(), .15), light: q(L.slice(), .90) };
  }, b64);

  const p = await br.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: 'light' });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/highway19-v2.html'));
  await p.waitForTimeout(2400);
  await p.evaluate(() => { document.documentElement.dataset.mode = 'night';
    /* his artboards have no traffic and no switch in them */
    document.querySelectorAll('.traffic, .mode-switch').forEach(e => e.style.visibility = 'hidden'); });
  await p.waitForTimeout(1600);

  const f = c => '#' + c.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
  let worst = 0;
  console.log('section'.padEnd(9) + 'his median'.padEnd(14) + 'mine'.padEnd(14) +
              'his dark/light'.padEnd(17) + 'mine dark/light'.padEnd(17) + 'off by');
  for (const [ab, sec] of PAIRS) {
    const file = '/tmp/claude-0/night/ab' + ab + '.png';
    if (!fs.existsSync(file)) { console.log('artboard ' + ab + ' not rendered'); continue }
    const H = await read(fs.readFileSync(file).toString('base64'));
    const box = await p.evaluate(s2 => { const r = document.querySelector(s2).getBoundingClientRect();
      return { x: 0, y: Math.max(0, Math.round(r.top + scrollY)), width: 1400,
               height: Math.min(2600, Math.round(r.height)) }; }, sec);
    const M = await read((await p.screenshot({ clip: box, fullPage: true })).toString('base64'));
    const d = Math.hypot(H.mid[0]-M.mid[0], H.mid[1]-M.mid[1], H.mid[2]-M.mid[2]);
    worst = Math.max(worst, d);
    console.log(sec.padEnd(9) + f(H.mid).padEnd(14) + f(M.mid).padEnd(14) +
      (Math.round(H.dark) + ' / ' + Math.round(H.light)).padEnd(17) +
      (Math.round(M.dark) + ' / ' + Math.round(M.light)).padEnd(17) +
      d.toFixed(0) + (d > 30 ? '   <-- off' : ''));
  }
  console.log('worst distance from his colour: ' + worst.toFixed(0) + ' of 441');
  await br.close();
})();

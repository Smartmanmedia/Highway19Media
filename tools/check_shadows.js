#!/usr/bin/env node
/* Does every shadow actually DARKEN what is under it?
 *
 * A computed style is not proof. A shadow whose CSS rule has gone still reports
 * its translate and its opacity quite happily - it simply has no background
 * left to paint, and nothing that reads the DOM can tell. So this reads pixels:
 * hide the shadow, sample where it falls, put it back, sample again, and check
 * the second reading is darker than the first.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const path = require('path');
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.goto('file://' + path.resolve(process.argv[2] || 'dist/highway19-v2.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500);
  /* FREEZE EVERYTHING FIRST. Two screenshots of a page with traffic on it
     differ wherever a car moved, and a max-darkening test happily reports that
     as a shadow - it passed with the bug deliberately put back. */
  await p.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  /* THE TRAFFIC IS NOT A CSS ANIMATION. It drives itself on requestAnimationFrame,
     so pausing the document's animations leaves every car still moving and a
     car that moved between the two shots reads as darkening. Blanking rAF stops
     the loop the next time it asks for a frame. */
  await p.evaluate(() => { window.requestAnimationFrame = function () { return 0 }; });
  await p.waitForTimeout(300);

  const targets = await p.evaluate(() =>
    [...document.querySelectorAll('.sign-shadow, .cast .shade, .rock-layer[style*="--lift"], svg.z-ground[style*="--lift"]')]
      .map((e, i) => { e.dataset.shcheck = i;
        return { i, what: (e.getAttribute('class') || e.tagName) + ' in ' + e.closest('section').className }; }));

  let bad = 0;
  for (const t of targets) {
    const r = await p.evaluate(i => {
      const e = document.querySelector('[data-shcheck="' + i + '"]');
      e.scrollIntoView({ block: 'center' });
      return null;
    }, t.i);
    await p.waitForTimeout(250);
    const sample = async hidden => {
      await p.evaluate(([i, h]) => {
        const e = document.querySelector('[data-shcheck="' + i + '"]');
        e.style.visibility = h ? 'hidden' : '';
      }, [t.i, hidden]);
      await p.waitForTimeout(80);
      /* THE WHOLE BOX, not a point. A round shadow has no ink at 85% down its
         own box, so a single sample says "not painting" about something that
         plainly is. Compare every pixel and take the biggest darkening. */
      const box = await p.evaluate(i => {
        const r = document.querySelector('[data-shcheck="' + i + '"]').getBoundingClientRect();
        const x = Math.round(Math.max(0, Math.min(1598, r.x)));
        const y = Math.round(Math.max(0, Math.min(998, r.y)));
        return { x, y,
                 width:  Math.max(2, Math.round(Math.min(r.width,  1600 - x))),
                 height: Math.max(2, Math.round(Math.min(r.height, 1000 - y))) };
      }, t.i);
      const buf = await p.screenshot({ clip: box });
      return buf;
    };
    const off = await sample(true), on = await sample(false);
    /* DECODE THE PNG. The first version of this averaged the raw bytes of the
       screenshot, which are deflate-compressed and mean nothing - it passed
       happily with the bug deliberately put back. Pixels or it proves nothing. */
    const d = await p.evaluate(async ([a, b]) => {
      const pix = async d64 => {
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i);
          i.src = 'data:image/png;base64,' + d64; });
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, c.width, c.height).data;
      };
      const A = await pix(a), B = await pix(b);
      if (A.length !== B.length) return 0;
      let worst = 0;
      for (let k = 0; k < A.length; k += 4) {
        const la = 0.299*A[k] + 0.587*A[k+1] + 0.114*A[k+2];
        const lb = 0.299*B[k] + 0.587*B[k+1] + 0.114*B[k+2];
        if (la - lb > worst) worst = la - lb;
      }
      return worst;
    }, [off.toString('base64'), on.toString('base64')]);
    if (d < 4) { bad++; console.log('  NOT PAINTING  ' + t.what + '   (no darkening where it falls)'); }
  }
  console.log(targets.length + ' shadow layers checked, ' + bad + ' not painting');
  await br.close();
})();

#!/usr/bin/env node
/* THE LIGHT A STREET LAMP THROWS, baked once.
 *
 * It was three live layers per lamp - a radial for the head, a clip-path
 * triangle for the cone and a second radial for the pool - and every one of
 * them had to be re-rasterised at a new size on every frame, because a lamp in
 * this scene never stops growing. Measured over a scripted scroll that is a
 * third of all the long frames in the night scene, and it is the whole of why
 * the scrolling stuttered after dark. The same lesson his palms taught: a
 * gradient that moves is expensive, a bitmap that moves is free.
 *
 * So the three become ONE bitmap, in one element, and the compositor scales it
 * for nothing.
 *
 * THE CONE IS A RIGHT TRIANGLE, 0 to 45 degrees. A street lamp does not shine
 * straight down and it does not shine symmetrically either: the near edge
 * drops vertically past its own mast and the far edge rakes out at 45 across
 * the road. Drawn as a symmetric cone tilted over, which is what it was, it
 * reads as a spotlight on a stage.
 */
const fs = require('fs'), path = require('path');
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const DIR = path.join(__dirname, '..', 'assets', 'v2', 'section-05');

/* the sprite, in multiples of the LAMP'S OWN HEIGHT - the scene multiplies
 * these by whatever height the lamp is drawn at, so the light can never come
 * apart from the lamp */
const BOX_W = 1.10, BOX_H = 1.25;   /* sprite size            */
const HEAD_X = 0.955, HEAD_Y = 0.112; /* the bulb, within it  */
const REACH = 0.95;                 /* how far out at 45      */
const W = 384, H = Math.round(W * BOX_H / BOX_W);

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage({ viewport: { width: 100, height: 100 } });
  await p.setContent('<body></body>');
  const webp = await p.evaluate(({ W, H, HEAD_X, HEAD_Y, REACH, BOX_W }) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const unit = W / BOX_W;                 /* one lamp-height, in pixels */
    const hx = HEAD_X * W, hy = HEAD_Y * H;
    const foot = hy + REACH * unit;         /* where the light lands       */
    const far = hx - REACH * unit;          /* 45 degrees: run = drop      */

    /* the cone */
    const g = x.createLinearGradient(0, hy, 0, foot);
    g.addColorStop(0, 'rgba(255,214,140,.34)');
    g.addColorStop(.45, 'rgba(255,188,84,.15)');
    g.addColorStop(1, 'rgba(255,172,56,.03)');
    x.fillStyle = g; x.beginPath();
    x.moveTo(hx, hy); x.lineTo(hx, foot); x.lineTo(far, foot); x.closePath(); x.fill();

    /* the pool it lands in, along the base of that triangle */
    const cx = (hx + far) / 2, rx = (hx - far) / 2 * 1.06, ry = unit * .075;
    x.save(); x.translate(cx, foot); x.scale(1, ry / rx);
    const pg = x.createRadialGradient(0, 0, 0, 0, 0, rx);
    pg.addColorStop(0, 'rgba(255,200,112,.40)');
    pg.addColorStop(.5, 'rgba(255,176,60,.14)');
    pg.addColorStop(1, 'rgba(255,164,40,0)');
    x.fillStyle = pg; x.beginPath(); x.arc(0, 0, rx, 0, 7); x.fill(); x.restore();

    /* and the bulb's own bloom */
    const r = unit * .105;
    const hg = x.createRadialGradient(hx, hy, 0, hx, hy, r);
    hg.addColorStop(0, 'rgba(255,236,192,.98)');
    hg.addColorStop(.3, 'rgba(255,196,96,.46)');
    hg.addColorStop(1, 'rgba(255,168,44,0)');
    x.fillStyle = hg; x.beginPath(); x.arc(hx, hy, r, 0, 7); x.fill();

    return c.toDataURL('image/webp', 0.86).split(',')[1];
  }, { W, H, HEAD_X, HEAD_Y, REACH, BOX_W });
  fs.writeFileSync(path.join(DIR, 'lamp-light.webp'), Buffer.from(webp, 'base64'));
  await br.close();
  console.log('lamp-light.webp  ' + W + 'x' + H + '  ' +
    (fs.statSync(path.join(DIR, 'lamp-light.webp')).size / 1024).toFixed(1) + 'K');
  console.log('box ' + BOX_W + 'x' + BOX_H + ' lamp-heights, head at ' + HEAD_X + ',' + HEAD_Y);
})();

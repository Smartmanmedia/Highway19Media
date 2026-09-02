#!/usr/bin/env node
/* Cut the scenery run straight out of the owner's composed file.
 *
 * Rebuilding his transitions from separate assets and gradients was never
 * going to be seamless: two backgrounds meeting at a section boundary make a
 * hard edge, and no amount of nudging strip heights fixes that. So take his
 * artwork uncut instead.
 *
 * The run is sliced in three, vertically:
 *   ocean   his waves and the sand they run into  — fixed aspect, never stretched
 *   flat    pure sand gradient between them       — stretches invisibly
 *   land    desert, mountains, canopy, into green — fixed aspect, never stretched
 *
 * The middle is the only part that stretches, and it is a flat gradient, so it
 * can stretch as far as the copy needs. The two transitions are his pixels.
 * Edge colours are sampled so the flat fill matches both neighbours exactly.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = ROOT + '/assets/brand/scene/';
const CANVAS_W = 2472.32;
/* His artwork does not fill his canvas: the bands run x 294 to 2214, with bare
   white either side. Slicing the full canvas width would carry those white
   bars into the page, which is the same fault the waves had. */
const ART_X = 294, ART_W = 1920;

/* y ranges on his canvas, read off the layer map in tools/scene-map.json */
const SLICES = [
  /* Each slice has to START and END on a row that is one flat colour right
     across its width, or the band butted against it can never match. His
     waves finish at 2393 and his sand rect runs to 2951, so 2460 is safely
     into flat sand; above, 1900 is clear sky. */
  { name: 'ocean', y0: 1900, y1: 2460 },
  { name: 'land',  y0: 2600, y1: 4300 }
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-proxy-server', '--ignore-certificate-errors', '--no-sandbox'] });
  const page = await browser.newPage({
    viewport: { width: Math.round(CANVAS_W), height: 900 }, deviceScaleFactor: 1.5 });
  await page.setContent('<style>html,body{margin:0;background:#fff}svg{display:block}</style>' +
    fs.readFileSync(ROOT + '/incoming/Website.svg', 'utf8'));
  await page.waitForTimeout(6000);

  /* Scenery only. The composed file also carries his road tiles and his copy;
     both are rebuilt live on the page, and baking them into a background image
     would double them up and freeze the text into a picture. */
  const hidden = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll('text').forEach(t => { t.style.display = 'none'; n++; });
    const TILE = [[106,361],[361,106],[445,471],[471,445]];
    /* The clouds come out too. They straddle the rows a slice has to start and
       end on, so leaving them in means no edge is ever a single flat colour and
       no band can be matched to it. They go back on the page as their own
       floating elements, which is what they should be anyway — they parallax. */
    const CLOUD = [[517,278],[214,215],[323,285],[99,151]];
    const near = (a,b) => Math.abs(a-b) <= 4;
    [...document.getElementById('Layer_1').children].forEach(el => {
      let b; try { b = el.getBBox(); } catch (e) { return; }
      if (!b || !b.width) return;
      if (TILE.concat(CLOUD).some(([w,h]) => near(b.width,w) && near(b.height,h))) {
        el.style.display = 'none'; n++;
      }
    });
    return n;
  });
  console.log('hidden before slicing: ' + hidden + ' road tiles and text runs\n');

  const enc = await browser.newPage();
  const report = [];
  for (const s of SLICES) {
    const h = s.y1 - s.y0;
    await page.setViewportSize({ width: Math.round(CANVAS_W), height: Math.ceil(h) + 40 });
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), s.y0);
    await page.waitForTimeout(400);
    const png = await page.screenshot({ clip: { x: ART_X, y: 0, width: ART_W, height: Math.round(h) } });

    const webp = await enc.evaluate(async ({ b64 }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      /* read the exact colour of the top and bottom rows, so whatever fills the
         gap above and below can match them and leave no seam */
      /* The commonest colour along the edge, not the average: an average of
         sand and a rock is neither, and a fill built from it shows a seam. */
      const row = y => {
        /* middle 60% only — the outer edges can catch a rock or a wave crest */
        const x0 = Math.round(c.width * 0.2), w = Math.round(c.width * 0.6);
        const d = ctx.getImageData(x0, y, w, 1).data;
        const counts = {};
        for (let i = 0; i < d.length; i += 4) {
          const k = d[i] + ',' + d[i+1] + ',' + d[i+2];
          counts[k] = (counts[k] || 0) + 1;
        }
        return Object.entries(counts).sort((a,b) => b[1]-a[1])[0][0].split(',').map(Number);
      };
      /* How uniform is that edge really? A row that is 98% one colour can be
         matched by a flat band; one that is 60% cannot, and butting a band
         against it leaves a visible step. */
      const spread = y => {
        const d = ctx.getImageData(0, y, c.width, 1).data;
        const counts = {};
        for (let i = 0; i < d.length; i += 4) {
          const k = d[i] + ',' + d[i+1] + ',' + d[i+2];
          counts[k] = (counts[k] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
        return Math.round(top[1] / (d.length / 4) * 100);
      };
      return { data: c.toDataURL('image/webp', 0.86),
               top: row(0), bottom: row(c.height - 1),
               topPure: spread(0), botPure: spread(c.height - 1),
               w: c.width, h: c.height };
    }, { b64: png.toString('base64') });

    const bytes = Buffer.from(webp.data.split(',')[1], 'base64');
    fs.writeFileSync(OUT + 'band-' + s.name + '.webp', bytes);
    const hex = c => '#' + c.map(v => v.toString(16).padStart(2,'0')).join('');
    report.push({ name: s.name, px: webp.w + 'x' + webp.h, kb: (bytes.length/1024).toFixed(0),
                  top: hex(webp.top) + ' (' + webp.topPure + '% pure)',
                  bottom: hex(webp.bottom) + ' (' + webp.botPure + '% pure)',
                  ratio: ((s.y1 - s.y0) / ART_W * 100).toFixed(3) });
  }
  await browser.close();

  console.log('slices cut from the composed file:\n');
  report.forEach(r => console.log('  band-' + r.name.padEnd(7) + r.px.padEnd(12) + r.kb + ' KB' +
    '   top ' + r.top + '   bottom ' + r.bottom + '   aspect ' + r.ratio + '% of width'));
  fs.writeFileSync(ROOT + '/tools/scene-slices.json', JSON.stringify(report, null, 2));
})();

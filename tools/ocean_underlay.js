#!/usr/bin/env node
/* His ocean is one big SVG image. When a browser is short of memory it drops
 * raster tiles out of an image's cache and repaints them lazily, and until it
 * gets round to it you see whatever is behind - which was one flat blue, so
 * the ocean looked like it stopped in mid-air.
 *
 * This samples the wave art itself down its own height and writes the colours
 * out as a CSS gradient for the section to paint UNDERNEATH. Normally you
 * never see it. When a tile goes missing you see the right colour at the right
 * height instead of a hole.
 *
 *   node tools/ocean_underlay.js  ->  the CSS to paste into section-02.css
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ART = ROOT + '/assets/v2/section-02/waves.svg';

/* how the image sits in the section, from section-02.html */
const IMG = { left: -15.17, width: 126, top: -1.93 };   /* % of the section */
const SECTION_ASPECT = 931.4 / 1920.8;                   /* height / width */

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--no-sandbox'] });
  const p = await b.newPage({ viewport:{ width: 1200, height: 800 } });
  const W = 2000;                                        /* sample at a good size */
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(ART)).toString('base64');
  await p.setContent('<body style="margin:0"><img id=i style="width:'+W+'px;display:block" src="'+uri+'">');
  await p.waitForFunction(()=>document.getElementById('i').naturalWidth>0);

  /* sample down the middle of the VISIBLE part of the art, not of the image:
     the image is 126% of the section, so 13% runs off each side */
  const fx = (0 - IMG.left) / IMG.width + 0.5 * (100 / IMG.width);
  const rows = await p.evaluate(({fx}) => {
    const im = document.getElementById('i');
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
    const col = Math.round(c.width * fx);
    const d = x.getImageData(col, 0, 1, c.height).data;
    const out = [];
    for (let y = 0; y < c.height; y++)
      out.push({ y: y / (c.height - 1), rgb:[d[y*4],d[y*4+1],d[y*4+2]], a: d[y*4+3] });
    return out;
  }, { fx });
  await b.close();

  /* a stop wherever the colour turns a corner - straight runs need only ends */
  const opaque = rows.filter(r => r.a > 250);
  const keep = [];
  const far = (a, b, t) => Math.max(...a.rgb.map((v,i) => Math.abs(v - b.rgb[i]))) > t;
  for (let i = 0; i < opaque.length; i++) {
    const r = opaque[i];
    if (!keep.length || i === opaque.length - 1) { keep.push(r); continue; }
    const last = keep[keep.length-1], next = opaque[i+1];
    /* keep it if the ramp bends here, or if it is far from a straight line */
    const span = next.y - last.y || 1;
    const lerp = { rgb: last.rgb.map((v,k) => v + (next.rgb[k]-v) * ((r.y-last.y)/span)) };
    if (far(r, lerp, 3)) keep.push(r);
  }

  /* image y -> section y */
  const imgHeightPct = IMG.width * (rows.length / (2000 * (rows.length / rows.length))) ; /* placeholder */
  const toSection = fy => {
    /* the image's own height as a % of the SECTION height */
    const imgWpx = 1, k = 0;                             /* proportions only */
    const imgHpctOfWidth = (IMG.width/100) * (487/2420.2) * 100;   /* art aspect */
    const imgHpctOfSection = imgHpctOfWidth / (SECTION_ASPECT*100) * 100;
    return IMG.top + fy * imgHpctOfSection;
  };

  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
  const stops = keep.map(r => '    ' + hex(r.rgb) + ' ' + toSection(r.y).toFixed(2) + '%');
  console.log('sampled ' + opaque.length + ' opaque rows, kept ' + keep.length + ' stops');
  console.log('  linear-gradient(180deg,\n' + stops.join(',\n') + ')');
})();

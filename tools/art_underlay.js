#!/usr/bin/env node
/* A safety net for any big piece of ground art.
 *
 * When a browser is short of memory it drops raster tiles and repaints them
 * lazily, and until it gets round to it you see whatever is behind - which is
 * how his ocean ended up looking like it stopped in mid-air. This samples the
 * art straight down its own height and writes the colours out as a CSS
 * gradient for the section to paint UNDERNEATH. Normally invisible. When a
 * tile does go missing what shows is the right colour at the right height,
 * with only the shaped edges lost.
 *
 *   node tools/art_underlay.js <art.svg> <left%> <width%> <top%> <sectionAspect> [tolerance]
 *
 * left/width/top are the art's placement in the section, as the section page
 * writes them. sectionAspect is height/width of the section. Tolerance is how
 * far off the colour may drift before it earns a stop - 3 for smooth art like
 * water, 12 or so for art full of detail, where a faithful trace would be
 * dozens of stops through individual rocks and the point is only to have
 * roughly the right colour at roughly the right height.
 */
const { chromium } = require('/home/user/storyboard-app/node_modules/playwright');
const fs = require('fs');
const [ART, LEFT, WIDTH, TOP, ASPECT] = [process.argv[2],
  parseFloat(process.argv[3]), parseFloat(process.argv[4]),
  parseFloat(process.argv[5]), parseFloat(process.argv[6])];
const TOL = parseFloat(process.argv[7] || '3');

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--no-proxy-server','--no-sandbox'] });
  const p = await b.newPage({ viewport:{ width: 1200, height: 800 } });
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(ART)).toString('base64');
  await p.setContent('<body style="margin:0"><img id=i style="width:2000px;display:block" src="'+uri+'">');
  await p.waitForFunction(()=>document.getElementById('i').naturalWidth>0);

  /* sample down the middle of the VISIBLE part of the art, not of the image */
  const fx = (0 - LEFT) / WIDTH + 0.5 * (100 / WIDTH);
  const { rows, ratio } = await p.evaluate(({fx}) => {
    const im = document.getElementById('i');
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height);
    const d = x.getImageData(Math.round(c.width*fx), 0, 1, c.height).data;
    const out = [];
    for (let y = 0; y < c.height; y++)
      out.push({ y: y / (c.height - 1), rgb:[d[y*4],d[y*4+1],d[y*4+2]], a: d[y*4+3] });
    return { rows: out, ratio: c.height / c.width };
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
    const span = next.y - last.y || 1;
    const lerp = { rgb: last.rgb.map((v,k) => v + (next.rgb[k]-v) * ((r.y-last.y)/span)) };
    if (far(r, lerp, TOL)) keep.push(r);
  }

  /* the art's own height as a % of the SECTION height */
  const artHeightPctOfSection = (WIDTH * ratio) / (ASPECT * 100) ;
  const toSection = fy => TOP + fy * artHeightPctOfSection * 100;

  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
  console.log('sampled ' + opaque.length + ' opaque rows of ' + rows.length + ', kept ' + keep.length + ' stops');
  console.log('  linear-gradient(180deg,\n' +
    keep.map(r => '    ' + hex(r.rgb) + ' ' + toSection(r.y).toFixed(2) + '%').join(',\n') + ')');
})();

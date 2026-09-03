#!/usr/bin/env node
/* HIS OWN SUN, read out of a piece of art that still has its shadow baked in.
 *
 * Match the shadow shape in the old file against the shadow he has now exported
 * on its own, then measure how far it sits from the art. That offset IS the
 * light he drew, so the page can be rebuilt in layers and look identical.
 *
 *   node tools/read_cast.js <old-with-shadow.svg> <new-shadow.svg> <new-art.svg>
 */
const fs = require('fs');
const [oldF, shF, artF] = process.argv.slice(2);
const read = f => fs.readFileSync(f, 'utf8');

/* the first 40 characters of a path's curve data are a fingerprint: the same
   shape exported twice keeps them, wherever it has been moved to */
function shapes(svg) {
  return [...svg.matchAll(/<path[^>]*\bd="M(-?[\d.]+),(-?[\d.]+)([^"]{0,40})/g)]
    .map(m => ({ x: +m[1], y: +m[2], key: m[3] }));
}
const oldS = shapes(read(oldF));
const sh = shapes(read(shF))[0];
const art = shapes(read(artF))[0];
const find = t => oldS.find(o => o.key === t.key);
const oS = find(sh), oA = find(art);
if (!oS || !oA) {
  console.error('could not match both shapes in ' + oldF + ' - the exports differ');
  process.exit(1);
}
const dx = oS.x - oA.x, dy = oS.y - oA.y;
const w = +/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(read(artF))[1];
console.log('his shadow sits ' + dx.toFixed(2) + ', ' + dy.toFixed(2) + ' from the art');
console.log('  angle  ' + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1) + ' deg');
console.log('  length ' + Math.hypot(dx, dy).toFixed(2) + ' units = '
  + (100 * Math.hypot(dx, dy) / w).toFixed(3) + '% of its own width');
console.log('  --lift = that, times the element width in cqw');

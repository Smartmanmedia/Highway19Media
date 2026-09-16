#!/usr/bin/env node
/* Centre each label in the space it actually sits in.
 *
 * His labels sit about 11 units left of their panel centres — consistently, so
 * it reads as a drift rather than a decision. The panels are the gaps between
 * his own white dividers, and the banner's two halves are the space either
 * side of the shield, so all six centres come out of his artwork rather than
 * being chosen.
 *
 * Setting text-anchor="middle" and putting the translate at the centre is all
 * it takes: the transform is translate(tx ty) scale(k 1), so a middle-anchored
 * run at local x=0 lands its centre exactly on tx, squeeze and all. */
const fs = require('fs');
const F = '/home/user/highway19media/assets/v2/section-01/hero-sign.svg';

/* from tools/… sign-geom.js, in the sign's own units: his dividers at 234.3,
   478 and 711.1 across a 938-wide plate, and his shield spanning 411.6–546.6
   of a banner running 184–765.7 */
const CENTRES = {
  'Website Design':   117.15,
  'Print Design':     357.30,
  'Video Production': 595.70,
  'Social Media':     825.70,
  'All Roads Lead':   297.80,
  'To Your Business': 656.15,
};
const X0 = 583.47;                      /* the sign's viewBox origin */

let s = fs.readFileSync(F, 'utf8'), n = 0;
s = s.replace(/<text([^>]*)>([\s\S]*?)<\/text>/g, (m, attrs, inner) => {
  const txt = inner.replace(/<[^>]+>/g, '').trim();
  if (!(txt in CENTRES)) return m;
  const want = (CENTRES[txt] + X0).toFixed(2);
  let a = attrs
    .replace(/translate\(\s*[-\d.]+/, 'translate(' + want)
    .replace(/\s*text-anchor="[^"]*"/, '');
  n++;
  return '<text' + a + ' text-anchor="middle">' + inner + '</text>';
});
fs.writeFileSync(F, s);
console.log(n + ' labels centred in their own panels');

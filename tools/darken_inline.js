#!/usr/bin/env node
/* The same shift as tools/darken_art.js, but applied to the art that is INLINE
 * in a section rather than sitting in an asset file.
 *
 * Some of his art has to be inline - an <img>'s raster lives in the browser's
 * image cache and a busy machine drops it - so the asset file is only the
 * record, and recolouring it changes nothing on screen. This walks the inlined
 * <svg class="..."> blocks and nothing else, so the copy, the signs and the
 * road keep their own colours.
 *
 *   node tools/darken_inline.js build/v2/section-04.html z-ground 2.2 0.88 1.18
 */
const fs = require('fs');
const [page, cls, g, d, s] = process.argv.slice(2);
const G = +(g || 2.2), D = +(d || 0.88), S = +(s || 1.18);

function toHsl(r,gg,b){r/=255;gg/=255;b/=255;const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),l=(mx+mn)/2;
  if(mx===mn)return[0,0,l];const dd=mx-mn,ss=l>0.5?dd/(2-mx-mn):dd/(mx+mn);
  let h=mx===r?(gg-b)/dd+(gg<b?6:0):mx===gg?(b-r)/dd+2:(r-gg)/dd+4;return[h/6,ss,l];}
function toRgb(h,ss,l){if(!ss){const v=Math.round(l*255);return[v,v,v];}
  const q=l<0.5?l*(1+ss):l+ss-l*ss,p=2*l-q;
  const f=t=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  return[f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255));}

let html = fs.readFileSync(page, 'utf8');
let total = 0, blocks = 0;
const open = new RegExp('<svg class="' + cls + '"', 'g');
const ONLY = process.argv[7] === undefined ? -1 : +process.argv[7];   /* which block */
let m, out = html, delta = 0, seen = -1;
while ((m = open.exec(html))) {
  /* find this svg's own close, counting nested <svg */
  let i = m.index, depth = 0, end = -1;
  const tag = /<svg\b|<\/svg>/g; tag.lastIndex = i;
  let t;
  while ((t = tag.exec(html))) {
    if (t[0] === '</svg>') { if (--depth === 0) { end = t.index + 6; break; } }
    else depth++;
  }
  if (end < 0) continue;
  seen++;
  if (ONLY >= 0 && seen !== ONLY) continue;   /* his trees share this class */
  const before = html.slice(m.index, end);
  let n = 0;
  const after = before.replace(/#([0-9a-fA-F]{6})\b|#([0-9a-fA-F]{3})\b/g, (mm, six, three) => {
    const hex = six || three.split('').map(c => c + c).join('');
    const [r, gg, b] = [0,2,4].map(k => parseInt(hex.slice(k, k+2), 16));
    let [h, ss, l] = toHsl(r, gg, b);
    l = Math.min(1, Math.pow(l, G) * D); ss = Math.min(1, ss * S);
    n++;
    return '#' + toRgb(h, ss, l).map(v => v.toString(16).padStart(2, '0')).join('');
  });
  out = out.slice(0, m.index + delta) + after + out.slice(end + delta);
  delta += after.length - before.length;
  total += n; blocks++;
}
fs.writeFileSync(page, out);
console.error(page + ' [' + cls + ']: ' + blocks + ' inline block(s), ' + total + ' colours shifted');

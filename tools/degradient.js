#!/usr/bin/env node
/* Illustrator draws a gradient-filled shape as a CLIP plus a stack of abutting
 * solid slivers — one rect per colour step. It is the same trick behind the
 * truss transparency and the hairline seams, and it is expensive: his waves
 * came out as 263 shapes for what is really three gradients.
 *
 * A browser has to raster every one of them. At 5,000 device pixels wide that
 * is enough work that Chromium can hand back a half-painted layer — which is
 * exactly what the ocean did on his screen.
 *
 * This puts the gradient back: each sliver stack becomes ONE path carrying a
 * real <linearGradient>. Stops are read from the slivers themselves, and a
 * midpoint is added wherever his ramp is not linear, so the output is his
 * colour, not an approximation of it.
 *
 *   node tools/degradient.js <file.svg> [...]        rewrites in place
 */
const fs = require('fs');

/* --- the smallest amount of parsing that does the job ------------------- */
const attrs = tag => {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
};
const hex = c => [1,3,5].map(i => parseInt(c.substr(i,2),16));
const toHex = a => '#' + a.map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');

/* Every clip shape in <defs>, by id, as the markup to re-emit. */
function clipShapes(svg) {
  const out = {};
  for (const m of svg.matchAll(/<clipPath\b([^>]*)>([\s\S]*?)<\/clipPath>/g)) {
    const id = attrs(m[1]).id;
    const shape = m[2].match(/<(path|rect|circle|ellipse|polygon)\b[^>]*>/);
    if (id && shape) out[id] = shape[0];
  }
  return out;
}

/* A stack is a run of <rect> that share one axis and step along the other. */
function readStack(body) {
  const rects = [...body.matchAll(/<rect\b([^>]*?)\/?>(?:<\/rect>)?/g)].map(m => attrs(m[1]));
  if (rects.length < 8) return null;
  if (!rects.every(r => /^#[0-9a-fA-F]{6}$/.test(r.fill || ''))) return null;
  /* nothing but rects may live in the group */
  if (/<(?!\/?(rect|g)\b)[a-zA-Z]/.test(body.replace(/<rect\b[^>]*?\/?>(<\/rect>)?/g,''))) return null;
  const num = (r,k) => parseFloat(r[k] || 0);
  const horizontal = new Set(rects.map(r => num(r,'y'))).size === 1;
  const vertical   = new Set(rects.map(r => num(r,'x'))).size === 1;
  if (horizontal === vertical) return null;                 /* neither, or both */
  const along = horizontal ? 'x' : 'y', size = horizontal ? 'width' : 'height';
  const sorted = [...rects].sort((a,b) => num(a,along) - num(b,along));
  const lo = num(sorted[0], along);
  const hi = num(sorted[sorted.length-1], along) + num(sorted[sorted.length-1], size);
  const cross = horizontal
    ? num(rects[0],'y') + num(rects[0],'height')/2
    : num(rects[0],'x') + num(rects[0],'width')/2;
  return { horizontal, lo, hi, cross, count: rects.length,
           /* centre of each sliver, as a fraction of the run, and its colour */
           stops: sorted.map(r => ({
             t: (num(r,along) + num(r,size)/2 - lo) / (hi - lo),
             c: hex(r.fill) })) };
}

/* Two stops if his ramp is linear; extra stops where it is not. */
function stopsFor(stack) {
  const first = stack.stops[0], last = stack.stops[stack.stops.length-1];
  const lerp = t => first.c.map((v,i) => v + (last.c[i]-v) * ((t-first.t)/(last.t-first.t)));
  const keep = [first, last];
  let worst = 0, worstStop = null;
  for (const s of stack.stops) {
    const d = Math.max(...s.c.map((v,i) => Math.abs(v - lerp(s.t)[i])));
    if (d > worst) { worst = d; worstStop = s; }
  }
  if (worst > 3) keep.splice(1, 0, worstStop);             /* one bend is enough */
  return { keep: keep.sort((a,b) => a.t - b.t), worst };
}

function run(file) {
  let svg = fs.readFileSync(file, 'utf8');
  const clips = clipShapes(svg);
  const grads = [];
  let n = 0, saved = 0;
  const base = (file.split('/').pop().replace(/\.svg$/,'')) + '-g';

  svg = svg.replace(/<g\s+clip-path="url\(#([\w-]+)\)"\s*>([\s\S]*?)<\/g>/g, (whole, id, body) => {
    const stack = readStack(body);
    if (!stack || !clips[id]) return whole;
    const { keep, worst } = stopsFor(stack);
    const gid = base + (++n);
    const [x1,y1,x2,y2] = stack.horizontal
      ? [stack.lo, stack.cross, stack.hi, stack.cross]
      : [stack.cross, stack.lo, stack.cross, stack.hi];
    grads.push('<linearGradient id="' + gid + '" x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) +
      '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) + '" gradientUnits="userSpaceOnUse">' +
      keep.map(s => '<stop offset="' + s.t.toFixed(4) + '" stop-color="' + toHex(s.c) + '"/>').join('') +
      '</linearGradient>');
    saved += stack.count - 1;
    console.log('  ' + id + ': ' + stack.count + ' slivers -> 1 ' +
                (stack.horizontal ? 'horizontal' : 'vertical') + ' gradient, ' +
                keep.length + ' stops, worst bend ' + worst.toFixed(1) + '/255');
    /* the clip shape itself, now carrying the gradient */
    return clips[id].replace(/\s*fill="[^"]*"/, '').replace(/\/?>$/, ' fill="url(#' + gid + ')"/>');
  });

  if (!n) { console.log(file + ': nothing to collapse'); return; }
  /* the clipPaths we consumed are now unreferenced */
  svg = svg.replace(/<clipPath\b([^>]*)>([\s\S]*?)<\/clipPath>/g, (whole, a) =>
    svg.includes('url(#' + attrs(a).id + ')') ? whole : '');
  svg = svg.replace(/<defs>/, '<defs>' + grads.join(''));
  const before = fs.statSync(file).size;
  fs.writeFileSync(file, svg);
  console.log(file + ': ' + saved + ' shapes gone, ' + before + 'B -> ' + fs.statSync(file).size + 'B');
}

process.argv.slice(2).forEach(run);

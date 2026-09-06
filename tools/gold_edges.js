#!/usr/bin/env node
/* HIS EDGE LINES GO GOLD, HIS DASHES STAY WHITE.
 *
 * The drive already reads that way - a solid yellow line down each shoulder and
 * a broken white one down the middle - and his top-down sections did not: every
 * marking in them was one colour. This tells the two apart and gives the edges
 * a variable of their own, so night can mute each on its own terms.
 *
 * IT IS DECIDED BY SIZE, because nothing else in the file distinguishes them.
 * They are not grouped consistently - in a straight tile the dashes sit in a
 * <g> and the edges do not, and in a curve tile three dashes are loose
 * siblings of two edges - and they carry no classes. But an edge line runs the
 * whole length of its tile and a dash is a dash: 149 to 325 units against 23 to
 * 28. There is no overlap anywhere near the middle, so a threshold of 40 is not
 * a guess, it is the empty space between two populations.
 *
 * Paths are measured by walking the `d` rather than by trusting its text
 * length. Every one of these is an absolute M followed by relative curves, so
 * the current point has to be carried; the extent of where it goes is the size.
 *
 *   node tools/gold_edges.js
 *
 * Idempotent: a shape already on --edge is left alone.
 */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'build', 'v2');
const LONG = 40;                       /* units: dashes end at 28, edges start at 149 */

/* the extent of a path, by walking it. Only the commands his export actually
   uses are implemented; anything else gives up and is left white, which is the
   safe way round - a dash painted gold would be obvious, an edge left white is
   what it already was. */
function extent(d) {
  const t = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!t) return null;
  let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', started = false;
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  const see = () => { lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y);
                      hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); };
  const n = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'Z') { x = sx; y = sy; see(); continue; }
    if (C === 'M') { const a = n(), b = n();
                     x = rel && started ? x + a : a; y = rel && started ? y + b : b;
                     sx = x; sy = y; started = true; cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { const a = n(), b = n(); x = rel ? x + a : a; y = rel ? y + b : b; }
    else if (C === 'H') { const a = n(); x = rel ? x + a : a; }
    else if (C === 'V') { const a = n(); y = rel ? y + a : a; }
    else if (C === 'C') { n(); n(); n(); n(); const a = n(), b = n();
                          x = rel ? x + a : a; y = rel ? y + b : b; }
    else if (C === 'S' || C === 'Q') { n(); n(); const a = n(), b = n();
                          x = rel ? x + a : a; y = rel ? y + b : b; }
    else if (C === 'T') { const a = n(), b = n(); x = rel ? x + a : a; y = rel ? y + b : b; }
    else if (C === 'A') { n(); n(); n(); n(); n(); const a = n(), b = n();
                          x = rel ? x + a : a; y = rel ? y + b : b; }
    else return null;                  /* unknown command: leave it white */
    see();
  }
  return Math.max(hi[0] - lo[0], hi[1] - lo[1]);
}

const attr = (tag, k) => { const m = tag.match(new RegExp(k + '="([^"]*)"')); return m ? m[1] : null; };

let total = 0, gold = 0;
fs.readdirSync(DIR).filter(f => /^section-\d\d\.html$/.test(f)).forEach(file => {
  const p = path.join(DIR, file);
  let html = fs.readFileSync(p, 'utf8'), n = 0, seen = 0, skipped = 0;
  html = html.replace(/<(rect|path)\b[^>]*fill="var\(--marking\)"[^>]*>/g, tag => {
    seen++;
    let size;
    if (tag.startsWith('<rect')) {
      size = Math.max(parseFloat(attr(tag, 'width')) || 0, parseFloat(attr(tag, 'height')) || 0);
    } else {
      size = extent(attr(tag, 'd') || '');
      if (size === null) { skipped++; return tag; }
    }
    if (size < LONG) return tag;       /* a dash stays white */
    n++;
    return tag.replace('fill="var(--marking)"', 'fill="var(--edge)"');
  });
  if (seen) {
    fs.writeFileSync(p, html);
    console.log(file.padEnd(18) + seen + ' markings, ' + n + ' edges -> gold' +
                (skipped ? ', ' + skipped + ' unparsed' : ''));
  }
  total += seen; gold += n;
});
console.log('---'.padEnd(18) + total + ' markings, ' + gold + ' edges');

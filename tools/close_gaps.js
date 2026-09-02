#!/usr/bin/env node
/* Grow abutting slivers by a hair so they overlap instead of touching.
 *
 * Illustrator draws a gradient inside a clip as a row of rects placed edge to
 * edge. Edge to edge is the problem: at any scale where the edges land on a
 * fraction of a pixel, each one antialiases against its neighbour and leaves a
 * hairline of whatever is behind showing through. In his truss that made a
 * solid rail read as 78% opaque; in his surf it draws vertical lines across
 * the water.
 *
 * Neighbouring slivers differ by about one step of 255 in colour, so an
 * overlap of a few hundredths of a unit cannot be seen. His file is never
 * touched — this writes a copy. */
const fs = require('fs');
const SRC = process.argv[2], DST = process.argv[3] || SRC;
const GROW = parseFloat(process.argv[4] || '0.06');

let n = 0;
const out = fs.readFileSync(SRC, 'utf8')
  .replace(/<rect\b[^>]*>/g, tag => {
    /* only the slivers: a rect that is thin in one axis and long in the other */
    const num = a => { const m = new RegExp(a + '="([\\d.-]+)"').exec(tag); return m ? parseFloat(m[1]) : null; };
    const w = num('width'), h = num('height');
    if (w === null || h === null) return tag;
    if (w < h / 4 && w < 70) { n++; return tag.replace(/width="[\d.-]+"/, 'width="' + (w + GROW).toFixed(3) + '"'); }
    if (h < w / 4 && h < 70) { n++; return tag.replace(/height="[\d.-]+"/, 'height="' + (h + GROW).toFixed(3) + '"'); }
    return tag;
  });
fs.writeFileSync(DST, out);
console.log('  ' + DST.split('/').pop() + ': ' + n + ' slivers overlapped by ' + GROW);

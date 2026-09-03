#!/usr/bin/env node
/* Re-inline an asset SVG into a section page, in place.
 *
 * Some art has to be inline rather than an <img>: an <img> is an isolated
 * document that cannot reach the page's fonts, and its raster lives in the
 * browser's image cache, which a browser short of memory will drop tiles out
 * of - the ocean stopping in mid-air on a busy machine. Inline art is part of
 * the section's own display list and repaints with it.
 *
 * The section keeps a marker comment naming the source, so the file on disk
 * stays the thing you edit:
 *
 *   node tools/inline_art.js build/v2/section-02.html z-ground
 */
const fs = require('fs'), path = require('path');
const [page, cls] = process.argv.slice(2);
if (!page || !cls) { console.error('usage: inline_art.js <section.html> <class>'); process.exit(1); }

let html = fs.readFileSync(page, 'utf8');
const m = html.match(new RegExp('Source: ([\\w/.-]+\\.svg)[\\s\\S]*?<svg class="' + cls + '"[\\s\\S]*?</svg>'));
if (!m) { console.error('no inlined <svg class="' + cls + '"> with a Source: line in ' + page); process.exit(1); }

const src = path.join(__dirname, '..', m[1]);
const art = fs.readFileSync(src, 'utf8').trim();
const root = art.match(/<svg\b[^>]*>/)[0];
const viewBox = root.match(/viewBox="([^"]*)"/)[1];
const inner = art.slice(root.length, -'</svg>'.length);

/* keep whatever style the section already gave it */
const style = m[0].match(/style="([^"]*)"/)[1];
const rebuilt =
  '<svg class="' + cls + '" data-at aria-hidden="true"\n' +
  '     style="' + style + '"\n' +
  '     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n' +
  '     viewBox="' + viewBox + '">' + inner + '</svg>';

html = html.replace(m[0].slice(m[0].indexOf('<svg')), rebuilt);
fs.writeFileSync(page, html);
console.log(cls + ' <- ' + m[1] + ' (' + rebuilt.length + ' bytes)');

#!/usr/bin/env node
/* HIS MOBILE REST-AREA SIGN, AS ART ONLY.
 *
 * He drew the phone's green board himself - the yellow REST AREA banner with
 * the shield hanging off its left end, the board under it, the two turn arrows
 * and the gantry running off behind - and it arrives with the copy set into it
 * as SVG <text> in Highway Gothic. The text comes OUT here, for the same three
 * reasons it came out of the hero board: SVG text cannot wrap, cannot be
 * selected, and does not answer to the page's own type scale. The copy is laid
 * over the art in HTML instead, at the sizes his own file asks for.
 *
 * AND THE SHIELD IS THE ONE WE ALREADY HAVE. His file carries it a second time
 * as a 206KB base64 PNG at 711x713; assets/v2/mobile/shield-badge.png is the
 * same badge at 227x228, cut from his artboard, and to four decimal places the
 * same aspect. Referencing it drops a fifth of a megabyte off the page.
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'incoming/mobile2/rest-area.svg');
const OUT = path.join(ROOT, 'assets/v2/mobile/rest-sign.svg');

let s = fs.readFileSync(SRC, 'utf8');

/* the copy goes to HTML */
const texts = (s.match(/<text[\s\S]*?<\/text>/g) || []);
s = s.replace(/<text[\s\S]*?<\/text>/g, '');

/* THE BADGE COMES FROM THE FILE WE ALREADY SHIP - AND IT TRAVELS INSIDE.
 * His file carries the shield a second time as a 206KB base64 PNG at 711x713;
 * assets/v2/mobile/shield-badge.png is the same badge cut from his artboard at
 * 227x228, the same aspect to four places, and a fifth of the size.
 *
 * It has to be a data URI and not a filename, though, and that cost an hour:
 * this drawing is used as an <img src>, and an SVG loaded as an IMAGE is a
 * sandbox - it fetches nothing, so an <image href="shield-badge.png"> inside it
 * simply does not appear, with no error anywhere. The badge was missing off the
 * banner and the file looked perfectly correct. */
const badge = fs.readFileSync(path.join(ROOT, 'assets/v2/mobile/shield-badge.png'));
const uri = 'data:image/png;base64,' + badge.toString('base64');
s = s.replace(/xlink:href="data:image\/png;base64,[^"]*"/, () => 'xlink:href="' + uri + '"');

/* ids are global once this is inlined into the page */
s = s.replace(/\bid="([^"]+)"/g, 'id="rs-$1"')
     .replace(/url\(#([^)]+)\)/g, 'url(#rs-$1)')
     .replace(/xlink:href="#([^"]+)"/g, 'xlink:href="#rs-$1"');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, s.trim() + '\n');
console.log('rest-sign.svg   ' + Math.round(fs.statSync(OUT).size / 1024) + ' KB');
console.log('copy lifted out:');
texts.forEach(t => {
  const size = (t.match(/font-size="([\d.]+)"/) || [])[1] || '-';
  const lines = (t.match(/<tspan[^>]*>([^<]*)<\/tspan>/g) || [])
    .map(x => x.replace(/<[^>]*>/g, ''));
  console.log('   ' + String(size).padStart(6) + '  ' + lines.join(' / '));
});

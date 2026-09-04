#!/usr/bin/env node
/* HIS LIGHT ON THE SIGN.
 *
 * GreenSIgn_Lights.svg is the beams themselves - the light landing on the
 * board, not a glow around a bulb - drawn against his own sign: four fittings
 * under the four panels throwing up, two over the outside panels throwing
 * down, and two small ones on the gold banner. Each beam is a wedge with a
 * green-to-nothing gradient at a quarter opacity, so it reads as light on
 * paint rather than as a lamp.
 *
 * WHERE IT SITS. His fittings land on the four panel centres of the hero
 * sign - their spacings are 237.6, 240.0 and 232.0 against the sign's own
 * 239.0, 238.4 and 230.0, the short last gap included - so the art is his
 * sign's width less its rounded corners, centred on the board and pinned to
 * the BOTTOM edge, which is what he asked for. That works out at 97.09% of
 * the panel wide, and every offset in night.css comes from those two facts.
 *
 * WHY A SECOND FILE. Section four's board is one green panel with no banner
 * over it, so the two banner fittings and their beams would hang in the air
 * above it. This drops those four pieces and crops the top of the box back to
 * the remaining fittings' mounts, which leaves the same six beams on a plain
 * board. Nothing is redrawn: it is his file with four elements taken out.
 *
 * Both are used as CSS backgrounds, so each is its own document and their
 * gradient ids cannot collide with the page's.
 */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'assets', 'v2');
const src = fs.readFileSync(path.join(DIR, 'ui-sign-lights-src.svg'), 'utf8');

/* THE FITTINGS AND THE BEAMS ARE TWO FILES, because they are on two
   different clocks: the fittings are bolted to the sign and stay there in
   daylight, the light they throw is night only. Splitting them here rather
   than drawing two elements means one box, one set of offsets, and no way
   for the two to drift apart. His polygons are the beams; everything else
   in the file is metal. */
const beams = src.replace(/\s*<g>(?:\s*<rect[^>]*>)+\s*<\/g>/g, '');
const fixtures = src.replace(/\s*<polygon[^>]*\/>/g, '')
                    .replace(/\s*<linearGradient[\s\S]*?<\/linearGradient>/g, '')
                    .replace(/\s*<linearGradient[^>]*\/>/g, '')
                    .replace(/\s*<defs>\s*<\/defs>/, '');
fs.writeFileSync(path.join(DIR, 'ui-sign-lights.svg'), beams);
fs.writeFileSync(path.join(DIR, 'ui-sign-fixtures.svg'), fixtures);

/* the banner pieces. His four panel fittings are 10.03 tall and the two on the
   banner are 7.98 - that is the only thing that separates them in the file, so
   it is what picks them out. Their beams are the two white gradients. */
let board = beams
  .replace(/\s*<polygon[^>]*fill="url\(#linear-gradient-[78]\)"[^>]*\/>/g, '')
  .replace(/\s*<linearGradient id="linear-gradient-[78]"[\s\S]*?<\/linearGradient>/g, '')
  .replace(/\s*<linearGradient id="linear-gradient-8"[^>]*\/>/g, '');

/* CROPPED TO WHAT IS LEFT. 43.2 is the top of the upper fittings' mounts; above
   it the file held nothing but the banner. */
const TOP = 43.2, H = 338.7 - TOP;
board = board
  .replace(/viewBox="0 0 911\.2 338\.7"/, `viewBox="0 ${TOP} 911.2 ${H.toFixed(1)}"`)
  .replace(/height="338\.7"/, `height="${H.toFixed(1)}"`);

fs.writeFileSync(path.join(DIR, 'ui-sign-lights-board.svg'), board);

let boardFix = fixtures
  .replace(/\s*<g>(?:\s*<rect[^>]*>)+\s*<\/g>/g, m => /height="7\.98"/.test(m) ? '' : m)
  .replace(/viewBox="0 0 911\.2 338\.7"/, `viewBox="0 ${TOP} 911.2 ${H.toFixed(1)}"`)
  .replace(/height="338\.7"/, `height="${H.toFixed(1)}"`);
fs.writeFileSync(path.join(DIR, 'ui-sign-fixtures-board.svg'), boardFix);
console.log(['ui-sign-lights', 'ui-sign-fixtures', 'ui-sign-lights-board', 'ui-sign-fixtures-board']
  .map((n, i) => n + ' ' + ([beams, fixtures, board, boardFix][i].length / 1024).toFixed(1) + 'K').join(', '));

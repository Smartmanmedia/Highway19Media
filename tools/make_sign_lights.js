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
/* THE FITTINGS SIT ON THE EDGE, NOT INSIDE IT. His are drawn a few units in
   from the board - the bottom four finish 7.07 above its lower edge, the two
   over the board start 2.23 below its upper one - and a lamp floating on the
   face of a sign reads as a sticker. Each group is moved out along its own
   axis until its body clears the edge by 5, which is what a real fitting
   does: the housing outside, the bracket crossing in.

   THE BEAM GOES WITH IT. Move the lamp and leave the light and there is a gap
   between the two; each beam takes the same shift as the fitting it belongs
   to, so its apex stays on the lamp's face and the light crosses onto the
   board a few units in, exactly as it would.

   His edges, in his own file's units: the board runs 48.04 to 338.70 and the
   banner's top is 9.19. */
const OUT = 5;
const EDGE = { bottom: 338.70, top: 48.04, banner: 9.19 };
const shift = { bottom: (EDGE.bottom + OUT) - 331.63,   /* body foot to 5 below */
                top: (EDGE.top - OUT) - 50.27,          /* body head to 5 above */
                banner: (EDGE.banner - OUT) - 5.62 };
const which = y => y > 300 ? 'bottom' : y > 30 ? 'top' : 'banner';
const move = (body, dy) =>
  '<g transform="translate(0 ' + dy.toFixed(2) + ')">' + body + '</g>';

const beams = src
  .replace(/\s*<g>(?:\s*<rect[^>]*>)+\s*<\/g>/g, '')
  .replace(/<polygon points="([^"]*)"[^>]*\/>/g, (m, pts) => {
    const ys = pts.trim().split(/[ ,]+/).map(Number).filter((_, i) => i % 2);
    /* a beam is named by the end it comes out of: its apex */
    const apex = Math.min(...ys) < 30 ? 'banner' : Math.max(...ys) > 300 ? 'bottom' : 'top';
    return move(m, shift[apex]);
  });
const fixtures = src.replace(/\s*<polygon[^>]*\/>/g, '')
                    .replace(/\s*<linearGradient[\s\S]*?<\/linearGradient>/g, '')
                    .replace(/\s*<linearGradient[^>]*\/>/g, '')
                    .replace(/\s*<defs>\s*<\/defs>/, '')
                    .replace(/<g>((?:\s*<rect[^>]*>)+)\s*<\/g>/g, (m, body) => {
                      const y = +/y="([\d.]+)"/.exec(body)[1];
                      return move(m, shift[which(y)]);
                    });

/* BOTH FILES GET THE SAME LARGER BOX, so one pair of numbers in night.css
   still places the two layers: the fittings now reach 350.8 and the box has
   to hold them, and the beams have to be scaled by the same amount or they
   would come apart from the metal. */
const VB = 'viewBox="0 -8 911.2 360"';
const box = t => t.replace(/width="911\.2" height="338\.7"/, 'width="911.2" height="360"')
                  .replace(/viewBox="0 0 911\.2 338\.7"/, VB);
fs.writeFileSync(path.join(DIR, 'ui-sign-lights.svg'), box(beams));
fs.writeFileSync(path.join(DIR, 'ui-sign-fixtures.svg'), box(fixtures));

/* SECTION FOUR NO LONGER TAKES A VARIANT OF THIS. Its board was redesigned
   and he drew it its own rig - two of its six board fittings sit at the
   right-hand end rather than at the corners, and two more hang on its REST
   AREA banner - so those come out of his own file for that sign, in
   tools/make_our_sign.js. This tool is the gantry's, and only the gantry's. */

console.log('ui-sign-lights ' + (beams.length/1024).toFixed(1) + 'K, ' +
            'ui-sign-fixtures ' + (fixtures.length/1024).toFixed(1) + 'K');

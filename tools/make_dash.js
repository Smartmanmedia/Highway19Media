#!/usr/bin/env node
/* HIS SPEEDBOAT'S RUN, as CSS keyframes.
 *
 * Not a circuit - a RUN. It leaves at the first road curve, opens up straight
 * north, goes off the top of the section entirely, turns round out of sight and
 * comes back down a parallel line, then carves a visible U at the bottom and
 * does it again. Two long straights and two half-circles: a racetrack stood on
 * its end.
 *
 * TWO NUMBERS SHAPE IT. --lane is the gap between the two straights (so the
 * turning radius is half of it) and --run is how long each straight is. Both
 * in cqw, a share of the section, so the whole thing scales with the art.
 *
 * SAMPLED BY ARC LENGTH, not by angle. The straights are two-thirds of the lap
 * and the turns are where all the shape is, so an even split of the timeline
 * would either crawl round the turns or step through them in chunks. Every
 * keyframe's percentage is its distance along the path, which is what makes a
 * `linear` animation hold one speed the whole way round.
 *
 * The boat STEERS, and the heading is unwrapped to -360 over a lap so CSS turns
 * one way and does not spin back at the seam.
 *
 * HIS ART IS NOT DRAWN BOW UP. Measured off the ink itself, the hull's long
 * axis sits 14.35 degrees off vertical (and its shadow 14.26, so one trim
 * straightens both). On the old oval that never showed - a boat that is turning
 * the whole time has no "straight" to be crooked against - but on a 64cqw run
 * up the page a 14-degree lean reads as the boat crabbing sideways. TRIM is
 * subtracted from every heading so that a heading of north draws a boat that is
 * actually pointing north. The yacht's art leans 16 degrees the other way; it
 * is left alone because it never stops turning.
 */
const TRIM = 14.35;
const rad = d => d * Math.PI / 180;
const TURN = 24;                       /* 7.5-degree steps through each half-circle */
const pts = [];

/* x is in units of --lane, y is (a of --run) + (b of --lane) */
const P = (x, a, b, h) => pts.push({ x, a, b, h });

P(0, 0, 0, -TRIM);  P(0, -0.5, 0, -TRIM);      /* up the near straight */
for (let i = 0; i <= TURN; i++) {      /* the turn off the top of the page */
  const f = rad(180 * i / TURN);
  P((-1 + Math.cos(f)) / 2, -1, -0.5 * Math.sin(f), -180 * i / TURN - TRIM);
}
P(-1, -0.5, 0, -180 - TRIM);                  /* down the far straight */
for (let i = 0; i <= TURN; i++) {      /* and the U he can see, at the bottom */
  const f = rad(180 * i / TURN);
  P((-1 - Math.cos(f)) / 2, 0, 0.5 * Math.sin(f), -180 - 180 * i / TURN - TRIM);
}

/* arc length, in the units the shape is written in: the straights measure in
   --run and the turns in --lane, so the two have to be given real values to be
   compared. These are the values the stylesheet sets. */
const LANE = 7.2, RUN = 64;
const at = p => [p.x * LANE, p.a * RUN + p.b * LANE];
let d = 0; const cum = [0];
for (let i = 1; i < pts.length; i++) {
  const [x0, y0] = at(pts[i - 1]), [x1, y1] = at(pts[i]);
  d += Math.hypot(x1 - x0, y1 - y0);
  cum.push(d);
}
console.error('lap ' + d.toFixed(2) + 'cqw  |  lane ' + LANE + '  run ' + RUN +
              '  radius ' + (LANE / 2));

const move = [], turn = [];
for (let i = 0; i < pts.length; i++) {
  const p = pts[i];
  const pc = (100 * cum[i] / d).toFixed(4).replace(/\.?0+$/, '') + '%';
  const y = (p.a ? 'var(--run) * ' + p.a.toFixed(5) : '')
          + (p.a && p.b ? ' + ' : '')
          + (p.b ? 'var(--lane) * ' + p.b.toFixed(5) : '');
  move.push('  ' + pc.padStart(9) + ' { translate: calc(var(--lane) * '
    + p.x.toFixed(5) + ') ' + (y ? 'calc(' + y + ')' : '0') + ' }');
  turn.push('  ' + pc.padStart(9) + ' { rotate: ' + p.h.toFixed(2) + 'deg }');
}
process.stdout.write('@keyframes dash-move{\n' + move.join('\n') + '\n}\n\n'
                   + '@keyframes dash-turn{\n' + turn.join('\n') + '\n}\n');

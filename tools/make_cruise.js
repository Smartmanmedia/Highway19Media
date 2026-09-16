#!/usr/bin/env node
/* His boat's circuit, as CSS keyframes.
 *
 * An oval in the open water, and the boat STEERS: at every step it is turned to
 * face along the path, because a boat that slides sideways round a bend reads as
 * a sticker being dragged. His art points bow-up, so heading 0 is his drawing
 * untouched.
 *
 * Written as keyframes rather than `offset-path: ellipse()`, which would be one
 * line: offset-path's basic shapes need Chrome 116 / Safari 18, and the exact
 * position of his art is not somewhere to spend a browser-support argument.
 * Keyframes work everywhere and the path is verifiable.
 *
 * Distances come out in cqw - a share of the SECTION - so the circuit scales
 * with everything else. --rx and --ry are the two numbers to turn.
 *
 * STARTS WHERE HE DREW IT. The boat's home is the LEFT flank of the oval, not
 * its centre, so at first paint it sits exactly on his mark and swings up and
 * right from there. Clockwise.
 */
const N = 24;                                   // 15-degree steps: the chord sags
                                                // ~1px on a 1990 screen
const rad = d => d * Math.PI / 180;
const out = [];
let prev = null, turns = 0;

for (let i = 0; i <= N; i++) {
  const s = (360 / N) * i, u = 270 + s;
  const sx =  (Math.sin(rad(u)) + 1);           // x, in units of --rx
  const sy = -(Math.cos(rad(u)));               // y, in units of --ry
  // tangent, and the heading that puts his bow along it
  let h = Math.atan2(Math.cos(rad(u)), -Math.sin(rad(u)) * 1) * 180 / Math.PI;
  if (prev !== null && h + turns * 360 < prev) turns++;   // unwrap, so CSS turns
  h += turns * 360;                                       // one way and not back
  prev = h;
  const pct = (100 * i / N).toFixed(4).replace(/\.?0+$/, '');
  out.push('  ' + (pct + '%').padStart(8) + ' { translate: '
    + 'calc(var(--rx) * ' + sx.toFixed(5) + ') '
    + 'calc(var(--ry) * ' + sy.toFixed(5) + '); '
    + 'rotate: ' + h.toFixed(2) + 'deg }');
}
/* TWO ANIMATIONS, NOT ONE. The wrapper travels and its children turn, because
   the boat's shadow has to spin with the hull - a shadow is the hull's own
   outline - while keeping the offset the sun gives it. Same duration, so they
   stay in step. */
const move = out.map(l => l.replace(/; rotate: [-\d.]+deg/, ''));
const turn = out.map(l => l.replace(/translate: [^;]+; /, ''));
process.stdout.write('@keyframes cruise-move{\n' + move.join('\n') + '\n}\n\n'
                   + '@keyframes cruise-turn{\n' + turn.join('\n') + '\n}\n');

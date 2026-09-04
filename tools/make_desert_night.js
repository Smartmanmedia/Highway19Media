#!/usr/bin/env node
/* HIS DESERT AT NIGHT, PAINT BY PAINT.
 *
 * WHY A FILTER COULD NEVER DO THIS. In his day art the sand is the bright
 * thing and the rocks are the dark thing; in his night artboard it is the
 * other way round - his dunes go to a deep navy, around L34, and his rocks
 * stay a warm brown at L69, catching the moon. No brightness, no hue chain,
 * nothing that maps one lightness onto another can swap two families over.
 * It has to be done a colour at a time, which is what he asked for.
 *
 * The chain that was here before is the reason the beach looked wrong: it
 * lifted the whole desert to #26294b while section two's sand sat at #1a1829,
 * so the join between them was a step rather than a transition.
 *
 * THE THREE FAMILIES, and how each one is told apart in his own file:
 *   sand   - a handful of shapes covering enormous area (his dunes are three
 *            paths across the whole board). Few shapes, very light.
 *   rock   - everything else warm: dozens of small shapes.
 *   plant  - hue in the greens. Tiny, but they are the only colour out there.
 *
 * Every night colour is measured out of his artboard three by
 * tools/his_colours.js. Rocks and plants are placed by their own day
 * lightness between his darkest and his lightest, so his art keeps its
 * modelling instead of going flat.
 *
 * Writes the fill rules into section-03.css and the values into night.css,
 * both between markers. Day is the fallback in every rule, so daylight
 * cannot be changed from here.
 */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'build', 'v2');

/* --- his night desert, off artboard three ------------------------------- */
const HIS = {
  /* HIS DUNES, BIGGEST AREA FIRST, AND OFF THE PURPLE. Three of his five
     have more red in them than green - #1b1a37 and #322d4a most of all -
     which is what put a violet cast across the whole desert next to the
     beach above it. Same lightnesses, green brought up past red: his blues
     stay his, and the two sands now sit in one family. */
  dune: ['#1a1f44', '#181d39', '#1a1f3e', '#181c41', '#2c324e'],
  /* his rock, darkest to lightest */
  rockLo: '#110f13', rockHi: '#593d38',
  /* nothing green survives in his artboard, so the scrub is taken to the
     same darkness as his trees in artboard four and left green */
  plantLo: '#0b1410', plantHi: '#26401f',
  /* section two's sand at its foot, so the two sections meet with no line */
  beachFoot: '#171c35'
};

const hex = h => { const c = h.replace('#', '');
  return c.length === 3 ? [...c].map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)) };
const str = v => '#' + v.map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
const lum = v => 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2];
const mix = (a, b, t) => hex(a).map((n, i) => n + (hex(b)[i] - n) * t);
const hue = h => { const [r, g, b] = hex(h).map(x => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return -1;
  const x = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return x * 60 };

/* --- what his day art actually uses ------------------------------------- */
const html = fs.readFileSync(path.join(DIR, 'section-03.html'), 'utf8');
const counts = new Map();
for (const m of html.matchAll(/fill="(#[0-9a-fA-F]{3,6})"/g))
  counts.set(m[1].toLowerCase(), (counts.get(m[1].toLowerCase()) || 0) + 1);

const warm = [...counts.keys()].filter(c => { const h = hue(c); return h >= 0 && h < 60 });
const plant = [...counts.keys()].filter(c => { const h = hue(c); return h >= 60 && h < 160 });
/* his dunes are the few-shape, very-light paints; everything else warm is rock */
const sand = warm.filter(c => counts.get(c) <= 8 && lum(hex(c)) >= 200)
                 .sort((a, b) => lum(hex(b)) - lum(hex(a)));
const rock = warm.filter(c => !sand.includes(c));

const map = new Map();
sand.forEach((c, i) => map.set(c, HIS.dune[i % HIS.dune.length]));
const span = (list, lo, hi) => {
  const L = list.map(c => lum(hex(c)));
  const a = Math.min(...L), b = Math.max(...L);
  list.forEach(c => map.set(c, str(mix(lo, hi, b === a ? .5 : (lum(hex(c)) - a) / (b - a)))));
};
span(rock, HIS.rockLo, HIS.rockHi);
span(plant, HIS.plantLo, HIS.plantHi);

/* his sand gradient is the top of the desert and the foot of the beach at
   once - the two sections meet in it - so its head takes section two's own
   night sand and its body the nearest of his dunes */
const grad = [];   /* his top fade is one colour now - the beach walks into it */
grad.forEach(([d, n]) => map.set(d, n));

/* --- write ------------------------------------------------------------- */
const name = c => '--d' + c.slice(1);
const rules = [...map].map(([d]) =>
  `.sec3 .z-ground [fill="${d}"]{ fill: var(${name(d)}, ${d}) }`).join('\n') + '\n' +
  [...map].map(([d]) =>
  `.sec3 .z-ground [stop-color="${d}"]{ stop-color: var(${name(d)}, ${d}) }`).join('\n') + `
.sec3 .z-ground [fill^="#"],
.sec3 .z-ground [stop-color^="#"]{ transition: fill 1s linear, stop-color 1s linear }`;

const vals = [...map].map(([d, n]) => '    ' + name(d) + ': ' + n + ';').join('\n');
const three = body =>
  '  @media (prefers-color-scheme: dark){\n' +
  '  :root:not([data-theme="light"]):not([data-mode="day"]){\n' + body + '\n  }}\n' +
  '  :root[data-theme="dark"]:not([data-mode="day"]),\n' +
  '  :root[data-mode="night"]{\n' + body + '\n  }';

const put = (file, A, B, text) => {
  const p = path.join(DIR, file);
  let s = fs.readFileSync(p, 'utf8');
  const i = s.indexOf(A), j = s.indexOf(B);
  if (i < 0 || j < 0) throw new Error(file + ' has no ' + A + ' marker');
  fs.writeFileSync(p, s.slice(0, i + A.length) + '\n' + text + '\n' + s.slice(j));
};
put('section-03.css', '/* >>> desert */', '/* <<< desert */', rules);
put('night.css', '/* >>> desert */', '/* <<< desert */', three(vals));

console.log('desert: ' + sand.length + ' sand, ' + rock.length + ' rock, ' +
            plant.length + ' plant, ' + grad.length + ' gradient stops');

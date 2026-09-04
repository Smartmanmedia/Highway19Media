#!/usr/bin/env node
/* HIS NIGHT PALETTE, GENERATED FROM HIS DAY ONE.
 *
 * The scene is painted by CSS gradients carrying eighty-odd stops of his own
 * sampled colour. Writing a night set of those by hand would be eighty chances
 * to get one wrong, and they would drift apart the moment he re-samples a
 * section. So the night value of every stop is DERIVED from his day value:
 * pulled most of the way to black and given the blue cast of a night sky.
 *
 * The day gradients stay where they are, in each section's own file, written
 * as var(--secN-bg, <his gradient>). Night is the variable; day is the
 * fallback. Nothing about his day work moves into this file.
 *
 *   node tools/make_night.js        rewrites the palette block in night.css
 */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'build', 'v2');

/* TOWARD BLACK, AND TOWARD A COLOUR - AND THE COLOUR IS NOT THE SAME EVERYWHERE.
 * Sampled off his own night painting: his sky and his water hold FULL
 * saturation at about 10% lightness (#001236, S100) while his sand goes almost
 * neutral and stays warm (#3f3735, S9). One blue tint over the whole page got
 * the sky right and turned his beach into cold slate. So each surface carries
 * its own tint and its own amount of it. */
const TINTS = {
  sea:  [0, 8, 28],       /* his water and sky: barely any grey, so his own blue holds */
  sand: [30, 24, 20],     /* warm, and most of the way to neutral */
  leaf: [15, 21, 17],
  page: [10, 14, 24]
};
function night(r, g, b, keep, tint, hue) {
  var T = TINTS[hue] || TINTS.sea;
  return [r, g, b].map((c, i) => Math.round(c * keep + T[i] * tint));
}
const hex = n => '#' + n.map(v => Math.max(0, Math.min(255, v))
  .toString(16).padStart(2, '0')).join('');

/* every colour inside one CSS value, day -> night, alpha untouched */
function darken(css, keep, tint, hue) {
  return css
    .replace(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (m, h) => {
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      const n = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
      return hex(night(n[0], n[1], n[2], keep, tint, hue));
    })
    .replace(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(,\s*[\d.]+\s*)?\)/gi,
      (m, r, g, b, a) => {
        const n = night(+r, +g, +b, keep, tint, hue);
        return 'rgba(' + n.join(',') + ',' + (a ? a.replace(/[,\s]/g, '') : '1') + ')';
      });
}

/* pull the background out of a section rule, whatever shape it is in */
function background(file, sel) {
  const css = fs.readFileSync(path.join(DIR, file), 'utf8');
  const rule = new RegExp('\\' + sel + '\\s*\\{([\\s\\S]*?)\\n\\}');
  const m = rule.exec(css);
  if (!m) throw new Error('no rule ' + sel + ' in ' + file);
  const b = /\n\s*background:\s*([\s\S]*?);/.exec(m[1]);
  if (!b) throw new Error('no background in ' + sel);
  let v = b[1].replace(/\/\*[\s\S]*?\*\//g, '')      /* his notes, not colour */
              .replace(/\s*\n\s*/g, ' ').trim();
  /* READ HIS DAY VALUE OUT OF THE FALLBACK. Once a surface is wired up it
     reads background: var(--secN-bg, <his gradient>), and taking that whole
     value would generate --secN-bg: var(--secN-bg, ...) - a property defined
     as itself, which CSS throws away, so the page silently stayed in daylight
     and every colour below looked right in the file. */
  const wrap = new RegExp('^var\\(\\s*--[\\w-]+\\s*,([\\s\\S]*)\\)$');
  const w = wrap.exec(v);
  if (w) v = w[1].trim();
  return v;
}

/* keep, tint amount, and which tint - all read off his own night painting */
const SURFACES = [
  ['--sec1-bg',     'section-01.css', '.sec1',         0.17, 0.30, 'sea'],
  ['--sec1-fade',   'section-01.css', '.sec1::after',  0.20, 0.30, 'sea'],
  ['--sec2-bg',     'section-02.css', '.sec2',         0.22, 0.30, 'sea'],
  ['--sec2-sand',   'section-02.css', '.sec2 .sand',   0.24, 0.60, 'sand'],
  ['--sec3-bg',     'section-03.css', '.sec3',         0.22, 0.60, 'sand'],
  ['--sec4-ground', 'section-04.css', '.sec4 .ground', 0.20, 0.55, 'leaf'],
  ['--sec6-bg',     'section-06.css', '.sec6',         0.10, 0.85, 'page']
];

/* THE FLAT TOKENS, alongside the generated gradients. They live here rather
   than in the stylesheet for one reason: the same set has to appear under two
   selectors, and when they were written by hand the two copies drifted - one
   indented four spaces and one two - so an edit meant to hit both hit neither.
   Generated, they cannot drift. */
const TOKENS = [
  ['--night', '1'],
  /* HIS ROAD. The tarmac in his painting is #36373f - dark, but nowhere near
     black; black tarmac was mine, not his. The markings stay bright: his read
     dim only because his road is lit by street lamps, and without those the
     markings are the only thing that makes the road a road. Slightly warm,
     as they are under any road lighting. */
  ['--tarmac', '#26272e'],
  ['--marking', '#ece9e0'],
  /* his painted layers keep their COLOUR - his water is still fully saturated
     blue at a tenth of daylight. Desaturating them was mine too. And they are
     not taken as far down as the flat surfaces behind them: his foam lines
     read at #425684, a good deal lighter than his water. */
  ['--scene', '0.36'],
  ['--scene-sat', '0.95'],
  /* his clouds go deep blue, not grey - #001a43, saturation 100. No amount of
     brightness reaches a hue, so this is a chain: strip the colour, lay a
     sepia over it, swing the hue round to his blue, pull the saturation back
     up and then take the whole thing down. Rotating FURTHER round makes them
     more purple, not less - the red climbs - so this stops at 190. Lands near
     his #001a43. */
  ['--cloud-filter', 'brightness(.30) sepia(1) hue-rotate(190deg) saturate(7) brightness(.23)'],
  /* HIS TWO DARK-ON-LIGHT COPY BLOCKS. Section two's sits on his sand and
     section six's on his white page. Both grounds go dark, so the ink has to
     turn over with them or the words simply disappear - everything else on the
     page is already white on his own colours and does not move. */
  ['--sec2-ink', '#dfe7f2'],
  ['--sec6-ink', '#eef2f7'],
  /* HIS CARDS TURN OVER. White cards on a dark page read as four holes cut in
     it; black cards with white type are the same object seen at night. */
  ['--card-bg', '#0c1018'],
  ['--card-line', '#7d8ea3'],
  ['--card-ink', '#f2f6fa'],
  ['--card-sub', '#c3cedb'],
  /* HIS SIGNS, MUTED. Not dimmed to nothing - a road sign at night is still the
     brightest thing out there - but taken off full daylight saturation, which
     is what he did in his own mock. */
  ['--sign-lit', '0.86'],
  ['--sign-sat', '0.80']
];

const vars = TOKENS.map(([k, v]) => '    ' + k + ': ' + v + ';').join('\n') + '\n' +
  SURFACES.map(([name, file, sel, keep, tint, hue]) =>
  '    ' + name + ':\n      ' + darken(background(file, sel), keep, tint, hue) + ';').join('\n');

/* WRITTEN TWICE ON PURPOSE. The three theme states need the same night values
   under two different selectors, and CSS has no way to say that without either
   an attribute set from script or a variable trick nobody should have to read.
   Duplication is only a problem when it has to be kept in step by hand; this
   is generated, so both copies are written from the same source every time. */
const block =
  '/* GENERATED by tools/make_night.js from his own day colours. Each stop\n' +
  '     pulled toward black and given a night sky\'s blue cast. His day\n' +
  '     gradients stay in their own section files - they are the fallback in\n' +
  '     var(--secN-bg, ...) - so nothing here is kept in step by hand. */\n' +
  '  @media (prefers-color-scheme: dark){\n' +
  '  :root:not([data-theme="light"]):not([data-mode="day"]){\n' +
  vars + '\n  }}\n' +
  '  :root[data-theme="dark"]:not([data-mode="day"]),\n' +
  '  :root[data-mode="night"]{\n' + vars + '\n  }';

const out = path.join(DIR, 'night.css');
let css = fs.readFileSync(out, 'utf8');
const A = '/* >>> palette */', B = '/* <<< palette */';
const i = css.indexOf(A), j = css.indexOf(B);
if (i < 0 || j < 0) throw new Error('night.css has no palette markers');
css = css.slice(0, i + A.length) + '\n  ' + block + '\n  ' + css.slice(j);
fs.writeFileSync(out, css);
console.log('night.css: ' + SURFACES.length + ' surfaces generated, ' +
  (fs.statSync(out).size / 1024).toFixed(1) + ' KB');

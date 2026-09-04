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
/* SAMPLED OFF HIS OWN NIGHT ARTBOARDS, not off a photographic reference.
 * The correction that matters: his ground is COOL. His beach reads #1c182b and
 * his desert #2f2831 - purple-greys, not the warm browns a photograph of a
 * lamplit road suggested. And the whole thing is darker than I had it: his sky
 * and water sit at 5-7% lightness where mine were at 9-11. */
const TINTS = {
  sea:  [0, 6, 22],        /* his sky and deep water - matched to 4 of 441 */
  surf: [26, 20, 34],      /* his beach section, which is a shade purpler */
  sand: [20, 26, 72],      /* HIS DESERT IS COOL. It reads #1a1c3a - a navy, not
                              the warm brown I had. That was the single biggest
                              thing wrong: mine was 36 of 441 away and warm
                              where his is cold. */
  leaf: [2, 26, 38],       /* and his forest floor is a dark teal, #041d22 */
  page: [7, 11, 30]        /* his card page */
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
  ['--sec1-bg',     'section-01.css', '.sec1',         0.10, 0.24, 'sea'],
  ['--sec1-fade',   'section-01.css', '.sec1::after',  0.13, 0.24, 'sea'],
  ['--sec2-bg',     'section-02.css', '.sec2',         0.14, 0.55, 'surf'],
  ['--sec3-bg',     'section-03.css', '.sec3',         0.07, 0.62, 'sand'],
  ['--sec4-ground', 'section-04.css', '.sec4 .ground', 0.06, 0.80, 'leaf'],
  ['--sec6-bg',     'section-06.css', '.sec6',         0.015, 0.92, 'page']
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
  ['--tarmac', '#111623'],
  ['--marking', '#ffffff'],
  /* HIS TRUSS. The one thing on the page still lit like daylight, and he
     said so. His night gantry is one gradient, #b3b3b3 down to #1a1a1a; the
     day tile is a raster and pure greyscale, running 127 to 255. His own
     night gantry is a straight grey and he wants blue in it, so the line that
     takes one range onto the other is drawn per channel: the tile's 127 lands
     on #10141d and its 255 on #8895ab. The filter is in section-01.html. */
  ['--truss-night', 'url(#truss-night)'],
  /* HIS GREEN AND HIS GOLD, off artboard one. Both are a repeating sheen in
     his file rather than a flat colour - the board cycles #06301a / #0c4221 /
     #0f4924 across its width and the banner runs a highlight through
     #cc9300 / #fbc93b / #fbb03b - so these are the means of his own stops.
     Flat, because a flat colour can be transitioned and a gradient cannot,
     and because his ramps span six levels of green: nothing an eye finds.

     WHAT THIS REPLACES IS THE REASON HE ASKED. A brightness over the whole
     sign took his white arrows and white type down to #a8a8a8 with the
     board, and that is the lack of contrast: his own night keeps them at a
     pure 255 and darkens only the paint behind them. */
  /* HIS TWO BOATS. Both are rasterised SVGs in an <img>, so no fill to set -
     but neither has any white to protect, so a filter is honest here. Solved
     against his own numbers: his cruiser's hull goes #d1d4d8 to #949494 and
     his speedboat's red goes #a92121 to #791715, and one brightness and one
     saturate land on both to within a couple of levels. */
  ['--boat-night', 'brightness(.68) saturate(.85)'],
  /* HIS ROAD MAP BUTTON, RED AND LIT. The one thing on the page that is
     meant to be the brightest, so it is not muted with everything else. The
     glow is drop-shadow, not box-shadow: it has to follow the plate's
     rounded ends and the triangle hanging off its left, and box-shadow only
     knows rectangles. */
  ['--cta-plate', '#530000'],
  ['--cta-glow',
   'drop-shadow(0 0 0.35cqw rgba(255,60,60,.95)) drop-shadow(0 0 1.4cqw rgba(230,20,30,.65))'],
  ['--sign-green', '#0a3d1f'],
  ['--sign-gold', '#e7aa28'],
  /* his painted layers keep their COLOUR - his water is still fully saturated
     blue at a tenth of daylight. Desaturating them was mine too. And they are
     not taken as far down as the flat surfaces behind them: his foam lines
     read at #425684, a good deal lighter than his water. */
  /* HIS ART KEEPS ITS HIGHLIGHTS. Measured over whole sections, the brightest
     tenth of his night sits at 76, 97, even 255 - his foam, his snow caps -
     where mine was crushed to 29. The surfaces behind go darker instead. */
  ['--scene', '0.50'],
  ['--scene-sat', '0.95'],
  /* HIS CLOUDS, DARK BLUE TO LIGHT MUTED - his words, and not what his
     artboards have, where they are still near-white. A duotone, because that
     is what "this colour to that colour" means: his greys are flattened and
     the two ends are set per channel, #0e1330 to #aab3c6. The filter itself
     is in section-01.html; brightness and saturate cannot do it, they move
     every channel by one shared offset and his two ends need different ones.

     A url() filter cannot be interpolated, so the clouds are the one thing
     on the page that changes on the instant rather than over the second. */
  ['--cloud-filter', 'url(#cloud-night)'],
  /* and his canopy, matched to the trees inside his own artboard four */
  ['--scene-tree', 'brightness(.30) saturate(.95) hue-rotate(70deg)'],
  /* HIS TWO DARK-ON-LIGHT COPY BLOCKS. Section two's sits on his sand and
     section six's on his white page. Both grounds go dark, so the ink has to
     turn over with them or the words simply disappear - everything else on the
     page is already white on his own colours and does not move. */
  ['--sec2-ink', '#dfe7f2'],
  ['--sec6-ink', '#eef2f7'],
  /* HIS CARDS TURN OVER. White cards on a dark page read as four holes cut in
     it; black cards with white type are the same object seen at night. */
  /* HIS CARDS AT NIGHT ARE GLASS, NOT PAPER. Transparent, so his page shows
     through, with the lane's own colour doing the work the black hairline
     did by day: a soft glow at rest and a stronger one under the pointer.
     The drop shadow goes - a black shadow on a black page is nothing but a
     smudge - and the fill only arrives on hover, which is what makes the
     card you are pointing at the one solid object in the row.

     var(--c) inside these resolves against the CARD, not the root: a custom
     property is substituted where it is used, so one line here gives four
     different glows. */
  ['--card-bg', 'transparent'],
  ['--card-hover-bg', '#05070c'],
  ['--card-glow', '0 0 1.0cqw color-mix(in srgb, var(--c) 38%, transparent)'],
  ['--card-glow-hover',
   '0 0 2.4cqw color-mix(in srgb, var(--c) 72%, transparent), 0 0 0.7cqw color-mix(in srgb, var(--c) 55%, transparent)'],
  ['--card-line', '#7d8ea3'],
  ['--card-ink', '#f2f6fa'],
  ['--card-sub', '#c3cedb'],
  /* HIS SIGNS, MUTED. Not dimmed to nothing - a road sign at night is still the
     brightest thing out there - but taken off full daylight saturation, which
     is what he did in his own mock. */
  /* his banner goes to a bronze - #b46824 where daylight is a bright yellow -
     so the signs come down further than a gentle mute */
  /* HIS OWN NIGHT OCEAN. waves_Night.svg is the same eleven shapes he drew for
     the day, recoloured in Illustrator and nothing else - so these are his
     numbers off that file, in his own paint order, and section-02.css hangs
     them on the stops of his day gradients. The surf keeps its white foam and
     its #002b61 shade; only the water under them turns.

     THE FAR BAND IS THE ONE THAT IS NOT A STRAIGHT SWAP. His night horizon is
     a vertical ramp, #000619 at the skyline down to #001136, where his day
     gradient there runs across the picture - so the ramp is kept and laid the
     other way. Eleven levels of blue between the two ends, at that darkness,
     is not something an eye can find. He also drops the white crest from that
     band at night, which is what --sea-far-foam does. */
  ['--sea-surf-hi', '#1b5791'],
  ['--sea-surf-lo', '#0d3d70'],
  ['--sea-mid', '#011f51'],
  ['--sea-swell', '#022152'],
  ['--sea-far-a', '#000619'],
  ['--sea-far-b', '#001136'],
  ['--sea-far-shade', '#233e77'],
  ['--sea-far-foam', '0'],
  /* THE FIVE SMALLER SIGNS, off the five night files he sent. Nothing here is
     derived: his green board, his red triangle, his banner gold, and the two
     strokes that only exist at night - his banner picks up a #fcee21 edge and
     his button a red one. The brightness that used to stand in for all of
     this is gone, along with the white type it was dimming. */
  ['--sign-red', '#b5000d'],
  ['--sign-gold-2', '#dda517'],
  ['--sign-gold-line', '#fcee21'],
  /* HIS BUTTON IS NOT A BRIGHT RED PLATE. It is a nearly black one - #530000 -
     inside a pure red edge, which is what makes it read as a lit tube and not
     as red paint. The glow on .cta only carries that edge off the plate. */
  ['--cta-line', 'red'],
  ['--cta-tri', '#b5000d']
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

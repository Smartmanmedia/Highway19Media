#!/usr/bin/env node
/* His surf, cut into its own depth bands so each one can move on its own.
 *
 * HIS ART IS ALREADY GROUPED FOR THIS. waves.svg is one <g> holding four
 * children, and each child is one band of surf - a dark shadow at .43, a white
 * crest, and the water body under it. Bottom of the markup is the horizon, top
 * is the shore. So the bands are his; all this does is give each one its own
 * <svg> so a CSS animation can move it.
 *
 * WHY FOUR <svg> ELEMENTS AND NOT FOUR <g>. A transform on an SVG group makes
 * the browser re-rasterise that group's paths every frame, and these paths run
 * to hundreds of segments each. A transform on an HTML element gets its own
 * compositor layer: the paths raster once and the frame only moves the layer.
 * Same reason the parallax writes `translate` on elements and never inside SVG.
 *
 * WHY THE CLIP BECOMES A WRAPPER. His clipPath is a rect at x 15.63 w 1922.47,
 * which lands within 2px of the section's own edges - it is there to trim the
 * 15% of bleed he drew past the artboard. That has to STOP MOVING while the
 * art slides under it, so it becomes overflow:hidden on a wrapper div and the
 * clipPath is dropped. This is the fourth of his clipPaths to go, and the only
 * one that was doing a real job.
 *
 * Emits the block to stdout. Paint order is preserved exactly: same order in,
 * same order out, so the still frame is unchanged - which is the check.
 */
const fs = require('fs');
const SRC = 'assets/v2/section-02/waves.svg';
const s = fs.readFileSync(SRC, 'utf8');

/* ---- his header ---- */
const vb = /viewBox="([^"]+)"/.exec(s)[1];

/* ---- his gradients, minus the clipPath (the wrapper does that job now) ---- */
const defs = /<defs>([\s\S]*?)<\/defs>/.exec(s)[1]
  .replace(/<clipPath[\s\S]*?<\/clipPath>/g, '');

/* ---- the four bands: the children of the <g> inside the clip ---- */
const inner = /<g clip-path="url\(#waves-clippath\)">\s*<g>([\s\S]*)<\/g>\s*<\/g>/.exec(s);
if (!inner) throw new Error('his group structure changed - look at ' + SRC);

/* Walk the top level of that group. A child is either a <g>...</g> subtree or
   a single self-closing <path/>. Depth counting, because the bands nest. */
function children(body) {
  const out = [];
  const re = /<(g|path)\b([^>]*?)(\/?)>|<\/(g)>/g;
  let m, depth = 0, start = -1;
  while ((m = re.exec(body))) {
    const [all, tag, , selfClose, close] = m;
    if (close) { if (--depth === 0) { out.push(body.slice(start, re.lastIndex)); start = -1; } continue; }
    if (depth === 0) {
      if (tag === 'path' || selfClose) { out.push(all); continue; }  // lone path
      start = m.index; depth = 1;
    } else if (tag === 'g' && !selfClose) depth++;
  }
  return out;
}
const bands = children(inner[1]);
if (bands.length !== 4) throw new Error('expected 4 bands, found ' + bands.length);

/* nearest the shore first, exactly his paint order. --par-wave is the band's
   own amplitude; section-02.css turns it into the swell. */
const NAMES = ['surf', 'mid', 'swell', 'far'];

const parts = bands.map((band, i) => {
  const isFirst = i === 0;
  return `    <svg class="wave wave-${NAMES[i]}" aria-hidden="true" viewBox="${vb}"` +
         (isFirst ? `>${defs.trim() ? '<defs>' + defs + '</defs>' : ''}` : '>') +
         `\n      ${band.trim()}\n    </svg>`;
});

process.stdout.write(
`  <!-- HIS SURF, IN FOUR BANDS. Split out of assets/v2/section-02/waves.svg by
       tools/split_waves.js - his own grouping, one <svg> each so each band can
       swell on its own. Inline rather than <img> for the same reason as before:
       an image's raster lives in the browser's image cache, and a browser short
       of memory drops it and repaints lazily, which is what made the ocean stop
       in mid-air on a busy machine.

       The wrapper is his clipPath: a fixed window at the section's own edges,
       with 15% of his bleed hidden either side, so the bands slide underneath
       and no edge can ever come into view. Re-run the tool if he re-exports. -->
  <div class="waves z-ground" aria-hidden="true">
${parts.join('\n')}
  </div>\n`);

#!/usr/bin/env node
/* HIS ROAD TILES, INLINE AND ON VARIABLES.
 *
 * Every one of them is exactly two colours - 27 fills of tarmac and 217 of
 * white - and at night those two have to move in OPPOSITE directions: the
 * tarmac drops to almost nothing while the lane markings stay bright. That is
 * the one change that most says night, and no filter can do it, because a
 * filter cannot tell the tarmac from the paint.
 *
 * So the tiles become inline SVG with their two fills written as custom
 * properties. Inline is what makes that possible at all: an <img> is an
 * isolated document and CSS variables from the page do not reach inside it.
 *
 * The <img> keeps its class and its style, so nothing about the layout moves,
 * and a marker comment names the file it came from so the asset on disk is
 * still the thing you edit.
 *
 *   node tools/inline_road.js build/v2/section-01.html
 */
const fs = require('fs'), path = require('path');
const page = process.argv[2];
let html = fs.readFileSync(page, 'utf8');
const base = path.dirname(page);
let done = 0;

html = html.replace(
  /<img class="z-road" data-at src="([^"]+\/(?:stright|curve)[^"]*\.svg)" alt=""\s*\n?\s*style="([^"]*)">/g,
  (m, src, style) => {
    let art = fs.readFileSync(path.resolve(base, src), 'utf8').trim()
      .replace(/<\?xml[^>]*\?>\s*/, '')
      /* ids repeat between tiles and nothing points at them, so they go rather
         than being prefixed - four copies of #stright-Stright in one document
         is a duplicate id for no gain */
      .replace(/\s+id="[^"]*"/g, '')
      .replace(/fill="#575757"/g, 'fill="var(--tarmac)"')
      .replace(/fill="#fff"/g, 'fill="var(--marking)"')
      /* the tile sizes itself from the style, as the <img> did. ONLY THE ROOT
         loses its width and height: a global strip took them off every <rect>
         inside as well, and a tile of zero-sized rectangles draws nothing at
         all - the road simply vanished, tarmac, edges and dashes together. */
      .replace(/^<svg\b[^>]*>/, m =>
        '<svg class="z-road" data-at aria-hidden="true" style="' + style + '"' +
        m.slice(4).replace(/\s(width|height)="[\d.]+"/g, ''))
      .replace(/\s*\n\s*/g, '');
    done++;
    return '<!-- road tile, inline so its two fills can be variables. Source: ' +
           src.replace(/^\.\.\/\.\.\//, '') + ' -->\n  ' + art;
  });

fs.writeFileSync(page, html);
console.log(path.basename(page) + ': ' + done + ' road tiles inlined');

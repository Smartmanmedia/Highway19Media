# Highway 19 Media — what we know

Facts that cost real time to establish. Read this before touching the build;
none of it is guesswork, all of it is measured.

## The rebuild, in one rule

**A section's height is a fixed ratio of its width, taken from Adam's canvas.**
The artwork sits inside it at percentages. No measuring, no anchor map, no
JavaScript for layout.

The previous build had the artwork positioned by the copy, and the copy's
spacing hand-tuned to fit the artwork — `#problem{padding-bottom:+27vw}` and
`#promise{padding-top:+82vw}`. Two things each defined in terms of the other.
That circle is why every fix moved something else, and why 452 lines of
canvas→page mapping existed. Don't rebuild it.

Order of work: **layout → driving path → traffic.** The path cannot be stable
until the layout is.

## His canvas

    artboard      2472.32 x 5119.77
    art column    x 288.9, width 1924.33   (maps to the page width)

Anything outside the column is deliberate bleed. A share of the column IS a
share of the page.

## HIS HORIZONTAL SQUEEZE — read this before placing any copy

Every text block in his file carries a `scale(k 1)`. It is not decoration and
it is not optional: it is why his type fits the measure he drew.

    headlines                .97
    second-level headings    .9666
    road-sign subheads       .82
    body copy                1

Place a block without it and the line runs long, re-wraps, and lands in
whatever is below. Two rounds of substitute fonts were quietly compensating for
this before it was spotted — which is why neither ever quite worked.

How it is done: widen the box by 1/k so his line breaks fall where his do, then
`transform: scaleX(k)` with `transform-origin: 50% 0` to bring it back to his
measure. Where his line breaks are explicit, make them explicit — one span per
line, `white-space: nowrap`. No box width is the right width when the breaks
are already decided.

With his real font at his real size and his squeeze, both of his subhead lines
measure ratio 1.000 of his width. That is the check that says the type is right.

## His type — measured, not chosen

Two families, both from his file:

| | |
|---|---|
| **Be Vietnam Pro** | Black 800 headlines, ExtraBold 700 buttons, Medium 500 and Light 300 body. On Google Fonts. |
| **Highway Gothic Expanded** | the road-sign lettering — guide panels, the sign plates AND the subheads. Not on Google Fonts (checked: HTTP 400). He supplied it; `HWYGEXPD.TTF` from his highway_gothic archive, internal family name exactly "Highway Gothic Expanded". |

Both families are self-hosted from his own files, subset to Latin and
compressed by `tools/subset_fonts.py` — 726 KB of TTF becomes 118 KB of WOFF2,
and the page makes no external font request. Use his files, not Google's build
of the same family: the metrics are the ones his artwork was drawn against.

If a stand-in is ever needed again, what they cost, measured on his subhead
lines: Overpass 0.739 (drawn from the same FHWA series but 26% wider, which
renders his subhead SMALLER than his body copy when he set it larger), PT Sans
Narrow 0.952, Saira Condensed 0.934, Oswald 0.913, Roboto Condensed 0.826.

Sizes in canvas units (a size of N is N/1924.33 of the page):

    hero h1        48.68 / 84.17 / 34.74   three sizes stacked, not one
    hero sub       26      body  21.96
    problem h2     58.90   sub   26      body 21.96
    objection h2   48.68   sub   33      body 21.96
    promise h2     66.64   sub   30.49   body 26      (Highway Gothic)
    buttons        22.86

**His export names every style as its own family** — `BeVietnamPro-Black`,
`BeVietnamPro-Light` — and only some runs carry the real `Be Vietnam Pro` as a
fallback. A browser without those files renders his text in a substitute, and
every width measured off it is wrong. Load the webfont and map his style names
onto it before measuring anything.

## Illustrator export traps

Each of these has cost a day. `tools/import_art.py` checks for them.

1. **Styling: Internal CSS** writes `.st0`, `.st1`… from zero in every file.
   Two files on one page and the second silently repaints the first. Use
   Presentation Attributes.
2. **Responsive checked** strips width/height off the root, so the artwork has
   no intrinsic size.
3. **`mix-blend-mode` as an XML attribute** — browsers ignore it. A multiply
   shadow then renders flat grey instead of darkening what it sits on.
4. **id collisions between files** — two exports both containing
   `#linear-gradient-3` fight, and whichever loads last wins. Namespace them.

## Multiply shadows

His clouds, boat and signs carry multiply shadows. A stacking context isolates
blending and the shadow renders flat grey. Measured over the same blue:
**#022751 correct, #666666 isolated.** Each of these creates one:

- wrapping the SVG in an `<img>` — inline the markup instead
- a `transform` — move by `top`/`left` instead
- a `z-index` — use DOM paint order instead
- `will-change: transform`

## Weight

**Shape count is the metric, not file size.** The forest was 10,112 shapes =
390ms of parse before first paint at any size. His tree tile is 4,185 shapes
EACH, so tiling it as vector would have been worse than the forest it replaced.
Rasterised once and repeated with a 150px overlap, the browser decodes it a
single time and every repeat is free.

Rule: a **tile vocabulary** survives rescaling; a single image does not. A
straight stretches along its own axis invisibly, a curve goes visibly oval.

## Contrast — the two that bite

    white on his plate green   4.15:1
    white on his grass         4.15:1

Both clear the bar for **bold** text (3.0) and fail for regular (4.5), and only
once the text is actually bold-SIZED — under 18.66px it is judged as regular.
`tools/check-contrast.js <width>` measures against actual painted pixels.

## Reading a section export

    tools/read_section.js   every named layer, in ART COLUMN coordinates
    tools/read_text.js      his copy — bounds, alignment, per-line size/weight
    tools/cut_layers.js     each named layer into its own file, cropped
    tools/check_section.js  the page against his copy, both as a share of the section

The art column is NOT the artboard. In section one the ocean runs x 87 to
2011.33 of a 2011.33-wide artboard, so the column is 1924.34 and all 87 units
of bleed are on the LEFT. Measuring against the artboard puts every layer 4.5%
right of where he drew it.

Three traps in cutting layers, each of which fails silently:

  - An extracted layer carrying an embedded PNG references it by `xlink:href`.
    Without `xmlns:xlink` on the new root the file is not well-formed and the
    browser drops the whole image, showing alt text and no error.
  - His truss X is TWO overlapping groups, one per diagonal. Cutting "the
    group" gives a single slash, which tiles into something like rain.
  - Curves that look identical are the same shape flipped, and his file carries
    the flipped one as its own layer. Pointing two tiles at one file sends the
    road out of the frame.

Rasterise a tile from HIS OWN TILE FILE, not from the section. The section is
drawn at section scale, so a small cell rasterises from a fraction of the
artwork and gradients flatten.

## Tools

    tools/import_art.py          validates an Illustrator export, fixes blend modes
    tools/check-contrast.js W    39 copy elements vs the pixels behind them
    tools/check-centreline.js W  is the driving line actually on the road
    tools/compare-layout.js      his text positions vs the page

`check-cars-on-road.js` samples the pixel under each vehicle, so it measures
wherever the traffic happens to be — it swung 18%→39% across runs of identical
code. Use `check-centreline.js` instead; it is deterministic.

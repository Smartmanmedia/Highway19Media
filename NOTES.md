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

## ABUTTING SLIVERS — the other thing that will keep happening

Illustrator draws a gradient inside a clip as a row of rects placed edge to
edge — his truss rails are ~130 rects each 0.14 units tall, his surf is 219
of them. Edge to edge is the problem: at any scale where the edges land on a
fraction of a pixel, each antialiases against its neighbour and leaves a
hairline of whatever is behind showing through.

It looks like two different bugs and it is one:

  - rasterised against transparency, the slivers never accumulate — a rail he
    draws as solid white came out at alpha 197 of 255 and the truss looked
    see-through
  - drawn at page scale, it draws visible vertical lines across his water

  - and the third, worst one: it is expensive. 263 shapes for three gradients,
    each clipped, is enough work that Chromium hands back a HALF-PAINTED layer
    at 5,000 device pixels wide. His ocean lost its right third and a band
    across its middle on a Retina screen while rendering perfectly headless.
    Missing rectangular regions = un-rastered tiles, not a broken file.

**Put the gradient back rather than patching the slivers.** `tools/degradient.js`
turns each clipped sliver stack into one path carrying a real `<linearGradient>`,
reading the stops off the slivers themselves and adding a midpoint only where
his ramp is not linear. On the waves: 263 shapes to 15, 31 KB to 7 KB, and the
seams go with them because there is nothing left to seam. Run it on every
export before anything else.

`tools/close_gaps.js` grows each sliver by a hair so they overlap, for the cases
degradient cannot collapse. Neighbours differ by about one step of 255, so the
overlap cannot be seen.

**The overlap has to be about a device pixel at the size the thing is actually
drawn.** 0.06 units was right for a tile rasterised at 10x and did nothing at
all for artwork drawn at page scale, which needed 1.5.

For anything rasterised, also solve the alpha rather than screenshotting it:
render the same frame on black and on white, then

    alpha  = 1 - (white - black)
    colour = black / alpha

A pixel the artwork covers fully reads the same on both; one it covers partly
differs by exactly the background showing through. That returns his artwork at
the opacity he drew it, with edges that butt together invisibly. There is no
opacity anywhere in his files — any transparency is the rasteriser's.

## WHEN ART VANISHES ON HIS MACHINE AND NOT ON YOURS

The ocean kept stopping in mid-air on his screen — the right third gone, a
band across the middle gone — while rendering perfectly headless at his exact
window size and pixel ratio. Missing RECTANGULAR regions are un-rastered
tiles, not a broken file. Two causes, both worth fixing:

  - **Cost.** 263 sliver shapes under four clip paths, drawn 5,000 device
    pixels wide, is a lot of rasterising. `tools/degradient.js` took it to 15.
  - **Where the raster lives.** An `<img>` keeps its raster in the browser's
    IMAGE cache, and a browser short of memory (he runs 18 tabs) drops tiles
    out of that cache and repaints them lazily. Inline the art instead and it
    is part of the section's own display list, which repaints with the section.
    `tools/inline_art.js` re-inlines an asset into a section page and keeps a
    `Source:` marker, so the file on disk is still the thing you edit.

**Rasterising does NOT fix a dropped raster.** The desert went out as a
4000px WebP and dropped on his screen exactly the way the ocean had. The cache
that gets emptied is the browser's IMAGE cache, and it makes no difference
whether the image is a bitmap or a vector: an `<img>` is an `<img>`. Inline is
the fix, every time. Rasterise for the DRAW cost, inline for the DROP.

**Not every heavy file has something to collapse.** Section three's desert is
978 low-poly paths and every one is real geometry - rocks, ridges, bushes.
`degradient` finds nothing, because there is nothing faked. Art like that gets
rasterised instead: `tools/rasterise_art.js` renders it from HIS OWN file to
WebP with the alpha intact. The desert at 4000px is 121 KB against 221 KB of
SVG, sharper than native up to a 3250px section, and one decode instead of a
thousand draws. Only for art that is detailed, static and carries no type -
anything with words in it stays vector, because an image cannot reach the
page's fonts.

And then assume it will happen anyway. `tools/ocean_underlay.js` samples the
art straight down its own height and writes the colours out as a CSS gradient
for the section to paint UNDERNEATH. You never see it. When a tile does go
missing, what shows is the right colour at the right height with only the wavy
edges lost, instead of a hole. Hide `.z-ground` in devtools to see it.

## Motion

Parallax lives in `build/v2/parallax.css` (the amplitudes) and
`build/v2/parallax.js` (twenty lines that drive it). An element carries
`class="par par-cloud"` and the class sets `--par`, an amplitude as a share of
its SECTION'S width, so it scales with everything else. The section enters at
the bottom of the screen with its art `--par` low, crosses his marks as the
section passes the middle, and leaves `--par` high. ONLY the big green signs, the gantries they hang from, and the clouds move.
Road signs, buttons and the boat stay put - he tried it with everything
floating and it read as noise. First clouds 20, signs and gantries 12, other
clouds 8.

**Nothing is displaced at first paint.** Each section remembers the progress it
had when the page loaded, and that is where its art sits exactly on his marks -
so the page opens as he drew it and only moves once you scroll. Anchored to the
middle of the pass instead, the hero sign loaded a hundred pixels low and landed
on the copy underneath it. A section BELOW the fold anchors at the middle
instead, since nobody is looking, and gets to use its travel both ways.

Section one carries 125.08 units of extra sky above his artboard (`.sec1 .page`)
for the same reason: a sign anchored to the load can only ride UP, and his
artboard leaves the hero 123px of clearance, which capped its travel. Everything
inside `.page` is a share of the page, so his marks stand.

**The spread is the point, not the number.** Clouds and signs on near-identical
amplitudes move together and read as if nothing is moving at all, however large
the number. `--par-bias` slides a whole travel down the screen without slowing
it, so a cloud can drift a long way without sliding out of the top of its own
section. And an amplitude that would carry art off an edge is capped to what
fits, per LOCK GROUP (`--par-lock`): sign, copy and gantry are one object and
take one cap; clouds are capped one by one, so a low cloud that has run out of
room does not drag a high one down with it.

**SVG elements have no offsetTop.** Measuring the fit off `offsetTop` gave NaN
for his inline hero sign and froze it while its own gantry kept moving. Use
`getBoundingClientRect`, with the translate cleared first.

**Progress is per SECTION, not per element.** Keyed off each element's own
centre, two things that have to travel together - his sign and the gantry it
hangs from - drift a couple of pixels apart, because their boxes are different
heights and cross the screen at different moments. One progress per section
fixes it outright: everything in a scene moves in lockstep and only the
amplitude differs, which is what parallax is anyway. Sign against truss now
measures 0.1px over 700px of scroll.

Only `translate` is touched, never `transform`, so the scaleX his squeezed copy
carries survives.

**The CSS-only way does not survive testing.** `animation-timeline: view()` is
a line and a half and runs off the main thread, but headless Chromium evaluates
it once at load and never advances it, so there is no way to prove it animates
before he sees it - and a frozen timeline leaves his art a few pixels off its
mark, which is worse than no motion at all. One passive scroll listener batched
into one rAF is verifiable, and measurably works: over 700px of scroll the
cloud drifts 52px against the truss, the boat 36, the sign 12.

## Hover, and why it never touches `transform`
Two hover states are live: the hero sign's four service underlines, and the
"pick your lane" cards.

**Use the standalone `scale` / `translate` properties, never `transform`.** His
squeezed copy already owns `transform` (`scaleX(var(--sx))`), and so does the
parallax (which writes `translate` and nothing else, for the same reason). A
hover rule that reaches for `transform` silently unsqueezes his type or cancels
the parallax. `scale:1.05` and `translate:0 60%` compose with whatever else is
on the element, and with each other.

**scaleX on an SVG rect needs `transform-box:fill-box`.** Without it the origin
is the whole viewBox, so the line slides across the sign instead of growing in
place. With `transform-origin:50% 50%` it grows out from its own centre.

**`fill="none"` receives no pointer events.** An invisible hit area over a sign
panel needs `pointer-events="all"` (or a fill with zero opacity). The four
panels' hit rects run the full panel width, from below his yellow banner to the
inside of the sign, so the words, the arrow above them and the space between
are one target.

**`:focus-within` is how "or click" works with no JavaScript.** It matches the
element itself as well as its children, so `tabindex="0"` on the card is enough
for a tap or a keyboard tab to open it — no listener, and it keeps working when
the cards become links and the tabindex comes off.

A grown card must be raised a layer (`z-index:2`), or it grows *under* its
neighbours. His card gaps are 1.30% of the section and 1.05 eats 0.34% a side,
so 1.05 is about as far as it can go before they touch.

## Moving his art without ever showing an edge
The surf swells; the pattern generalises to anything of his that should drift.

**His own clipPath becomes the window.** waves.svg carried a clip rect that
lands within 2px of the section's edges - it was there to trim the 15% of bleed
he drew past the artboard. Turned into `overflow:hidden` on a wrapper div, that
window STOPS MOVING while the art slides under it, and no amount of motion can
bring an edge into view. This is the one clipPath of his that was doing real
work; the other four were cutting art short and got dropped.

**Bleed is the budget.** At a 1990 screen his surf has 320px of hidden art to
the left, 233px to the right, 23px above and 21px below at the tightest point
of the cycle. Measure that margin before choosing an amplitude - `tools/` has
the check (walk the cycle, compare every layer's box to the wrapper's).

**One `<svg>` per band, not one `<g>`.** A transform on an SVG group makes the
browser re-rasterise that group's paths every frame, and his wave paths run to
hundreds of segments. A transform on an HTML element gets its own compositor
layer: raster once, move the layer. Same reason the parallax only ever writes
`translate` on elements.

**Split it, then prove the still frame did not change.** Screenshot before,
split, screenshot after with the animation forced off (pausing at 0% parks it
on a DISPLACED keyframe, not at rest), and diff. His four bands came out at 509
differing pixels of 1.92M - 453 of them in column 0, the 0.4px of extra water
the slightly wider window reveals. Anything more than edge pixels means the
paint order moved.

**An SVG element's `className` is an SVGAnimatedString, not a string.** It has
no `.split`. Use `getAttribute('class')`. Same family as SVG having no
`offsetTop`: an inline `<svg>` is not an HTML element, and the DOM says so in
small ways that only show up at runtime.

**A forever-animation off screen is pure cost.** Six lines of
IntersectionObserver in parallax.js add `.still` to the wrapper, and the CSS
pauses the animations. On a page this long the beach is off screen most of the
time.

**Sliding a horizontal wavy line sideways is close to invisible.** The line is
quasi-periodic, so a shifted copy looks like the same line. It is the VERTICAL
that reads. The first pass had 18px of drift against 5px of lift and he could
not see it moving at all; the lift now carries most of it.

**Check the tightest moment, not the largest.** The first edge check took
`Math.min` over a cycle of NEGATIVE overhangs, so it reported the moment of
greatest safety and called it the worst case. Margins that looked like 30px
were really 1.8px. When a measurement is a safety argument, prove the extreme
is the one you think it is.

**Then check what his PAINT does, not what the box does.** getBBox on the
band's own content is the real budget. His surf's ink runs 9.7px past the
window and his far band's 20.2px, which are completely different constraints -
and the surf's turned out not to be a constraint at all, because its bottom
edge is a natural foam curve: moving it up just reads as the tide going out.
The far band's IS a cliff, because that edge is the section one/two seam.

**Give it one dial.** `--swell` on the wrapper scales all four bands together
and keeps their relation, so there is a single number to turn when he says it
is too much or too little - which is the feedback that always comes.

## Moving something along a path
His boat circles an oval and STEERS - turned to face along the path at every
step, because anything that slides sideways round a bend reads as a sticker
being dragged.

**Keyframes, not `offset-path`.** `offset-path: ellipse()` is one line and does
exactly this, but its basic shapes need Chrome 116 / Safari 18. The exact
position of his art is not somewhere to spend a browser-support argument.
tools/make_cruise.js generates 24 keyframes (15-degree steps, so the chord sags
about a pixel), in cqw so the circuit scales with the section.

**Unwrap the heading.** atan2 comes back in -180..180, and handing CSS a
rotation that goes 170 -> -170 makes it spin the long way back. Add 360 each
time it decreases so the value climbs 0 -> 360 across the lap.

**Home is a point ON the path, not its centre.** An element can never be at the
centre of its own orbit, so if his drawn position is to survive, the path has to
pass through it. His boat's home is the oval's left flank; the oval hangs to the
right of where he put it.

**A turning thing's bounding box swells, and the widest moment is not the
furthest moment.** His boat is 81px bow-on and 208px broadside; the tightest
clearance to the section edge came 15 degrees off the flank, not at it. Walk the
lap and measure - reasoning about it was out by 30px.

**The drop shadow rotates with it.** His shadow is baked into the art, so the
light appears to swing round the lap. Splitting it out is the wave treatment
again: give the shadow its own element that translates but does not rotate.
Not done - flagged to him.

## Traffic
His 20 vehicles survive in assets/js/cars-sprite.js from v1, all drawn facing
right. tools/subset_sprite.js cuts them to the ten in use - 132KB raw, 26KB
gzipped - and carries only the gradients those ten reference, walking
xlink:href chains, because a car painted with url(#missing) renders black.
Emit as a TEMPLATE LITERAL, not JSON: his SVG is nearly all double-quoted
attributes and JSON.stringify escaping doubled the file to 210KB.

**Where the road is comes from his dashes**, via tools/extract_path.js. See the
extractor's own header for why a dash is told from an edge line by clearance
rather than by size or position.

**Stop-and-go needs a simulation, but not v1's 1,800 lines.** build/v2/traffic.js
is 200. A position along the road, a speed, and a rule about the gap ahead.

**The jams come from a REACTION DELAY, and nothing else works.** A driver who
responds instantly to the gap ahead finds a stable equilibrium and sits in it -
measured, that gave 0.6% of readings queueing and a tidy convoy, no matter how
much the top speeds varied or how dense the road got. A driver who responds
LATE overshoots, brakes harder than needed, and the car behind does the same but
worse. That is a stop-and-go wave, and it is emergent: nothing is scripted.
Long vehicles are also slower, which is where most queues start, same as real
traffic.

**Density is the other dial.** Too sparse and free flow hides the delay; too
dense and everything crawls and looks sluggish rather than alive. SPACING is
road length per car as a share of the section width; 0.11 gives mostly-moving
traffic with occasional full stops.

**A car crossing the one/two seam is drawn TWICE**, once in each section, because
both sections clip their own overflow. The two halves are positioned from the
same page coordinates and meet exactly on the boundary.

**Section four's cars pass under his rocks for free.** His rocks are z-ground
(2) and the road is z-road (1); the traffic layer takes z-road, so nothing had
to be written to make it happen.

**Measuring motion needs settling time.** A parallax check that scrolled and
waited 20ms reported 25 overhangs that a careful max-overhang check could not
reproduce at all - the traffic script appending its layer triggers a relayout,
and a frame measured inside that window catches art mid-update.

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

## The sections so far

    section  artboard        art column          ratio    shapes
    01       2011.33 x 1810.6  x 86.99 w 1924.34  0.9409   4362 (95% baked truss)
    02       1938.1  x  931.4  x 15.23 w 1920.80  0.4849     92
    03       1922.52 x  855.76 x 0     w 1922.52  0.4451   1074 (desert inline)
    04       1930.6  x 1626.4  x 0     w 1930.6   0.8424   1604 (canopy a WebP)
    06       3127.99 x 1496.53 x 66.34 w 1923.2   0.6186   1300 (cards are CSS)

The art column is whatever his ground is — an ocean polygon in one, a sand rect
in the next. The ratios stack: a page of both is 1.4258 x its own width at every
screen size, measured at 1024, 1400, 1920 and 2560.

## A HAIRLINE ON A SECTION JOIN

Two boxes that share an edge land on a half device pixel at some widths and
zooms, and the row where they meet renders LIGHTER than either side - a bright
line straight across his ocean on his screen, at the exact boundary, with the
colour identical either side of it. It did not reproduce here at the same
width, at 1x or 2x, which is the tell: it is a rasteriser artefact, not a
colour mismatch, so no amount of matching the two blues fixes it.

`section + section{ margin-top:-1px }` in the generated page. A pixel of
overlap means there is no shared edge to land badly. Sections that already ride
up over the one above keep their own margin - a class beats it.

## Joining a section to the one above

Two things break the road at a join, and both will recur on every section:

  - **His artboards are not the same width.** 1924.34 against 1920.8 is 0.18%,
    so a road he drew continuous in his master lands 0.14% apart once each
    section is normalised to its own column. Whichever section has less riding
    on it is the one that moves — section two's road, not section one's.
  - **His road stops short of his artboard edge.** Section one's ran out 186
    units above the bottom, section two's started 9.5 units below the top: a
    gap of about 10% of the section width, which reads as a road snapped in
    mid-air. Carry it across with one more of his own straight tiles, and start
    the section below above its own top edge so the seam is covered.

Overlap tiles by a whole dash period, not an arbitrary amount, or the dashes
double up in the overlap. The straight tile is 683 units for 6.85 periods, so
one period is 14.60% of the tile — 2.62% of section one.

`tools/check_join.js` walks the road's own column down through the seam at six
widths and fails on any background pixel it finds there.

**His sections are separate animations.** His words: the road leaving the
screen ends one animation, the next section starts its own with the same rules,
and a car drives off the edge and disappears. So a road that does not meet the
one below is not a bug - do not bridge them.

**But his ART does carry across.** Section three's desert runs 282.77 units
past the bottom of its own artboard, and clipped there it cut his rocks off
mid-shape. That overhang belongs at the top of section four: the same drawing
at the same scale, `assets/v2/section-04/desert-bleed.webp`, a thin strip
rasterised because duplicating 978 paths for it would not be thin.

Two more things his exports do at a join, both from section three:

  - **A layer can open on a band of the wrong colour.** His desert's gold sand
    base starts at y 9.2 and the cream gradient over it only at 23.51, so the
    layer's first 14 units are gold - a hard line exactly where section two's
    sand ends. `clip-path:inset()` takes it off; the section paints his cream
    underneath, so cream meets cream.
  - **A layer's name is not its shape.** Section three's "Curve" is a plain
    road rectangle whose edge lines and dashes sit about a unit off the
    straights beside it, which reads as a step in the white line a tenth of the
    way across. The run carries on with one more straight tile instead, on his
    own 16.81% step.

`build/v2/page.html` is GENERATED by `tools/make_page.js` from the section
files. It used to be a hand-copy, and an edit to a section landed in one file
and not the other.

## Reading a section export

    tools/read_section.js   every named layer, in ART COLUMN coordinates
    tools/read_text.js      his copy — bounds, alignment, per-line size/weight
    tools/cut_layers.js     each named layer into its own file, cropped
    tools/check_section.js  the page against his copy, both as a share of the section

**Section six is the case where the artboard is neither.** His artboard is
3127.99 x 1496.53 but the PAGE inside it is a white rect at x 66.34, width
1923.2, height 1189.6 - the rest is workspace, and his rock band keeps a second
copy of itself out there for tiling. Find the white rect, and pass its column
to the readers. And then watch the vertical numbers: read_section and read_text
report every TOP and HEIGHT as a share of the ARTBOARD height, so on a section
like this one they all need scaling by artboard/page - 1496.53/1189.6 = 1.258.
Lefts and widths are already against the column you passed.

His four service cards are one component in CSS, not the 1,340 shapes his
export draws them as: a box, a radius, a hairline rule and one colour per card
off a --c custom property. The tag is his own label.svg, filled from that same
property - which is what "change the label colour to each card" asks for.

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
    tools/degradient.js          sliver stacks back into real gradients — run first
    tools/inline_art.js          an asset SVG inlined into its section page
    tools/rasterise_art.js       heavy static art to WebP, alpha intact
    tools/art_underlay.js        the art's own colours as a CSS gradient behind it
    tools/make_page.js           page.html from the section files
    tools/check_join.js          the road across a section seam, at six widths
    tools/check-contrast.js W    39 copy elements vs the pixels behind them
    tools/check-centreline.js W  is the driving line actually on the road
    tools/compare-layout.js      his text positions vs the page

`check-cars-on-road.js` samples the pixel under each vehicle, so it measures
wherever the traffic happens to be — it swung 18%→39% across runs of identical
code. Use `check-centreline.js` instead; it is deterministic.

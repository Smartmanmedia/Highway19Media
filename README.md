# Highway 19 Media — home page

Standalone HTML. Open `index.html` in a browser, or serve the folder
(`python3 -m http.server`) — no build step, no dependencies, nothing external.
WordPress conversion happens later, once this is approved.

```
index.html                     the page — 9 sections + header + footer
assets/css/highway19.css       palette first, then everything else
assets/js/cars-sprite.js       the 20 vehicles + gradients, ported verbatim
assets/js/road.js              the living road, threaded down the whole page
assets/js/site.js              nav, form, booking links
build.js                       inlines it all into one file
```

`node build.js` writes two self-contained files to `dist/` (gitignored —
regenerate rather than commit):

- `highway19-home.html` — a full standalone document. Open it off disk, email
  it, or hand it to WPVibe. Everything inlined, nothing external.
- `highway19-artifact.html` — body-only, for publishing as a hosted preview.

Add `?road=debug` to the URL for the traffic panel: hour scrubber, density,
speed, car size, weekend toggle, lane paths. It is not shipped to visitors.

---

## What needs you next

**1. Exact hexes, or the source files.** The palette is now built from your own
artwork — the interstate shield, the "All Roads Lead To Your Business" guide
sign, and the four coloured service lanes and icon discs — but it was read *by
eye* from images, not sampled from files. Drop the logo vector, the banner and
the icon set into `assets/brand/` (or just send the hexes) and these become
exact. Everything is a custom property in the `:root` block at the top of
`highway19.css` and nothing downstream hardcodes a colour, so it is one block of
edits and nothing else moves.

Current values, all provisional:

| | | |
|---|---|---|
| Shield red / blue / rim | `#c0202a` `#12569f` `#b9bcc0` | logo |
| Guide-sign green | `#1f9a24` large · `#1c9022` plates · `#126d18` band | banner |
| Brand red | `#e4032b` | social marks |
| Website Design | `#164f96` card · `#1068b6` disc | lane + icon |
| Video Production | `#12605c` card · `#0f8f8a` disc | lane + icon |
| Print & Branding | `#6d1a7d` card · `#8b1ba2` disc | lane + icon |
| Social & Paid Ads | `#b5541a` card · `#f37020` disc | lane + icon |

Two notes on the green. The banner's grass green is too light for small white
type — it fails contrast — so sign plates and the section 6 band step down from
it while the big footer sign keeps it. And the shield, guide sign and four
service icons are all **redrawn as SVG**, not your files; they'll be closer
still once the real vectors are in.

**The blend-mode fix that shipped in the first draft was wrong.** Illustrator
exports blend modes as an XML attribute and every browser ignores them —
`mix-blend-mode` is a CSS property. The old "lift it onto the parent group"
step therefore did nothing, and the screen highlights (authored near-black so
screen can invert them) rendered literally, as a black streak across every car.
All 121 blend modes are now inline CSS. `tools/fix_illustrator_blend_modes.py`
does the conversion and must be re-run on any new Illustrator export;
`tools/unlift_group_blend_modes.py` strips the 33 attributes the old step added.

**`HWY19_Website_2_copy.jpg` is still missing** and it is the source of truth for
layout as well as colour. Everything below about proportion is my call, not
yours, until it turns up.

**2. Two things are still my redraws, not your artwork.** Renaming to
`.svg.txt` works — that is how the signs arrived. Still outstanding:

- **the interstate shield**, used in the header and in both guide signs
- **the hero banner** (the photoreal one)
- the green "road ahead" plate on section 7, which has no supplied equivalent

Everything in `assets/brand/` is yours, unaltered:

| File | Where it appears |
|---|---|
| `highway-sign.svg` | section 4 and section 9 headlines |
| `road-work-sign.svg` | section 3 — the detour |
| `road-bridge-sign.svg` | section 2 — the problem |
| `lane-arrows-sign.svg` | section 5 — "Pick Your Lane" |
| `rest-stop-sign.svg` | section 6 — "Your Success Is Our Destination" |
| `road-tiles-reference.svg` | reference only; the road is generated in code |

Signs are sized by **height**, not width: they range from a 0.65 portrait plate
to a 1.13 triangle, and matching widths would make the tall ones tower.

The hero banner is a stand-in meanwhile: the guide sign and shield over four
service signs, each an actual sign face — rounded, white-bordered, bolted to a
metal post. Swap in the real artwork by replacing `.hero-banner__art` with an
`<img>`; the guide sign overlays it either way.

**3. The typeface.** "Anke" isn't a released family. The site is set in **Anek
Latin**, the closest match and genuinely signage-like. If you have a licensed
file under that name, send the `.woff2` and it's two lines in `:root`.

**4. How much page the road should take.** Each section reserves a lane and the
animation *measures* that lane rather than being told a number, so moving the
road is a CSS change, not a code change. Two dials:

| Token | Now | Used by |
|---|---|---|
| `--road-reserve` | `38%` | hero, problem, promise — road shares the copy grid |
| `--road-corridor` | `172px` | proof and close — road runs just outside the copy |

Traffic has two dials in `road.js`: `TRAFFIC` (0.5 — half the demo's density)
and `CAR_H` (37px median vehicle height).

Change either and the road follows on the next resize. Which side each section
takes is the `data-road` attribute on the `<section>`.

**3. Section 8 (proof) ships hidden.** Drop in three real before/after pairs,
write the captions, delete `hidden` from `<section id="proof">`. The road
re-routes through it automatically. Leaving it out beats filling it with stock —
it would argue against section 3.

**4. Section 7's marker copy is new.** "The camera shows up / The calls change /
The number changes" is not part of approved Draft 1; the layout sheet only
specified Month 1 / 3 / 6. Approved Draft 1 body copy sits above it, untouched.

---

## Decisions taken, and why

**Colour bands.** Hero interstate blue, problem white, objection white,
promise pale blue, services white, why-us guide-sign green, payoff pale blue,
close blue, footer deep blue. Green landed on "Your Success Is Our
Destination" because guide signs are the ones that name destinations.

**The four service cards carry their lane colours** from the banner rather than
a generic four-colour set, with the brighter icon-disc tone inside a white rim —
the same pairing the banner uses. Card order follows the approved copy (Website
first), not the banner's left-to-right order.

**The footer headline is the banner's guide sign**, rebuilt in SVG: green panel,
white rule, lane arrows either side, shield breaking out top and bottom.

****Road signs beside the headlines.** A real sign sits by every section
headline, chosen for what the section says rather than for decoration: a
warning triangle at the problem, roadworks at the detour, a motorway plate at
the promise, lane arrows at "Pick Your Lane", a destination panel at "Your
Success Is Our Destination". Left-aligned sections keep it alongside; centred
sections stack it above, because sitting it to one side pulls the block off the
section's axis. Every CTA carries a red-and-white warning triangle.

**Section 3 is deliberately undesigned**** — narrow centred column, large type,
one faint DETOUR plate, no button. It argues against templates, so it must not
look designed.

**No CTA in sections 2 and 7.** 2 builds tension; 7 is still an open question
(Open Items #7). Adding one to 7 is a two-line change.

**No phone number anywhere.** The form is on the page, not behind a link, with
the 24-hour promise beside the button.

**The form is not wired and says so.** No endpoint is chosen yet, so submitting
tells the user plainly that nothing was sent rather than pretending it worked.
Set `data-endpoint` on `#contact-form` and it posts for real; set `BOOKING_URL`
in `site.js` and every "Book a free consult" link picks it up.

---

## The road — two runs, not one

Run A enters above the hero, weaves down past the problem and the objection,
and at the end of "We Handle the Marketing" **turns right and drives off the
right edge of the screen**. The services section then runs edge to edge with no
asphalt anywhere near it. Run B **comes back in from the left edge** at "Your
Success Is Our Destination", hooks around that band — across the top, down the
right, back along the bottom — and carries on down through the payoff and the
close and under the footer.

Each run hands off into **its own** section's lane, never the next section's —
handing the hook straight to the payoff's centre lane put the road under that
section's headline, because the jog the payoff asks for (`data-jog="slot"`) then
had nothing left to do.

Each run is its own loop with its own traffic. Both ends of both runs sit
off-canvas, so the point where a vehicle wraps is never visible. Below 900px
neither run weaves: one lane down the left margin, because a 126px road
crossing the page needs about two corner-radii of clear vertical space and
narrow layouts haven't got it.

Ported from `Highway-19-Living-Road-REAL.html`, not rebuilt. The geometry is
carried over exactly, and `assets/brand/road-tiles-reference.svg` now confirms
every number against your own export — asphalt 125.88, edge lines 4.36 at 7.76
and 114.04 from the top edge, centre dash 37.43 x 4.68 on a 62.65 pitch (a
25.22 gap). All of it matches — road 125.88, edge
lines at ±53, dashes 37.43 on 25.21 gaps, lanes at ±31 — and so is the traffic
model: every vehicle measures the gap to the car ahead, checks the tightest
curve in the next ~130px, and takes whichever speed is lower. Queues behind the
semi are emergent, not scripted. **The Illustrator blend-mode repair is baked
into `cars-sprite.js`.** If you re-export the vehicles from Illustrator, that
fix has to be re-applied or the highlights turn into dark smears.

What's new is what a page-long road needs:

- The road weaves between sections instead of jogging once, and its position in
  each section is measured from the empty lane the layout reserves — so the
  artwork and the copy cannot drift apart at any width.
- It's drawn into five stacked SVGs, each clipped to its own slice, so no single
  layer is ever the height of the page.
- Traffic lives in one layer above the tiles, so nothing is cut in half at a
  seam. Every vehicle is simulated every frame; only the dozen or so near the
  viewport hold a DOM node. Measured deep in the page: **16.7ms median frame,
  16.8ms worst** — a locked 60fps, same as the original hero.
- It loops on its own clock. Not scroll-driven, as agreed.

**Tap the road to hold the traffic**, tap again to release it. Nothing freezes:
paused sets every vehicle's target speed to zero and lets the existing
car-following model do the braking, so a semi takes noticeably longer to come
to rest than a hatchback and they pull away in the same order. Once everything
has actually stopped the simulation idles rather than spinning. The tap target
is the asphalt stroke itself, so only the road is clickable — never the gaps
around it and never the copy. A short pill confirms the state, and a
focus-visible button carries the same toggle for keyboard users.

Time-of-day traffic is built and running off the visitor's clock — roughly 5
vehicles at 2am, up to ~150 at evening peak — with no visitor-facing control.
Set `auto = false` in `road.js` to switch it off.

**Below 900px the road stops weaving** and runs as one lane down the left
margin. A 126px road crossing the page needs about two corner-radii plus a
road-width of clear vertical space to do it without clipping a paragraph, and
narrow layouts don't have it. The weave is verified clean down to 1024px.
Below 720px the lane also bleeds half off the left edge and the copy insets past
it — a holding pattern until the dedicated mobile pass, not the mobile design.

---

## Verified

Rendered in headless Chromium at 1920 / 1440 / 1280 / 1024 / 768 / 390. The
check samples **every** rendered asphalt path — one per run; a selector that
grabbed only the first silently stopped checking run B and let a collision
through —  and tests it against every
headline, paragraph, card, label and form field on the page: **no road/copy
collisions at any width**, no console errors. Two bugs came out of that pass
that no amount of looking at screenshots would have found — an infinite loop in
the sprite mount, and every tile painting over its neighbour's traffic.

## Still open

Hero rework · pricing · section 7 CTA · which three proof jobs · the two flagged
headlines (2 and 7) · booking tool and business email · service-area wording ·
privacy policy entity and state · Spanish. Service pages, privacy and terms are
not started.

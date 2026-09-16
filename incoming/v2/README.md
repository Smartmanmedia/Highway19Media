# Section exports — the rebuild

One folder per section. Drop both files for a section in its folder:

    section-01/
      section-01.svg     the layered export — layers NAMED, Object IDs: Layer Names,
                         Styling: Presentation Attributes, Responsive UNCHECKED
      section-01.jpg     the flat render, for placement reference
      tiles/             anything meant to repeat forever, one file each

Nothing else is needed. The SVG carries the positions; I cut the named layers
out of it with tools/extract_layers.js rather than asking for separate exports,
because a per-element export is cropped to its own bounds and loses where the
thing sat.

## Per section, tell me

- **artboard width and height** in the export's own units (or just confirm the
  artboard is tight to the section)
- **which layers bleed** past the left/right edge
- **which layers are tiles**, their width, and butt-join or overlap

Keep the artboard WIDTH identical across sections. Height varies per section —
that ratio is the whole layout system. Same width means the sections stack with
no seam and one scale rule covers all of them.

## Not yet

Traffic and moving elements come last, after the layout is settled and the
driving path is drawn on it. The car code is parked, not deleted:
assets/js/road.js and assets/js/cars-sprite.js.

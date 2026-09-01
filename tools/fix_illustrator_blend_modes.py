#!/usr/bin/env python3
"""
Fix Illustrator SVG exports whose blend modes do nothing in the browser.

THE BUG
-------
Illustrator exports blend modes as an XML ATTRIBUTE:

    <path fill="url(#grad)" mix-blend-mode="screen"/>

Chrome, Safari and Firefox all IGNORE that. `mix-blend-mode` is a CSS property,
not an SVG presentation attribute. The browser silently drops it.

WHY THAT LOOKS LIKE BLACK PAINT
-------------------------------
A "screen" highlight is authored as a near-black gradient (#000 -> #70706f),
because screen inverts dark pixels into a bright shine. With the blend mode
dropped, that gradient renders literally -- as a black smear across the artwork.
Multiply shadows go opaque and heavy for the same reason.

The artwork is correct. Only the export is wrong.

THE FIX
-------
Move every blend mode from the attribute into an inline style:

    <path fill="url(#grad)" style="mix-blend-mode:screen"/>

Existing style attributes are preserved and appended to.

ALSO REQUIRED, IN THE RENDERER
------------------------------
Wrap each vehicle instance in its own isolation group:

    <g style="isolation:isolate"> ...car... </g>

Without it a car's screen/multiply layers blend with the road and with
neighbouring cars instead of staying inside their own vehicle.

USAGE
-----
    python3 fix_illustrator_blend_modes.py input.svg output.svg

Re-run this on ANY new Illustrator export. It is not a one-off.
"""

import re
import sys


def convert(svg_text):
    """Rewrite mix-blend-mode attributes as inline CSS. Returns (text, count)."""
    # Stash the attribute so the tag-level pass can find it unambiguously.
    staged = re.sub(r'mix-blend-mode="([a-z-]+)"',
                    lambda m: 'data-bm="%s"' % m.group(1),
                    svg_text)

    def fold(match):
        tag = match.group(0)
        bm = re.search(r'data-bm="([a-z-]+)"', tag)
        if not bm:
            return tag
        mode = bm.group(1)
        tag = re.sub(r'\s*data-bm="[a-z-]+"', '', tag)

        existing = re.search(r'style="([^"]*)"', tag)
        if existing:
            merged = '%s;mix-blend-mode:%s' % (existing.group(1).rstrip(';'), mode)
            return tag.replace(existing.group(0), 'style="%s"' % merged)

        close = '/>' if tag.endswith('/>') else '>'
        return tag[:-len(close)].rstrip() + ' style="mix-blend-mode:%s"' % mode + close

    out = re.sub(r'<[^>]*data-bm="[a-z-]+"[^>]*>', fold, staged)
    return out, out.count('mix-blend-mode:')


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    src, dst = sys.argv[1], sys.argv[2]
    text = open(src).read()
    before = len(re.findall(r'mix-blend-mode="', text))

    out, after = convert(text)

    if 'mix-blend-mode="' in out:
        print('WARNING: some attributes were not converted')

    open(dst, 'w').write(out)

    print('attributes found:   %d' % before)
    print('now inline CSS:     %d' % after)
    print('written to:         %s' % dst)


if __name__ == '__main__':
    main()

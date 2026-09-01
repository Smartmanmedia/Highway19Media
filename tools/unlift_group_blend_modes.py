#!/usr/bin/env python3
"""
Undo the "lift the blend mode onto the parent group" step.

BACKGROUND
----------
An earlier build step tried to fix Illustrator's blend-mode export by copying a
group's children's mix-blend-mode ATTRIBUTE up onto the group itself. That was
based on a wrong diagnosis: mix-blend-mode is a CSS property, not an SVG
presentation attribute, so browsers ignore it wherever it sits. Lifting it onto
the parent achieved nothing except adding attributes that were never in the
artwork.

Run this BEFORE fix_illustrator_blend_modes.py on any artwork that went through
that step, so the lifted attributes don't get converted into live CSS that
Illustrator never intended.

A group is treated as lifted when it carries a mix-blend-mode AND at least one
of its element children carries one too. Illustrator's own group-level blend
modes sit on groups whose children carry none; the old step only ever touched
groups whose children were already blended, so the two sets are cleanly
separable.

Verified against this artwork: 154 attributes = 101 on leaf shapes + 53 on
groups, of which 20 are Illustrator's own (no blended children) and 33 were
added by the old step. 154 - 33 = 121, which matches the count in the
independently produced Cars_Highway19_Media_FIXED.svg.

USAGE
    python3 unlift_group_blend_modes.py input.svg output.svg
"""

import re
import sys
import xml.etree.ElementTree as ET

BM = 'mix-blend-mode'
G_WITH_BM = re.compile(r'<g[^>]*\smix-blend-mode="[a-z-]+"[^>]*>')


def lifted_flags(svg_text):
    """Document-order flags: True where a <g>'s blend mode was lifted."""
    root = ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg" '
                         'xmlns:xlink="http://www.w3.org/1999/xlink">'
                         + svg_text + '</svg>')
    flags = []
    for g in root.iter('{http://www.w3.org/2000/svg}g'):
        mode = g.get(BM)
        if mode is None:
            continue
        kids = list(g)
        flags.append(any(k.get(BM) is not None for k in kids))
    return flags


def strip(svg_text, flags):
    it = iter(range(len(flags)))

    def repl(m):
        i = next(it)
        if not flags[i]:
            return m.group(0)
        return re.sub(r'\s*mix-blend-mode="[a-z-]+"', '', m.group(0))

    return G_WITH_BM.sub(repl, svg_text)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    text = open(sys.argv[1]).read()
    before = len(re.findall(r'mix-blend-mode="', text))
    flags = lifted_flags(text)
    out = strip(text, flags)
    after = len(re.findall(r'mix-blend-mode="', out))
    print('attributes before: %d' % before)
    print('lifted groups removed: %d' % (before - after))
    print('attributes after:  %d' % after)
    open(sys.argv[2], 'w').write(out)


if __name__ == '__main__':
    main()

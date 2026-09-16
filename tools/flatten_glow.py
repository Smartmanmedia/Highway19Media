#!/usr/bin/env python3
"""HIS SUN AND HIS MOON, WITH THE GLOW BAKED INTO ALPHA.

Both are drawn as a stack of `screen` circles - a white-to-black radial ramp
over a white-to-black radial ramp - which is the right way to draw a glow and
the one way it cannot survive the trip to a web page. Screen over black IS the
backdrop, so those ramps are meant to disappear into whatever is behind them;
but a blend mode can only reach as far as its own isolated group, and the
OUTERMOST <svg> is one. Inline it, take Illustrator's isolation:isolate off,
strip every stacking context between it and the bar - all of which was tried -
and Chrome still composites it against nothing, and what the bar shows is the
ramps themselves: a hard grey ring round his sun.

So the blend is done here instead, once, and the file that ships carries the
answer rather than the instruction.

THE ARITHMETIC IS EXACT, not an approximation, for every grey ramp in these
two files - which is all of them but one:

    screen(a, c) = a + c - a*c
    over(a, white, alpha) = a*(1 - alpha) + alpha

and those are the same expression when alpha = c. Stacked, too: n screens of
grey come to a*prod(1-ci) + (1 - prod(1-ci)), and so do n source-over whites.
So each stop keeps its own grey level as its OPACITY and its colour becomes
white, the element keeps whatever opacity Illustrator gave it (which multiplies
the same way in both models), and the blend mode comes off.

The one coloured ramp - his yellow, #ffdc00 to black - has no single alpha that
is right in all three channels, because screen works per channel and alpha does
not. It is taken at its brightest channel with the colour divided back out,
which is exact where the ramp is neutral and within a couple of levels of it
everywhere else over a dark blue bar.

`multiply` is left alone: the only one is the moon's own craters, which sit on
the opaque face inside the drawing and never needed the page to blend against.

    python3 tools/flatten_glow.py
      assets/brand/Sun.svg  -> assets/v2/header/sun.svg
      assets/brand/Moon.svg -> assets/v2/header/moon.svg
"""
import re, sys, os

ROOT = os.path.join(os.path.dirname(__file__), '..')

def tag_of(src, gid):
    """the gradient element with this id: its kind, its own tag, and its body.

    Written as a scan rather than one expression because a self-closing
    <radialGradient .../> and an open one are different shapes, and a regex
    that matches `...id="X"...>(.*?)</radialGradient>` happily pairs a
    self-closing tag with the NEXT gradient's closing tag - which is how three
    of the moon's four glow rings ended up painted with the ramp off his
    moon's own face and came out a hard olive instead of a white haze."""
    m = re.search(r'<(linear|radial)Gradient\b[^>]*\bid="%s"[^>]*>' % re.escape(gid), src)
    if not m: return None, '', ''
    kind, tag = m.group(1), m.group(0)
    if tag.endswith('/>'): return kind, tag, ''
    end = src.index('</%sGradient>' % kind, m.end())
    return kind, tag, src[m.end():end]

def stops_of(src, gid, seen=None):
    """the stops a gradient actually paints with, following xlink:href"""
    seen = seen or set()
    if gid in seen: return []
    seen.add(gid)
    kind, tag, body = tag_of(src, gid)
    if not kind: return []
    stops = re.findall(r'<stop\b[^>]*/>', body)
    if stops: return stops
    href = re.search(r'(?:xlink:)?href="#([^"]+)"', tag)
    return stops_of(src, href.group(1), seen) if href else []

def bake(stop):
    off = re.search(r'offset="([^"]*)"', stop)
    col = re.search(r'stop-color="([^"]*)"', stop)
    op  = re.search(r'stop-opacity="([^"]*)"', stop)
    o   = float(op.group(1)) if op else 1.0
    h   = (col.group(1) if col else '#000').lstrip('#')
    if len(h) == 3: h = ''.join(ch * 2 for ch in h)
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    a = max(r, g, b)
    if a <= 0:
        return '<stop offset="%s" stop-color="#fff" stop-opacity="0"/>' % (off.group(1) if off else '0')
    rgb = '#%02x%02x%02x' % tuple(round(v / a * 255) for v in (r, g, b))
    return '<stop offset="%s" stop-color="%s" stop-opacity="%.4f"/>' % (
        off.group(1) if off else '0', rgb, a * o)

def flatten(src):
    # the c2pa provenance block Illustrator now writes is a base64 JPEG of the
    # artboard - 106 KB of it on his moon, against 3 KB of drawing
    src = re.sub(r'<metadata>.*?</metadata>', '', src, flags=re.S)
    src = re.sub(r'\s+xmlns:c2pa="[^"]*"', '', src)
    # Illustrator writes the blend as an ATTRIBUTE, which a browser drops; the
    # same fix tools/fix_illustrator_blend_modes.py makes, so this is the whole
    # pipeline in one pass rather than two.
    src = re.sub(r'\smix-blend-mode="([^"]+)"', r' style="mix-blend-mode:\1"', src)
    src = re.sub(r'\sisolation="isolate"', '', src)
    src = src.replace(' style="isolation:isolate"', '')

    # which gradients are painted through a screen
    ids = set(re.findall(r'fill="url\(#([^)]+)\)"[^>]*style="mix-blend-mode:screen"', src))
    ids |= set(re.findall(r'style="mix-blend-mode:screen"[^>]*fill="url\(#([^)]+)\)"', src))
    made = []
    for gid in sorted(ids):
        st = stops_of(src, gid)
        if not st: continue
        kind, tag, _ = tag_of(src, gid)
        attrs = tag[len('<%sGradient' % kind):].rstrip('>').rstrip('/')
        attrs = re.sub(r'\s(?:xlink:)?href="#[^"]+"', '', attrs)
        attrs = attrs.replace('id="%s"' % gid, 'id="%s-a"' % gid)
        # a gradient that inherited its geometry needs it written out
        if 'gradientUnits' not in attrs:
            attrs += ' gradientUnits="userSpaceOnUse"'
        made.append('<%sGradient%s>%s</%sGradient>' % (kind, attrs, ''.join(bake(s) for s in st), kind))
        src = re.sub(r'(fill=")url\(#%s\)(")' % re.escape(gid), r'\1url(#%s-a)\2' % gid, src)
    if made:
        src = src.replace('</defs>', ''.join(made) + '</defs>', 1)
    src = src.replace(' style="mix-blend-mode:screen"', '')
    return src

for a, b in (('assets/brand/Sun.svg',  'assets/v2/header/sun.svg'),
             ('assets/brand/Moon.svg', 'assets/v2/header/moon.svg')):
    s = open(os.path.join(ROOT, a), encoding='utf-8').read()
    out = flatten(s)
    open(os.path.join(ROOT, b), 'w', encoding='utf-8').write(out)
    print('%-26s -> %-28s %5.1fK  screens baked: %d'
          % (a, b, len(out) / 1024, s.count('mix-blend-mode="screen"')))

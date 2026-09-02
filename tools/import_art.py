#!/usr/bin/env python3
"""
Take an Illustrator SVG export and make it safe to drop into the page.

WHY THIS EXISTS
---------------
Three separate export mistakes have each cost us real time on this project,
and none of them announce themselves -- the file opens fine in a browser on
its own and only breaks once it is combined with the rest of the page:

  1. Styling: Internal CSS.  Illustrator writes `.st0 { fill: #fff }` class
     names starting from zero in EVERY file. Two files on one page and the
     second silently repaints the first. Presentation Attributes avoids it.

  2. Responsive checked.  Strips width/height off the root, so the artwork
     has no intrinsic size and collapses or fills its parent unpredictably.

  3. mix-blend-mode as an XML attribute.  Browsers ignore it, and a "screen"
     highlight authored as a near-black gradient renders as a black smear.
     (See fix_illustrator_blend_modes.py for the long version.)

On top of that, ids collide between separately-authored files -- two exports
both containing `#linear-gradient-3` will fight, and whichever loads last
wins. So every id here gets a per-file prefix.

USAGE
-----
    python3 tools/import_art.py incoming/h19-scene.svg assets/brand/scene.svg
    python3 tools/import_art.py incoming/*.svg --into assets/brand/

    --canvas WxH   the master artboard every file must match, e.g. 1440x9082
    --check        report only, write nothing

Exit code is non-zero if any file fails a check, so it can gate a build.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fix_illustrator_blend_modes import convert as fix_blend_modes


# --------------------------------------------------------------------------
# Reading the root element
# --------------------------------------------------------------------------

def root_tag(text):
    m = re.search(r'<svg\b[^>]*>', text, re.S)
    return m.group(0) if m else ''


def attr(tag, name):
    m = re.search(r'\b%s\s*=\s*"([^"]*)"' % re.escape(name), tag)
    return m.group(1) if m else None


def px(value):
    """'1440', '1440px', '1440.0pt' -> 1440.0. None if it isn't a length."""
    if not value:
        return None
    m = re.match(r'\s*(-?[\d.]+)\s*(px|pt|mm|cm|in)?\s*$', value)
    if not m:
        return None
    n = float(m.group(1))
    unit = m.group(2)
    if unit == 'pt':
        n *= 96.0 / 72.0
    elif unit == 'mm':
        n *= 96.0 / 25.4
    elif unit == 'cm':
        n *= 96.0 / 2.54
    elif unit == 'in':
        n *= 96.0
    return n


def canvas_of(text):
    """Artboard size, preferring the viewBox -- it is the coordinate system
    everything else in the file is measured in."""
    tag = root_tag(text)
    vb = attr(tag, 'viewBox')
    if vb:
        parts = re.split(r'[,\s]+', vb.strip())
        if len(parts) == 4:
            try:
                return float(parts[2]), float(parts[3])
            except ValueError:
                pass
    return px(attr(tag, 'width')), px(attr(tag, 'height'))


# --------------------------------------------------------------------------
# Checks. Each returns a list of (level, message).
# --------------------------------------------------------------------------

def check(text, name, canvas=None):
    out = []
    tag = root_tag(text)

    if not tag:
        return [('FAIL', 'no <svg> root element -- is this really an SVG?')]

    # 1. Internal CSS
    styles = re.findall(r'<style\b[^>]*>(.*?)</style>', text, re.S)
    classes = set()
    for block in styles:
        classes.update(re.findall(r'\.((?:st|cls)\d+)\b', block))
    if classes:
        out.append(('FAIL',
            'Internal CSS: %d generated class names (%s...). These collide '
            'between files. Re-export with Styling: Presentation Attributes.'
            % (len(classes), ', '.join(sorted(classes)[:3]))))

    # 2. Responsive
    w, h = px(attr(tag, 'width')), px(attr(tag, 'height'))
    if w is None or h is None:
        out.append(('FAIL',
            'no width/height on the root -- "Responsive" was checked in the '
            'export dialog. Uncheck it and export again.'))

    # 3. Artboard registration
    cw, ch = canvas_of(text)
    if canvas and cw and ch:
        want_w, want_h = canvas
        if abs(cw - want_w) > 1 or abs(ch - want_h) > 1:
            out.append(('FAIL',
                'artboard is %g x %g, master is %g x %g. Every file must be '
                'exported at the full artboard size or the layers will not '
                'register. Uncheck "Use Artboards" cropping to object bounds.'
                % (cw, ch, want_w, want_h)))

    # 4. Blend modes (auto-fixed, reported for the record)
    bm = len(re.findall(r'mix-blend-mode="', text))
    if bm:
        out.append(('FIXED', '%d blend-mode attributes moved to inline CSS' % bm))

    # 5. Weight
    nodes = len(re.findall(r'<(path|polygon|polyline|circle|ellipse|rect|line)\b', text))
    kb = len(text.encode('utf-8')) / 1024.0
    level = 'HEAVY' if kb > 900 else 'INFO'
    out.append((level, '%d shapes, %.0f KB' % (nodes, kb)))
    if level == 'HEAVY':
        out.append(('HEAVY',
            'this one is a candidate for rasterising to WebP at 2x; the '
            'vector stays the master either way'))

    # 6. Embedded rasters
    raster = re.findall(r'xlink:href="data:image/([a-z+]+);base64,([^"]*)"', text)
    for kind, blob in raster:
        out.append(('INFO', 'embedded %s, %.0f KB' % (kind, len(blob) * 0.75 / 1024)))

    # 7. Named groups -- what I can address from code
    named = re.findall(r'<g\b[^>]*\bid="([^"]+)"', text)
    keep = [n for n in named if not re.match(r'^(Layer_?\d*|_?[xX]\d+_?)$', n)]
    if keep:
        out.append(('INFO', 'named groups: ' + ', '.join(keep[:14]) +
                            (' ... (+%d)' % (len(keep) - 14) if len(keep) > 14 else '')))
    else:
        out.append(('WARN',
            'no useful group names. Set Object IDs: Layer Names on export, '
            'and name the layers you want addressable (each cloud, the boat).'))

    # 8. Open paths, which is what a road centreline should be
    opens = len(re.findall(r'<path\b[^>]*\bd="[^"]*"', text))
    if 'road' in name.lower() and opens:
        ds = re.findall(r'<path\b[^>]*\bd="([^"]*)"', text)
        closed = sum(1 for d in ds if re.search(r'[zZ]\s*$', d.strip()))
        out.append(('INFO', '%d paths, %d closed' % (len(ds), closed)))
        if closed:
            out.append(('WARN',
                'a road centreline should be an OPEN path. A closed one makes '
                'the traffic loop back on itself at the join.'))
    return out


# --------------------------------------------------------------------------
# Namespacing
# --------------------------------------------------------------------------

def namespace(text, prefix):
    """Prefix every id in the file, and every reference to one."""
    ids = set(re.findall(r'\bid="([^"]+)"', text))
    if not ids:
        return text, 0

    # Longest first, so #grad-1 is not clobbered while rewriting #grad.
    for old in sorted(ids, key=len, reverse=True):
        new = prefix + old
        q = re.escape(old)
        text = re.sub(r'\bid="%s"' % q, 'id="%s"' % new, text)
        text = re.sub(r'url\(#%s\)' % q, 'url(#%s)' % new, text)
        text = re.sub(r'(\bhref=")#%s"' % q, r'\1#%s"' % new, text)
        text = re.sub(r'(\bxlink:href=")#%s"' % q, r'\1#%s"' % new, text)
    return text, len(ids)


# --------------------------------------------------------------------------

def process(src, dst, canvas, write):
    name = os.path.basename(src)
    text = open(src, encoding='utf-8').read()

    findings = check(text, name, canvas)
    failed = any(level == 'FAIL' for level, _ in findings)

    print('\n%s' % name)
    print('-' * max(len(name), 40))
    for level, msg in findings:
        print('  %-6s %s' % (level, msg))

    if failed or not write:
        if failed:
            print('  ->     not written')
        return not failed

    text, _ = fix_blend_modes(text)
    stem = re.sub(r'[^a-z0-9]+', '', os.path.splitext(name)[0].lower())
    text, n = namespace(text, '%s-' % stem)
    print('  %-6s %d ids namespaced as "%s-*"' % ('OK', n, stem))

    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(text)
    print('  %-6s %s' % ('->', dst))
    return True


def main():
    args = [a for a in sys.argv[1:]]
    canvas = None
    write = True
    into = None

    if '--check' in args:
        write = False
        args.remove('--check')
    if '--canvas' in args:
        i = args.index('--canvas')
        m = re.match(r'(\d+(?:\.\d+)?)[xX](\d+(?:\.\d+)?)$', args[i + 1])
        if not m:
            sys.exit('--canvas wants WxH, e.g. --canvas 1440x9082')
        canvas = (float(m.group(1)), float(m.group(2)))
        del args[i:i + 2]
    if '--into' in args:
        i = args.index('--into')
        into = args[i + 1]
        del args[i:i + 2]

    if not args:
        print(__doc__)
        sys.exit(1)

    if not write:
        pairs = [(s, None) for s in args]          # nothing is written; --check
    elif into:
        pairs = [(s, os.path.join(into, os.path.basename(s))) for s in args]
    elif len(args) == 2 and not os.path.isdir(args[1]):
        pairs = [(args[0], args[1])]
    else:
        sys.exit('give one source and one destination, or --into <dir>')

    ok = True
    for src, dst in pairs:
        ok = process(src, dst, canvas, write) and ok

    print()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()

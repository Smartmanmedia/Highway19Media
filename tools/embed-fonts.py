#!/usr/bin/env python3
"""Puts his type inside his artwork.

   A band of scenery is an <img>, and an <img> is its own document: it cannot
   see the page's stylesheet or its webfonts, so every run his artboard sets
   in Be Vietnam Pro fell back to a system serif and lost its letter spacing.
   Illustrator writes the PostScript name — font-family="BeVietnamPro-SemiBold,
   'Be Vietnam Pro'" — so each weight is declared under that exact name and
   embedded in the file that uses it. Arial Bold, which his sign plates use,
   is a system font and already resolved.

   Latin subsets only, ~22KB a weight, and only the weights a band actually
   asks for.
"""
import base64, os, re, sys

ROOT  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART   = os.path.join(ROOT, "assets", "art")
FONTS = os.path.join(ROOT, "assets", "fonts")

FACE = {                       # his PostScript name -> the weight it is
    "BeVietnamPro-Light":     300,
    "BeVietnamPro-Regular":   400,
    "BeVietnamPro-Medium":    500,
    "BeVietnamPro-SemiBold":  600,
    "BeVietnamPro-Bold":      700,
    "BeVietnamPro-ExtraBold": 800,
    "BeVietnamPro-Black":     900,
}
HAVE = {300, 500, 600, 800, 900}

_cache = {}
def b64(weight):
    if weight not in _cache:
        with open(os.path.join(FONTS, f"bvp-{weight}.woff2"), "rb") as f:
            _cache[weight] = base64.b64encode(f.read()).decode()
    return _cache[weight]


def embed(path):
    s = open(path, encoding="utf-8").read()
    if "@font-face" in s:
        return 0, 0
    used = sorted({n for n in FACE if n in s})
    if not used:
        return 0, 0
    faces = []
    for name in used:
        w = FACE[name]
        w = w if w in HAVE else min(HAVE, key=lambda h: abs(h - w))
        faces.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%d;"
            "src:url(data:font/woff2;base64,%s) format('woff2')}" % (name, w, b64(w)))
    block = "<style>" + "".join(faces) + "</style>"
    m = re.search(r"<svg\b[^>]*>", s)
    out = s[:m.end()] + block + s[m.end():]
    open(path, "w", encoding="utf-8").write(out)
    return len(used), len(out) - len(s)


if __name__ == "__main__":
    tot = 0
    for f in sorted(os.listdir(ART)):
        if not f.endswith(".svg"):
            continue
        n, grew = embed(os.path.join(ART, f))
        tot += grew
        if n:
            print(f"  {f:26s} {n} weight(s)  +{grew/1024:.0f}KB")
    print(f"embedded, +{tot/1024:.0f}KB total")

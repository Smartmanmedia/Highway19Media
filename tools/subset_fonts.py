#!/usr/bin/env python3
"""Cut his font files down to the characters the page actually sets, and
convert to WOFF2.

His TTFs are ~137 KB each and carry Latin, Vietnamese and a lot else. The page
uses two weights and a couple of hundred characters. Subsetting to the Latin
range and compressing takes each one to a few KB, which matters because these
are embedded in the preview build as data URIs.

The point is not to save bytes for their own sake — self-hosting his own files
means the metrics are exactly the ones his artwork was drawn against, rather
than Google's build of the same family.
"""
import glob, os, sys
from fontTools.subset import main as subset

OUT = 'assets/fonts'
UNI = 'U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026'

os.makedirs(OUT, exist_ok=True)
total_in = total_out = 0
for src in sorted(glob.glob(OUT + '/*.ttf')):
    dst = src[:-4] + '.woff2'
    subset([src, '--unicodes=' + UNI, '--layout-features=*',
            '--flavor=woff2', '--output-file=' + dst])
    a, b = os.path.getsize(src), os.path.getsize(dst)
    total_in += a; total_out += b
    print('  %-34s %6.1f KB -> %5.1f KB' % (os.path.basename(dst), a/1024, b/1024))
print('  %-34s %6.1f KB -> %5.1f KB' % ('total', total_in/1024, total_out/1024))

#!/bin/sh
# The whole page, from his artboards.
set -e
cd "$(dirname "$0")"
export NODE_PATH=/opt/node22/lib/node_modules
export CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
N=/opt/node22/bin/node
$N extract.js            # his cards out, his rasters out, his signs and tiles tagged
$N shadowfix.js          # his Multiply shadows, which his SVG export dropped
python3 answers.py       # his questions, his drawn answers, the rest from the copy
$N animate.js            # his vehicles wrapped and his empty lanes filled
python3 build.py         # faq.html + css

#!/bin/sh
# Everything a new section needs, in order. One argument: the section number.
#
#   sh tools/new_section.sh 02
#
# Expects incoming/v2/section-NN/section-NN.svg to be there already.
set -e
N=$1
D=incoming/v2/section-$N
[ -f "$D/section-$N.svg" ] || { echo "put section-$N.svg in $D first"; exit 1; }

echo "== his export, checked =="
python3 tools/import_art.py --check "$D/section-$N.svg"

echo "== the layout ratio, and where every layer sits =="
node tools/read_section.js "$D/section-$N.svg"

echo "== his copy: bounds, alignment, size, weight, and his scale(k 1) =="
node tools/read_text.js "$D/section-$N.svg"

echo
echo "next: cut the layers you need, then build the page."
echo "  node tools/cut_layers.js $D/section-$N.svg assets/v2/section-$N <Layer> <Layer> ..."
echo "  node tools/check_section.js $N 1400"
